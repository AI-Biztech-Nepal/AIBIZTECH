import { getStock, money } from '@/lib/stock';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { deleteSale, receivePayment, recordSale } from '../actions';

export default async function Sales({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { stock, ctx, org, setupError } = await getStock();
  const [{ data: sales, error: loadError }, { data: vehicles }, { data: customers }] = await Promise.all([
    stock.from('sales').select('id, vehicle_id, customer_id, sale_price, total_amount, due_amount, due_date, payment_status, sale_date').eq('company_id', org.id).order('sale_date', { ascending: false }).limit(1000),
    stock.from('vehicles').select('id, brand, model, year, registration_number, selling_price, status').eq('company_id', org.id).order('created_at', { ascending: false }).limit(2000),
    stock.from('customers').select('id, name, contact_number').eq('company_id', org.id).order('name').limit(2000),
  ]);
  const vName = new Map((vehicles ?? []).map((v) => [v.id, [v.brand, v.model, v.year].filter(Boolean).join(' ') + (v.registration_number ? ` (${v.registration_number})` : '')]));
  const cName = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const available = (vehicles ?? []).filter((v) => v.status === 'available');
  const rows = sales ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const revenue = rows.reduce((s, r) => s + (r.sale_price ?? 0), 0);
  const totalDue = rows.reduce((s, r) => s + (r.due_amount ?? 0), 0);
  const month = today.slice(0, 7);
  const thisMonth = rows.filter((r) => (r.sale_date ?? '').startsWith(month));
  const overdue = rows.filter((r) => (r.due_amount ?? 0) > 0 && r.due_date && r.due_date < today).length;
  const isAdmin = org.services.stock === 'admin';
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame" light>
      <h1>Sales</h1>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />
      <div className="panels">
        <section className="tile"><h2>Total sales</h2><p className="big">{rows.length}</p><p>Revenue {money(revenue)}</p></section>
        <section className="tile"><h2>This month</h2><p className="big">{thisMonth.length}</p><p>{money(thisMonth.reduce((s, r) => s + (r.sale_price ?? 0), 0))}</p></section>
        <section className="tile"><h2>Money due</h2><p className="big">{money(totalDue)}</p><p>{rows.filter((r) => (r.due_amount ?? 0) > 0).length} sales{overdue ? `, ${overdue} overdue` : ''}</p></section>
      </div>

      <section className="tile">
        <h2>Record a sale</h2>
        {available.length ? (
          <form action={recordSale}>
            <div className="grid2">
              <label>Vehicle<select name="vehicle_id" required defaultValue=""><option value="" disabled>Choose…</option>{available.map((v) => <option key={v.id} value={v.id}>{vName.get(v.id)}</option>)}</select></label>
              <label>Customer<select name="customer_id" defaultValue=""><option value="">— none —</option>{customers?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.contact_number ? ` · ${c.contact_number}` : ''}</option>)}</select></label>
              <label>Sale price<input name="sale_price" type="number" step="any" min="0" required /></label>
              <label>Sale date<input name="sale_date" type="date" defaultValue={today} /></label>
              <label>Payment method<select name="payment_method" defaultValue="Cash"><option>Cash</option><option>Bank</option><option>Cash + Bank</option><option>Finance / EMI</option></select></label>
              <label>Paid in cash<input name="paid_cash" type="number" step="any" min="0" defaultValue="0" /></label>
              <label>Paid by bank<input name="paid_bank" type="number" step="any" min="0" defaultValue="0" /></label>
              <label>Advance already paid<input name="advance_payment" type="number" step="any" min="0" defaultValue="0" /></label>
              <label>Balance due by<input name="due_date" type="date" /></label>
            </div>
            <h3>Extra charges <small>(transfer fee, accessories… added to the bill)</small></h3>
            <div className="grid2">
              {[1, 2, 3].map((i) => <div key={i} className="grid2"><label>Charge {i}<input name={`extra_name_${i}`} /></label><label>Amount<input name={`extra_amount_${i}`} type="number" step="any" min="0" /></label></div>)}
            </div>
            <h3>Old vehicle taken in exchange <small>(its value counts as paid)</small></h3>
            <div className="grid2">
              <label>Brand<input name="exchange_brand" /></label><label>Model<input name="exchange_model" /></label>
              <label>Registration no.<input name="exchange_reg_no" /></label><label>Value given<input name="exchange_valuation" type="number" step="any" min="0" defaultValue="0" /></label>
            </div>
            <h3>Witness <small>(for the sale deed)</small></h3>
            <div className="grid2">
              <label>Name<input name="witness_name" /></label><label>Address<input name="witness_address" /></label>
              <label>Phone<input name="witness_phone" /></label><label>ID number<input name="witness_id_number" /></label>
            </div>
            <label>Notes<textarea name="notes" rows={2} /></label>
            <p>The amount due is worked out for you: price + extra charges − cash − bank − advance − exchange value.</p>
            <button type="submit">Record sale</button>
          </form>
        ) : <p>No vehicles in stock to sell. <a href="/stock/inventory">Add one in Inventory</a>.</p>}
      </section>

      <section className="tile">
        <h2>All sales</h2>
        {rows.length ? (
          <table className="table">
            <thead><tr><th>Date</th><th>Vehicle</th><th>Customer</th><th className="num">Price</th><th className="num">Due</th><th>Status</th><th>Receive money</th>{isAdmin && <th />}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td>{r.sale_date}</td><td>{vName.get(r.vehicle_id ?? '') ?? '—'}</td><td>{cName.get(r.customer_id ?? '') ?? '—'}</td>
                <td className="num">{money(r.sale_price)}</td>
                <td className={`num${(r.due_amount ?? 0) > 0 ? ' out' : ''}`}>{money(r.due_amount)}{r.due_date && (r.due_amount ?? 0) > 0 ? ` by ${r.due_date}` : ''}</td>
                <td>{r.payment_status}</td>
                <td>{(r.due_amount ?? 0) > 0 && (
                  <form action={receivePayment} style={{ display: 'flex', gap: 6 }}>
                    <input type="hidden" name="id" value={r.id} />
                    <input name="cash" type="number" step="any" min="0" placeholder="Cash" style={{ width: 90 }} />
                    <input name="bank" type="number" step="any" min="0" placeholder="Bank" style={{ width: 90 }} />
                    <button type="submit">Add</button>
                  </form>
                )}</td>
                {isAdmin && <td><form action={deleteSale}><input type="hidden" name="id" value={r.id} /><button type="submit" className="secondary">Delete</button></form></td>}
              </tr>
            ))}</tbody>
          </table>
        ) : <p>No sales yet.</p>}
      </section>
    </Shell>
  );
}
