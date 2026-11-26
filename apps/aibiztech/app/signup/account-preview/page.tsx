import { notFound } from 'next/navigation';
import type { Member } from '@/lib/supabase';
import { BusinessView } from '../../admin/business-view';
import { AppsView } from '../../apps/apps-view';
import { PortalFrame, type Page } from '../../portal-frame';
import { SettingsView } from '../../profile/settings-view';
import { TeamView } from '../../team/team-view';
import { APPS, ORG, sampleRows } from '../preview-sample';

const PAGES: Record<string, Page> = { business: 'admin', team: 'team', apps: 'apps', settings: 'profile' };
const NOTE = 'Preview with made-up people and details. Buttons do nothing here.';

// Look at My Business, Team Members, Add apps and Settings on your own computer without signing in. Nothing is read
// or saved, and the page does not exist on the live site. Choose with ?page=business, team, apps or settings.
export default async function AccountPreview({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { page = '' } = await searchParams;
  const shown = page in PAGES ? page : 'business';
  const now = new Date();
  const at = (days: number) => new Date(now.getTime() + days * 864e5).toISOString();

  const services = APPS.map((a) => ({ key: a.key, name: a.name, roles: ['admin', 'viewer'] }));
  const person = (user_id: string, full_name: string, org_role: Member['org_role'], status: Member['status'], service_roles: Record<string, string>): Member =>
    ({ user_id, full_name, email: `${user_id}@example.com`, org_role, status, joined_at: at(-40), service_roles });
  const members = [
    person('owner', 'Sample Owner', 'owner', 'active', ORG.services),
    person('manager', 'Sample Manager', 'admin', 'active', { finance: 'admin', stock: 'viewer' }),
    person('staff', 'Sample Staff', 'member', 'disabled', { attendance: 'viewer' }),
  ];
  const pending = [['new.person@example.com', 5], ['late.person@example.com', -2]].map(([email, days], i) => ({ id: `invite-${i}`, email: String(email), org_role: 'member', expires_at: at(Number(days)), link: `https://example.com/invite/sample-${i}` }));
  // Marketing's trial is over and Stock was never added, so Add apps shows each kind of row
  const rows = sampleRows(undefined, now).filter((r) => r.service_key !== 'stock').map((r) => (r.service_key === 'marketing' ? { ...r, trial_ends_at: at(-1) } : r));
  const mine = { attendance: 'admin', finance: 'admin' };

  return (
    <PortalFrame preview light org={ORG} orgs={[ORG]} services={APPS} person="Sample Owner" email="owner@example.com" page={PAGES[shown]}>
      {shown === 'business' && (
        <BusinessView preview now={now} message={NOTE} org={ORG} members={members} services={services} pending={pending}
          enabled={sampleRows(undefined, now).map((r) => (r.service_key === 'marketing' ? { ...r, trial_ends_at: at(-1) } : r))}
          details={{ name: ORG.name, address: 'Sample Road, Kathmandu', phone: '9800000000', email: 'office@example.com', owner_name: 'Sample Owner', owner_phone: '9800000001', owner_email: 'owner@example.com', pan_no: '000000000', created_at: at(-60), verified_at: at(-59) }} />
      )}
      {shown === 'team' && <TeamView preview now={now} message={NOTE} org={ORG} userId="owner" members={members} offered={services} pending={pending} />}
      {shown === 'apps' && <AppsView preview now={now} message={NOTE} orgName={ORG.name} access={mine} services={APPS} rows={rows} />}
      {shown === 'settings' && <SettingsView preview message={NOTE} name="Sample Owner" email="owner@example.com" phone="9800000001" org={ORG} services={APPS} />}
    </PortalFrame>
  );
}
