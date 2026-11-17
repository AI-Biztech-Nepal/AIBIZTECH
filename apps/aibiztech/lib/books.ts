// The business dashboard's numbers, from the Finance books (finance schema). The rules are Finance's own (FINANCE-SPEC.md):
// a bill is not money, an expense is, a bill with no saved party is cash settled on the spot.
export type Tx = { id: string; type: 'sale' | 'purchase' | 'expense'; amount: number; customer_id: string | null; party_name: string | null; bill_date: string | null; created_at: string; bank_account_id: string | null; expense_category_id: string | null };
export type Entry = { id: string; customer_id?: string; vendor_id?: string; entry_type: 'debit' | 'credit'; amount: number; source: 'manual' | 'booking'; bank_account_id: string | null; entry_date: string | null; note: string | null; created_at: string };
export type Transfer = { from_account_id: string | null; to_account_id: string | null; amount: number };
export type Account = { id: string; name: string };
export type Party = { id: string; name: string };
export type Raw = { txs: Tx[]; cl: Entry[]; vl: Entry[]; accounts: Account[]; transfers: Transfer[]; parties: Party[]; categories: { id: string; name: string }[] };

export const npr = (n: number) => `NPR ${Math.round(n).toLocaleString('en-IN')}`;
const day = (x: { bill_date?: string | null; entry_date?: string | null; created_at: string }) => (x.bill_date ?? x.entry_date ?? x.created_at).slice(0, 10);
const spot = (t: Tx) => (t.type === 'sale' || t.type === 'purchase') && !t.customer_id;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function computeDashboard(raw: Raw, now = new Date()) {
  const { txs, cl, vl, accounts, transfers, parties, categories } = raw;
  const names = new Map(parties.map((p) => [p.id, p.name]));

  // The last twelve months, oldest first
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { key, label: MONTHS[d.getMonth()], end };
  });
  const idx = new Map(months.map((m, i) => [m.key, i]));
  const slot = (date: string) => idx.get(date.slice(0, 7));
  const zero = () => months.map(() => 0);
  const add = (arr: number[], date: string, v: number) => { const i = slot(date); if (i != null) arr[i] += v; };

  // Sales, purchases, expenses by the bill's own date
  const sales = zero(), purchases = zero(), expensesM = zero();
  for (const t of txs) add(t.type === 'sale' ? sales : t.type === 'purchase' ? purchases : expensesM, day(t), +t.amount);

  // Cash and banks
  const bucket = new Map<string, number>([['cash', 0], ...accounts.map((a) => [a.id, 0] as [string, number])]);
  const bump = (id: string | null, v: number) => bucket.set(id ?? 'cash', (bucket.get(id ?? 'cash') ?? 0) + v);
  for (const t of txs) { if (spot(t)) bump(t.bank_account_id, t.type === 'sale' ? +t.amount : -t.amount); if (t.type === 'expense') bump(t.bank_account_id, -t.amount); }
  for (const e of cl) { if (e.entry_type === 'credit') bump(e.bank_account_id, +e.amount); else if (e.source === 'manual') bump(e.bank_account_id, -e.amount); }
  for (const e of vl) if (e.entry_type === 'credit') bump(e.bank_account_id, -e.amount);
  for (const t of transfers) { bump(t.from_account_id, -t.amount); bump(t.to_account_id, +t.amount); }
  const bankRows = [{ name: 'Cash in hand', value: bucket.get('cash') ?? 0 }, ...accounts.map((a) => ({ name: a.name, value: bucket.get(a.id) ?? 0 }))].filter((r) => Math.round(r.value) !== 0).sort((a, b) => b.value - a.value);
  const cashAndBank = [...bucket.values()].reduce((a, v) => a + v, 0);

  // Received and paid, by month
  const received = zero(), paid = zero();
  for (const t of txs) { if (spot(t) && t.type === 'sale') add(received, day(t), +t.amount); if (spot(t) && t.type === 'purchase') add(paid, day(t), +t.amount); if (t.type === 'expense') add(paid, day(t), +t.amount); }
  for (const e of cl) { if (e.entry_type === 'credit') add(received, day(e), +e.amount); else if (e.source === 'manual') add(paid, day(e), +e.amount); }
  for (const e of vl) if (e.entry_type === 'credit') add(paid, day(e), +e.amount);

  // Who owes whom: each party's balance up to a date; only the positive ones count
  const balanceAt = (rows: Entry[], key: 'customer_id' | 'vendor_id', upTo: string) => {
    const m = new Map<string, number>();
    for (const e of rows) if (day(e) <= upTo) { const id = e[key]!; m.set(id, (m.get(id) ?? 0) + (e.entry_type === 'debit' ? +e.amount : -e.amount)); }
    return m;
  };
  const positive = (m: Map<string, number>) => [...m.values()].reduce((a, v) => a + Math.max(v, 0), 0);
  const today = now.toISOString().slice(0, 10);
  const owedNow = balanceAt(cl, 'customer_id', today), oweNow = balanceAt(vl, 'vendor_id', today);
  const receivable = positive(owedNow), payable = positive(oweNow);
  const receivableTrend = months.map((m) => positive(balanceAt(cl, 'customer_id', m.end)));
  const payableTrend = months.map((m) => positive(balanceAt(vl, 'vendor_id', m.end)));

  // Ageing: a balance is as old as the day its party last became indebted
  const ageBuckets = [0, 0, 0];
  const byParty = new Map<string, Entry[]>();
  for (const e of cl) { const id = e.customer_id!; (byParty.get(id) ?? byParty.set(id, []).get(id)!).push(e); }
  for (const [id, rows] of byParty) {
    if ((owedNow.get(id) ?? 0) <= 0) continue;
    rows.sort((a, b) => day(a).localeCompare(day(b)) || a.created_at.localeCompare(b.created_at));
    let run = 0, since = day(rows[0]);
    for (const e of rows) { const before = run; run += e.entry_type === 'debit' ? +e.amount : -e.amount; if (before <= 0 && run > 0) since = day(e); }
    const days = Math.floor((now.getTime() - new Date(since).getTime()) / 864e5);
    ageBuckets[days <= 30 ? 0 : days <= 60 ? 1 : 2] += owedNow.get(id)!;
  }

  // Expenses by category, top customers (12 months), recent activity
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const first = months[0].key + '-01';
  const exp = new Map<string, number>();
  const topC = new Map<string, number>();
  for (const t of txs) {
    if (day(t) < first) continue;
    if (t.type === 'expense') { const n = (t.expense_category_id && cat.get(t.expense_category_id)) || 'Other'; exp.set(n, (exp.get(n) ?? 0) + +t.amount); }
    if (t.type === 'sale') { const n = (t.customer_id && names.get(t.customer_id)) || t.party_name || 'Walk-in'; topC.set(n, (topC.get(n) ?? 0) + +t.amount); }
  }
  const expenseRows = [...exp.entries()].sort((a, b) => b[1] - a[1]);
  const topCustomers = [...topC.entries()].sort((a, b) => b[1] - a[1]);
  const recent = [
    ...txs.map((t) => ({ date: day(t), stamp: t.created_at, what: t.type === 'sale' ? 'Sale' : t.type === 'purchase' ? 'Purchase' : 'Expense', who: (t.customer_id && names.get(t.customer_id)) || t.party_name || '—', amount: +t.amount, sign: t.type === 'sale' ? 1 : -1 })),
    ...cl.filter((e) => e.source === 'manual').map((e) => ({ date: day(e), stamp: e.created_at, what: e.entry_type === 'credit' ? 'Received' : 'Refund', who: names.get(e.customer_id!) ?? '—', amount: +e.amount, sign: e.entry_type === 'credit' ? 1 : -1 })),
    ...vl.filter((e) => e.source === 'manual').map((e) => ({ date: day(e), stamp: e.created_at, what: e.entry_type === 'credit' ? 'Paid' : 'Adjustment', who: names.get(e.vendor_id!) ?? '—', amount: +e.amount, sign: -1 })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.stamp.localeCompare(a.stamp)).slice(0, 9);

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  return {
    months: months.map((m) => m.label), sales, purchases, expensesM, received, paid, receivableTrend, payableTrend,
    totals: { sales: sum(sales), purchases: sum(purchases), expenses: sum(expensesM), received: sum(received), paid: sum(paid) },
    cashAndBank, bankRows, receivable, payable, ageBuckets, expenseRows, topCustomers, recent,
    counts: { customers: parties.length, accounts: accounts.length, entries: txs.length },
  };
}
