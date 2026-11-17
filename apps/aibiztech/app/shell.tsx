import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient, type Org } from '@/lib/supabase';
import { signOut, switchOrg } from './actions';
import { Icon, serviceIcon } from './icons';

type Page = 'home' | 'admin' | 'team';

// App shell: left navigation like the apps themselves. Apps come from core.services, so a new
// service (or a feature turned on for a business) shows up here without touching this file.
export async function Shell({ org, orgs = [], page, children }: { org: Org | null; orgs?: Org[]; page: Page; children: ReactNode }) {
  const { data: services } = await (await createClient()).schema('core').from('services').select('key, name').eq('is_active', true).order('name');
  const isAdmin = !!org && org.org_role !== 'member';
  const initials = (org?.name ?? 'AIBIZTECH').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const item = (href: string, icon: string, label: string, active = false, extra?: ReactNode) => (
    <Link href={href} className={`nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
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
            {services?.map((s) => {
              const on = !!org?.services[s.key];
              return on
                ? item(`/go/${s.key}`, serviceIcon(s.key, s.name), s.name)
                : item(org ? '/' : '/onboarding', serviceIcon(s.key, s.name), s.name, false, <Icon name="lockmini" size={14} />);
            })}
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
