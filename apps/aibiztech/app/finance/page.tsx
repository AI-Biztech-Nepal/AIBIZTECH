import { money } from '@/lib/finance';
import { Notice, type Search } from '../notice';
import { Shell } from '../shell';
import { loadBooks } from './data';
import { FinanceTabs } from './tabs';

export default async function FinanceOverview({ searchParams }: { searchParams: Search }) {
  const { error, message } = await searchParams;
  const { ctx, org, accounts, books, failure } = await loadBooks();
  const stat = (label: string, value: number, tone = '') => <div className={`stat ${tone}`}><span>{label}</span><strong>{money(value)}</strong></div>;

  return (
    <Shell org={org} orgs={ctx.orgs} page="finance">
      <h1>Finance</h1>
      <FinanceTabs current="/finance" />
      <Notice error={error ?? failure} message={message} />
      <div className="stats">
        {stat('Available balance', books.total, 'big')}
        {stat('To receive', books.totalReceivable, 'ok')}
        {stat('To pay', books.totalPayable, 'warn')}
      </div>

      <div className="panels">
        <section className="tile">
          <h2>This month</h2>
          <dl>
            <dt>Sales</dt><dd>{money(books.month.sales)}</dd>
            <dt>Purchases</dt><dd>{money(books.month.purchases)}</dd>
            <dt>Expenses</dt><dd>{money(books.month.expenses)}</dd>
            <dt>Net profit</dt><dd><strong>{money(books.month.net)}</strong></dd>
          </dl>
        </section>
        <section className="tile">
          <h2>Where the money is</h2>
          <dl>
            <dt>Cash in hand</dt><dd>{money(books.balances.get('cash') ?? 0)}</dd>
            {accounts.map((a) => <><dt key={a.id}>{a.name}</dt><dd key={a.id + 'v'}>{money(books.balances.get(a.id) ?? 0)}</dd></>)}
          </dl>
        </section>
      </div>
      <p className="muted">Profit is what you billed, not what you collected. Compare it with the available balance above.</p>
    </Shell>
  );
}
