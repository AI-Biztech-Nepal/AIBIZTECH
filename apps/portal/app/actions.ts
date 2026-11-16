'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, getContext } from '@/lib/supabase';
import { safeNext } from '@/lib/safe-next';
import { parseProfile } from '@/lib/recommend';
import { EMAIL, FIELDS, PHONE, validateDetails, validatePhoto, type Details } from '@/lib/org-details';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);

async function origin() {
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
}

export async function signIn(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(form, 'email'), password: String(form.get('password')) });
  if (error) fail('/login', error.message);
  redirect(safeNext(str(form, 'next')));
}

export async function signUp(form: FormData) {
  const supabase = await createClient();
  const next = safeNext(str(form, 'next')); // an invitation link survives sign-up
  const { data, error } = await supabase.auth.signUp({
    email: str(form, 'email'),
    password: String(form.get('password')),
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`, data: { full_name: str(form, 'full_name') } },
  });
  if (error) fail('/signup', error.message);
  // Email confirmation on: no session until the link is clicked
  if (!data.session) redirect('/login?message=' + encodeURIComponent('Check your email to confirm your account.'));
  redirect(next);
}

// The database only lets a person pick an org they belong to (core.profiles_update)
export async function switchOrganization(form: FormData) {
  const { supabase, ctx } = await getContext();
  if (ctx) await supabase.schema('core').from('profiles').update({ active_org_id: str(form, 'org') }).eq('user_id', ctx.user_id);
  redirect('/');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function forgotPassword(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(str(form, 'email'), {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  if (error) fail('/forgot-password', error.message);
  redirect('/login?message=' + encodeURIComponent('If that email has an account, a reset link is on its way.'));
}

export async function resetPassword(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: String(form.get('password')) });
  if (error) fail('/reset-password', error.message);
  redirect('/');
}

export async function createOrganization(form: FormData) {
  const v = Object.fromEntries(FIELDS.map((f) => [f, str(form, f)])) as Details;
  const problem = validateDetails(v);
  if (problem) fail('/onboarding', problem);
  const photo = form.get('pan_photo');
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  const photoProblem = file && validatePhoto(file);
  if (photoProblem) fail('/onboarding', photoProblem);

  const slug = v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';
  const supabase = await createClient();
  const { data: orgId, error } = await supabase.schema('core').rpc('create_organization', {
    p_name: v.name, p_slug: slug, p_address: v.address, p_phone: v.phone, p_email: v.email, p_pan_no: v.pan_no,
    p_owner_name: v.owner_name, p_owner_address: v.owner_address, p_owner_phone: v.owner_phone, p_owner_email: v.owner_email,
  });
  if (error) {
    if (error.code !== '23505') fail('/onboarding', error.message);
    fail('/onboarding', error.message.includes('pan_no') ? 'An organization with this PAN is already registered.' : 'That name is already taken. Try another.');
  }

  // The organization exists by now; a failed extra step must not lose it, so the owner is told and carries on
  let soft = '';
  const { error: profileError } = await supabase.schema('core').from('organizations').update(parseProfile(form)).eq('id', orgId);
  if (profileError) soft = 'Your organization was created, but your business answers could not be saved.';
  if (file) {
    const path = `${orgId}/pan.${file.type.split('/')[1]}`;
    const { error: uploadError } = await supabase.storage.from('pan-cards').upload(path, file, { contentType: file.type, upsert: true });
    const { error: linkError } = uploadError
      ? { error: uploadError }
      : await supabase.schema('core').from('organizations').update({ pan_photo_path: path }).eq('id', orgId);
    if (linkError) soft = 'Your organization was created, but the PAN photo could not be saved. You can add it later.';
  }
  if (soft) fail('/', soft);
  redirect('/');
}

export async function updateProfile(form: FormData) {
  const { supabase, ctx } = await getContext();
  const full_name = str(form, 'full_name');
  const phone = str(form, 'phone');
  if (!full_name) fail('/settings', 'Enter your name.');
  if (phone && !PHONE.test(phone)) fail('/settings', 'Enter a valid phone number (digits, optional + and dashes).');
  const { error } = await supabase.schema('core').from('profiles')
    .update({ full_name, phone: phone || null }).eq('user_id', ctx!.user_id);
  if (error) fail('/settings', error.message);
  redirect('/settings?message=' + encodeURIComponent('Profile saved.'));
}

export async function markNotificationsRead(form: FormData) {
  const { supabase, ctx } = await getContext();
  const core = supabase.schema('core');
  const [{ data: all }, { data: read }] = await Promise.all([
    core.from('notifications').select('id').eq('org_id', str(form, 'org_id')),
    core.from('notification_reads').select('notification_id'),
  ]);
  const seen = new Set((read ?? []).map((r) => r.notification_id));
  const rows = (all ?? []).filter((n) => !seen.has(n.id)).map((n) => ({ notification_id: n.id, user_id: ctx!.user_id }));
  if (rows.length) {
    const { error } = await core.from('notification_reads').insert(rows);
    if (error) fail('/', error.message);
  }
  revalidatePath('/', 'layout');
}

// Owner/admin starts a trial and becomes the service's admin; RLS enforces who may do this
export async function startTrial(form: FormData) {
  const { supabase, ctx } = await getContext();
  const org_id = str(form, 'org_id');
  if (ctx!.orgs.find((o) => o.id === org_id)?.verification_status !== 'verified') fail('/', 'Your organization must be verified before you can start a service.');
  const service_key = str(form, 'service_key');
  const core = supabase.schema('core');
  if (!str(form, 'enabled')) {
    const { error } = await core.from('org_services').insert({ org_id, service_key });
    if (error) fail('/', error.message);
  }
  const { error: roleError } = await core.from('service_roles').insert({ org_id, user_id: ctx!.user_id, service_key, role: 'admin' });
  if (roleError) fail('/', roleError.message);
  revalidatePath('/');
}

// Owner/admin edits one member: org role, active state and a role per service. RLS and triggers enforce who may do what.
export async function saveMember(form: FormData) {
  const { supabase, ctx } = await getContext();
  const core = supabase.schema('core');
  const org_id = str(form, 'org_id');
  const user_id = str(form, 'user_id');

  // Your own org role and active state are not editable here, so you cannot lock yourself out
  if (form.get('manage') && user_id !== ctx!.user_id) {
    const org_role = str(form, 'org_role');
    const patch = { status: form.get('active') ? 'active' : 'disabled', ...(org_role === 'admin' || org_role === 'member' ? { org_role } : {}) };
    const { data, error } = await core.from('memberships').update(patch).eq('org_id', org_id).eq('user_id', user_id).select('user_id');
    if (error) fail('/team', error.message);
    if (!data?.length) fail('/team', 'You are not allowed to change this member.');
  }

  for (const [name, value] of form.entries()) {
    if (!name.startsWith('role_')) continue;
    const service_key = name.slice(5);
    const role = String(value);
    const { error } = role
      ? await core.from('service_roles').upsert({ org_id, user_id, service_key, role })
      : await core.from('service_roles').delete().eq('org_id', org_id).eq('user_id', user_id).eq('service_key', service_key);
    if (error) fail('/team', error.message);
  }
  revalidatePath('/');
  redirect('/team?message=' + encodeURIComponent('Saved.'));
}

// Owner/admin invites someone by email; the result is a link to hand over (email delivery comes later)
export async function createInvite(form: FormData) {
  const { supabase } = await getContext();
  const service_roles: Record<string, string> = {};
  for (const [name, value] of form.entries()) {
    if (name.startsWith('role_') && value) service_roles[name.slice(5)] = String(value);
  }
  const { data, error } = await supabase.schema('core').rpc('create_invitation', {
    p_org: str(form, 'org_id'), p_email: str(form, 'email'), p_org_role: str(form, 'org_role'), p_service_roles: service_roles,
  });
  if (error) fail('/team', error.message);
  redirect('/team?invite=' + data);
}

export async function revokeInvite(form: FormData) {
  const { supabase } = await getContext();
  const { error } = await supabase.schema('core').from('invitations').delete().eq('id', str(form, 'id'));
  if (error) fail('/team', error.message);
  redirect('/team?message=' + encodeURIComponent('Invitation revoked.'));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function acceptInvitation(form: FormData) {
  const id = str(form, 'id');
  if (!UUID.test(id)) fail('/', 'That invitation link is not valid.');
  const { supabase } = await getContext();
  const { error } = await supabase.schema('core').rpc('accept_invitation', { p_id: id });
  if (error) fail(`/invite/${id}`, error.message);
  redirect('/');
}

// Admins edit contact details. PAN and the owner's details are not here: changing the PAN restarts verification.
export async function updateOrganization(form: FormData) {
  const { supabase, ctx } = await getContext();
  const id = str(form, 'org_id');
  if (ctx!.orgs.find((o) => o.id === id)?.org_role === 'member') fail('/settings', 'Only owners and admins can edit the organization.');
  const v = { name: str(form, 'name'), address: str(form, 'address'), phone: str(form, 'phone'), email: str(form, 'email') };
  if (!v.name || !v.address) fail('/settings', 'Name and address are required.');
  if (!PHONE.test(v.phone)) fail('/settings', 'Enter a valid phone number (digits, optional + and dashes).');
  if (!EMAIL.test(v.email)) fail('/settings', 'Enter a valid email address.');
  const { error } = await supabase.schema('core').from('organizations').update(v).eq('id', id);
  if (error) fail('/settings', error.message);
  revalidatePath('/', 'layout');
  redirect('/settings?message=' + encodeURIComponent('Organization details saved.'));
}

// Owners and admins do not switch features: they ask, and platform staff approve (see core.request_features).
// The form lists every feature with a tick for "I want this on"; the difference from today's state is the request.
export async function requestFeatures(form: FormData) {
  const { supabase, ctx } = await getContext();
  const org = str(form, 'org_id');
  if (ctx!.orgs.find((o) => o.id === org)?.org_role === 'member') fail('/settings', 'Only owners and admins can ask for features.');
  const core = supabase.schema('core');
  const { data: current } = await core.rpc('org_features', { p_org: org });
  const want = new Set(form.getAll('want').map(String));
  const now = new Set(((current ?? []) as { feature_key: string; enabled: boolean }[]).filter((f) => f.enabled).map((f) => f.feature_key));
  const known = ((current ?? []) as { feature_key: string }[]).map((f) => f.feature_key);
  const on = known.filter((k) => want.has(k) && !now.has(k));
  const off = known.filter((k) => !want.has(k) && now.has(k));
  if (!on.length && !off.length) fail('/settings', 'You have not changed anything.');
  const { error } = await core.rpc('request_features', { p_org: org, p_on: on, p_off: off, p_note: str(form, 'note') || null });
  if (error) fail('/settings', error.message);
  redirect('/settings?message=' + encodeURIComponent('Request sent. We will review it and set your features up.'));
}

export async function cancelFeatureRequest(form: FormData) {
  const { supabase } = await getContext();
  const { error } = await supabase.schema('core').rpc('cancel_feature_request', { p_id: Number(str(form, 'id')) });
  if (error) fail('/settings', error.message);
  redirect('/settings?message=' + encodeURIComponent('Request cancelled.'));
}
