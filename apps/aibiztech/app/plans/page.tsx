import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { Shell } from '../shell';
import { PlansView } from './plans-view';

export const metadata: Metadata = { title: 'Subscription & Plans · AIBIZTECH' };

export default async function Plans() {
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (org.org_role === 'member') redirect('/');

  // The same trial rows the My Business page reads
  const core = supabase.schema('core');
  const [{ data: services }, { data: enabled, error }] = await Promise.all([
    core.from('services').select('key, name').eq('is_active', true).order('name'),
    core.from('org_services').select('service_key, status, trial_ends_at, enabled_at').eq('org_id', org.id),
  ]);
  const names = new Map((services ?? []).map((s) => [s.key, s.name]));
  const apps = (enabled ?? []).filter((a) => names.has(a.service_key)).map((a) => ({ ...a, name: names.get(a.service_key)! }));

  return (
    <Shell org={org} orgs={ctx.orgs} page="plans" light>
      <PlansView apps={apps} failed={!!error} contact={process.env.NEXT_PUBLIC_SALES_CONTACT} />
    </Shell>
  );
}
