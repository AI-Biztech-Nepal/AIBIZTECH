import { getStock, money } from '@/lib/stock';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { addCustomer, deleteCustomer } from '../actions';

export default async function Customers({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { stock, ctx, org, setupError } = await getStock();
  const { data, error: loadError } = await stock.from('customers').select('id, name, contact_number, address, budget_min, budget_max, interested_brands').eq('company_id', org.id).order('created_at', { ascending: false }).limit(1000);
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame">
      <h1>Customers</h1>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />
      <section className="tile">
        <h2>Add a customer</h2>
        <form action={addCustomer}>
          <div className="grid2">
            <label>Name<input name="name" required /></label>
            <label>Phone<input name="contact_number" /></label>
            <label>Address<input name="address" /></label>
            <label>ID number<input name="id_number" /></label>
            <label>Occupation<input name="occupation" /></label>
            <label>Interested brands<input name="interested_brands" /></label>
            <label>Budget from<input name="budget_min" type="number" step="any" /></label>
            <label>Budget to<input name="budget_max" type="number" step="any" /></label>
          </div>
          <label>Notes<textarea name="notes" rows={2} /></label>
          <button type="submit">Add customer</button>
        </form>
      </section>
      <section className="tile">
        <h2>{data?.length ?? 0} customers</h2>
        {data?.length ? (
          <table className="table">
            <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Budget</th><th /></tr></thead>
            <tbody>{data.map((c) => (
              <tr key={c.id}><td>{c.name}</td><td>{c.contact_number ?? '—'}</td><td>{c.address ?? '—'}</td>
                <td>{c.budget_min || c.budget_max ? `${money(c.budget_min)} – ${money(c.budget_max)}` : '—'}</td>
                <td><form action={deleteCustomer}><input type="hidden" name="id" value={c.id} /><button type="submit" className="secondary">Remove</button></form></td></tr>
            ))}</tbody>
          </table>
        ) : <p>No customers yet.</p>}
      </section>
    </Shell>
  );
}
