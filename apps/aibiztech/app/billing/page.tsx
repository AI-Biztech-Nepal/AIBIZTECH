import type { Metadata } from 'next';
import { loadSubscription } from '../plans/load';
import { Shell } from '../shell';
import { BillingView } from './billing-view';

export const metadata: Metadata = { title: 'Billing · AIBIZTECH' };

export default async function Billing() {
  const { ctx, org, apps, failed } = await loadSubscription();
  return (
    <Shell org={org} orgs={ctx.orgs} page="billing" light>
      <BillingView apps={apps} failed={failed} />
    </Shell>
  );
}
