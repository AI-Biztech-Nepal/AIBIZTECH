import { getStock } from '@/lib/stock';
import { Notice } from '../../notice';
import { Shell } from '../../shell';
import { setSanakhat } from '../actions';

const OVERDUE_DAYS = 30;
const STOCK_LABEL: Record<string, string> = { available: 'In stock', reserved: 'Booked', in_repair: 'In repair', sold: 'Sold', scrap: 'Scrap', unlisted: 'Unlisted' };
const daysSince = (d: string | null) => { const t = Date.parse((d ?? '').slice(0, 10)); return Number.isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 86400000)); };

// Every vehicle with the progress of its Sanakhat (ownership termination). No prices or purchase details are shown here.
export default async function Sanakhat({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; q?: string; show?: string }> }) {
  const { error, message, q, show } = await searchParams;
  const { stock, ctx, org, setupError } = await getStock('vehicles');
  const { data, error: loadError } = await stock.from('vehicles').select('id, brand, model, year, registration_number, color, status, ownership_termination_status, sanakhat_date, created_at').eq('company_id', org.id).order('created_at', { ascending: false }).limit(5000);
  const all = (data ?? []).map((v) => ({ ...v, done: v.ownership_termination_status === 'yes' }));
  const term = String(q ?? '').trim().toLowerCase();
  const rows = all.filter((v) => (!term || [v.brand, v.model, v.registration_number, v.color].some((x) => (x ?? '').toLowerCase().includes(term)))
    && (show === 'done' ? v.done : show === 'pending' ? !v.done : true));
  const pending = all.filter((v) => !v.done).length;
  const overdue = all.filter((v) => !v.done && v.status !== 'sold' && v.status !== 'scrap' && (daysSince(v.sanakhat_date) ?? 0) > OVERDUE_DAYS).length;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame">
      <h1>Sanakhat</h1>
      <p>Ownership-termination progress for every vehicle. Mark one done with its date, or undo it.</p>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />
      <div className="panels">
        <section className="tile"><h2>Done</h2><p className="big">{all.length - pending}</p></section>
        <section className="tile"><h2>Not done yet</h2><p className="big">{pending}</p></section>
        <section className="tile"><h2>Waiting over {OVERDUE_DAYS} days</h2><p className="big">{overdue}</p></section>
      </div>
      <section className="tile">
        <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input name="q" defaultValue={q} placeholder="Search brand, model, number plate…" style={{ flex: 1, minWidth: 200 }} />
          <select name="show" defaultValue={show ?? ''}><option value="">All</option><option value="pending">Not done</option><option value="done">Done</option></select>
          <button type="submit">Search</button>
        </form>
        {rows.length ? (
          <table className="table">
            <thead><tr><th>Vehicle</th><th>Number plate</th><th>Stock</th><th>Sanakhat</th><th /></tr></thead>
            <tbody>{rows.slice(0, 300).map((v) => {
              const waiting = !v.done ? daysSince(v.sanakhat_date) : null;
              const late = waiting !== null && waiting > OVERDUE_DAYS && v.status !== 'sold' && v.status !== 'scrap';
              return (
                <tr key={v.id}>
                  <td>{[v.brand, v.model, v.year].filter(Boolean).join(' ')}{v.color ? <><br /><small>{v.color}</small></> : null}</td>
                  <td>{v.registration_number ?? <small>No number yet</small>}</td>
                  <td>{STOCK_LABEL[v.status ?? ''] ?? v.status ?? 'In stock'}</td>
                  <td className={v.done ? 'in' : late ? 'out' : undefined}>
                    {v.done ? `Done · ${(v.sanakhat_date ?? '').slice(0, 10) || 'no date'}` : waiting !== null ? `Not done · ${waiting} days waiting${late ? ' (late)' : ''}` : 'Not done'}
                  </td>
                  <td>
                    <form action={setSanakhat} style={{ display: 'flex', gap: 6 }}>
                      <input type="hidden" name="id" value={v.id} />
                      {v.done ? <button type="submit" name="done" value="0" className="secondary">Undo</button> : (
                        <><input name="date" type="date" defaultValue={today} /><button type="submit" name="done" value="1">Mark done</button></>
                      )}
                    </form>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <p>No vehicles match.</p>}
        {rows.length > 300 && <p>Showing the first 300 of {rows.length}. Use the search to narrow it.</p>}
      </section>
    </Shell>
  );
}
