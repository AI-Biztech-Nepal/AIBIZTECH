import { getStock } from '@/lib/stock';
import { Shell } from '../../shell';

// Pages of the old Stock Manager that are not rewritten yet
export default async function NotYet() {
  const { ctx, org } = await getStock();
  return (
    <Shell org={org} orgs={ctx.orgs} page="frame">
      <h1>Coming soon</h1>
      <p>This part of Stock Manager is being rebuilt inside AIBIZTECH. Dashboard and Inventory are ready; the rest follows in stages.</p>
      <p><a className="button" href="/stock/inventory">Go to Inventory</a></p>
    </Shell>
  );
}
