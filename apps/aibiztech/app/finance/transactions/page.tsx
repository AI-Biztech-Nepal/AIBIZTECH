import { dateOf, money } from '@/lib/finance';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { addPayment, addTransaction } from '../actions';
import { loadBooks } from '../data';
import { FinanceTabs } from '../tabs';

export default async function Transactions({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { ctx, org, parties, accounts, txs, customerLedger, vendorLedger, failure } = await loadBooks();
  const names = new Map(parties.map((p) => [p.id, p.name]));
  const accountOptions = <><option value="cash">Cash in hand</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</>;
  const partyOptions = parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>);

  // Day book: bills and manual payments together, newest first
  const book = [
    ...txs.map((t) => ({ id: t.id, date: dateOf(t), what: t.type === 'sale' ? 'Sale' : t.type === 'purchase' ? 'Purchase' : 'Expense', who: t.customer_id ? names.get(t.customer_id) : t.party_name, amount: +t.amount, sign: t.type === 'sale' ? 1 : -1, stamp: t.created_at })),
    ...customerLedger.filter((e) => e.source === 'manual').map((e) => ({ id: e.id, date: dateOf(e), what: e.entry_type === 'credit' ? 'Received' : 'Refund', who: names.get(e.customer_id!), amount: +e.amount, sign: e.entry_type === 'credit' ? 1 : -1, stamp: e.created_at })),
    ...vendorLedger.filter((e) => e.source === 'manual').map((e) => ({ id: e.id, date: dateOf(e), what: e.entry_type === 'credit' ? 'Paid' : 'Bill adjustment', who: names.get(e.vendor_id!), amount: +e.amount, sign: -1, stamp: e.created_at })),
  ].sort((a, b) => (a.date === b.date ? b.stamp.localeCompare(a.stamp) : b.date.localeCompare(a.date)));

  return (
    <Shell org={org} orgs={ctx.orgs} page="finance">
      <h1>Transactions</h1>
      <FinanceTabs current="/finance/transactions" />
      <Notice error={error ?? failure} message={message} />
      <p className="muted">A sale or purchase to a saved party is a bill: it adds to what they owe, and no money moves until you record a payment. An expense is paid straight away.</p>

      <div className="panels">
        <section className="tile">
          <h2>New bill or expense</h2>
          <form action={addTransaction}>
            <label>Type<select name="type"><option value="sale">Sale</option><option value="purchase">Purchase</option><option value="expense">Expense</option></select></label>
            <label>Party (leave empty for a walk-in or an expense)<select name="party"><option value="">None</option>{partyOptions}</select></label>
            <label>Amount<input name="amount" type="number" min="1" step="0.01" required /></label>
            <label>Account (for expenses and walk-ins)<select name="account">{accountOptions}</select></label>
            <label>Date<input name="date" type="date" /></label>
            <label>Bill no<input name="bill_no" /></label>
            <label>Note<input name="note" /></label>
            <button>Save entry</button>
          </form>
        </section>
        <section className="tile">
          <h2>Record a payment</h2>
          <form action={addPayment}>
            <label>Direction<select name="direction"><option value="received">Received from a customer</option><option value="paid">Paid to a vendor</option></select></label>
            <label>Party<select name="party" required><option value="">Choose…</option>{partyOptions}</select></label>
            <label>Amount<input name="amount" type="number" min="1" step="0.01" required /></label>
            <label>Account<select name="account">{accountOptions}</select></label>
            <label>Date<input name="date" type="date" /></label>
            <label>Note<input name="note" /></label>
            <button>Save payment</button>
          </form>
        </section>
      </div>

      <section className="tile">
        <h2>Day book</h2>
        {!book.length ? <p>Nothing recorded yet.</p> : (
          <table className="table">
            <thead><tr><th>Date</th><th>Entry</th><th>Party</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {book.slice(0, 200).map((r) => (
                <tr key={r.id}><td>{r.date}</td><td>{r.what}</td><td>{r.who ?? '—'}</td><td className={`num ${r.sign > 0 ? 'in' : 'out'}`}>{r.sign > 0 ? '+' : '−'}{money(r.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Shell>
  );
}
