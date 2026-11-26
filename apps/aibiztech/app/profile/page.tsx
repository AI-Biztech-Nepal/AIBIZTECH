import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import type { Search } from '../notice';
import { Shell } from '../shell';
import { SettingsView } from './settings-view';

export const metadata: Metadata = { title: 'Settings · AIBIZTECH' };

// Your account: who you are in this business and your role in each app, with a form to change your name and phone
export default async function Profile({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0] ?? null;
  const [{ data: profile }, { data: claims }, { data: services }] = await Promise.all([
    supabase.schema('core').from('profiles').select('phone').eq('user_id', ctx.user_id).maybeSingle(),
    supabase.auth.getClaims(),
    supabase.schema('core').from('services').select('key, name').eq('is_active', true).order('name'),
  ]);
  return (
    <Shell org={org} orgs={ctx.orgs} page="profile" light>
      <SettingsView name={ctx.full_name ?? ''} email={claims?.claims.email ?? ''} phone={profile?.phone ?? ''} org={org} services={services ?? []} error={error} message={message} />
    </Shell>
  );
}
