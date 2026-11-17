import type { ReactNode } from 'react';
import { npr, type computeDashboard } from '@/lib/books';

type D = ReturnType<typeof computeDashboard>;
const PALETTE = ['#0b79ee', '#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#f472b6', '#94a3b8'];
const pct = (n: number, total: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%');

function Panel({ title, sub, right, children }: { title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="tile dash-panel">
      <div className="panel-head"><div><h2>{title}</h2>{sub && <p className="muted">{sub}</p>}</div>{right}</div>
      {children}
    </section>
  );
}

function Money({ label, value, tone }: { label: string; value: number; tone: 'in' | 'out' | 'plain' }) {
  return <div className={`money ${tone}`}><span>{label}</span><strong>{npr(value)}</strong></div>;
}

// Two lines over twelve months; the first is filled
function Trend({ labels, a, b, nameA, nameB }: { labels: string[]; a: number[]; b: number[]; nameA: string; nameB: string }) {
  const W = 600, H = 210, L = 44, R = 12, T = 12, B = 26;
  const max = Math.max(...a, ...b, 1);
  const x = (i: number) => L + (i * (W - L - R)) / (labels.length - 1);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line(a)} L${x(a.length - 1)},${H - B} L${x(0)},${H - B} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const short = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${nameA} and ${nameB}, last 12 months`} className="chart">
        <defs><linearGradient id="fillA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b79ee" stopOpacity="0.45" /><stop offset="1" stopColor="#0b79ee" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#243665" strokeDasharray="3 4" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#8fa3c7">{short(t)}</text></g>)}
        <path d={area} fill="url(#fillA)" />
        <path d={line(b)} fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinejoin="round" />
        <path d={line(a)} fill="none" stroke="#22d3ee" strokeWidth="2.6" strokeLinejoin="round" />
        {labels.map((l, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8fa3c7">{l}</text>)}
      </svg>
      <p className="legend"><i style={{ background: '#22d3ee' }} />{nameA} <i style={{ background: '#f59e0b' }} />{nameB}</p>
    </div>
  );
}

function Donut({ rows }: { rows: [string, number][] }) {
  const total = rows.reduce((a, r) => a + r[1], 0);
  const top = rows.slice(0, 6);
  const rest = rows.slice(6).reduce((a, r) => a + r[1], 0);
  const parts: [string, number][] = rest > 0 ? [...top, ['Other', rest]] : top;
  const R = 42, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" className="donut" role="img" aria-label="Expenses by category">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#243665" strokeWidth="16" />
        {total > 0 && parts.map(([name, v], i) => {
          const len = (v / total) * C;
          const el = <circle key={name} cx="60" cy="60" r={R} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />;
          off += len;
          return el;
        })}
        <text x="60" y="64" textAnchor="middle" fontSize="13" fontWeight="700" fill="#e8f0ff">{total > 0 ? npr(total).replace('NPR ', '') : '—'}</text>
      </svg>
      <ul className="legend-list">
        {parts.map(([name, v], i) => <li key={name}><i style={{ background: PALETTE[i % PALETTE.length] }} /><span>{name}</span><b>{pct(v, total)}</b></li>)}
        {!parts.length && <li className="muted">No expenses yet</li>}
      </ul>
    </div>
  );
}

export function MoneyDashboard({ d }: { d: D }) {
  const ageTotal = d.ageBuckets.reduce((a, v) => a + v, 0);
  const bankMax = Math.max(...d.bankRows.map((r) => Math.abs(r.value)), 1);
  const topTotal = d.topCustomers.reduce((a, r) => a + r[1], 0);
  const net = d.receivable - d.payable;
  return (
    <div className="dash">
      <div className="dash-grid">
        <Panel title="Sales and purchases" sub="What you sold and what you bought · last 12 months">
          <div className="money-row"><Money label="Sales" value={d.totals.sales} tone="in" /><Money label="Purchases" value={d.totals.purchases} tone="out" /></div>
          <Trend labels={d.months} a={d.sales} b={d.purchases} nameA="Sales" nameB="Purchases" />
        </Panel>

        <Panel title="Recent activity" sub="Latest sales, purchases and payments">
          {!d.recent.length ? <p className="muted">Nothing recorded yet. Add entries in Finance.</p> : (
            <ul className="activity">
              {d.recent.map((r, i) => (
                <li key={i}><span className="who"><strong>{r.who}</strong><small>{r.what} · {r.date}</small></span><b className={r.sign > 0 ? 'in' : 'out'}>{r.sign > 0 ? '+' : '−'}{npr(r.amount)}</b></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <h2 className="section">Money</h2>
      <div className="dash-grid">
        <Panel title="In cash and banks" sub="Where your money is today" right={<strong className="big in">{npr(d.cashAndBank)}</strong>}>
          {!d.bankRows.length ? <p className="muted">No cash or bank balance yet.</p> : d.bankRows.map((r) => (
            <div key={r.name} className="bar-row"><span>{r.name}</span><div className="bar"><i style={{ width: `${(Math.abs(r.value) / bankMax) * 100}%`, background: r.value < 0 ? '#ef4444' : '#14b8a6' }} /></div><b>{npr(r.value)}</b></div>
          ))}
        </Panel>

        <Panel title="Receivable ageing" sub="How long what you are owed has been waiting">
          <div className="age">
            {(['0–30 days', '31–60 days', '60+ days'] as const).map((label, i) => (
              <div key={label} className="age-box" style={{ background: ['#0f766e', '#d97706', '#dc2626'][i], flexGrow: Math.max(d.ageBuckets[i], ageTotal * 0.12) || 1 }}>
                <small>{pct(d.ageBuckets[i], ageTotal)}</small><strong>{npr(d.ageBuckets[i])}</strong><span>{label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Receivable and payable" sub="What is owed to you and by you">
          <div className="money-row"><Money label="To receive" value={d.receivable} tone="in" /><Money label="To pay" value={d.payable} tone="out" /></div>
          <p className="muted">Net (receivable − payable) <b className={net >= 0 ? 'in' : 'out'}>{npr(net)}</b></p>
          <Trend labels={d.months} a={d.receivableTrend} b={d.payableTrend} nameA="To receive" nameB="To pay" />
        </Panel>

        <Panel title="Received and paid" sub="What came in and what went out · last 12 months">
          <div className="money-row"><Money label="Received" value={d.totals.received} tone="in" /><Money label="Paid" value={d.totals.paid} tone="out" /></div>
          <p className="muted">Net movement <b className={d.totals.received - d.totals.paid >= 0 ? 'in' : 'out'}>{npr(d.totals.received - d.totals.paid)}</b></p>
          <Trend labels={d.months} a={d.received} b={d.paid} nameA="Received" nameB="Paid" />
        </Panel>
      </div>

      <h2 className="section">Expenses and customers</h2>
      <div className="dash-grid">
        <Panel title="Expense diagram" sub="Expenses by category · last 12 months"><Donut rows={d.expenseRows} /></Panel>
        <Panel title="Top customers" sub="Sales · last 12 months">
          {!d.topCustomers.length ? <p className="muted">No sales yet.</p> : (
            <>
              {d.topCustomers.slice(0, 8).map(([name, v]) => (
                <div key={name} className="bar-row"><span>{name}</span><div className="bar"><i style={{ width: `${(v / d.topCustomers[0][1]) * 100}%`, background: '#0b79ee' }} /></div><b>{npr(v)}</b><em>{pct(v, topTotal)}</em></div>
              ))}
              <div className="bar-row total"><span>All customers</span><span /><b>{npr(topTotal)}</b><em>100%</em></div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
