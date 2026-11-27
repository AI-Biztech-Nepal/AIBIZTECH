import { getStock, money } from '@/lib/stock';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { addPart, adjustPart, deletePart } from '../actions';

export default async function SpareParts({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { stock, ctx, org, setupError } = await getStock();
  const [{ data: parts, error: loadError }, { data: vendors }] = await Promise.all([
    stock.from('spare_parts').select('id, name, category, part_number, quantity, unit_cost, selling_price, min_stock_alert, location').eq('company_id', org.id).order('name').limit(2000),
    stock.from('vendors').select('id, name').eq('company_id', org.id).order('name'),
  ]);
  const value = (parts ?? []).reduce((s, p) => s + (p.quantity ?? 0) * (p.unit_cost ?? 0), 0);
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame" light>
      <h1>Spare parts</h1>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />
      <section className="tile">
        <h2>Add a part</h2>
        <form action={addPart}>
          <div className="grid2">
            <label>Name<input name="name" required /></label>
            <label>Category<input name="category" /></label>
            <label>Fits brands<input name="brand_compatibility" /></label>
            <label>Part number<input name="part_number" /></label>
            <label>Opening stock<input name="quantity" type="number" min="0" defaultValue="0" /></label>
            <label>Cost each<input name="unit_cost" type="number" step="any" /></label>
            <label>Selling price<input name="selling_price" type="number" step="any" /></label>
            <label>Alert when below<input name="min_stock_alert" type="number" min="0" /></label>
            <label>Location<input name="location" /></label>
            <label>Vendor<select name="vendor_id" defaultValue=""><option value="">—</option>{vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          </div>
          <label>Notes<textarea name="notes" rows={2} /></label>
          <button type="submit">Add part</button>
        </form>
      </section>
      <section className="tile">
        <h2>{parts?.length ?? 0} parts · stock worth {money(value)}</h2>
        {parts?.length ? (
          <table className="table">
            <thead><tr><th>Part</th><th>Category</th><th className="num">In stock</th><th className="num">Cost</th><th className="num">Price</th><th>Stock in / out</th><th /></tr></thead>
            <tbody>{parts.map((p) => {
              const low = p.min_stock_alert != null && (p.quantity ?? 0) <= p.min_stock_alert;
              return (
                <tr key={p.id}>
                  <td>{p.name}{p.part_number ? ` · ${p.part_number}` : ''}</td><td>{p.category ?? '—'}</td>
                  <td className={`num${low ? ' out' : ''}`}>{p.quantity ?? 0}{low ? ' (low)' : ''}</td>
                  <td className="num">{money(p.unit_cost)}</td><td className="num">{money(p.selling_price)}</td>
                  <td>
                    <form action={adjustPart} style={{ display: 'flex', gap: 6 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input name="qty" type="number" min="1" placeholder="Qty" style={{ width: 70 }} required />
                      <button type="submit" name="type" value="in">In</button>
                      <button type="submit" name="type" value="out" className="secondary">Out</button>
                    </form>
                  </td>
                  <td><form action={deletePart}><input type="hidden" name="id" value={p.id} /><button type="submit" className="secondary">Remove</button></form></td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <p>No parts yet.</p>}
      </section>
    </Shell>
  );
}
