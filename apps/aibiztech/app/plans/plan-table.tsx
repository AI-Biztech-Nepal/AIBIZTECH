'use client';

import Link from 'next/link';
import { Fragment, useRef, useState } from 'react';
import { COMPARISON, contactHref, PLANS, priceText, type Cell, type Cycle, type Plan, type Subscription } from '@/lib/plans';
import s from './plans.module.css';

const CYCLES: [Cycle, string][] = [['monthly', 'Monthly'], ['yearly', 'Yearly']];

function Value({ value }: { value: Cell }) {
  if (value === true) return <span className={s.yes}>✓ Included</span>;
  if (value === false) return <span className={s.no}><span aria-hidden="true">—</span><span className={s.hidden}>Not included</span></span>;
  return value === null ? <span className={s.no}>To be confirmed</span> : <>{value}</>;
}

export function PlanTable({ current, contact }: { current: Subscription['kind']; contact?: string }) {
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [chosen, setChosen] = useState<Plan | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  function choose(plan: Plan) {
    setChosen(plan);
    dialog.current?.showModal();
  }

  function action(plan: Plan) {
    if (plan.key === 'trial') {
      // Adding an app is what starts a trial, so a business that never had one goes there
      if (current === 'none') return <Link href="/apps" className={s.button}>Start Free Trial</Link>;
      return <button type="button" className={s.button} disabled>{current === 'trial' ? 'Your current trial' : 'Trial used'}</button>;
    }
    const label = plan.key === 'enterprise' ? 'Contact Sales' : plan.recommended ? `Upgrade to ${plan.name}` : `Choose ${plan.name}`;
    return <button type="button" className={plan.recommended ? `${s.button} ${s.primary}` : s.button} onClick={() => choose(plan)}>{label}</button>;
  }

  const price = chosen && priceText(chosen, cycle);

  return (
    <>
      <div className={s.cycle} role="group" aria-label="Billing period">
        {CYCLES.map(([key, label]) => <button key={key} type="button" aria-pressed={cycle === key} onClick={() => setCycle(key)}>{label}</button>)}
      </div>

      <div className={s.sheet}>
        <table className={s.compare}>
          <thead>
            <tr>
              <td className={s.corner}>Compare plans</td>
              {PLANS.map((plan) => {
                const { amount, per } = priceText(plan, cycle);
                return (
                  <th key={plan.key} scope="col" className={plan.recommended ? s.best : undefined}>
                    <div className={s.plan}>
                      <div className={s.name}><span>{plan.name}</span>{plan.recommended && <em>Recommended</em>}</div>
                      <p className={s.about}>{plan.about}</p>
                      <div><strong className={s.amount}>{amount}</strong><small>{per}</small></div>
                      {action(plan)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map(({ group, rows }) => (
              <Fragment key={group}>
                <tr className={s.group}><th colSpan={PLANS.length + 1} scope="colgroup"><span>{group}</span></th></tr>
                {rows.map(([label, ...values]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {values.map((value, i) => <td key={PLANS[i].key} className={PLANS[i].recommended ? s.best : undefined}><Value value={value} /></td>)}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <dialog ref={dialog} className={s.dialog} aria-labelledby="plan-dialog-title" data-lenis-prevent onClose={() => setChosen(null)}>
        {chosen && price && (
          <form method="dialog">
            <h2 id="plan-dialog-title">{chosen.key === 'enterprise' ? 'Contact sales' : `Choose ${chosen.name}`}</h2>
            {chosen.key !== 'enterprise' && (
              <dl>
                <dt>Billing</dt><dd>{cycle === 'monthly' ? 'Monthly' : 'Yearly'}</dd>
                <dt>Price</dt><dd>{price.amount}</dd>
              </dl>
            )}
            <p>{chosen.key === 'enterprise' ? 'Tell us how many branches and people you have, and we will quote for your business.' : 'Online payment is not available yet. To subscribe to this plan, contact AIBIZTECH.'}</p>
            {!contact && <p className={s.note}>Please speak to your AIBIZTECH representative.</p>}
            <div className={s.buttons}>
              <button className={s.button}>Close</button>
              {contact && <a className={`${s.button} ${s.primary}`} href={contactHref(contact)}>Contact AIBIZTECH</a>}
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
