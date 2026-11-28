import 'lenis/dist/lenis.css';
import Link from 'next/link';
import { ReactLenis } from 'lenis/react';
import type { BusinessKind } from '@/lib/business-kind';
import { manages, SOON, soonShown, tilesFor } from '@/lib/app-tiles';
import { appStatus, isOpen } from '@/lib/plans';
import { TRIAL_DAYS } from '@/lib/signup';
import a from '../account.module.css';
import { saveModules } from '../actions';
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
  hidden?: string[]; // modules the business has unticked
  failed?: boolean;
  error?: string;
  message?: string;
  preview?: boolean; // look only: nothing is saved
  now?: Date;
};

export function AppsView({ orgName, access, services, kind = null, rows, hidden = [], failed = false, error, message, preview = false, now = new Date() }: Props) {
  const all = tilesFor(services, kind).map((tile) => ({ ...tile, row: rows.find((r) => r.service_key === tile.app) }));
  const mine = new Set(Object.keys(access));
  // Ticking cannot reopen an app whose trial is over or that is suspended: that needs a plan
  const isClosed = (tile: (typeof all)[number]) => !manages(tile, mine, kind) && !!tile.row && !isOpen(tile.row, now);
  const shownSoon = new Set(soonShown(hidden).map((tile) => tile.id));

  return (
    <div className={`${page.page} ${a.page}`}>
      <ReactLenis root options={{ anchors: true }} />
      <div className={page.head}>
        <div>
          <h1>Add apps</h1>
          <p className={page.sub}>Tick the apps {orgName} wants in the left panel, then press Save. Each new app starts with a free {TRIAL_DAYS}-day trial.</p>
        </div>
      </div>

      <Notices error={failed ? 'Your apps could not be loaded. Reload the page to try again.' : error} message={message} />

      {!failed && (
        <section className={s.card} aria-labelledby="apps-title">
          <div className={s.cardHead}><h2 id="apps-title">All apps</h2></div>
          {/* redrawn after each save, so the ticks always show what is stored */}
          <form key={`${hidden.join()}|${[...mine].join()}`} action={preview ? undefined : saveModules}>
            <ul className={t.grid}>
              {all.map((tile) => {
                const status = tile.row ? appStatus(tile.row, now) : null;
                const added = manages(tile, mine, kind);
                const closed = isClosed(tile);
                return (
                  <li key={tile.id}>
                    <div className={t.tile}>
                      <label className={t.pick}>
                        <input type="checkbox" name="modules" value={tile.id} defaultChecked={added && !hidden.includes(tile.id)} disabled={closed} aria-label={`Show ${tile.name} in the left panel`} />
                        {tile.art ? <ModuleLogo art={tile.art} /> : <ServiceLogo svc={{ key: tile.app, name: tile.name }} />}
                        <span className={t.name}>{tile.name}</span>
                      </label>
                      {status && <span className={`${s.tag} ${status.tone === 'good' && !closed ? s.on : s.over}`}>{status.text}</span>}
                      {!added && !closed && tile.app === 'stock' && <span className={t.note}>Part of Stock Manager</span>}
                      {!added && !closed && <span className={t.note}>{status ? 'Tick to give yourself access' : `Tick for a ${TRIAL_DAYS}-day free trial`}</span>}
                      {added && <a href={access[tile.app] ? tile.href : `/app/stock/${tile.id}`} className={t.action} aria-label={`Open ${tile.name}`}>Open</a>}
                      {closed && <Link href="/plans" className={t.action}>View plans</Link>}
                    </div>
                  </li>
                );
              })}
              {SOON.map((tile) => (
                <li key={tile.id}>
                  <div className={t.tile}>
                    <label className={t.pick}>
                      <input type="checkbox" name="modules" value={tile.id} defaultChecked={shownSoon.has(tile.id)} aria-label={`Show ${tile.name} in the left panel`} />
                      <ModuleLogo art={tile.art!} />
                      <span className={t.name}>{tile.name}</span>
                    </label>
                    <span className={`${s.tag} ${s.over}`}>Coming soon</span>
                    <Link href={tile.href} className={t.action} aria-label={`About ${tile.name}`}>Open</Link>
                  </div>
                </li>
              ))}
            </ul>
            <div className={a.foot}><button type={preview ? 'button' : 'submit'} className={`${s.button} ${s.primary}`}>Save left panel</button></div>
          </form>
        </section>
      )}
    </div>
  );
}
