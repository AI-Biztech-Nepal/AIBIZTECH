import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getContext, type Member } from '@/lib/supabase';
import { updateOrganization } from '../actions';
import { Header } from '../header';
import { Notice, type Search } from '../notice';

const date = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kathmandu' });
const days = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

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
  const members = (rows ?? []) as Member[];
  const active = members.filter((m) => m.status === 'active');
  const disabled = members.length - active.length;
  const count = (r: string) => members.filter((m) => m.org_role === r).length;
  const expiredInvites = (pending ?? []).filter((i) => new Date(i.expires_at) <= new Date()).length;
  const enabledBy = new Map((enabled ?? []).map((s) => [s.service_key, s]));

  // What needs the admin's attention, most urgent first
  const alerts: { text: string; bad?: boolean }[] = [];
  if (org.verification_status === 'pending') alerts.push({ text: 'Your organization is awaiting verification. Services unlock once it is verified.' });
  if (org.verification_status === 'rejected') alerts.push({ text: `Verification was rejected${org.verification_note ? `: ${org.verification_note}` : ''}. Contact support.`, bad: true });
  for (const s of services ?? []) {
    const e = enabledBy.get(s.key);
    if (!e) continue;
    const people = active.filter((m) => m.service_roles[s.key]).length;
    if (e.status === 'trial' && days(e.trial_ends_at) <= 0) alerts.push({ text: `${s.name} trial has ended. Contact us to subscribe and restore access.`, bad: true });
    else if (e.status === 'trial' && days(e.trial_ends_at) <= 3) alerts.push({ text: `${s.name} trial ends in ${plural(days(e.trial_ends_at), 'day')}. Contact us to subscribe.` });
    if (e.status === 'suspended') alerts.push({ text: `${s.name} is suspended.`, bad: true });
    if (!people) alerts.push({ text: `Nobody has a role in ${s.name} yet. Assign roles on the Team page.` });
  }
  if (expiredInvites) alerts.push({ text: `${plural(expiredInvites, 'invitation')} expired without being accepted. Revoke and resend on the Team page.` });
  if (disabled) alerts.push({ text: `${plural(disabled, 'member')} disabled. They cannot sign in to services.` });

  return (
    <main className="wide">
      <Header org={org} page="admin" />
      <h1>Admin</h1>
      <p>Everything about {org.name} in one place.</p>
      <Notice error={error} message={message} />

      <section className="tile">
        <h2>Needs attention</h2>
        {alerts.length ? (
          <ul className="notes">{alerts.map((a, i) => <li key={i} className={a.bad ? 'error' : ''}>{a.text}</li>)}</ul>
        ) : <p>Nothing needs your attention.</p>}
      </section>

      <div className="panels">
        <section className="tile">
          <h2>Organization</h2>
          <dl>
            <dt>Verification</dt><dd className="cap">{org.verification_status}{details?.verified_at ? `, ${date(details.verified_at)}` : ''}</dd>
            <dt>PAN</dt><dd>{details?.pan_no ? `•••••${details.pan_no.slice(-4)}` : '—'}</dd>
            <dt>Owner</dt><dd>{details?.owner_name} · {details?.owner_phone} · {details?.owner_email}</dd>
            <dt>Created</dt><dd>{details ? date(details.created_at) : '—'}</dd>
          </dl>
          <form action={updateOrganization}>
            <input type="hidden" name="org_id" value={org.id} />
            <label>Name<input name="name" defaultValue={details?.name ?? ''} maxLength={120} required /></label>
            <label>Address<input name="address" defaultValue={details?.address ?? ''} maxLength={200} required /></label>
            <label>Phone<input name="phone" type="tel" defaultValue={details?.phone ?? ''} pattern="\+?[0-9][0-9 \-]{6,19}" title="Digits, optionally starting with +" required /></label>
            <label>Email<input name="email" type="email" defaultValue={details?.email ?? ''} required /></label>
            <button>Save details</button>
          </form>
          <p>To change the PAN or the owner's details, contact support. A new PAN restarts verification.</p>
        </section>

        <section className="tile">
          <h2>Team</h2>
          <dl>
            <dt>Members</dt><dd>{members.length} ({count('owner')} owner, {count('admin')} admin, {count('member')} member)</dd>
            <dt>Active</dt><dd>{active.length}{disabled ? `, ${disabled} disabled` : ''}</dd>
            <dt>Pending invitations</dt><dd>{pending?.length ?? 0}{expiredInvites ? ` (${expiredInvites} expired)` : ''}</dd>
          </dl>
          <Link href="/team" className="button">Manage team</Link>
        </section>
      </div>

      <h2 className="spaced">Services</h2>
      <ul className="tiles">
        {services?.map((s) => {
          const e = enabledBy.get(s.key);
          const holders = active.filter((m) => m.service_roles[s.key]);
          return (
            <li key={s.key} className="tile">
              <h2>{s.name}</h2>
              {!e ? <p>Not enabled. Start a free trial from the home page.</p> : (
                <>
                  <p className="cap">{e.status}{e.status === 'trial' ? `, ${days(e.trial_ends_at) > 0 ? plural(days(e.trial_ends_at), 'day') + ' left' : 'ended'}` : ''}</p>
                  <p>Enabled {date(e.enabled_at)}</p>
                  <p>{plural(holders.length, 'person')} with access</p>
                  <ul className="notes">
                    {s.roles.map((r: string) => <li key={r}><span className="cap">{r.replace(/_/g, ' ')}</span>: {holders.filter((m) => m.service_roles[s.key] === r).length}</li>)}
                  </ul>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
