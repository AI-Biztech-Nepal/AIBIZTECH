import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient, type Org } from '@/lib/supabase';
import { signOut, switchOrg } from './actions';
import { Icon, serviceIcon } from './icons';

type Page = 'home' | 'admin' | 'team' | 'apps';

// App shell: left navigation like the apps themselves. Apps come from core.services, so a new
// service (or a feature turned on for a business) shows up here without touching this file.
export async function Shell({ org, orgs = [], page, children }: { org: Org | null; orgs?: Org[]; page: Page; children: ReactNode }) {
  const { data: services } = await (await createClient()).schema('core').from('services').select('key, name').eq('is_active', true).order('name');
  const isAdmin = !!org && org.org_role !== 'member';
  const initials = (org?.name ?? 'AIBIZTECH').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const item = (href: string, icon: string, label: string, active = false, extra?: ReactNode) => (
    <Link href={href} className={`nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} {...(href.startsWith('/go/') ? { target: '_blank', rel: 'noopener' } : {})}>
      <Icon name={icon} size={18} /><span>{label}</span>{extra}
    </Link>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">{initials}</span>
          {org ? (
            <details className="orgmenu">
              <summary><strong>{org.name}</strong><small className="cap">{org.org_role}</small></summary>
              <div className="menu">
                {orgs.map((o) => (
                  <form key={o.id} action={switchOrg}>
                    <input type="hidden" name="org_id" value={o.id} />
                    <button className={o.id === org.id ? 'current' : ''}>{o.id === org.id ? '✓ ' : ''}{o.name}</button>
                  </form>
                ))}
                <Link href="/onboarding">+ Add another business</Link>
              </div>
            </details>
          ) : (
            <div className="brand-text"><strong>AIBIZTECH</strong><small>Business suite</small></div>
          )}
        </div>

        <nav>
          {item('/', 'dashboard', 'Dashboard', page === 'home')}

          <details className="group" open>
            <summary>Apps</summary>
            {services?.filter((s) => !org || org.services[s.key]).map((s) => {
              const on = !!org?.services[s.key];
              // Finance runs inside AIBIZTECH (served at /finance); the other apps are still opened through single sign-on
              return on && s.key === 'finance'
                ? item('/finance', serviceIcon(s.key, s.name), s.name)
                : on && s.key === 'attendance' && process.env.ATTENDANCE_URL
                ? item('/attendance', serviceIcon(s.key, s.name), s.name)
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

        <form action={signOut} className="signout">
          <button className="nav-item"><Icon name="signout" size={18} /><span>Sign out</span></button>
        </form>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
