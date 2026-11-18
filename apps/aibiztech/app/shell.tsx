import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient, type Org } from '@/lib/supabase';
import { signOut, switchOrg } from './actions';
import { Icon, serviceIcon } from './icons';
import { ATTENDANCE_MENU, type MenuNode } from '@/lib/attendance-menu';
import { STOCK_MENU } from '@/lib/stock-menu';
import { FINANCE_MENU } from '@/lib/finance-menu';

type Page = 'home' | 'admin' | 'team' | 'apps';

// App shell: left navigation like the apps themselves. Apps come from core.services, so a new
// service (or a feature turned on for a business) shows up here without touching this file.
export async function Shell({ org, orgs = [], page, children }: { org: Org | null; orgs?: Org[]; page: Page; children: ReactNode }) {
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
  const item = (href: string, icon: string, label: string, active = false, extra?: ReactNode, newTab = href.startsWith('/go/')) => (
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

          <details className="group" open>
            <summary>Apps</summary>
            {services?.filter((s) => !org || org.services[s.key]).map((s) => {
              const on = !!org?.services[s.key];
              // Attendance Nepal opens its own menu here (live app, new tab); a bare address with no path keeps the link usable
              if (on && s.key === 'attendance') return <AppMenu key={s.key} service="attendance" icon="attendance" name={s.name} base={s.base_url} nodes={ATTENDANCE_MENU} isAdmin={org?.services.attendance === 'admin'} />;
              if (on && s.key === 'stock') return <AppMenu key={s.key} service="stock" icon="stock" name={s.name} base={s.base_url} nodes={STOCK_MENU} isAdmin={org?.services.stock === 'admin'} />;
              // Finance runs inside AIBIZTECH (served at /finance); the other apps are still opened through single sign-on
              return on && s.key === 'finance'
                ? <AppMenu key={s.key} service="finance" icon="finance" name={s.name} base="/finance" internal nodes={FINANCE_MENU} isAdmin />
                : on
                ? item(`/go/${s.key}`, serviceIcon(s.key, s.name), s.name)
                : item(org ? '/' : '/onboarding', serviceIcon(s.key, s.name), s.name, false, <Icon name="lockmini" size={14} />);
            })}
            {isAdmin && item('/apps', 'plus', 'Add apps', page === 'apps')}
          </details>

          {isAdmin && (
            <details className="group" open>
              <summary>Organization</summary>
              {item('/team', 'team', 'Team', page === 'team')}
              {item('/admin', 'admin', 'Admin', page === 'admin')}
            </details>
          )}

          {item('/#account', 'settings', 'Settings')}
        </nav>

      </aside>
      <div className="main-col">
        <main className="content">
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
                {org && <Link href="/#account" className="menu-link">Edit profile</Link>}
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

// An app's own menu as a dropdown under the app name; its pages are on the app itself, so they open in a new tab.
// "from=aibiztech" lets the app show a way back to the portal (only for people who arrived from here).
function AppMenu({ service, icon, name, base, nodes, isAdmin, internal = false }: { service: string; icon: string; name: string; base: string; nodes: MenuNode[]; isAdmin: boolean; internal?: boolean }) {
  const root = base.replace(/\/$/, '');
  const visible = (list: MenuNode[]) => list.filter((n) => !n.adminOnly || isAdmin);
  // Apps with single sign-on go through the portal's /go, which hands over a signed pass and lands on the page
  const sso = !!process.env.SSO_SECRET && (process.env.SSO_SERVICES ?? '').split(',').map((s) => s.trim()).includes(service);
  const href = (path = '/') => (internal ? `${root}${path}` : sso ? `/go/${service}?to=${encodeURIComponent(path)}` : `${root}${path}${path.includes('?') ? '&' : '?'}from=aibiztech`);
  const render = (list: MenuNode[]): ReactNode =>
    visible(list).map((n) =>
      n.children ? (
        <details key={n.label} className="sub-group">
          <summary className="nav-item sub-item"><Icon name={n.icon} size={16} /><span>{n.label}</span></summary>
          <div className="sub">{render(n.children)}</div>
        </details>
      ) : (
        <a key={n.label} className="nav-item sub-item" href={href(n.path)} {...(internal ? {} : { target: '_blank', rel: 'noopener' })}>
          <Icon name={n.icon} size={16} /><span>{n.label}</span>
        </a>
      ),
    );
  return (
    <details className="app-menu">
      <summary className="nav-item"><Icon name={icon} size={18} /><span>{name}</span></summary>
      <div className="sub">{render(nodes)}</div>
    </details>
  );
}
