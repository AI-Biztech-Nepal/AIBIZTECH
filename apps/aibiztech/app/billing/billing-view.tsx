import 'lenis/dist/lenis.css';
import Link from 'next/link';
import { ReactLenis } from 'lenis/react';
import { isOpen, nepalDate, PLANS, subscription, type Subscription } from '@/lib/plans';
import page from '../dashboard.module.css';
import type { AppRow } from '../plans/load';
import s from '../plans/plans.module.css';

const COLUMNS = ['Date', 'Invoice', 'Plan', 'Period', 'Amount', 'Status', 'Receipt'];

// The current subscription as a title, a label and facts. Only what is recorded is shown.
function summary(sub: Subscription, plan: string, open: string) {
  const unbilled: [string, string][] = [['Selected plan', plan || 'Not chosen yet'], ['Next billing date', 'None until you subscribe'], ['Apps open', open]];
  if (sub.kind === 'trial') {
    return { title: 'Free trial', tag: 'Trial', tone: s.info, facts: [['Trial started', nepalDate(sub.started)], ['Trial ends', nepalDate(sub.ends)], ['Days remaining', `${sub.left} of ${sub.days}`], ...unbilled] };
  }
  if (sub.kind === 'ended') return { title: 'Free trial', tag: 'Ended', tone: s.over, facts: [['Trial ended', nepalDate(sub.ended)], ['Days remaining', '0'], ...unbilled] };
  if (sub.kind === 'active') return { title: plan || 'Subscription', tag: 'Active', tone: s.on, facts: [['Selected plan', plan || 'Not recorded'], ['Next billing date', 'Not recorded yet'], ['Apps open', open]] };
  return { title: 'No plan yet', tag: 'Not started', tone: s.info, facts: [['Apps open', open], ['Next billing date', 'None until you subscribe']] };
}

export function BillingView({ apps, failed = false, note, now = new Date() }: { apps: AppRow[]; failed?: boolean; note?: string; now?: Date }) {
  const sub = subscription(apps, now);
  const open = apps.filter((a) => isOpen(a, now)).map((a) => a.name).join(', ') || 'None';
  // A stored plan key is shown by its name
  const plan = [...new Set(apps.map((a) => a.plan).filter(Boolean))].map((key) => PLANS.find((p) => p.key === key)?.name ?? key).join(', ');
  const now_ = summary(sub, plan, open);

  return (
    <div className={page.page}>
      <ReactLenis root options={{ anchors: true }} />
      <div className={page.head}>
        <div>
          <h1>Billing</h1>
          <p className={page.sub}>Your subscription, its dates and every payment.</p>
        </div>
      </div>

      {note && <p role="status" className={page.banner}>{note}</p>}

      {failed ? <p role="alert" className={page.alert}>Your subscription could not be loaded. Reload the page to try again.</p> : (
        <section className={s.card} aria-label="Current subscription">
          <div className={s.cardHead}>
            <div className={s.title}><h2>{now_.title}</h2><span className={`${s.tag} ${now_.tone}`}>{now_.tag}</span></div>
            {sub.kind === 'none'
              ? <Link href="/apps" className={`${s.button} ${s.primary}`}>Add apps</Link>
              : <Link href="/plans" className={`${s.button} ${s.primary}`}>{sub.kind === 'active' ? 'Compare plans' : 'Choose a plan'}</Link>}
          </div>
          <dl className={s.facts}>
            {now_.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
      )}

      <section className={s.card} aria-labelledby="payments-title">
        <div className={s.cardHead}><h2 id="payments-title">Payment history</h2></div>
        <div className={s.scroll}>
          <table className={s.history}>
            <thead><tr>{COLUMNS.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
            {/* shortcut: payments are not recorded anywhere yet; add the rows when online payment exists */}
            <tbody><tr><td colSpan={COLUMNS.length}><div><strong>No payments yet</strong><span>Receipts appear here after your first payment.</span></div></td></tr></tbody>
          </table>
        </div>
      </section>

      <section className={s.card} aria-labelledby="change-title">
        <div className={s.cardHead}><h2 id="change-title">Change your plan</h2></div>
        <ul className={s.changes}>
          {PLANS.filter((p) => p.key !== 'trial').map((p) => (
            <li key={p.key}>
              <strong>{p.name}</strong>
              <span>{p.about}</span>
              <Link href="/plans" className={s.button} aria-label={`View the ${p.name} plan`}>View plan</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
