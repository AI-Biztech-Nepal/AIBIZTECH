import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { createClient, type Org } from '@/lib/supabase';
import { signOut, switchOrg } from './actions';
import { Icon, serviceIcon } from './icons';
import { SidebarMemory } from './sidebar-memory';
import { ATTENDANCE_MENU, type MenuNode } from '@/lib/attendance-menu';
import { STOCK_MENU, STOCK_SERVICE_MENU } from '@/lib/stock-menu';
import { MARKETING_MENU } from '@/lib/marketing-menu';
import { FINANCE_MENU } from '@/lib/finance-menu';

type Page = 'home' | 'admin' | 'team' | 'apps' | 'frame';

// App shell: left navigation like the apps themselves. Apps come from core.services, so a new
// service (or a feature turned on for a business) shows up here without touching this file.
export async function Shell({ org, orgs = [], page, bleed = false, children }: { org: Org | null; orgs?: Org[]; page: Page; bleed?: boolean; children: ReactNode }) {
  const supabase = await createClient();
  const [{ data: services }, { data: claims }] = await Promise.all([
    supabase.schema('core').from('services').select('key, name, base_url').eq('is_active', true).order('name'),
    supabase.auth.getClaims(),
  ]);
  const email = claims?.claims.email ?? '';
  const status = org?.verification_status;
  const statusLabel = status === 'verified' ? 'Verified' : status === 'rejected' ? 'Rejected' : 'Awaiting verification';
  const person = (claims?.claims.user_metadata as { full_name?: string } | undefined)?.full_name || email.split('@')[0] || 'Account';
  const isAdmin = !!org && org.org_role !== 'member';
  const initials = (org?.name ?? person).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const item = (href: string, icon: string, label: string, active = false, extra?: ReactNode, newTab = false) => (
    <Link href={href} className={`nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} {...(newTab ? { target: '_blank', rel: 'noopener' } : {})}>
      <Icon name={icon} size={18} /><span>{label}</span>{extra}
    </Link>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="AIBIZTECH home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="AIBIZTECH" className="brand-logo" width={900} height={529} />
        </Link>

        <nav>
          {item('/', 'dashboard', 'Dashboard', page === 'home')}

          <details className="group" open data-menu="group:apps">
            <summary>Apps</summary>
            {appsInOrder(services, org).map((s) => {
              const on = !!org?.services[s.key];
              // Attendance Nepal opens its own menu here (live app, new tab); a bare address with no path keeps the link usable
              if (on && s.key === 'attendance') return <AppMenu key={s.key} service="attendance" icon="attendance" name={s.name} base={s.base_url} home="/" nodes={ATTENDANCE_MENU} isAdmin={org?.services.attendance === 'admin'} />;
              if (on && s.key === 'marketing') return <AppMenu key={s.key} service="marketing" icon="megaphone" name={s.name} base={s.base_url} home="/" nodes={MARKETING_MENU} isAdmin={org?.services.marketing === 'admin'} />;
              if (on && s.key === 'stock') {
                const stockAdmin = org?.services.stock === 'admin';
                // Sales, EMI, Service and Sanakhat sit beside Stock Manager in the sidebar, not inside it
                return (
                  <Fragment key={s.key}>
                    <AppMenu service="stock" icon="stock" name={s.name} base={s.base_url} home="/" nodes={STOCK_MENU} isAdmin={stockAdmin} />
                    {item('/stock/sales', 'task', 'Sales')}
                    {stockAdmin && item('/stock/emi', 'card', 'EMI')}
                    <AppMenu service="stock" icon="wrench" name="Service" base={s.base_url} home="/jobs" nodes={STOCK_SERVICE_MENU} isAdmin={stockAdmin} />
                    {stockAdmin && item('/stock/sanakhat', 'doc', 'Sanakhat')}
                  </Fragment>
                );
              }
              // Finance runs inside AIBIZTECH (served at /finance); the other apps are still opened through single sign-on
              return on && s.key === 'finance'
                ? <AppMenu key={s.key} service="finance" icon="finance" name={s.name} base="/finance" internal home="/company-dashboard" nodes={FINANCE_MENU} isAdmin />
                : on
                ? item(`/app/${s.key}`, serviceIcon(s.key, s.name), s.name)
                : item(org ? '/' : '/onboarding', serviceIcon(s.key, s.name), s.name, false, <Icon name="lockmini" size={14} />);
            })}
            {isAdmin && item('/apps', 'plus', 'Add apps', page === 'apps')}
          </details>

          {isAdmin && (
            <details className="group" open data-menu="group:org">
              <summary>Organization</summary>
              {item('/team', 'team', 'Team', page === 'team')}
              {item('/admin', 'admin', 'Admin', page === 'admin')}
            </details>
          )}

          {item('/profile', 'settings', 'Settings')}
        </nav>
        <SidebarMemory />
      </aside>
      <div className="main-col">
        <main className={`content${bleed ? ' bleed' : ''}`}>
          <div className="topbar">
            <details className="usermenu">
              <summary aria-label="Account menu">
                <span className="avatar-sm">{initials}{status && <i className={`status-dot ${status}`} title={statusLabel} />}</span>
                <span className="who-text"><strong>{org?.name ?? person}</strong><small><span className="cap">{org ? org.org_role : email}</span>{status && <> · <em className={`status-text ${status}`}>{statusLabel}</em></>}</small></span>
              </summary>
              <div className="panel">
                <div className="me">
                  <span className="avatar-sm big">{initials}</span>
                  <div><strong>{person}</strong><small>{email}</small></div>
                </div>
                {org && <dl><dt>Business</dt><dd>{org.name}</dd><dt>Your role</dt><dd className="cap">{org.org_role}</dd><dt>Status</dt><dd><span className={`pill ${org.verification_status}`}>{statusLabel}</span></dd></dl>}
                {orgs.length > 0 && (
                  <div className="switch">
                    <small>Switch business</small>
                    {orgs.map((o) => (
                      <form key={o.id} action={switchOrg}>
                        <input type="hidden" name="org_id" value={o.id} />
                        <button className={o.id === org?.id ? 'current' : ''}>{o.id === org?.id ? '✓ ' : ''}{o.name}</button>
                      </form>
                    ))}
                  </div>
                )}
                <Link href="/onboarding" className="menu-link">+ Add another business</Link>
                {org && <Link href="/profile" className="menu-link">Edit profile</Link>}
                <form action={signOut}><button className="signout-btn"><Icon name="signout" size={16} /> Sign out</button></form>
              </div>
            </details>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

// The apps in the sidebar, in this order, with Attendance Nepal shown as HRIS
const APP_ORDER = ['attendance', 'finance', 'marketing', 'stock'];
const SHOWN_AS: Record<string, string> = { attendance: 'HRIS' };
function appsInOrder<T extends { key: string; name: string }>(services: T[] | null, org: Org | null): T[] {
  const rank = (key: string) => { const i = APP_ORDER.indexOf(key); return i < 0 ? APP_ORDER.length : i; };
  return (services ?? [])
    .filter((s) => !org || org.services[s.key])
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map((s) => ({ ...s, name: SHOWN_AS[s.key] ?? s.name }));
}

// An app's own menu as a dropdown under the app name; its pages are on the app itself and open in this same tab.
// "from=aibiztech" lets the app show a way back to the portal (only for people who arrived from here).
function AppMenu({ service, icon, name, base, nodes, isAdmin, home = '/', internal = false }: { service: string; icon: string; name: string; base: string; nodes: MenuNode[]; isAdmin: boolean; home?: string; internal?: boolean }) {
  const visible = (list: MenuNode[]) => list.filter((n) => !n.adminOnly || isAdmin);
  // Every page opens inside the portal (/app/<app>/<page>), in this same tab, with the sidebar and top bar around it
  const href = (path = '/') => `${service === 'stock' || service === 'marketing' ? `/${service}` : `/app/${service}`}${path === '/' ? '' : path}`;
  const render = (list: MenuNode[]): ReactNode =>
    visible(list).map((n) =>
      n.children ? (
        <details key={n.label} className="sub-group" data-menu={`${service}:${n.label}`}>
          <summary className="nav-item sub-item"><Icon name={n.icon} size={16} /><span>{n.label}</span></summary>
          <div className="sub">{render(n.children)}</div>
        </details>
      ) : (
        <a key={n.label} className="nav-item sub-item" href={href(n.path)}>
          <Icon name={n.icon} size={16} /><span>{n.label}</span>
        </a>
      ),
    );
  return (
    <details className="app-menu" data-menu={`app:${service}:${name}`}>
      {/* Clicking the name opens the app's dashboard; the arrow opens and closes the list */}
      <summary className="nav-item"><a href={href(home)} className="app-title"><Icon name={icon} size={18} /><span>{name}</span></a></summary>
      <div className="sub">{render(nodes)}</div>
    </details>
  );
}
