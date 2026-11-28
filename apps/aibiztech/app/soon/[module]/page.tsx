import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SOON } from '@/lib/app-tiles';
import { getContext } from '@/lib/supabase';
import page from '../../dashboard.module.css';
import { ModuleLogo } from '../../icons';
import s from '../../plans/plans.module.css';
import { Shell } from '../../shell';

// /soon/chats ...: an app that is announced but not built yet
export default async function ComingSoon({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const tile = SOON.find((t) => t.id === module);
  if (!tile) notFound();
  const { ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');

  return (
    <Shell org={org} orgs={ctx.orgs} page="soon" current={tile.id} light>
      <div className={page.page}>
        <div className={page.head}>
          <div>
            <h1>{tile.name}</h1>
            <p className={page.sub}>Coming soon</p>
          </div>
        </div>
        <section className={s.card} style={{ display: 'grid', justifyItems: 'center', gap: 12, padding: '36px 18px', textAlign: 'center' }}>
          <ModuleLogo art={tile.art!} />
          <strong>{tile.name} is not ready yet.</strong>
          <p className={page.sub}>There is nothing to set up or pay for. It will open here once it is built.</p>
          {org.org_role !== 'member' && <Link href="/apps" className={s.button}>Back to Add apps</Link>}
        </section>
      </div>
    </Shell>
  );
}
