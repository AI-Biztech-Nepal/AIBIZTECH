import { getStock, money } from '@/lib/stock';
import { Shell } from '../shell';

export default async function StockHome() {
  const { stock, ctx, org, setupError } = await getStock();
  const { data } = await stock.from('vehicles').select('status, purchase_price, selling_price').eq('company_id', org.id).limit(5000);
  const rows = data ?? [];
  const avail = rows.filter((v) => v.status !== 'sold');
  const sold = rows.filter((v) => v.status === 'sold');
  const sum = (a: typeof rows, k: 'purchase_price' | 'selling_price') => a.reduce((s, v) => s + (v[k] ?? 0), 0);
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame" light>
      <h1>Stock Manager</h1>
      {setupError && <p className="error">{setupError}</p>}
      <div className="panels">
        <section className="tile"><h2>In stock</h2><p className="big">{avail.length}</p><p>Money in stock: {money(sum(avail, 'purchase_price'))}</p></section>
        <section className="tile"><h2>Sold</h2><p className="big">{sold.length}</p><p>Sales value: {money(sum(sold, 'selling_price'))}</p></section>
      </div>
      <p><a className="button" href="/stock/inventory">Open inventory</a></p>
    </Shell>
  );
}
