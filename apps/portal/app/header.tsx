import { SubmitButton } from '@/app/submit-button';
import Link from 'next/link';
import type { Org } from '@/lib/supabase';
import { isPlatformAdmin } from '@/lib/platform';
import { createClient } from '@/lib/supabase';
import { signOut } from './actions';
import { Bell } from './bell';
import { OrgSwitcher } from './org-switcher';

type Page = 'home' | 'team' | 'settings';

// Rendered above <main> so it is the page banner, with the links in a <nav>
export async function Header({ org, orgs = [], page }: { org: Org; orgs?: Org[]; page: Page }) {
  // RLS returns notifications to owners and admins only, so members get no bell
  const admin = org.org_role !== 'member';
  const platform = await isPlatformAdmin();
  let bell = null;
  if (admin) {
    const core = (await createClient()).schema('core');
    const [{ data: notes }, { data: reads }] = await Promise.all([
      core.from('notifications').select('id, title, body, created_at').eq('org_id', org.id).order('created_at', { ascending: false }).limit(6),
      core.from('notification_reads').select('notification_id'),
    ]);
    const seen = new Set((reads ?? []).map((r) => r.notification_id));
    const items = (notes ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, read: seen.has(n.id), when: new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kathmandu' }) }));
    bell = <Bell notes={items} unread={items.filter((n) => !n.read).length} orgId={org.id} />;
  }
  const link = (href: string, label: string, key: Page) => <Link href={href} aria-current={page === key ? 'page' : undefined}>{label}</Link>;
  return (
    <header className="site-header">
      <strong className="brand"><span className="mark" aria-hidden>AB</span>AI Biz Tech Nepal</strong>
      {orgs.length > 1 ? <OrgSwitcher org={org} orgs={orgs} /> : <span className="chip">{org.name}</span>}
      <nav aria-label="Main">
        {link('/', 'Home', 'home')}
        {org.org_role !== 'member' && link('/team', 'Team', 'team')}
        {link('/settings', 'Settings', 'settings')}
        {platform && <Link href="/platform">Platform</Link>}
        {bell}
        <form action={signOut}><SubmitButton className="link">Sign out</SubmitButton></form>
      </nav>
    </header>
  );
}
