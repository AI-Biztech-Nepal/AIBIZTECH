import { getMarketing } from '@/lib/marketing';
import { Notice } from '../../notice';
import { Shell } from '../../shell';
import { addPerson, completeFollowup, logInteraction, scheduleFollowup, setStatus } from '../actions';

const STATUSES = ['new', 'contacted', 'interested', 'converted', 'lost'];
const SOURCES: [string, string][] = [['walk_in', 'Walk-in'], ['website', 'Website'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['referral', 'Referral'], ['other', 'Other']];

export default async function Crm({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; status?: string }> }) {
  const { error, message, status } = await searchParams;
  const { db, ctx, org, setupError } = await getMarketing();
  let pq = db.from('customers').select('id, name, contact_number, address, source, lead_status, interested_vehicle, notes').eq('company_id', org.id).order('created_at', { ascending: false }).limit(1000);
  if (status && STATUSES.includes(status)) pq = pq.eq('lead_status', status);
  const [{ data: people, error: loadError }, { data: follow }, { data: touches }] = await Promise.all([
    pq,
    db.from('crm_followups').select('id, customer_id, due_at, purpose, notes').eq('company_id', org.id).eq('status', 'pending').order('due_at').limit(500),
    db.from('crm_interactions').select('customer_id, kind, summary, occurred_at').eq('company_id', org.id).order('occurred_at', { ascending: false }).limit(2000),
  ]);
  const name = new Map((people ?? []).map((p) => [p.id, p.name]));
  const last = new Map<string, { kind: string | null; summary: string | null; occurred_at: string | null }>();
  for (const t of touches ?? []) if (t.customer_id && !last.has(t.customer_id)) last.set(t.customer_id, t);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame" light>
      <h1>CRM</h1>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />

      <section className="tile">
        <h2>Follow-ups to do ({follow?.length ?? 0})</h2>
        {follow?.length ? (
          <table className="table">
            <thead><tr><th>Due</th><th>Person</th><th>About</th><th /></tr></thead>
            <tbody>{follow.map((f) => {
              const late = (f.due_at ?? '').slice(0, 10) < today;
              return (
                <tr key={f.id}>
                  <td className={late ? 'out' : undefined}>{(f.due_at ?? '').slice(0, 10)}{late ? ' (late)' : ''}</td>
                  <td>{name.get(f.customer_id) ?? '—'}</td>
                  <td>{f.purpose ?? '—'}{f.notes ? <><br /><small>{f.notes}</small></> : null}</td>
                  <td><form action={completeFollowup} style={{ display: 'flex', gap: 6 }}><input type="hidden" name="id" value={f.id} /><input name="outcome" placeholder="What happened?" style={{ width: 180 }} /><button type="submit">Done</button></form></td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <p>Nothing to follow up.</p>}
      </section>

      <section className="tile">
        <h2>Add a person</h2>
        <form action={addPerson}>
          <div className="grid2">
            <label>Name<input name="name" required /></label>
            <label>Phone<input name="contact_number" /></label>
            <label>Address<input name="address" /></label>
            <label>Found us through<select name="source" defaultValue=""><option value="">—</option>{SOURCES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Interested in<input name="interested_vehicle" /></label>
          </div>
          <label>Notes<textarea name="notes" rows={2} /></label>
          <button type="submit">Add</button>
        </form>
      </section>

      <section className="tile">
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <a href="/marketing/crm" className={!status ? 'button' : 'button secondary'}>All</a>
          {STATUSES.map((s) => <a key={s} href={`/marketing/crm?status=${s}`} className={s === status ? 'button' : 'button secondary'}>{s[0].toUpperCase() + s.slice(1)}</a>)}
        </nav>
        {people?.length ? (
          <table className="table">
            <thead><tr><th>Person</th><th>Status</th><th>Last contact</th><th>Log / schedule</th></tr></thead>
            <tbody>{people.map((p) => {
              const t = last.get(p.id);
              return (
                <tr key={p.id}>
                  <td>{p.name}<br /><small>{[p.contact_number, p.source?.replace('_', '-'), p.interested_vehicle].filter(Boolean).join(' · ')}</small></td>
                  <td>
                    <form action={setStatus} style={{ display: 'flex', gap: 6 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <select name="lead_status" defaultValue={p.lead_status ?? 'new'}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                      <button type="submit" className="secondary">Save</button>
                    </form>
                  </td>
                  <td>{t ? <>{t.kind} · {(t.occurred_at ?? '').slice(0, 10)}<br /><small>{t.summary}</small></> : '—'}</td>
                  <td>
                    <details><summary>Log or schedule</summary>
                      <form action={logInteraction} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input type="hidden" name="id" value={p.id} />
                        <select name="kind" defaultValue="call"><option value="call">Call</option><option value="visit">Visit</option><option value="message">Message</option><option value="other">Other</option></select>
                        <input name="summary" placeholder="What was discussed?" required style={{ width: 180 }} /><button type="submit">Log</button>
                      </form>
                      <form action={scheduleFollowup} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input type="hidden" name="id" value={p.id} />
                        <input name="due" type="date" required /><input name="purpose" placeholder="Follow up about…" style={{ width: 160 }} /><button type="submit" className="secondary">Schedule</button>
                      </form>
                    </details>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <p>No people here yet.</p>}
      </section>
    </Shell>
  );
}
