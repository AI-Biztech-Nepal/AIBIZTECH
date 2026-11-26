import 'lenis/dist/lenis.css';
import Link from 'next/link';
import { ReactLenis } from 'lenis/react';
import { contactHref, nepalDate, PLANS, priceText } from '@/lib/plans';
import page from './dashboard.module.css';
import s from './plans/plans.module.css';

type Props = { orgName: string; ended: Date; isAdmin: boolean; contact?: string; note?: string };

// What the dashboard shows once the free trial is over and nothing has been bought.
// The database closes every app at that moment and deletes nothing, so the page says exactly that.
export function TrialEndedView({ orgName, ended, isAdmin, contact, note }: Props) {
  return (
    <div className={page.page}>
      <ReactLenis root options={{ anchors: true }} />
      <div className={page.head}>
        <div>
          <h1>Your free trial has ended</h1>
          <p className={page.sub}>{orgName} · Trial ended {nepalDate(ended)}</p>
        </div>
      </div>

      {note && <p role="status" className={page.banner}>{note}</p>}

      <div role="status" className={`${s.status} ${s.ended}`}>
        <div className={s.grow}>
          <strong>Your records are not deleted.</strong>
          <span>{isAdmin ? 'Your apps are closed until you subscribe to a plan.' : `Apps are closed until an owner or admin of ${orgName} subscribes to a plan.`}</span>
        </div>
        {isAdmin && (
          <div className={s.buttons}>
            <Link href="/plans" className={`${s.button} ${s.primary}`}>View plans</Link>
            {contact && <a href={contactHref(contact)} className={s.button}>Contact Sales</a>}
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          <section className={s.card} aria-labelledby="continue-title">
            <div className={s.cardHead}><h2 id="continue-title">Choose a plan to continue</h2></div>
            <ul className={s.changes}>
              {PLANS.filter((p) => p.key !== 'trial').map((p) => {
                const { amount, per } = priceText(p, 'monthly');
                return (
                  <li key={p.key} className={p.recommended ? s.picked : undefined}>
                    <strong>{p.name}</strong>
                    <span>{p.recommended && 'Recommended. '}{p.about}</span>
                    <div className={s.cost}><b>{amount}</b><small>{per}</small></div>
                    <Link href="/plans" className={p.recommended ? `${s.button} ${s.primary}` : s.button} aria-label={`View the ${p.name} plan`}>View plan</Link>
                  </li>
                );
              })}
            </ul>
          </section>
          <p className={s.note}>Online payment is not available yet. To subscribe, {contact ? 'use Contact Sales' : 'speak to your AIBIZTECH representative'}.</p>
        </>
      )}
    </div>
  );
}
