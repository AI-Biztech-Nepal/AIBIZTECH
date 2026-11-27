import { getStock } from '@/lib/stock';
import { DEFAULT_WARRANTY_DAYS, warrantyInfo } from '@/lib/stock-calc';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { restoreWarranty, setWarrantyLength, voidWarranty } from '../actions';

const LABEL = { awaiting: 'Awaiting 1st service', active: 'Active', expired: 'Expired', void: 'Void', none: '' } as const;
const ORDER = { active: 0, awaiting: 1, expired: 2, void: 3, none: 4 } as const;

export default async function Warranty({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { stock, ctx, org, setupError } = await getStock();
  const [{ data: sold, error: loadError }, { data: settings }] = await Promise.all([
    stock.from('vehicles').select('id, brand, model, year, registration_number, status, sold_date, customer_id, warranty_days, warranty_void, warranty_void_reason').eq('company_id', org.id).eq('status', 'sold').limit(5000),
    stock.from('settings').select('warranty_days_default').eq('company_id', org.id).maybeSingle(),
  ]);
  const ids = (sold ?? []).map((v) => v.id);
  const custIds = [...new Set((sold ?? []).map((v) => v.customer_id).filter(Boolean))] as string[];
  const [{ data: jobs }, { data: customers }] = await Promise.all([
    ids.length ? stock.from('job_cards').select('vehicle_id, is_warranty, after_sale, job_date, created_at').eq('company_id', org.id).in('vehicle_id', ids.slice(0, 1000)) : Promise.resolve({ data: [] }),
    custIds.length ? stock.from('customers').select('id, name, contact_number').eq('company_id', org.id).in('id', custIds.slice(0, 1000)) : Promise.resolve({ data: [] }),
  ]);
  const days = settings?.warranty_days_default || DEFAULT_WARRANTY_DAYS;
  const cust = new Map((customers ?? []).map((c) => [c.id, c]));
  const rows = (sold ?? []).map((v) => ({ v, w: warrantyInfo(v, days, (jobs ?? []).filter((j) => j.vehicle_id === v.id)) }))
    .filter((r) => r.w.status !== 'none')
    .sort((a, b) => ORDER[a.w.status] - ORDER[b.w.status] || (a.w.daysLeft ?? 0) - (b.w.daysLeft ?? 0));
  const isAdmin = org.services.stock === 'admin';
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame" light>
      <h1>Warranty</h1>
      <p>Every sold vehicle, with how long its warranty has left. Standard warranty: {days} days from the sale date; it becomes active after the 1st service at your shop.</p>
      <Notice error={error ?? setupError ?? loadError?.message} message={message} />
      <section className="tile">
        {rows.length ? (
          <table className="table">
            <thead><tr><th>Vehicle</th><th>Customer</th><th>Sold</th><th>Status</th><th>Ends</th><th /></tr></thead>
            <tbody>{rows.map(({ v, w }) => {
              const c = cust.get(v.customer_id ?? '');
              return (
                <tr key={v.id}>
                  <td>{[v.brand, v.model, v.year].filter(Boolean).join(' ')}{v.registration_number ? ` (${v.registration_number})` : ''}</td>
                  <td>{c?.name ?? '—'}<br /><small>{c?.contact_number ?? ''}</small></td>
                  <td>{w.start}</td>
                  <td>{LABEL[w.status]}{w.status === 'void' && v.warranty_void_reason ? <><br /><small>{v.warranty_void_reason}</small></> : null}<br /><small>{w.services} services</small></td>
                  <td>{w.end}{w.daysLeft !== null && w.status !== 'void' ? <><br /><small>{w.daysLeft >= 0 ? `${w.daysLeft} days left` : `ended ${-w.daysLeft} days ago`}</small></> : null}</td>
                  <td>
                    {w.status === 'void' ? (isAdmin && <form action={restoreWarranty}><input type="hidden" name="id" value={v.id} /><button type="submit" className="secondary">Restore</button></form>) : (
                      <form action={voidWarranty} style={{ display: 'flex', gap: 6 }}><input type="hidden" name="id" value={v.id} /><input name="reason" placeholder="Reason to void" style={{ width: 150 }} required /><button type="submit" className="secondary">Void</button></form>
                    )}
                    {isAdmin && <form action={setWarrantyLength} style={{ display: 'flex', gap: 6, marginTop: 6 }}><input type="hidden" name="id" value={v.id} /><input name="days" type="number" min="0" placeholder={`Days (${w.days})`} style={{ width: 110 }} /><button type="submit" className="secondary">Set length</button></form>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <p>No sold vehicles yet.</p>}
      </section>
    </Shell>
  );
}
