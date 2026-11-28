import type { Metadata } from 'next';
import { businessKind } from '@/lib/business-kind-load';
import type { Search } from '../notice';
import { createClient } from '@/lib/supabase';
import { loadSubscription } from '../plans/load';
import { Shell } from '../shell';
import { AppsView } from './apps-view';

export const metadata: Metadata = { title: 'Add apps · AIBIZTECH' };

export default async function Apps({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { ctx, org, apps, services, failed } = await loadSubscription();
  const kind = await businessKind(await createClient(), org.id);
  return (
    <Shell org={org} orgs={ctx.orgs} page="apps" light>
      <AppsView orgName={org.name} access={org.services} services={services} kind={kind} rows={apps} failed={failed} error={error} message={message} />
    </Shell>
  );
}
