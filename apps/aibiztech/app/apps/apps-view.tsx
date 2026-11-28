import 'lenis/dist/lenis.css';
import Link from 'next/link';
import { ReactLenis } from 'lenis/react';
import { appStatus, isOpen } from '@/lib/plans';
import { TRIAL_DAYS } from '@/lib/signup';
import a from '../account.module.css';
import { addApps } from '../actions';
import { Notices } from '../dashboard-view';
import page from '../dashboard.module.css';
import { ServiceLogo } from '../icons';
import { inModuleOrder } from '../onboarding/modules';
import type { AppRow } from '../plans/load';
import s from '../plans/plans.module.css';
import t from './apps.module.css';

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
const HOME: Record<string, string> = { attendance: '/app/attendance', finance: '/app/finance/company-dashboard', stock: '/app/stock', marketing: '/app/marketing' };

export function AppsView({ orgName, access, services, rows, failed = false, error, message, preview = false, now = new Date() }: Props) {
  const all = inModuleOrder(services).map((svc) => ({ ...svc, row: rows.find((r) => r.service_key === svc.key) }));
  // Adding cannot reopen an app whose trial is over or that is suspended: that needs a plan
  const isClosed = (svc: (typeof all)[number]) => !access[svc.key] && !!svc.row && !isOpen(svc.row, now);
  const canAdd = all.some((svc) => !access[svc.key] && !isClosed(svc));

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

      {!failed && (
        <section className={s.card} aria-labelledby="apps-title">
          <div className={s.cardHead}><h2 id="apps-title">All apps</h2></div>
          <form action={preview ? undefined : addApps}>
            <ul className={t.grid}>
              {all.map((svc) => {
                const status = svc.row ? appStatus(svc.row, now) : null;
                const face = (
                  <>
                    <ServiceLogo svc={svc} />
                    <span className={t.name}>{svc.name}</span>
                  </>
                );
                return (
                  <li key={svc.key}>
                    {access[svc.key] ? (
                      <a href={HOME[svc.key] ?? `/app/${svc.key}`} className={t.tile}>
                        {face}
                        {status && <span className={`${s.tag} ${status.tone === 'good' ? s.on : s.over}`}>{status.text}</span>}
                        <span className={t.action}>Open</span>
                      </a>
                    ) : isClosed(svc) ? (
                      <Link href="/plans" className={t.tile}>
                        {face}
                        <span className={`${s.tag} ${s.over}`}>{status!.text}</span>
                        <span className={t.action}>View plans</span>
                      </Link>
                    ) : (
                      <label className={t.tile}>
                        <input type="checkbox" name="apps" value={svc.key} />
                        {face}
                        <span className={t.note}>{status ? `On for your business · ${status.text}` : `${TRIAL_DAYS}-day free trial`}</span>
                        <span className={t.action}>{status ? 'Add me as admin' : 'Add'}</span>
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
            {canAdd && <div className={a.foot}><button type={preview ? 'button' : 'submit'} className={`${s.button} ${s.primary}`}>Add selected apps</button></div>}
          </form>
        </section>
      )}
    </div>
  );
}
