import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getContext, type Member } from '@/lib/supabase';
import type { Search } from '../notice';
import { Shell } from '../shell';
import { TeamView } from './team-view';

export const metadata: Metadata = { title: 'Team Members · AIBIZTECH' };

export default async function Team({ searchParams }: { searchParams: Search }) {
  const { error, message, invite } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  if (org.org_role === 'member') redirect('/');

  const core = supabase.schema('core');
  const [{ data: rows }, { data: services }, { data: enabled }, { data: pending }] = await Promise.all([
    core.rpc('org_members', { p_org: org.id }),
    core.from('services').select('key, name, roles').eq('is_active', true).order('name'),
    core.from('org_services').select('service_key').eq('org_id', org.id),
    core.from('invitations').select('id, email, org_role, expires_at').eq('org_id', org.id).is('accepted_at', null).order('expires_at'),
  ]);
  const h = await headers();
  const linkFor = (id: string) => `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}/invite/${id}`;
  const enabledKeys = new Set((enabled ?? []).map((s) => s.service_key));

  return (
    <Shell org={org} orgs={ctx.orgs} page="team" light>
      <TeamView
        org={org}
        userId={ctx.user_id}
        members={rows as Member[] | null}
        offered={(services ?? []).filter((s) => enabledKeys.has(s.key))}
        pending={(pending ?? []).map((i) => ({ ...i, link: linkFor(i.id) }))}
        created={invite ? linkFor(invite) : undefined}
        error={error}
        message={message}
      />
    </Shell>
  );
}
