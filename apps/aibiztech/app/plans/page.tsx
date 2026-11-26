import type { Metadata } from 'next';
import { Shell } from '../shell';
import { loadSubscription } from './load';
import { PlansView } from './plans-view';

export const metadata: Metadata = { title: 'Subscription & Plans · AIBIZTECH' };

export default async function Plans() {
  const { ctx, org, apps, failed } = await loadSubscription();
  return (
    <Shell org={org} orgs={ctx.orgs} page="plans" light>
      <PlansView apps={apps} failed={failed} contact={process.env.NEXT_PUBLIC_SALES_CONTACT} />
    </Shell>
  );
}
