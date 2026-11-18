import { getStock, money } from '@/lib/stock';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { addEmiPayment, createEmi } from '../actions';

export default async function Emi({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { stock, ctx, org, setupError } = await getStock();
  if (org.services.stock !== 'admin') {
    return <Shell org={org} orgs={ctx.orgs} page="frame"><h1>EMI</h1><p>Only a Stock Manager admin can see EMI plans.</p></Shell>;
  }
  const [{ data: emis, error: loadError }, { data: pays }, { data: customers }, { data: vehicles }] = await Promise.all([
    stock.from('emi_records').select('*').eq('company_id', org.id).order('created_at', { ascending: false }).limit(500),
    stock.from('emi_payments').select('emi_id, amount, payment_date').eq('company_id', org.id).limit(10000),
    stock.from('customers').select('id, name').eq('company_id', org.id).order('name').limit(2000),
    stock.from('vehicles').select('id, brand, model, year, registration_number').eq('company_id', org.id).order('created_at', { ascending: false }).limit(2000),
  ]);
  const paid = new Map<string, { sum: number; n: number }>();
  for (const p of pays ?? []) { const c = paid.get(p.emi_id ?? '') ?? { sum: 0, n: 0 }; c.sum += p.amount ?? 0; c.n += 1; paid.set(p.emi_id ?? '', c); }
  const left = (e: { id: string; total_payable: number | null }) => Math.max(0, (e.total_payable ?? 0) - (paid.get(e.id)?.sum ?? 0));
  const totalLeft = (emis ?? []).reduce((s, e) => s + left(e), 0);
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame">
      <h1>EMI</h1>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />
      <div className="panels"><section className="tile"><h2>Still to collect</h2><p className="big">{money(totalLeft)}</p><p>{(emis ?? []).filter((e) => left(e) > 0).length} active plans</p></section></div>
      <section className="tile">
        <h2>New EMI plan</h2>
        <form action={createEmi}>
          <div className="grid2">
            <label>Customer<select name="customer_id" defaultValue=""><option value="">—</option>{customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Vehicle<select name="vehicle_id" defaultValue=""><option value="">—</option>{vehicles?.map((v) => <option key={v.id} value={v.id}>{[v.brand, v.model, v.year].filter(Boolean).join(' ')}{v.registration_number ? ` (${v.registration_number})` : ''}</option>)}</select></label>
            <label>Loan amount<input name="loan_amount" type="number" step="any" min="1" required /></label>
            <label>Down payment<input name="down_payment" type="number" step="any" min="0" defaultValue="0" /></label>
            <label>Yearly interest %<input name="interest_rate" type="number" step="any" min="0" defaultValue="0" /></label>
            <label>Months<input name="tenure_months" type="number" min="1" required /></label>
            <label>Start date<input name="start_date" type="date" /></label>
            <label>Financer<input name="financer_name" /></label>
          </div>
          <label>Notes<textarea name="notes" rows={2} /></label>
          <p>The monthly instalment, total payable and interest are worked out for you.</p>
          <button type="submit">Create plan</button>
        </form>
      </section>
      <section className="tile">
        <h2>Plans</h2>
        {emis?.length ? (
          <table className="table">
            <thead><tr><th>Customer / vehicle</th><th className="num">Loan</th><th className="num">Monthly</th><th className="num">Paid</th><th className="num">Left</th><th>Record payment</th></tr></thead>
            <tbody>{emis.map((e) => (
              <tr key={e.id}>
                <td>{e.customer_name ?? '—'}<br /><small>{e.vehicle_name ?? ''}{e.financer_name ? ` · ${e.financer_name}` : ''}</small></td>
                <td className="num">{money(e.loan_amount)}<br /><small>{e.tenure_months} months · {e.interest_rate}%</small></td>
                <td className="num">{money(e.monthly_installment)}</td>
                <td className="num">{money(paid.get(e.id)?.sum)}<br /><small>{paid.get(e.id)?.n ?? 0} payments</small></td>
                <td className={`num${left(e) > 0 ? ' out' : ' in'}`}>{left(e) > 0 ? money(left(e)) : 'Cleared'}</td>
                <td>{left(e) > 0 && (
                  <form action={addEmiPayment} style={{ display: 'flex', gap: 6 }}>
                    <input type="hidden" name="emi_id" value={e.id} />
                    <input name="amount" type="number" step="any" min="1" placeholder={String(Math.round(e.monthly_installment ?? 0))} style={{ width: 100 }} required />
                    <button type="submit">Add</button>
                  </form>
                )}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p>No EMI plans yet.</p>}
      </section>
    </Shell>
  );
}
