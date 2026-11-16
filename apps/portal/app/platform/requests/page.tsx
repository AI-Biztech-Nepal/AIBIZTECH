import Link from 'next/link';
import { platformClient, ago } from '@/lib/platform';
import { SubmitButton } from '@/app/submit-button';
import { Notice } from '../../notice';
import { decideRequest } from '../actions';

type Req = {
  id: number; org_id: string; org_name: string; requested_by_email: string | null; turn_on: string[]; turn_off: string[];
  note: string | null; status: string; quote_amount: number | null; quote_note: string | null; decision_note: string | null; created_at: string;
};

export default async function Requests({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;
  const supabase = await platformClient();
  const [{ data }, { data: features }] = await Promise.all([
    supabase.schema('core').rpc('platform_feature_requests'),
    supabase.schema('core').from('features').select('key, name'),
  ]);
  const name = new Map((features ?? []).map((f) => [f.key, f.name]));
  const all = (data ?? []) as Req[];
  const open = all.filter((r) => r.status === 'pending');
  const done = all.filter((r) => r.status !== 'pending').slice(0, 20);

  return (
    <main className="pf-main">
      <div className="pf-title"><h1>Feature requests</h1><p className="sub">What customers chose. Approving sets every feature up at once; declining needs a reason they will read.</p></div>
      <Notice error={error} message={message} />

      {open.length === 0 ? <p className="empty">No requests waiting.</p> : (
        <ul className="rows">
          {open.map((r) => (
            <li key={r.id} className="setting">
              <div>
                <h2><Link href={`/platform/orgs/${r.org_id}`}>{r.org_name}</Link></h2>
                <p className="sub">{r.requested_by_email ?? 'unknown'} · {ago(r.created_at)}</p>
              </div>
              <div>
                <ul className="alerts">
                  {r.turn_on.map((k) => <li key={k}>Add {name.get(k) ?? k}</li>)}
                  {r.turn_off.map((k) => <li key={k}>Remove {name.get(k) ?? k}</li>)}
                </ul>
                {r.note && <p>“{r.note}”</p>}
                <form action={decideRequest}>
                  <input type="hidden" name="id" value={r.id} />
                  <div className="grid2">
                    <label>Price, NPR (optional)<input name="amount" type="number" min="0" step="1" /></label>
                    <label>Note with the price (the customer sees this)<input name="quote_note" maxLength={300} placeholder="e.g. Rs 1,500 per month" /></label>
                  </div>
                  <label>Reason (required to decline)<input name="note" maxLength={300} /></label>
                  <div className="actions">
                    <button name="decision" value="approve" className="button">Approve and set up</button>
                    <button name="decision" value="decline" className="ghost">Decline</button>
                  </div>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section>
          <h2>Recent decisions</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Organization</th><th>Result</th><th>Price</th><th>When</th></tr></thead>
              <tbody>
                {done.map((r) => (
                  <tr key={r.id}><td>{r.org_name}</td><td className="cap">{r.status}</td><td>{r.quote_amount != null ? `Rs ${r.quote_amount}` : '—'}</td><td>{ago(r.created_at)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
