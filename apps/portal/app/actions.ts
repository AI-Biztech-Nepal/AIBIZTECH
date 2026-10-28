'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, getContext } from '@/lib/supabase';
import { safeNext } from '@/lib/safe-next';
import { FIELDS, validateDetails, validatePhoto, type Details } from '@/lib/org-details';

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
  const { data, error } = await supabase.auth.signUp({
    email: str(form, 'email'),
    password: String(form.get('password')),
    options: { emailRedirectTo: `${await origin()}/auth/callback`, data: { full_name: str(form, 'full_name') } },
  });
  if (error) fail('/signup', error.message);
  // Email confirmation on: no session until the link is clicked
  if (!data.session) redirect('/login?message=' + encodeURIComponent('Check your email to confirm your account.'));
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

  // The organization exists by now; a failed photo upload must not lose it, so the owner can add the photo later
  if (file) {
    const path = `${orgId}/pan.${file.type.split('/')[1]}`;
    const { error: uploadError } = await supabase.storage.from('pan-cards').upload(path, file, { contentType: file.type, upsert: true });
    const { error: linkError } = uploadError
      ? { error: uploadError }
      : await supabase.schema('core').from('organizations').update({ pan_photo_path: path }).eq('id', orgId);
    if (linkError) fail('/', 'Your organization was created, but the PAN photo could not be saved. You can add it later.');
  }
  redirect('/');
}

export async function switchOrg(form: FormData) {
  const { supabase, ctx } = await getContext();
  const { error } = await supabase.schema('core').from('profiles')
    .update({ active_org_id: str(form, 'org_id') }).eq('user_id', ctx!.user_id);
  if (error) fail('/', error.message);
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
