import { money } from '@/lib/finance';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { addParty } from '../actions';
import { loadBooks } from '../data';
import { FinanceTabs } from '../tabs';

export default async function Parties({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { ctx, org, parties, books, failure } = await loadBooks();
  return (
    <Shell org={org} orgs={ctx.orgs} page="finance">
      <h1>Parties</h1>
      <FinanceTabs current="/finance/parties" />
      <Notice error={error ?? failure} message={message} />
      <p className="muted">Customers and vendors are the same list. Someone can owe you and be owed by you at once, so both numbers are shown.</p>

      <section className="tile">
        <h2>Add a party</h2>
        <form action={addParty} className="row">
          <label>Name<input name="name" required maxLength={120} autoComplete="off" /></label>
          <label>Phone<input name="phone" type="tel" autoComplete="off" /></label>
          <label>Address<input name="address" autoComplete="off" /></label>
          <button>Add</button>
        </form>
      </section>

      <section className="tile">
        <h2>All parties ({parties.length})</h2>
        {!parties.length ? <p>No parties yet.</p> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Phone</th><th className="num">To receive</th><th className="num">To pay</th></tr></thead>
            <tbody>
              {parties.map((p) => {
                const r = books.receivable.get(p.id) ?? 0, v = books.payable.get(p.id) ?? 0;
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td><td>{p.phone ?? '—'}</td>
                    <td className="num">{r > 0 ? money(r) : r < 0 ? `${money(-r)} advance` : 'Settled'}</td>
                    <td className="num">{v > 0 ? money(v) : v < 0 ? `${money(-v)} advance` : 'Settled'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </Shell>
  );
}
