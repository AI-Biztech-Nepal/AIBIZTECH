import { getStock, money } from '@/lib/stock';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { createJob, deleteJob, setJobStatus } from '../actions';

export default async function Jobs({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { stock, ctx, org, setupError } = await getStock();
  const [{ data: jobs, error: loadError }, { data: vehicles }, { data: parts }] = await Promise.all([
    stock.from('job_cards').select('id, job_number, job_date, vehicle_brand, vehicle_model, registration_number, customer_name, work_description, mechanic_name, estimated_cost, actual_cost, status, is_warranty, is_external, parts').eq('company_id', org.id).order('created_at', { ascending: false }).limit(500),
    stock.from('vehicles').select('id, brand, model, year, registration_number, status').eq('company_id', org.id).in('status', ['available', 'in_repair', 'sold']).order('created_at', { ascending: false }).limit(2000),
    stock.from('spare_parts').select('id, name, quantity').eq('company_id', org.id).order('name').limit(2000),
  ]);
  const isAdmin = org.services.stock === 'admin';
  const open = (jobs ?? []).filter((j) => j.status !== 'completed').length;
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame" light>
      <h1>Job cards</h1>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />
      <div className="panels"><section className="tile"><h2>Open job cards</h2><p className="big">{open}</p></section></div>
      <section className="tile">
        <h2>Open a job card</h2>
        <form action={createJob}>
          <div className="grid2">
            <label>Vehicle
              <select name="vehicle_id" defaultValue=""><option value="">— choose, or fill an outside vehicle below —</option>
                {vehicles?.map((v) => <option key={v.id} value={v.id}>{[v.brand, v.model, v.year].filter(Boolean).join(' ')}{v.registration_number ? ` (${v.registration_number})` : ''} · {v.status}</option>)}
              </select>
            </label>
            <label>Is it an outside vehicle?<select name="kind" defaultValue="own"><option value="own">No, one of ours</option><option value="external">Yes, a customer's own vehicle</option></select></label>
            <label>Outside brand<input name="vehicle_brand" /></label><label>Outside model<input name="vehicle_model" /></label>
            <label>Outside year<input name="vehicle_year" type="number" /></label><label>Outside registration no.<input name="registration_number" /></label>
            <label>Customer name<input name="customer_name" /></label><label>Customer phone<input name="customer_contact" /></label>
            <label>Mechanic<input name="mechanic_name" /></label><label>Date<input name="job_date" type="date" /></label>
            <label>Estimated cost<input name="estimated_cost" type="number" step="any" min="0" /></label><label>Labour charge<input name="labour_charge" type="number" step="any" min="0" defaultValue="0" /></label>
          </div>
          <label>Work to do<textarea name="work_description" rows={2} /></label>
          <h3>Parts used <small>(taken out of Spare Parts stock)</small></h3>
          <div className="grid2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid2">
                <label>Part {i}<select name={`part_${i}`} defaultValue=""><option value="">—</option>{parts?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.quantity ?? 0} left)</option>)}</select></label>
                <label>Qty<input name={`qty_${i}`} type="number" min="1" /></label>
              </div>
            ))}
          </div>
          <label>Notes<textarea name="notes" rows={2} /></label>
          <p>A sold vehicle in its warranty window is opened as a free-labour warranty service automatically.</p>
          <button type="submit">Open job card</button>
        </form>
      </section>
      <section className="tile">
        <h2>All job cards</h2>
        {jobs?.length ? (
          <table className="table">
            <thead><tr><th>Job</th><th>Vehicle</th><th>Work</th><th className="num">Cost</th><th>Status</th><th />{isAdmin && <th />}</tr></thead>
            <tbody>{jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.job_number}<br /><small>{j.job_date}</small></td>
                <td>{[j.vehicle_brand, j.vehicle_model].filter(Boolean).join(' ')}{j.registration_number ? ` (${j.registration_number})` : ''}{j.is_external ? ' · outside' : ''}{j.is_warranty ? ' · warranty' : ''}<br /><small>{j.customer_name ?? ''}</small></td>
                <td>{j.work_description ?? '—'}<br /><small>{j.mechanic_name ?? ''}</small></td>
                <td className="num">{money(j.actual_cost ?? j.estimated_cost)}</td>
                <td>{j.status}</td>
                <td>
                  <form action={setJobStatus} style={{ display: 'flex', gap: 6 }}>
                    <input type="hidden" name="id" value={j.id} />
                    {j.status !== 'completed' && <input name="actual_cost" type="number" step="any" min="0" placeholder="Final cost" style={{ width: 100 }} />}
                    {j.status === 'pending' && <button type="submit" name="status" value="in_progress" className="secondary">Start</button>}
                    {j.status !== 'completed' ? <button type="submit" name="status" value="completed">Complete</button> : <button type="submit" name="status" value="in_progress" className="secondary">Reopen</button>}
                  </form>
                </td>
                {isAdmin && <td><form action={deleteJob}><input type="hidden" name="id" value={j.id} /><button type="submit" className="secondary">Delete</button></form></td>}
              </tr>
            ))}</tbody>
          </table>
        ) : <p>No job cards yet.</p>}
      </section>
    </Shell>
  );
}
