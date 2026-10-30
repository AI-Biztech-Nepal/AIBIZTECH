import Link from 'next/link';
import type { Org } from '@/lib/supabase';
import { signOut, switchOrganization } from './actions';

export function Header({ org, orgs = [], page }: { org: Org; orgs?: Org[]; page: 'home' | 'admin' | 'team' }) {
  return (
    <header>
      <strong>AI Biz Tech Nepal</strong>
      <span>{org.name} · <span className="cap">{org.org_role}</span></span>
      {orgs.length > 1 && (
        <form action={switchOrganization} className="inline">
          <select name="org" defaultValue={org.id} aria-label="Organization">
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button>Switch</button>
        </form>
      )}
      {page !== 'home' && <Link href="/">Home</Link>}
      {org.org_role !== 'member' && page !== 'admin' && <Link href="/admin">Admin</Link>}
      {org.org_role !== 'member' && page !== 'team' && <Link href="/team">Team</Link>}
      <form action={signOut} className="inline"><button className="link">Sign out</button></form>
    </header>
  );
}
