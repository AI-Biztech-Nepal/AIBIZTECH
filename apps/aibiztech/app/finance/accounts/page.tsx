import { money } from '@/lib/finance';
import { Notice, type Search } from '../../notice';
import { Shell } from '../../shell';
import { addAccount, addTransfer } from '../actions';
import { loadBooks } from '../data';
import { FinanceTabs } from '../tabs';

export default async function Accounts({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { ctx, org, accounts, books, failure } = await loadBooks();
  const choices = <><option value="cash">Cash in hand</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</>;
  return (
    <Shell org={org} orgs={ctx.orgs} page="finance">
      <h1>Accounts</h1>
      <FinanceTabs current="/finance/accounts" />
      <Notice error={error ?? failure} message={message} />

      <section className="tile">
        <h2>Balances</h2>
        <table className="table">
          <tbody>
            <tr><td>Cash in hand</td><td className="num">{money(books.balances.get('cash') ?? 0)}</td></tr>
            {accounts.map((a) => <tr key={a.id}><td>{a.name}{a.bank_name ? ` · ${a.bank_name}` : ''}</td><td className="num">{money(books.balances.get(a.id) ?? 0)}</td></tr>)}
            <tr className="total"><td>Total available</td><td className="num">{money(books.total)}</td></tr>
          </tbody>
        </table>
      </section>

      <div className="panels">
        <section className="tile">
          <h2>Add a bank account</h2>
          <form action={addAccount}>
            <label>Name<input name="name" required maxLength={80} placeholder="e.g. NIC Asia current" /></label>
            <label>Bank<input name="bank_name" /></label>
            <label>Account number<input name="account_number" /></label>
            <button>Add account</button>
          </form>
        </section>
        <section className="tile">
          <h2>Move money between accounts</h2>
          <form action={addTransfer}>
            <label>From<select name="from">{choices}</select></label>
            <label>To<select name="to" defaultValue={accounts[0]?.id ?? 'cash'}>{choices}</select></label>
            <label>Amount<input name="amount" type="number" min="1" step="0.01" required /></label>
            <label>Date<input name="date" type="date" /></label>
            <button>Transfer</button>
          </form>
        </section>
      </div>
    </Shell>
  );
}
