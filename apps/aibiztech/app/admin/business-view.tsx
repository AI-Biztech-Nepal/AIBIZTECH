import 'lenis/dist/lenis.css';
import Link from 'next/link';
import { ReactLenis } from 'lenis/react';
import { businessAlerts, plural, roleName, type Enabled, type Invite } from '@/lib/business';
import { appStatus, nepalDate } from '@/lib/plans';
import type { Member, Org } from '@/lib/supabase';
import a from '../account.module.css';
import { updateOrganization } from '../actions';
import { Notices } from '../dashboard-view';
import page from '../dashboard.module.css';
import s from '../plans/plans.module.css';
import { BUSINESS_TYPES } from '@/lib/business-kind';

export type Details = { name: string; address: string | null; phone: string | null; email: string | null; owner_name: string | null; owner_phone: string | null; owner_email: string | null; pan_no: string | null; created_at: string; verified_at: string | null };
type Service = { key: string; name: string; roles: string[] };

type Props = {
  org: Org;
  details: Details | null;
  members: Member[];
  services: Service[];
  enabled: Enabled[];
  pending: Invite[];
  error?: string;
  message?: string;
  preview?: boolean; // look only: nothing is saved
  now?: Date;
};

const TONES = { good: s.on, warn: s.over, bad: s.over };

export function BusinessView({ org, details, members, services, enabled, pending, error, message, preview = false, now = new Date() }: Props) {
  const active = members.filter((m) => m.status === 'active');
  const disabled = members.length - active.length;
  const count = (role: string) => members.filter((m) => m.org_role === role).length;
  const expired = pending.filter((i) => new Date(i.expires_at) <= now).length;
  const status = org.verification_status;
  const alerts = businessAlerts({ verification: { status, note: org.verification_note }, services, enabled, members, pending }, now);
  const owner = [details?.owner_name, details?.owner_phone, details?.owner_email].filter(Boolean).join(' · ');

  return (
    <div className={`${page.page} ${a.page}`}>
      <ReactLenis root options={{ anchors: true }} />
      <div className={page.head}>
        <div>
          <h1>My Business</h1>
          <p className={page.sub}>{org.name}</p>
        </div>
        <span className={`${s.tag} ${status === 'verified' ? s.on : s.over}`}>{status === 'verified' ? 'Verified' : status === 'rejected' ? 'Rejected' : 'Awaiting verification'}</span>
      </div>

      <Notices error={error ?? (details ? undefined : 'Your business details could not be loaded. Reload the page to try again.')} message={message} />

      <section className={page.panel}>
        <h2>Needs your attention</h2>
        {!alerts.length ? <p className={page.empty}>Nothing needs your attention.</p> : (
          <ul className={`${page.list} ${page.tasks}`}>
            {alerts.map((t) => (
              <li key={t.text}>
                <span className={t.bad ? `${page.dot} ${page.bad}` : page.dot} aria-hidden="true" />
                <div><strong>{t.text}</strong></div>
                {t.href && <Link href={t.href}>{t.action}</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={a.sheet}>
        <section className={a.section} aria-labelledby="details-title">
          <div className={a.about}>
            <h2 id="details-title">Business details</h2>
            <p>To change the PAN or the owner&rsquo;s details, contact support. A new PAN restarts verification.</p>
          </div>
          <div className={a.body}>
            <dl className={a.facts}>
              <dt>Verification</dt><dd>{roleName(status)}{details?.verified_at ? `, ${nepalDate(new Date(details.verified_at))}` : ''}</dd>
              <dt>PAN</dt><dd>{details?.pan_no ? `•••••${details.pan_no.slice(-4)}` : '—'}</dd>
              <dt>Owner</dt><dd>{owner || '—'}</dd>
              <dt>Created</dt><dd>{details?.created_at ? nepalDate(new Date(details.created_at)) : '—'}</dd>
            </dl>
            {/* Not offered when the current values are unknown, so blanks cannot replace them */}
            {details && (
              <form action={preview ? undefined : updateOrganization} className={a.form}>
                <input type="hidden" name="org_id" value={org.id} />
                <div className={a.fields}>
                  <label>Name<input name="name" defaultValue={details.name ?? ''} maxLength={120} required /></label>
                  <label>Kind of business<select name="business_type" defaultValue={(details as { business_type?: string | null }).business_type ?? ''}>
                    <option value="" disabled>Choose…</option>
                    {BUSINESS_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select></label>
                  <label>Address<input name="address" defaultValue={details.address ?? ''} maxLength={200} required /></label>
                  <label>Phone<input name="phone" type="tel" defaultValue={details.phone ?? ''} pattern="\+?[0-9][0-9 \-]{6,19}" title="Digits, optionally starting with +" required /></label>
                  <label>Email<input name="email" type="email" defaultValue={details.email ?? ''} required /></label>
                </div>
                <button type={preview ? 'button' : 'submit'} className={`${s.button} ${s.primary}`}>Save details</button>
              </form>
            )}
          </div>
        </section>

        <section className={a.section} aria-labelledby="team-title">
          <div className={a.about}>
            <h2 id="team-title">Team</h2>
            <p>The people who can sign in to your business.</p>
          </div>
          <div className={a.body}>
            <dl className={a.facts}>
              <dt>Members</dt><dd>{members.length} ({plural(count('owner'), 'owner')}, {plural(count('admin'), 'admin')}, {plural(count('member'), 'member')})</dd>
              <dt>Active</dt><dd>{active.length}{disabled ? `, ${disabled} disabled` : ''}</dd>
              <dt>Pending invitations</dt><dd>{pending.length}{expired ? ` (${expired} expired)` : ''}</dd>
            </dl>
            <Link href="/team" className={s.button}>Manage team</Link>
          </div>
        </section>

        <section className={a.section} aria-labelledby="apps-title">
          <div className={a.about}>
            <h2 id="apps-title">Apps</h2>
            <p>What your business uses, and who has access.</p>
          </div>
          <div className={a.body}>
            <ul className={a.plain}>
              {services.map((svc) => {
                const e = enabled.find((row) => row.service_key === svc.key);
                if (!e) return <li key={svc.key}><div><strong>{svc.name}</strong><span className={`${s.tag} ${a.quiet}`}>Not added</span></div></li>;
                const state = appStatus(e, now);
                const holders = active.filter((m) => m.service_roles[svc.key]);
                const byRole = svc.roles.map((r) => `${roleName(r)} ${holders.filter((m) => m.service_roles[svc.key] === r).length}`).join(', ');
                return (
                  <li key={svc.key}>
                    <div><strong>{svc.name}</strong><span className={`${s.tag} ${TONES[state.tone]}`}>{state.text}</span></div>
                    <span>Added {nepalDate(new Date(e.enabled_at))} · {plural(holders.length, 'person', 'people')} with access · {byRole}</span>
                  </li>
                );
              })}
            </ul>
            <Link href="/apps" className={s.button}>Add apps</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
