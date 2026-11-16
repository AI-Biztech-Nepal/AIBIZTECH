'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const back = (org: string, key: 'message' | 'error', text: string): never => redirect(`/platform/orgs/${org}?${key}=${encodeURIComponent(text)}`);

// The database functions check that the caller is platform staff, so these actions need no check of their own
export async function reviewOrg(form: FormData) {
  const org = str(form, 'org_id');
  const status = str(form, 'status');
  const { error } = await (await createClient()).schema('core').rpc('platform_review_org', { p_org: org, p_status: status, p_note: str(form, 'note') || null });
  if (error) back(org, 'error', error.message);
  revalidatePath('/platform', 'layout');
  back(org, 'message', status === 'verified' ? 'Organization approved.' : status === 'rejected' ? 'Organization rejected.' : 'Review reopened.');
}

export async function setService(form: FormData) {
  const org = str(form, 'org_id');
  const { error } = await (await createClient()).schema('core').rpc('platform_set_service', {
    p_org: org, p_service: str(form, 'service_key'), p_status: str(form, 'status') || null, p_extend_days: Number(str(form, 'extend')) || 0,
  });
  if (error) back(org, 'error', error.message);
  revalidatePath('/platform', 'layout');
  back(org, 'message', 'Subscription updated.');
}

export async function setFeature(form: FormData) {
  const org = str(form, 'org_id');
  const { error } = await (await createClient()).schema('core').rpc('set_feature', {
    p_org: org, p_feature: str(form, 'feature'), p_enabled: str(form, 'enabled') === 'true', p_reason: str(form, 'reason'),
  });
  if (error) back(org, 'error', error.message);
  revalidatePath('/platform', 'layout');
  back(org, 'message', 'Feature updated.');
}
