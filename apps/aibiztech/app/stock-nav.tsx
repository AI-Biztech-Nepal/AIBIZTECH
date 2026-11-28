'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { Icon } from './icons';
import s from './frame.module.css';

// Stock Manager's menu, in the portal's own side panel. The app (in the page area) sends its menu for the signed-in
// person, so roles and staff access decide what is listed; it is remembered for the pages where the app is not open.
export type StockNode = { key: string; label: string; to: string; active?: boolean; badge?: number; children?: StockNode[] };

const ICONS: Record<string, string> = {
  dashboard: 'dashboard', sales: 'card', inventory: 'stock', items: 'stock', 'spare-parts': 'structure', marketing: 'megaphone',
  service: 'wrench', jobs: 'wrench', warranty: 'admin', ledger: 'doc', finance: 'finance', sanakhat: 'doc', ai: 'hanuman', platform: 'branch',
};
const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');
const address = (to: string) => `/app/stock${to === '/' ? '' : to}`;
const frame = () => document.querySelector<HTMLIFrameElement>('iframe[data-app="stock"]');
let answering: Window | null = null; // the open app that has sent its menu: clicks go to it, without loading it again

function useStockMenu(who: string) {
  const [menu, setMenu] = useState<StockNode[] | null>(null);
  const path = usePathname();
  const here = path.startsWith('/app/stock') || path.startsWith('/app/marketing');
  useEffect(() => {
    const key = `aibiztech:stock-menu:${who}`;
    try { const saved = localStorage.getItem(key); if (saved) setMenu(JSON.parse(saved)); } catch {}
    const onMessage = (e: MessageEvent) => {
      const app = frame()?.contentWindow;
      if (e.origin !== window.location.origin || !app || e.source !== app || e.data?.type !== 'stock:menu') return;
      answering = app;
      setMenu(e.data.menu);
      try { localStorage.setItem(key, JSON.stringify(e.data.menu)); } catch {}
      // keep the portal's address on the page being shown, so it can be reloaded or shared
      const next = address(String(e.data.path ?? '/'));
      if (next !== window.location.pathname + window.location.search) window.history.replaceState(null, '', next);
    };
    window.addEventListener('message', onMessage);
    frame()?.contentWindow?.postMessage({ type: 'stock:hello' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [who]);
  return { menu, here };
}

function open(e: MouseEvent, to: string) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const app = frame()?.contentWindow;
  if (!app || app !== answering || app.location.pathname.endsWith('/login')) return; // an ordinary link
  e.preventDefault();
  app.postMessage({ type: 'stock:go', to }, window.location.origin);
}

const Badge = ({ n }: { n?: number }) => (n ? <b className={s.badge}>{n > 99 ? '99+' : n}</b> : null);

function Node({ node, here, icon }: { node: StockNode; here: boolean; icon?: string }) {
  const active = here && node.active;
  const [chosen, setChosen] = useState<boolean | null>(null); // null: open while one of its pages is shown
  const inner = <>{icon && <Icon name={icon} size={17} />}<span className={s.label}>{node.label}</span></>;
  if (!node.children?.length) {
    return (
      <a className={cls(s.item, active && s.active)} href={address(node.to)} onClick={(e) => open(e, node.to)} aria-current={active ? 'page' : undefined} title={node.label}>
        {inner}<Badge n={node.badge} />
      </a>
    );
  }
  const shown = chosen ?? !!active;
  return (
    <details className={s.menu} open={shown}>
      <summary className={cls(s.item, active && !shown && s.active)} onClick={(e) => { e.preventDefault(); setChosen(!shown); }}>
        <a href={address(node.to)} className={s.appTitle} title={node.label} onClick={(e) => { e.stopPropagation(); setChosen(true); open(e, node.to); }}>{inner}</a>
        {!shown && <Badge n={node.badge} />}
      </summary>
      <div className={s.sub}>{node.children.map((c) => <Node key={c.key} node={c} here={here} />)}</div>
    </details>
  );
}

// "Dashboard" in the Workspace group
export function StockDashboardLink({ who }: { who: string }) {
  const { menu, here } = useStockMenu(who);
  const node = menu ? menu.find((n) => n.key === 'dashboard') : { key: 'dashboard', label: 'Dashboard', to: '/' };
  return node ? <Node node={node} here={here} icon="dashboard" /> : null;
}

// Every other page of Stock Manager, in the Modules group. withDashboard: the portal keeps its own Dashboard too.
export function StockModules({ who, withDashboard }: { who: string; withDashboard: boolean }) {
  const { menu, here } = useStockMenu(who);
  if (!menu) return <Node node={{ key: 'stock', label: 'Stock Manager', to: '/' }} here={here} icon="stock" />;
  return (
    <>
      {menu.filter((n) => n.key !== 'settings' && (withDashboard || n.key !== 'dashboard')).map((n) => (
        // beside the general Finance, which has its own Ledger, the stock app's people list is named for what it holds
        <Node key={n.key} node={n.key === 'dashboard' ? { ...n, label: 'Stock Dashboard' } : n.key === 'ledger' ? { ...n, label: 'Customers & Staff' } : n} here={here} icon={ICONS[n.key] ?? 'app'} />
      ))}
    </>
  );
}

// One "Settings": the business's Stock Manager settings and the person's own profile
export function StockSettings({ who, onProfile }: { who: string; onProfile: boolean }) {
  const { menu, here } = useStockMenu(who);
  const business = menu?.find((n) => n.key === 'settings');
  const profile = <a className={cls(s.item, onProfile && s.active)} href="/profile"><span className={s.label}>My profile</span></a>;
  if (!business) {
    return <a className={cls(s.item, onProfile && s.active)} href="/profile" title="Settings"><Icon name="settings" size={17} /><span className={s.label}>Settings</span></a>;
  }
  const active = (here && business.active) || onProfile;
  return (
    <details className={s.menu} open={active || undefined}>
      <summary className={s.item}><Icon name="settings" size={17} /><span className={s.label}>Settings</span></summary>
      <div className={s.sub}>
        <a className={cls(s.item, here && business.active && s.active)} href={address(business.to)} onClick={(e) => open(e, business.to)}><span className={s.label}>Business settings</span></a>
        {profile}
      </div>
    </details>
  );
}
