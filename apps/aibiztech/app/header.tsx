import Link from 'next/link';
import type { Org } from '@/lib/supabase';
import { signOut, switchOrg } from './actions';

export function Header({ org, orgs = [], page }: { org: Org | null; orgs?: Org[]; page: 'home' | 'admin' | 'team' }) {
  return (
    <header>
      <strong>AIBIZTECH</strong>
      {org && (
        <details className="orgmenu">
          <summary>{org.name} · <span className="cap">{org.org_role}</span></summary>
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
      )}
      {page !== 'home' && <Link href="/">Home</Link>}
      {org && org.org_role !== 'member' && page !== 'admin' && <Link href="/admin">Admin</Link>}
      {org && org.org_role !== 'member' && page !== 'team' && <Link href="/team">Team</Link>}
      <form action={signOut} className="inline"><button className="link">Sign out</button></form>
    </header>
  );
}
