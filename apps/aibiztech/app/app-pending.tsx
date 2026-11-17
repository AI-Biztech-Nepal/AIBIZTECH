import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { ServiceLogo } from './icons';
import { Shell } from './shell';

// Shown at /attendance and /stock until that app runs under the portal address (one login, like Finance).
// It does not send people to the app's own login page.
export async function AppPending({ service, name, liveUrl }: { service: string; name: string; liveUrl: string }) {
  const { ctx } = await getContext();
  if (!ctx) redirect('/login');
  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];
  if (!org) redirect('/onboarding');
  return (
    <Shell org={org} orgs={ctx.orgs} page="home">
      <section className="tile" style={{ maxWidth: 560 }}>
        <ServiceLogo svc={{ key: service, name }} />
        <h1>{name}</h1>
        <p>{name} is being connected to AIBIZTECH, so it opens here with the same login as Finance. It isn't switched on for your account yet.</p>
        <p className="muted">Until then you can still use the current {name} on its own address. It has a separate login.</p>
        <a className="button" href={liveUrl} target="_blank" rel="noopener">Open the current {name}</a>
      </section>
    </Shell>
  );
}
