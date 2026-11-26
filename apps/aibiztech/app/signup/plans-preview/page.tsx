import { notFound } from 'next/navigation';
import type { Org } from '@/lib/supabase';
import { PlansView } from '../../plans/plans-view';
import { PortalFrame } from '../../portal-frame';

// Look at the plans page on your own computer without signing in. Made-up trial dates, nothing is read or saved,
// and the page does not exist on the live site. Add ?state=ended, ?state=active or ?state=new to see the others.
const APPS = [['attendance', 'HRIS'], ['finance', 'Finance'], ['marketing', 'Marketing'], ['stock', 'Stock Manager']].map(([key, name]) => ({ key, name, base_url: `/${key}` }));
const ORG: Org = { id: 'preview', name: 'Sample Motors', org_role: 'owner', verification_status: 'verified', verification_note: null, services: { attendance: 'admin', finance: 'admin', marketing: 'admin', stock: 'admin' } };

export default async function PlansPreview({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { state } = await searchParams;
  const now = new Date();
  const at = (days: number) => new Date(now.getTime() + days * 864e5).toISOString();
  const [startedAgo, endsIn] = state === 'ended' ? [9, -2] : [2, 5];
  const apps = state === 'new' ? [] : APPS.map((a) => ({ service_key: a.key, name: a.name, status: state === 'active' ? 'active' : 'trial', enabled_at: at(-startedAgo), trial_ends_at: at(endsIn) }));

  return (
    <PortalFrame preview light org={ORG} orgs={[ORG]} services={APPS} person="Sample Owner" email="owner@example.com" page="plans">
      <PlansView apps={apps} now={now} contact={process.env.NEXT_PUBLIC_SALES_CONTACT} note="Preview with made-up trial dates." />
    </PortalFrame>
  );
}
