import { notFound } from 'next/navigation';
import { PortalFrame } from '../../portal-frame';
import { TrialEndedView } from '../../trial-ended-view';
import { APPS, ORG, sampleRows } from '../preview-sample';

// Look at the trial ended screen on your own computer without signing in. Made-up dates, nothing is read or saved,
// and the page does not exist on the live site. Add ?role=member to see what a team member sees.
export default async function TrialEndedPreview({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { role } = await searchParams;
  const member = role === 'member';
  // As on the real page: once the trial is over, no app is open
  const org = { ...ORG, org_role: member ? ('member' as const) : ORG.org_role, services: {} };
  return (
    <PortalFrame preview light org={org} orgs={[org]} services={APPS} person={member ? 'Sample Member' : 'Sample Owner'} email="owner@example.com" page="home">
      <TrialEndedView orgName={org.name} ended={new Date(sampleRows('ended', new Date())[0].trial_ends_at)} isAdmin={!member} contact={process.env.NEXT_PUBLIC_SALES_CONTACT} note="Preview with made-up trial dates." />
    </PortalFrame>
  );
}
