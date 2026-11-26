import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getContext, type Member } from '@/lib/supabase';
import type { Search } from '../notice';
import { Shell } from '../shell';
import { BusinessView } from './business-view';

export const metadata: Metadata = { title: 'My Business · AIBIZTECH' };

export default async function Admin({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (org.org_role === 'member') redirect('/');

  const core = supabase.schema('core');
  const [{ data: details }, { data: rows }, { data: services }, { data: enabled }, { data: pending }] = await Promise.all([
    core.from('organizations').select('name, address, phone, email, owner_name, owner_phone, owner_email, pan_no, created_at, verified_at').eq('id', org.id).single(),
    core.rpc('org_members', { p_org: org.id }),
    core.from('services').select('key, name, roles').eq('is_active', true).order('name'),
    core.from('org_services').select('service_key, status, trial_ends_at, enabled_at').eq('org_id', org.id),
    core.from('invitations').select('id, email, org_role, expires_at').eq('org_id', org.id).is('accepted_at', null),
  ]);

  return (
    <Shell org={org} orgs={ctx.orgs} page="admin" light>
      <BusinessView org={org} details={details} members={(rows ?? []) as Member[]} services={services ?? []} enabled={enabled ?? []} pending={pending ?? []} error={error} message={message} />
    </Shell>
  );
}
