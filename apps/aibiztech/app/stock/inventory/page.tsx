import { getStock, money } from '@/lib/stock';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { addVehicle, deleteVehicle } from '../actions';

export default async function Inventory({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { stock, ctx, org, setupError } = await getStock();
  const { data: vehicles, error: loadError } = await stock.from('vehicles').select('id, brand, model, variant, year, registration_number, color, selling_price, purchase_price, status').eq('company_id', org.id).order('created_at', { ascending: false }).limit(500);
  const problem = error ?? setupError ?? loadError?.message;
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame">
      <h1>Inventory</h1>
      <p>Vehicles in your stock.</p>
      <Notice error={problem} message={message} />
      <section className="tile">
        <h2>Add a vehicle</h2>
        <form action={addVehicle}>
          <div className="grid2">
            <label>Brand<input name="brand" required /></label>
            <label>Model<input name="model" required /></label>
            <label>Variant<input name="variant" /></label>
            <label>Year<input name="year" type="number" /></label>
            <label>Registration number<input name="registration_number" /></label>
            <label>Chassis number<input name="chassis_number" /></label>
            <label>Colour<input name="color" /></label>
            <label>Fuel<select name="fuel_type" defaultValue=""><option value="">—</option><option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option></select></label>
            <label>Type<select name="vehicle_type" defaultValue=""><option value="">—</option><option>Bike</option><option>Scooter</option><option>Car</option><option>Jeep</option><option>Other</option></select></label>
            <label>Kilometres run<input name="kilometer_run" type="number" /></label>
            <label>Purchase price<input name="purchase_price" type="number" step="any" /></label>
            <label>Purchase date<input name="purchase_date" type="date" /></label>
            <label>Selling price<input name="selling_price" type="number" step="any" /></label>
          </div>
          <label>Notes<textarea name="notes" rows={2} /></label>
          <button type="submit">Add vehicle</button>
        </form>
      </section>
      <section className="tile">
        <h2>{vehicles?.length ?? 0} vehicles</h2>
        {vehicles?.length ? (
          <table className="table">
            <thead><tr><th>Vehicle</th><th>Reg. no.</th><th>Status</th><th className="num">Bought</th><th className="num">Price</th><th /></tr></thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>{[v.brand, v.model, v.variant, v.year].filter(Boolean).join(' ')}{v.color ? ` · ${v.color}` : ''}</td>
                  <td>{v.registration_number ?? '—'}</td>
                  <td>{v.status}</td>
                  <td className="num">{money(v.purchase_price)}</td>
                  <td className="num">{money(v.selling_price)}</td>
                  <td><form action={deleteVehicle}><input type="hidden" name="id" value={v.id} /><button type="submit" className="secondary">Remove</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>No vehicles yet. Add the first one above.</p>}
      </section>
    </Shell>
  );
}
