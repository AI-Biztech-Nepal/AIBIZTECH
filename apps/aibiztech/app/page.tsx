import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { Shell } from './shell';
import { MoneyDashboard } from './dashboard-view';
import { loadRaw } from './dashboard-data';
import { computeDashboard } from '@/lib/books';
import { ServiceLogo } from './icons';
import { Notice, type Search } from './notice';

export default async function Launcher({ searchParams }: { searchParams: Search }) {
  const { error, denied, message } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  if (ctx.orgs.length === 0) {
    // New account: show every app right away; they unlock once an organization is set up and verified
    const { data: all } = await supabase.schema('core').from('services').select('key, name').eq('is_active', true).order('name');
    return (
      <Shell org={null} page="home">
        <h1>Hello{ctx.full_name ? `, ${ctx.full_name}` : ''}</h1>
        <Notice error={error} message={message} />
        <p role="status" className="banner">
          Finish setting up your organization to unlock these apps. <Link href="/onboarding">Set up organization</Link>
        </p>
        <ul className="tiles">
          {all?.map((s) => (
            <li key={s.key} className="tile app">
              <Link href="/onboarding" className="app-link">
                <ServiceLogo svc={s} />
                <h2>{s.name}</h2>
                <p>Tap to set up your organization and unlock this app.</p>
              </Link>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  const verified = org.verification_status === 'verified';
  const { data: services } = await supabase.schema('core').from('services').select('key, name').eq('is_active', true);
  const deniedName = services?.find((s) => s.key === denied)?.name;

  // The business's money dashboard, from its Finance books (only when the business has Finance)
  const raw = org.services.finance ? await loadRaw(supabase, org.id) : null;
  const dash = raw ? computeDashboard(raw) : null;
  const initials = (ctx.full_name || org.name).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Shell org={org} orgs={ctx.orgs} page="home">
      <Notice error={error} message={deniedName ? `You don't have access to ${deniedName} in ${org.name}. Ask your organization admin.` : message} />

      <section className="hero">
        <span className="avatar" aria-hidden="true">{initials}</span>
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>{ctx.full_name || 'Hello'}</h1>
          <p className="hero-sub">{org.name} · <span className="cap">{org.org_role}</span></p>
        </div>
      </section>

      {org.verification_status === 'pending' && (
        <p role="status" className="banner">Your organization is awaiting verification. Apps unlock once it is verified.</p>
      )}
      {org.verification_status === 'rejected' && (
        <p role="alert" className="banner error">Verification was rejected{org.verification_note ? `: ${org.verification_note}` : '.'} Contact support.</p>
      )}

      {dash && (
        <>
          <div className="chips">
            <span className="chip big-chip">{dash.counts.customers} customers</span>
            <span className="chip big-chip">{dash.counts.accounts} bank accounts</span>
            <span className="chip big-chip">{dash.counts.entries} bills and expenses</span>
          </div>
          <MoneyDashboard d={dash} />
        </>
      )}
    </Shell>
  );
}
