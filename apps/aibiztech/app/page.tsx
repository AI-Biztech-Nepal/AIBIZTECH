import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { Shell } from './shell';
import { DashboardView, SetupDashboard } from './dashboard-view';
import { loadRaw } from './dashboard-data';
import { computeDashboard } from '@/lib/books';
import { subscription } from '@/lib/plans';
import { TrialEndedView } from './trial-ended-view';
import type { Search } from './notice';

export default async function Launcher({ searchParams }: { searchParams: Search }) {
  const { error, denied, message } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect('/login');
  if (ctx.orgs.length === 0) {
    // New account: show every app right away; they unlock once an organization is set up and verified
    const { data: all } = await supabase.schema('core').from('services').select('key, name').eq('is_active', true).order('name');
    return (
      <Shell org={null} page="home" light>
        <SetupDashboard name={ctx.full_name} apps={all ?? []} error={error} message={message} />
      </Shell>
    );
  }

  const org = ctx.orgs.find((o) => o.id === ctx.active_org_id) ?? ctx.orgs[0];

  // No app is open to this person. If the free trial being over is why, say so instead of showing an empty dashboard.
  if (!Object.keys(org.services).length) {
    const { data: rows } = await supabase.schema('core').from('org_services').select('status, trial_ends_at, enabled_at').eq('org_id', org.id);
    const sub = subscription(rows ?? []);
    if (sub.kind === 'ended') {
      return (
        <Shell org={org} orgs={ctx.orgs} page="home" light>
          <TrialEndedView orgName={org.name} ended={sub.ended} isAdmin={org.org_role !== 'member'} contact={process.env.NEXT_PUBLIC_SALES_CONTACT} />
        </Shell>
      );
    }
  }

  const { data: services } = await supabase.schema('core').from('services').select('key, name').eq('is_active', true);
  const deniedName = services?.find((s) => s.key === denied)?.name;

  // The business's money dashboard, from its Finance books (only when the business has Finance)
  const raw = org.services.finance ? await loadRaw(supabase, org.id) : null;
  const dash = raw ? computeDashboard(raw) : null;
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kathmandu' }).format(new Date());

  return (
    <Shell org={org} orgs={ctx.orgs} page="home" light>
      <DashboardView
        orgName={org.name}
        today={today}
        access={org.services}
        isAdmin={org.org_role !== 'member'}
        verification={{ status: org.verification_status, note: org.verification_note }}
        d={dash}
        error={error}
        message={deniedName ? `You don't have access to ${deniedName} in ${org.name}. Ask your organization admin.` : message}
      />
    </Shell>
  );
}
