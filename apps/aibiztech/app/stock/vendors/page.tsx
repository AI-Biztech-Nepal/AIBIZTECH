import { getStock } from '@/lib/stock';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { addVendor, deleteVendor } from '../actions';

export default async function Vendors({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { stock, ctx, org, setupError } = await getStock();
  const { data, error: loadError } = await stock.from('vendors').select('id, name, phone, address, vendor_type').eq('company_id', org.id).order('created_at', { ascending: false }).limit(1000);
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame" light>
      <h1>Vendors</h1>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />
      <section className="tile">
        <h2>Add a vendor</h2>
        <form action={addVendor}>
          <div className="grid2">
            <label>Name<input name="name" required /></label>
            <label>Phone<input name="phone" /></label>
            <label>Address<input name="address" /></label>
            <label>Type<select name="vendor_type" defaultValue="both"><option value="both">Vehicles and parts</option><option value="vehicle">Vehicles</option><option value="parts">Parts</option></select></label>
            <label>Commission<input name="commission_amount" type="number" step="any" /></label>
          </div>
          <label>Notes<textarea name="notes" rows={2} /></label>
          <button type="submit">Add vendor</button>
        </form>
      </section>
      <section className="tile">
        <h2>{data?.length ?? 0} vendors</h2>
        {data?.length ? (
          <table className="table">
            <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Type</th><th /></tr></thead>
            <tbody>{data.map((v) => (
              <tr key={v.id}><td>{v.name}</td><td>{v.phone ?? '—'}</td><td>{v.address ?? '—'}</td><td>{v.vendor_type}</td>
                <td><form action={deleteVendor}><input type="hidden" name="id" value={v.id} /><button type="submit" className="secondary">Remove</button></form></td></tr>
            ))}</tbody>
          </table>
        ) : <p>No vendors yet.</p>}
      </section>
    </Shell>
  );
}
