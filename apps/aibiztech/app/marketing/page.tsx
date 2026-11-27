import { getMarketing } from '@/lib/marketing';
import { Shell } from '../shell';

export default async function MarketingHome() {
  const { db, ctx, org, setupError } = await getMarketing();
  const today = new Date().toISOString().slice(0, 10);
  const [{ count: newLeads }, { data: people }, { data: follow }] = await Promise.all([
    db.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', org.id).eq('status', 'new'),
    db.from('customers').select('lead_status').eq('company_id', org.id).limit(10000),
    db.from('crm_followups').select('due_at').eq('company_id', org.id).eq('status', 'pending').limit(5000),
  ]);
  const by = (s: string) => (people ?? []).filter((p) => (p.lead_status ?? 'new') === s).length;
  const due = (follow ?? []).filter((f) => (f.due_at ?? '').slice(0, 10) <= today).length;
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame" light>
      <h1>Marketing</h1>
      {setupError && <p className="error">{setupError}</p>}
      <div className="panels">
        <section className="tile"><h2>New leads</h2><p className="big">{newLeads ?? 0}</p><p><a href="/marketing/leads">Decide leads</a></p></section>
        <section className="tile"><h2>Follow-ups due</h2><p className="big">{due}</p><p><a href="/marketing/crm">Open CRM</a></p></section>
        <section className="tile"><h2>People in the CRM</h2><p className="big">{people?.length ?? 0}</p>
          <p>{by('new')} new · {by('contacted')} contacted · {by('interested')} interested · {by('converted')} converted · {by('lost')} lost</p></section>
      </div>
    </Shell>
  );
}
