import 'lenis/dist/lenis.css';
import { ReactLenis } from 'lenis/react';
import { appStatus, nepalDate, subscription, type Access, type Subscription } from '@/lib/plans';
import page from '../dashboard.module.css';
import { PlanTable } from './plan-table';
import s from './plans.module.css';

export type AppRow = Access & { service_key: string; name: string };

// Where the business stands now. Days are counted on the server from the trial's own dates.
function Status({ sub }: { sub: Subscription }) {
  if (sub.kind === 'trial') {
    return (
      <section className={s.status} aria-label="Trial status">
        <div>
          <strong>Free trial, day {sub.day} of {sub.days}</strong>
          <span>Started {nepalDate(sub.started)} · Ends {nepalDate(sub.ends)}</span>
        </div>
        <div className={s.bar} aria-hidden="true">{Array.from({ length: sub.days }, (_, i) => <i key={i} className={i < sub.day ? s.used : undefined} />)}</div>
        <strong>{sub.left} {sub.left === 1 ? 'day' : 'days'} left</strong>
      </section>
    );
  }
  const [title, detail] = sub.kind === 'ended'
    ? [`Your free trial ended on ${nepalDate(sub.ended)}`, 'Your records are not deleted. Subscribe to get back into your apps.']
    : sub.kind === 'active'
      ? ['Your subscription is active', 'Contact AIBIZTECH to change your plan.']
      : ['No trial started yet', 'Add an app to start your free trial. No payment is needed.'];
  return (
    <section className={sub.kind === 'ended' ? `${s.status} ${s.ended}` : s.status} aria-label="Subscription status">
      <div><strong>{title}</strong><span>{detail}</span></div>
    </section>
  );
}

export function PlansView({ apps, contact, failed = false, note, now = new Date() }: { apps: AppRow[]; contact?: string; failed?: boolean; note?: string; now?: Date }) {
  const sub = subscription(apps, now);
  return (
    <div className={page.page}>
      <ReactLenis root options={{ anchors: true }} />
      <div className={page.head}>
        <div>
          <h1>Subscription &amp; Plans</h1>
          <p className={page.sub}>All prices are in NPR.</p>
        </div>
      </div>

      {note && <p role="status" className={page.banner}>{note}</p>}
      {failed ? <p role="alert" className={page.alert}>Your trial dates could not be loaded. Reload the page to try again.</p> : <Status sub={sub} />}

      <PlanTable current={failed ? 'active' : sub.kind} contact={contact} />

      <div className={page.pair}>
        <section className={page.panel}>
          <h2>Your apps</h2>
          {!apps.length ? <p className={page.empty}>No apps yet.</p> : (
            <ul className={`${page.list} ${s.apps}`}>
              {apps.map((app) => {
                const state = appStatus(app, now);
                return <li key={app.service_key}><span>{app.name}</span><b className={s[state.tone]}>{state.text}</b></li>;
              })}
            </ul>
          )}
        </section>
        <section className={page.panel}>
          <h2>How billing works</h2>
          <ul className={s.terms}>
            <li>No payment is needed to start a free trial.</li>
            <li>Online payment is not available yet. Subscriptions are arranged with AIBIZTECH.</li>
            <li>When a trial ends, access to that app stops until you subscribe. Your records are not deleted.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
