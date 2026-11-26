import { redirect } from 'next/navigation';
import type { Access } from '@/lib/plans';
import { getContext } from '@/lib/supabase';

export type AppRow = Access & { service_key: string; name: string; plan?: string | null };

// For the plans and billing pages: owners and admins only, with each app's trial or subscription row
// (the same rows the My Business page reads)
export async function loadSubscription() {
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (org.org_role === 'member') redirect('/');

  const core = supabase.schema('core');
  const [{ data: services }, { data: enabled, error }] = await Promise.all([
    core.from('services').select('key, name').eq('is_active', true).order('name'),
    core.from('org_services').select('service_key, status, plan, trial_ends_at, enabled_at').eq('org_id', org.id),
  ]);
  const names = new Map((services ?? []).map((s) => [s.key, s.name]));
  const apps: AppRow[] = (enabled ?? []).filter((a) => names.has(a.service_key)).map((a) => ({ ...a, name: names.get(a.service_key)! }));

  return { ctx, org, apps, failed: !!error };
}
