import Link from 'next/link';
import type { Org } from '@/lib/supabase';
import { signOut } from './actions';

export function Header({ org, page }: { org: Org; page: 'home' | 'admin' | 'team' }) {
  return (
    <header>
      <strong>AIBIZTECH</strong>
      <span>{org.name} · <span className="cap">{org.org_role}</span></span>
      {page !== 'home' && <Link href="/">Home</Link>}
      {org.org_role !== 'member' && page !== 'admin' && <Link href="/admin">Admin</Link>}
      {org.org_role !== 'member' && page !== 'team' && <Link href="/team">Team</Link>}
      <form action={signOut} className="inline"><button className="link">Sign out</button></form>
    </header>
  );
}
