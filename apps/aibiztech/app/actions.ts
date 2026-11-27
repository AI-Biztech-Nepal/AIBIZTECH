'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, getContext } from '@/lib/supabase';
import { safeNext } from '@/lib/safe-next';
import { EMAIL, FIELDS, PHONE, validateDetails, validatePhoto, type Details } from '@/lib/org-details';
import { TRIAL_DAYS, validateSignup, type SignupState, type SignupValues } from '@/lib/signup';
import { signInProblem, type SignInState } from '@/lib/signin';
import { isBusinessType } from '@/lib/business-kind';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);

async function origin() {
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
}

// Problems are returned, so the email stays typed and the ?next= address is not lost after a wrong password
export async function signIn(_: SignInState, form: FormData): Promise<SignInState> {
  const email = str(form, 'email');
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: signInProblem(error) };
  redirect(safeNext(str(form, 'next')));
}

// Problems are returned, not redirected to, so the form keeps what the person typed
export async function signUp(_: SignupState, form: FormData): Promise<SignupState> {
  const next = safeNext(str(form, 'next')); // an invitation link survives sign-up
  const v: SignupValues = {
    full_name: str(form, 'full_name'), business_name: str(form, 'business_name'), email: str(form, 'email'), phone: str(form, 'phone'),
    password: String(form.get('password') ?? ''), confirm_password: String(form.get('confirm_password') ?? ''),
  };
  const problem = Object.values(validateSignup(v, next.startsWith('/invite/')))[0];
  if (problem) return { error: problem };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    // business_name prefills the setup wizard
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`, data: { full_name: v.full_name, business_name: v.business_name, phone: v.phone } },
  });
  if (error) return { error: error.message };
  // Email confirmation on: no session until the link is clicked
  if (!data.session) redirect('/login?message=' + encodeURIComponent('Check your email to confirm your account.'));
  redirect(next);
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
  if (String(form.get('password')) !== String(form.get('confirm_password'))) fail('/reset-password', 'Passwords do not match.');
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: String(form.get('password')) });
  if (error) fail('/reset-password', error.message);
  redirect('/');
}

// Starts the chosen apps (on a free trial) for a business and makes the person admin in each
async function enableApps(supabase: Awaited<ReturnType<typeof createClient>>, org_id: string, user_id: string, keys: string[]) {
  const core = supabase.schema('core');
  const { data: valid } = await core.from('services').select('key').eq('is_active', true).in('key', keys);
  const chosen = (valid ?? []).map((s) => s.key);
  if (!chosen.length) return null;
  const { data: have } = await core.from('org_services').select('service_key').eq('org_id', org_id);
  const started = new Set((have ?? []).map((s) => s.service_key));
  const fresh = chosen.filter((k) => !started.has(k));
  if (fresh.length) {
    const { error } = await core.from('org_services').insert(fresh.map((service_key) => ({ org_id, service_key })));
    if (error) return error.message;
  }
  const { error } = await core.from('service_roles').upsert(chosen.map((service_key) => ({ org_id, user_id, service_key, role: 'admin' })), { onConflict: 'org_id,user_id,service_key', ignoreDuplicates: true });
  return error?.message ?? null;
}

// Tick more apps later (Apps page)
export async function addApps(form: FormData) {
  const { supabase, ctx } = await getContext();
  const org = ctx?.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx?.orgs[0];
  if (!ctx || !org || org.org_role === 'member') fail('/', 'Only owners and admins can add apps.');
  const keys = form.getAll('apps').map(String);
  if (!keys.length) fail('/apps', 'Tick at least one app.');
  const problem = await enableApps(supabase, org!.id, ctx!.user_id, keys);
  if (problem) fail('/apps', problem);
  revalidatePath('/', 'layout');
  redirect('/?message=' + encodeURIComponent(`Apps added. Your ${TRIAL_DAYS}-day trial has started.`));
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

  // The kind of business picks its stock and finance screens; it can be changed later in My Business
  const type = str(form, 'business_type');
  if (isBusinessType(type)) {
    const { error: typeError } = await supabase.schema('core').from('organizations').update({ business_type: type }).eq('id', orgId);
    if (typeError) console.error('Could not save the kind of business:', typeError.message);
  }

  // The organization exists by now; a failed photo upload must not lose it, so the owner can add the photo later
  if (file) {
    const path = `${orgId}/pan.${file.type.split('/')[1]}`;
    const { error: uploadError } = await supabase.storage.from('pan-cards').upload(path, file, { contentType: file.type, upsert: true });
    const { error: linkError } = uploadError
      ? { error: uploadError }
      : await supabase.schema('core').from('organizations').update({ pan_photo_path: path }).eq('id', orgId);
    if (linkError) fail('/', 'Your organization was created, but the PAN photo could not be saved. You can add it later.');
  }
  const keys = form.getAll('apps').map(String);
  const { data: me } = await supabase.auth.getUser();
  const appsProblem = keys.length && me.user ? await enableApps(supabase, String(orgId), me.user.id, keys) : null;
  if (appsProblem) fail('/', `Your organization was created, but the apps could not be started: ${appsProblem}. Add them from the Apps page.`);
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function updateProfile(form: FormData) {
  const { supabase, ctx } = await getContext();
  const full_name = str(form, 'full_name');
  const phone = str(form, 'phone');
  if (!full_name) fail('/profile', 'Enter your name.');
  if (phone && !PHONE.test(phone)) fail('/profile', 'Enter a valid phone number (digits, optional + and dashes).');
  const { error } = await supabase.schema('core').from('profiles')
    .update({ full_name, phone: phone || null }).eq('user_id', ctx!.user_id);
  if (error) fail('/profile', error.message);
  redirect('/profile?message=' + encodeURIComponent('Profile saved.'));
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
  revalidatePath('/');
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

export async function setBusinessType(form: FormData) {
  const { supabase, ctx } = await getContext();
  const id = str(form, 'org_id');
  const type = str(form, 'business_type');
  const org = ctx?.orgs.find((o) => o.id === id);
  if (!org || org.org_role === 'member') fail('/', 'Only owners and admins can set the kind of business.');
  if (!isBusinessType(type)) fail('/business-type', 'Choose your kind of business.');
  const { error } = await supabase.schema('core').from('organizations').update({ business_type: type }).eq('id', id);
  if (error) fail('/business-type', error.message);
  revalidatePath('/', 'layout');
  redirect('/');
}

// Admins edit contact details. PAN and the owner's details are not here: changing the PAN restarts verification.
export async function updateOrganization(form: FormData) {
  const { supabase, ctx } = await getContext();
  const id = str(form, 'org_id');
  if (ctx!.orgs.find((o) => o.id === id)?.org_role === 'member') fail('/admin', 'Only owners and admins can edit the organization.');
  const type = str(form, 'business_type');
  const v = { name: str(form, 'name'), address: str(form, 'address'), phone: str(form, 'phone'), email: str(form, 'email'), ...(isBusinessType(type) ? { business_type: type } : {}) };
  if (!v.name || !v.address) fail('/admin', 'Name and address are required.');
  if (!PHONE.test(v.phone)) fail('/admin', 'Enter a valid phone number (digits, optional + and dashes).');
  if (!EMAIL.test(v.email)) fail('/admin', 'Enter a valid email address.');
  const { error } = await supabase.schema('core').from('organizations').update(v).eq('id', id);
  if (error) fail('/admin', error.message);
  revalidatePath('/', 'layout');
  redirect('/admin?message=' + encodeURIComponent('Organization details saved.'));
}

// Owners can run several businesses; this picks the one the dashboard, Admin and Team pages work on
export async function switchOrg(form: FormData) {
  const { supabase, ctx } = await getContext();
  const org_id = str(form, 'org_id');
  if (!ctx || !ctx.orgs.some((o) => o.id === org_id)) fail('/', 'You are not a member of that organization.');
  const { error } = await supabase.schema('core').from('profiles').update({ active_org_id: org_id }).eq('user_id', ctx!.user_id);
  if (error) fail('/', error.message);
  revalidatePath('/', 'layout');
  redirect('/');
}
