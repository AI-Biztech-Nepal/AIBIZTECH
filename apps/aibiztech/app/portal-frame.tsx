import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import type { Org } from '@/lib/supabase';
import { ATTENDANCE_MENU, type MenuNode } from '@/lib/attendance-menu';
import { STOCK_MENU, STOCK_SERVICE_MENU } from '@/lib/stock-menu';
import { MARKETING_MENU } from '@/lib/marketing-menu';
import { FINANCE_MENU } from '@/lib/finance-menu';
import { signOut, switchOrg } from './actions';
import { Icon, serviceIcon } from './icons';
import { SidebarMemory } from './sidebar-memory';
import { CollapseButton, MenuButton } from './sidebar-toggle';
import { fontVariables } from './fonts';
import s from './frame.module.css';

export type Page = 'home' | 'admin' | 'team' | 'apps' | 'plans' | 'profile' | 'frame';
export type Service = { key: string; name: string; base_url: string };

type Props = {
  org: Org | null;
  orgs?: Org[];
  services: Service[] | null;
  person: string;
  email: string;
  page: Page;
  bleed?: boolean; // an app's own page fills the whole area
  light?: boolean; // redesigned portal pages; module screens keep their own look
  preview?: boolean; // look only: switching business and signing out do nothing
  children: ReactNode;
};

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');
const initialsOf = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// The frame around every signed-in page: side panel on the left, business and account menus on top.
// Apps come from core.services, so a new service (or one turned on for a business) shows up without touching this file.
export function PortalFrame({ org, orgs = [], services, person, email, page, bleed = false, light = false, preview = false, children }: Props) {
  const isAdmin = !!org && org.org_role !== 'member';
  const status = org?.verification_status;
  const statusLabel = status === 'verified' ? 'Verified' : status === 'rejected' ? 'Rejected' : 'Awaiting verification';

  const item = (href: string, icon: string, label: string, active = false, extra?: ReactNode) => (
    <Link href={href} className={cls(s.item, active && s.active)} aria-current={active ? 'page' : undefined} aria-label={label} title={label}>
      <Icon name={icon} size={17} /><span className={s.label}>{label}</span>{extra}
    </Link>
  );

  return (
    <div className={cls(s.frame, fontVariables)}>
      <aside className={s.sidebar} data-lenis-prevent>
        <div className={s.brand}>
          {/* The logo file is one tall picture; the mark and the wordmark are shown side by side by cropping it */}
          <Link href="/" className={s.logo} aria-label="AIBIZTECH home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className={s.mark}><img src="/logo.png" alt="" /></span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className={s.word}><img src="/logo.png" alt="" /></span>
          </Link>
          <CollapseButton className={s.collapse} />
        </div>

        <nav className={s.nav} aria-label="Main">
          <div className={s.group}>
            <div className={s.groupTitle}>Workspace</div>
            {item('/', 'dashboard', 'Dashboard', page === 'home')}
            {isAdmin && item('/admin', 'admin', 'My Business', page === 'admin')}
            {isAdmin && item('/team', 'team', 'Team Members', page === 'team')}
          </div>

          <div className={s.group}>
            <div className={s.groupTitle}>Modules</div>
            {appsInOrder(services, org).map((svc) => {
              const on = !!org?.services[svc.key];
              // HRIS and Marketing open their own menu here
              if (on && svc.key === 'attendance') return <AppMenu key={svc.key} service="attendance" icon="attendance" name={svc.name} home="/" nodes={ATTENDANCE_MENU} isAdmin={org?.services.attendance === 'admin'} />;
              if (on && svc.key === 'marketing') return <AppMenu key={svc.key} service="marketing" icon="megaphone" name={svc.name} home="/" nodes={MARKETING_MENU} isAdmin={org?.services.marketing === 'admin'} />;
              if (on && svc.key === 'stock') {
                const stockAdmin = org?.services.stock === 'admin';
                // Sales, EMI, Service and Sanakhat sit beside Stock Manager in the side panel, not inside it
                return (
                  <Fragment key={svc.key}>
                    <AppMenu service="stock" icon="stock" name={svc.name} home="/" nodes={STOCK_MENU} isAdmin={stockAdmin} />
                    {item('/stock/sales', 'task', 'Sales')}
                    {stockAdmin && item('/stock/emi', 'card', 'EMI')}
                    <AppMenu service="stock" icon="wrench" name="Service" home="/jobs" nodes={STOCK_SERVICE_MENU} isAdmin={stockAdmin} />
                    {stockAdmin && item('/stock/sanakhat', 'doc', 'Sanakhat')}
                  </Fragment>
                );
              }
              // Finance runs inside AIBIZTECH (served at /finance); other apps are opened through single sign-on
              if (on && svc.key === 'finance') return <AppMenu key={svc.key} service="finance" icon="finance" name={svc.name} home="/company-dashboard" nodes={FINANCE_MENU} isAdmin />;
              return (
                <Fragment key={svc.key}>
                  {on ? item(`/app/${svc.key}`, serviceIcon(svc.key, svc.name), svc.name) : item(org ? '/' : '/onboarding', serviceIcon(svc.key, svc.name), svc.name, false, <Icon name="lockmini" size={14} />)}
                </Fragment>
              );
            })}
            {isAdmin && item('/apps', 'plus', 'Add apps', page === 'apps')}
          </div>

          <div className={s.group}>
            <div className={s.groupTitle}>Account</div>
            {isAdmin && item('/plans', 'spark', 'Subscription & Plans', page === 'plans')}
            {item('/profile', 'settings', 'Settings', page === 'profile')}
          </div>
        </nav>
        <SidebarMemory />
      </aside>

      <div className={s.top}>
        <MenuButton className={s.menuButton} />
        <details className={s.drop}>
          <summary className={s.business}>
            <span className={s.square} aria-hidden="true">{initialsOf(org?.name ?? person)}</span>
            <span className={s.businessName}>{org?.name ?? 'No business yet'}</span>
          </summary>
          <div className={s.panel} data-lenis-prevent>
            {orgs.length > 0 && <small>Switch business</small>}
            {orgs.map((o) => (
              <form key={o.id} action={preview ? undefined : switchOrg}>
                <input type="hidden" name="org_id" value={o.id} />
                <button type={preview ? 'button' : 'submit'} className={cls(s.choice, o.id === org?.id && s.current)} aria-current={o.id === org?.id ? 'true' : undefined}>
                  <span>{o.name}</span>{o.id === org?.id && <span aria-hidden="true">✓</span>}
                </button>
              </form>
            ))}
            <Link href="/onboarding" className={s.link}>{org ? 'Add another business' : 'Set up your business'}</Link>
          </div>
        </details>

        <details className={cls(s.drop, s.account)}>
          <summary className={s.who} aria-label="Account menu">
            <span className={s.avatar}>{initialsOf(person)}{status && <i className={s[status]} title={statusLabel} />}</span>
            <span className={s.whoText}><strong>{person}</strong><small>{org ? org.org_role : email}</small></span>
          </summary>
          <div className={cls(s.panel, s.right)} data-lenis-prevent>
            <div className={s.me}><strong>{person}</strong><span>{email}</span></div>
            {org && <dl><dt>Business</dt><dd>{org.name}</dd><dt>Your role</dt><dd className="cap">{org.org_role}</dd><dt>Status</dt><dd>{statusLabel}</dd></dl>}
            {org && <Link href="/profile" className={s.link}>Edit profile</Link>}
            <form action={preview ? undefined : signOut}>
              <button type={preview ? 'button' : 'submit'} className={s.signOut}><Icon name="signout" size={16} /> Sign out</button>
            </form>
          </div>
        </details>
      </div>

      <main className={cls(s.content, bleed && s.bleed, light && s.light)}>{children}</main>
    </div>
  );
}

// The apps in the side panel, in this order, with Attendance Nepal shown as HRIS
const APP_ORDER = ['attendance', 'finance', 'marketing', 'stock'];
const SHOWN_AS: Record<string, string> = { attendance: 'HRIS' };
function appsInOrder(services: Service[] | null, org: Org | null): Service[] {
  const rank = (key: string) => { const i = APP_ORDER.indexOf(key); return i < 0 ? APP_ORDER.length : i; };
  return (services ?? [])
    .filter((svc) => !org || org.services[svc.key])
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map((svc) => ({ ...svc, name: SHOWN_AS[svc.key] ?? svc.name }));
}

// An app's own menu as a dropdown under the app name; every page opens inside the portal, in this same tab
function AppMenu({ service, icon, name, nodes, isAdmin, home = '/' }: { service: string; icon: string; name: string; nodes: MenuNode[]; isAdmin: boolean; home?: string }) {
  const href = (path = '/') => `${service === 'stock' || service === 'marketing' ? `/${service}` : `/app/${service}`}${path === '/' ? '' : path}`;
  const render = (list: MenuNode[]): ReactNode =>
    list.filter((n) => !n.adminOnly || isAdmin).map((n) =>
      n.children ? (
        <details key={n.label} className={s.menu} data-menu={`${service}:${n.label}`}>
          <summary className={s.item}><Icon name={n.icon} size={15} /><span className={s.label}>{n.label}</span></summary>
          <div className={s.sub}>{render(n.children)}</div>
        </details>
      ) : (
        <a key={n.label} className={s.item} href={href(n.path)}>
          <Icon name={n.icon} size={15} /><span className={s.label}>{n.label}</span>
        </a>
      ),
    );
  return (
    <details className={s.menu} data-menu={`app:${service}:${name}`}>
      {/* The name opens the app's first page; the arrow opens and closes the list */}
      <summary className={s.item}><a href={href(home)} className={s.appTitle} aria-label={name} title={name}><Icon name={icon} size={17} /><span className={s.label}>{name}</span></a></summary>
      <div className={s.sub}>{render(nodes)}</div>
    </details>
  );
}
