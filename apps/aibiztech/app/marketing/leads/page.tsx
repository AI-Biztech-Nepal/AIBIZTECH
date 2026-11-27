import { getMarketing } from '@/lib/marketing';
import { Notice } from '../../notice';
import { Shell } from '../../shell';
import { acceptLead, addLead, rejectLead } from '../actions';

const TABS = ['new', 'accepted', 'rejected', 'all'] as const;

export default async function Leads({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; tab?: string }> }) {
  const { error, message, tab: rawTab } = await searchParams;
  const tab = (TABS as readonly string[]).includes(rawTab ?? '') ? (rawTab as (typeof TABS)[number]) : 'new';
  const { db, ctx, org, setupError, isAdmin } = await getMarketing();
  let q = db.from('leads').select('id, type, name, phone, email, address, message, vehicle_type, status, remark, decided_by, created_at').eq('company_id', org.id).order('created_at', { ascending: false }).limit(500);
  if (tab !== 'all') q = q.eq('status', tab);
  const { data: leads, error: loadError } = await q;
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame" light>
      <h1>Leads</h1>
      <p>Accept a lead to put the person in the CRM, or reject it with a reason. A lead is never deleted.</p>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />
      <section className="tile">
        <h2>Add a lead</h2>
        <form action={addLead}>
          <div className="grid2">
            <label>Name<input name="name" /></label>
            <label>Phone<input name="phone" /></label>
            <label>Email<input name="email" type="email" /></label>
            <label>Address<input name="address" /></label>
            <label>Looking for<select name="type" defaultValue="enquiry"><option value="enquiry">Buy a vehicle</option><option value="sell">Sell their vehicle</option><option value="exchange">Exchange</option><option value="service">Book a service</option></select></label>
            <label>Vehicle type<input name="vehicle_type" placeholder="Bike, scooter, car…" /></label>
          </div>
          <label>Message<textarea name="message" rows={2} /></label>
          <button type="submit">Add lead</button>
        </form>
      </section>
      <section className="tile">
        <nav style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {TABS.map((t) => <a key={t} href={`/marketing/leads?tab=${t}`} className={t === tab ? 'button' : 'button secondary'}>{t[0].toUpperCase() + t.slice(1)}</a>)}
        </nav>
        {leads?.length ? (
          <table className="table">
            <thead><tr><th>Date</th><th>Who</th><th>Wants</th><th>Status</th>{isAdmin && tab === 'new' && <th>Decide</th>}</tr></thead>
            <tbody>{leads.map((l) => (
              <tr key={l.id}>
                <td>{(l.created_at ?? '').slice(0, 10)}</td>
                <td>{l.name ?? '—'}<br /><small>{[l.phone, l.email, l.address].filter(Boolean).join(' · ')}</small></td>
                <td>{l.type}{l.vehicle_type ? ` · ${l.vehicle_type}` : ''}{l.message ? <><br /><small>{l.message}</small></> : null}</td>
                <td>{l.status}{l.remark ? <><br /><small>{l.remark}</small></> : null}{l.decided_by ? <><br /><small>by {l.decided_by}</small></> : null}</td>
                {isAdmin && tab === 'new' && (
                  <td>
                    <form action={acceptLead} style={{ marginBottom: 6 }}><input type="hidden" name="id" value={l.id} /><button type="submit">Add to CRM</button></form>
                    <form action={rejectLead} style={{ display: 'flex', gap: 6 }}><input type="hidden" name="id" value={l.id} /><input name="remark" placeholder="Why reject?" required minLength={3} style={{ width: 150 }} /><button type="submit" className="secondary">Reject</button></form>
                  </td>
                )}
              </tr>
            ))}</tbody>
          </table>
        ) : <p>No leads here.</p>}
      </section>
    </Shell>
  );
}
