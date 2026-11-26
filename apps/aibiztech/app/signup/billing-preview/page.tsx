import { notFound } from 'next/navigation';
import { BillingView } from '../../billing/billing-view';
import { PortalFrame } from '../../portal-frame';
import { APPS, ORG, sampleRows } from '../preview-sample';

// Look at the billing page on your own computer without signing in. Made-up trial dates, nothing is read or saved,
// and the page does not exist on the live site. Add ?state=ended, ?state=active or ?state=new to see the others.
export default async function BillingPreview({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { state } = await searchParams;
  const now = new Date();
  return (
    <PortalFrame preview light org={ORG} orgs={[ORG]} services={APPS} person="Sample Owner" email="owner@example.com" page="billing">
      <BillingView apps={sampleRows(state, now)} now={now} note="Preview with made-up trial dates." />
    </PortalFrame>
  );
}
