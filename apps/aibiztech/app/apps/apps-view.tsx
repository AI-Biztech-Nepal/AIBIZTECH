import 'lenis/dist/lenis.css';
import Link from 'next/link';
import { ReactLenis } from 'lenis/react';
import type { BusinessKind } from '@/lib/business-kind';
import { tilesFor } from '@/lib/app-tiles';
import { appStatus, isOpen } from '@/lib/plans';
import { TRIAL_DAYS } from '@/lib/signup';
import a from '../account.module.css';
import { addApps } from '../actions';
import { Notices } from '../dashboard-view';
import page from '../dashboard.module.css';
import { ModuleLogo, ServiceLogo } from '../icons';
import type { AppRow } from '../plans/load';
import s from '../plans/plans.module.css';
import t from './apps.module.css';

type Props = {
  orgName: string;
  access: Record<string, string>; // app key -> this person's role: the apps they can open now
  services: { key: string; name: string }[];
  kind?: BusinessKind | null; // what the business deals in: decides which Stock Manager modules it has
  rows: AppRow[];
  failed?: boolean;
  error?: string;
  message?: string;
  preview?: boolean; // look only: nothing is saved
  now?: Date;
};

export function AppsView({ orgName, access, services, kind = null, rows, failed = false, error, message, preview = false, now = new Date() }: Props) {
  const all = tilesFor(services, kind).map((tile) => ({ ...tile, row: rows.find((r) => r.service_key === tile.app) }));
  // Adding cannot reopen an app whose trial is over or that is suspended: that needs a plan
  const isClosed = (tile: (typeof all)[number]) => !access[tile.app] && !!tile.row && !isOpen(tile.row, now);
  const canAdd = all.some((tile) => !access[tile.app] && !isClosed(tile));

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
              {all.map((tile) => {
                const status = tile.row ? appStatus(tile.row, now) : null;
                const face = (
                  <>
                    {tile.art ? <ModuleLogo art={tile.art} /> : <ServiceLogo svc={{ key: tile.app, name: tile.name }} />}
                    <span className={t.name}>{tile.name}</span>
                  </>
                );
                return (
                  <li key={tile.id}>
                    {access[tile.app] ? (
                      <a href={tile.href} className={t.tile}>
                        {face}
                        {status && <span className={`${s.tag} ${status.tone === 'good' ? s.on : s.over}`}>{status.text}</span>}
                        <span className={t.action}>Open</span>
                      </a>
                    ) : isClosed(tile) ? (
                      <Link href="/plans" className={t.tile}>
                        {face}
                        <span className={`${s.tag} ${s.over}`}>{status!.text}</span>
                        <span className={t.action}>View plans</span>
                      </Link>
                    ) : (
                      <label className={t.tile}>
                        <input type="checkbox" name="apps" value={tile.app} />
                        {face}
                        {tile.app === 'stock' && <span className={t.note}>Part of Stock Manager</span>}
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
