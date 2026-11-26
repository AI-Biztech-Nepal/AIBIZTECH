import 'lenis/dist/lenis.css';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ReactLenis } from 'lenis/react';
import { npr, type computeDashboard } from '@/lib/books';
import { MonthChart } from './dashboard-chart';
import type { StockNow } from './dashboard-data';
import { ShowAll } from './dashboard-show-all';
import { ServiceLogo } from './icons';
import s from './dashboard.module.css';

type D = ReturnType<typeof computeDashboard>;
type Messages = { error?: string; message?: string };

const pct = (n: number, total: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%');
const sum = (list: number[]) => list.reduce((a, v) => a + v, 0);
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Notices({ error, message }: Messages) {
  if (error) return <p role="alert" className={s.alert}>{error}</p>;
  return message ? <p role="status" className={s.banner}>{message}</p> : null;
}

function Panel({ title, sub, right, className, children }: { title: string; sub?: string; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={className ? `${s.panel} ${className}` : s.panel}>
      <div className={s.panelHead}>
        <div><h2>{title}</h2>{sub && <p className={s.sub}>{sub}</p>}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

// Names with a bar each; `of` adds each row's share
function Bars({ rows, of }: { rows: { name: string; value: number }[]; of?: number }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <ul className={`${s.list} ${s.rows}`}>
      {rows.map((r) => (
        <li key={r.name}>
          <span title={r.name}>{r.name}</span>
          <span className={s.track}><i className={r.value < 0 ? s.below : undefined} style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} /></span>
          <b>{npr(r.value)}{of !== undefined && <em>{pct(r.value, of)}</em>}</b>
        </li>
      ))}
    </ul>
  );
}

type Task = { title: string; detail: string; href: string; action: string; bad: boolean; phone?: boolean };

const partsTask = (low: number): Task => ({ title: `${count(low, 'spare part')} low`, detail: 'At or below the alert level', href: '/stock/spare-parts', action: 'Restock', bad: false, phone: true });

// Rows marked `phone` show on phones only, so wider screens still say "nothing" when those are all there is
function Tasks({ tasks }: { tasks: Task[] }) {
  const everywhere = tasks.some((t) => !t.phone);
  return (
    <>
      {!everywhere && <p className={tasks.length ? `${s.empty} ${s.wideOnly}` : s.empty}>Nothing needs your attention.</p>}
      {!!tasks.length && (
        <ul className={everywhere ? `${s.list} ${s.tasks}` : `${s.list} ${s.tasks} ${s.phoneOnly}`}>
          {tasks.map((t) => (
            <li key={t.title} className={t.phone ? s.phoneOnly : undefined}>
              <span className={t.bad ? `${s.dot} ${s.bad}` : s.dot} aria-hidden="true" />
              <div><strong>{t.title}</strong><small>{t.detail}</small></div>
              <a href={t.href}>{t.action}</a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// Counted on phones only; wider screens keep the money figures
function VehiclesFigure({ stock }: { stock: StockNow }) {
  return <li className={s.phoneOnly}><span>Vehicles in stock</span><strong>{stock.vehicles.toLocaleString('en-IN')}</strong></li>;
}

type Props = Messages & {
  orgName: string;
  today: string;
  access: Record<string, string>; // app key -> this person's role in it
  isAdmin: boolean;
  verification: { status: string; note: string | null };
  d: D | null; // the Finance figures, when there are any
  stock?: StockNow | null; // shown on phones
  trialLeft?: number; // days left of a running free trial, for those who can choose a plan
};

export function DashboardView({ orgName, today, access, isAdmin, verification, d, stock, trialLeft, error, message }: Props) {
  const money = access.finance && access.finance !== 'viewer';
  const actions = [
    access.attendance && ['Add employee', '/app/attendance/employees'],
    money && ['Money received', '/app/finance/quick-payment?type=in', 'in'],
    money && ['Money paid', '/app/finance/quick-payment?type=out', 'out'],
    access.stock && ['Add vehicle', '/stock/inventory'],
    access.stock && ['Record sale', '/stock/sales'],
  ].filter(Boolean) as string[][];

  return (
    <div className={`${s.page} ${s.home}`}>
      <ReactLenis root options={{ anchors: true }} />
      <div className={s.head}>
        <div className={s.title}>
          <h1>Dashboard</h1>
          <p className={s.sub}>{today} · {orgName}</p>
        </div>
        {!!actions.length && <div className={s.actions}>{actions.map(([label, href, pay]) => <a key={label} href={href} data-pay={pay}>{label}</a>)}</div>}
      </div>

      {trialLeft !== undefined && (
        <Link href="/plans" className={`${s.trial} ${s.phoneOnly}`}><span>Free trial · {count(trialLeft, 'day')} left</span><span>Plans</span></Link>
      )}
      <Notices error={error} message={message} />
      {verification.status === 'pending' && <p role="status" className={s.banner}>Your organization is awaiting verification. Apps unlock once it is verified.</p>}
      {verification.status === 'rejected' && <p role="alert" className={s.alert}>Verification was rejected{verification.note ? `: ${verification.note}` : '.'} Contact support.</p>}

      {d ? <Money d={d} stock={stock} /> : (
        <>
          {stock && <ul className={`${s.metrics} ${s.phoneOnly}`}><VehiclesFigure stock={stock} /></ul>}
          {!!stock?.lowParts && <Panel className={s.phoneOnly} title="Needs your attention"><Tasks tasks={[partsTask(stock.lowParts)]} /></Panel>}
          <section className={s.panel}>
            <h2>No money figures to show</h2>
            <p className={s.sub}>
              {access.finance ? 'Finance could not be reached just now. Reload the page to try again.' : 'Sales, cash and balances appear here when you have access to Finance.'}
              {!access.finance && isAdmin && <> <Link href="/apps">Add apps</Link></>}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Money({ d, stock }: { d: D; stock?: StockNow | null }) {
  const last = d.months.length - 1;
  const month = d.months[last];
  const net = d.receivable - d.payable;
  const ageTotal = sum(d.ageBuckets);
  const ages = ['0 to 30 days', '31 to 60 days', 'Over 60 days'].map((label, i) => ({ label, value: d.ageBuckets[i], tone: [s.age0, s.age1, s.age2][i] }));
  const topTotal = sum(d.topCustomers.map((r) => r[1]));
  // Six categories at most; the rest are one row
  const rest = sum(d.expenseRows.slice(6).map((r) => r[1]));
  const expenses = d.expenseRows.slice(0, 6).concat(rest > 0 ? [['All other', rest]] : []).map(([name, value]) => ({ name, value }));

  const metrics = [
    [`Sales in ${month}`, d.sales[last], `12 months: ${npr(d.totals.sales)}`],
    [`Expenses in ${month}`, d.expensesM[last], `12 months: ${npr(d.totals.expenses)}`],
    ['Cash and banks', d.cashAndBank, count(d.counts.accounts, 'bank account')],
    ['To receive', d.receivable, count(d.counts.customers, 'customer')],
    ['To pay', d.payable, 'You owe today'],
  ] as const;

  const tasks = [
    d.ageBuckets[2] > 0 && { title: `${npr(d.ageBuckets[2])} overdue`, detail: 'Owed to you for more than 60 days', href: '/app/finance/to-receive', action: 'Open report', bad: true },
    ...d.bankRows.filter((r) => r.value < 0).map((r) => ({ title: `${r.name} is below zero`, detail: npr(r.value), href: '/app/finance/bank-accounts', action: 'Check', bad: true })),
    d.ageBuckets[1] > 0 && { title: `${npr(d.ageBuckets[1])} waiting`, detail: 'Owed to you for 31 to 60 days', href: '/app/finance/to-receive', action: 'Follow up', bad: false },
    d.payable > 0 && { title: `${npr(d.payable)} to pay`, detail: 'Money you owe today', href: '/app/finance/to-give', action: 'Open report', bad: false },
    !!stock?.lowParts && partsTask(stock.lowParts),
  ].filter(Boolean) as Task[];

  return (
    <>
      <ul className={s.metrics}>
        {metrics.map(([label, value, note]) => <li key={label}><span>{label}</span><strong>{npr(value)}</strong><small>{note}</small></li>)}
        {stock && <VehiclesFigure stock={stock} />}
      </ul>

      <div className={s.split}>
        <Panel className={`${s.wide} ${s.later}`} title="Sales and purchases" sub={`Last 12 months · Sales ${npr(d.totals.sales)} · Purchases ${npr(d.totals.purchases)}`}>
          <MonthChart kind="bars" months={d.months} a={{ name: 'Sales', values: d.sales }} b={{ name: 'Purchases', values: d.purchases }} />
        </Panel>
        <Panel className={s.narrow} title="Needs your attention">
          <Tasks tasks={tasks} />
        </Panel>
      </div>

      <ShowAll className={`${s.showAll} ${s.phoneOnly}`} />

      <Panel className={s.later} title="Recent activity" sub={`Bills and expenses recorded: ${d.counts.entries}`}>
        {!d.recent.length ? <p className={s.empty}>Nothing recorded yet. Add entries in Finance.</p> : (
          <ul className={`${s.list} ${s.activity}`}>
            {d.recent.map((r, i) => (
              <li key={i}>
                <div><strong>{r.who}</strong><small>{r.what} · {r.date}</small></div>
                <b className={r.sign > 0 ? s.in : s.out}>{r.sign > 0 ? '+' : '−'}{npr(r.amount)}</b>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className={`${s.pair} ${s.later}`}>
        <Panel title="Cash and bank accounts" sub="Where your money is today" right={<span className={s.total}>{npr(d.cashAndBank)}</span>}>
          {!d.bankRows.length ? <p className={s.empty}>No cash or bank balance yet.</p> : <Bars rows={d.bankRows} />}
        </Panel>

        <Panel title="Receivable ageing" sub="How long what you are owed has been waiting" right={<span className={s.total}>{npr(ageTotal)}</span>}>
          {!ageTotal ? <p className={s.empty}>Nobody owes you money.</p> : (
            <>
              <div className={s.age} aria-hidden="true">{ages.map((a) => a.value > 0 && <i key={a.label} className={a.tone} style={{ flex: a.value }} />)}</div>
              <ul className={`${s.list} ${s.ages}`}>
                {ages.map((a) => <li key={a.label}><i className={`${s.key} ${a.tone}`} aria-hidden="true" /><span>{a.label} · {pct(a.value, ageTotal)}</span><b>{npr(a.value)}</b></li>)}
              </ul>
            </>
          )}
        </Panel>

        <Panel title="Receivable and payable" sub={`To receive less to pay: ${npr(net)}`}>
          <MonthChart kind="lines" months={d.months} a={{ name: 'To receive', values: d.receivableTrend }} b={{ name: 'To pay', values: d.payableTrend }} />
        </Panel>

        <Panel title="Received and paid" sub={`Last 12 months · In ${npr(d.totals.received)} · Out ${npr(d.totals.paid)} · Net ${npr(d.totals.received - d.totals.paid)}`}>
          <MonthChart kind="bars" months={d.months} a={{ name: 'Received', values: d.received }} b={{ name: 'Paid', values: d.paid }} />
        </Panel>

        <Panel title="Expenses by category" sub="Last 12 months" right={<span className={s.total}>{npr(d.totals.expenses)}</span>}>
          {!expenses.length ? <p className={s.empty}>No expenses yet.</p> : <Bars rows={expenses} of={sum(expenses.map((e) => e.value))} />}
        </Panel>

        <Panel title="Top customers" sub="Sales in the last 12 months" right={<span className={s.total}>{npr(topTotal)}</span>}>
          {!d.topCustomers.length ? <p className={s.empty}>No sales yet.</p> : <Bars rows={d.topCustomers.slice(0, 8).map(([name, value]) => ({ name, value }))} of={topTotal} />}
        </Panel>
      </div>
    </>
  );
}

// A new account: every app is shown, and unlocks once a business is set up
export function SetupDashboard({ name, apps, error, message }: Messages & { name: string | null; apps: { key: string; name: string }[] }) {
  return (
    <div className={s.page}>
      <ReactLenis root options={{ anchors: true }} />
      <div className={s.head}><h1>Hello{name ? `, ${name}` : ''}</h1></div>
      <Notices error={error} message={message} />
      <p role="status" className={s.banner}>Finish setting up your business to unlock these apps. <Link href="/onboarding">Set up your business</Link></p>
      <ul className={s.apps}>
        {apps.map((app) => <li key={app.key}><Link href="/onboarding"><ServiceLogo svc={app} />{app.name}</Link></li>)}
      </ul>
    </div>
  );
}
