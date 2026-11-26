import 'lenis/dist/lenis.css';
import Link from 'next/link';
import { ReactLenis } from 'lenis/react';
import { appStatus, isOpen } from '@/lib/plans';
import { TRIAL_DAYS } from '@/lib/signup';
import a from '../account.module.css';
import { addApps } from '../actions';
import { Notices } from '../dashboard-view';
import page from '../dashboard.module.css';
import { inModuleOrder, MODULES } from '../onboarding/modules';
import type { AppRow } from '../plans/load';
import s from '../plans/plans.module.css';

type Props = {
  orgName: string;
  access: Record<string, string>; // app key -> this person's role: the apps they can open now
  services: { key: string; name: string }[];
  rows: AppRow[];
  failed?: boolean;
  error?: string;
  message?: string;
  preview?: boolean; // look only: nothing is saved
  now?: Date;
};

// Each app's first page
const HOME: Record<string, string> = { attendance: '/app/attendance', finance: '/app/finance/company-dashboard', stock: '/stock', marketing: '/marketing' };

export function AppsView({ orgName, access, services, rows, failed = false, error, message, preview = false, now = new Date() }: Props) {
  const all = inModuleOrder(services).map((svc) => ({ ...svc, row: rows.find((r) => r.service_key === svc.key) }));
  const mine = all.filter((svc) => access[svc.key]);
  const rest = all.filter((svc) => !access[svc.key]);
  // Adding cannot reopen an app whose trial is over or that is suspended: that needs a plan
  const closed = rest.filter((svc) => svc.row && !isOpen(svc.row, now));
  const free = rest.filter((svc) => !svc.row || isOpen(svc.row, now));

  return (
    <div className={`${page.page} ${a.page}`}>
      <ReactLenis root options={{ anchors: true }} />
      <div className={page.head}>
        <div>
          <h1>Add apps</h1>
          <p className={page.sub}>Apps for {orgName}. Each new app starts with a free {TRIAL_DAYS}-day trial.</p>
        </div>
      </div>

      <Notices error={failed ? 'Your apps could not be loaded. Reload the page to try again.' : error} message={message} />

      {!failed && !!mine.length && (
        <section className={s.card} aria-labelledby="mine-title">
          <div className={s.cardHead}><h2 id="mine-title">Your apps</h2></div>
          <ul className={a.rows}>
            {mine.map((svc) => (
              <li key={svc.key} className={a.row}>
                <span className={a.who}><strong>{svc.name}</strong></span>
                {svc.row && <span className={`${s.tag} ${appStatus(svc.row, now).tone === 'good' ? s.on : s.over}`}>{appStatus(svc.row, now).text}</span>}
                <a href={HOME[svc.key] ?? `/app/${svc.key}`} className={s.button} aria-label={`Open ${svc.name}`}>Open</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!failed && !!closed.length && (
        <section className={s.card} aria-labelledby="closed-title">
          <div className={s.cardHead}><h2 id="closed-title">Needs a plan</h2></div>
          <ul className={a.rows}>
            {closed.map((svc) => (
              <li key={svc.key} className={a.row}>
                <span className={a.who}><strong>{svc.name}</strong></span>
                <span className={`${s.tag} ${s.over}`}>{appStatus(svc.row!, now).text}</span>
                <Link href="/plans" className={s.button} aria-label={`View plans for ${svc.name}`}>View plans</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!failed && (
        <section className={s.card} aria-labelledby="add-title">
          <div className={s.cardHead}><h2 id="add-title">Available to add</h2></div>
          {!free.length ? <p className={a.padded}>{closed.length ? 'There is nothing else to add.' : 'You already have every app.'}</p> : (
            <form action={preview ? undefined : addApps}>
              <ul className={a.rows}>
                {free.map((svc) => (
                  <li key={svc.key}>
                    <label className={a.pick}>
                      <span className={a.words}>
                        <input type="checkbox" name="apps" value={svc.key} />
                        <span>
                          <strong>{svc.name}</strong>
                          {MODULES[svc.key] && <small>{MODULES[svc.key].about}</small>}
                          <em>{svc.row ? `Already on for your business (${appStatus(svc.row, now).text}). Adding it makes you its admin.` : `Starts a free ${TRIAL_DAYS}-day trial`}</em>
                        </span>
                      </span>
                      {MODULES[svc.key]?.points && <span className={a.points}>{MODULES[svc.key].points!.map((p) => <span key={p}>{p}</span>)}</span>}
                    </label>
                  </li>
                ))}
              </ul>
              <div className={a.foot}><button type={preview ? 'button' : 'submit'} className={`${s.button} ${s.primary}`}>Add selected apps</button></div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
