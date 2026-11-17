// The Finance money rules, in one place so every screen shows the same numbers (see services/finance/finance-port/FINANCE-SPEC.md §2).
export type Tx = { id: string; type: 'sale' | 'purchase' | 'expense'; amount: number; customer_id: string | null; party_name: string | null; bill_no: string | null; bill_date: string | null; note: string | null; bank_account_id: string | null; created_at: string };
export type Entry = { id: string; customer_id?: string; vendor_id?: string; entry_type: 'debit' | 'credit'; amount: number; source: 'manual' | 'booking'; bank_account_id: string | null; entry_date: string | null; note: string | null; created_at: string };
export type Transfer = { from_account_id: string | null; to_account_id: string | null; amount: number };
export type Account = { id: string; name: string; bank_name: string | null; account_number: string | null };
export type Party = { id: string; name: string; phone: string | null; address: string | null };

export const money = (n: number) => 'Rs ' + Math.round(n).toLocaleString('en-IN');
export const dateOf = (x: { bill_date?: string | null; entry_date?: string | null; created_at: string }) => (x.bill_date ?? x.entry_date ?? x.created_at).slice(0, 10);

// A sale or purchase with no saved party has no ledger to settle later, so its cash moved when it was recorded
export const settledOnTheSpot = (t: Tx) => (t.type === 'sale' || t.type === 'purchase') && !t.customer_id;

export function computeBooks(input: { txs: Tx[]; customerLedger: Entry[]; vendorLedger: Entry[]; transfers: Transfer[]; accounts: Account[] }) {
  const { txs, customerLedger, vendorLedger, transfers, accounts } = input;
  const bucket = new Map<string, number>([['cash', 0], ...accounts.map((a) => [a.id, 0] as [string, number])]);
  const add = (id: string | null, v: number) => bucket.set(id ?? 'cash', (bucket.get(id ?? 'cash') ?? 0) + v);

  for (const t of txs) {
    if (settledOnTheSpot(t)) add(t.bank_account_id, t.type === 'sale' ? +t.amount : -t.amount);
    if (t.type === 'expense') add(t.bank_account_id, -t.amount);
  }
  for (const e of customerLedger) {
    if (e.entry_type === 'credit') add(e.bank_account_id, +e.amount); // received
    else if (e.source === 'manual') add(e.bank_account_id, -e.amount); // refund out
  }
  for (const e of vendorLedger) if (e.entry_type === 'credit') add(e.bank_account_id, -e.amount); // paid
  for (const t of transfers) { add(t.from_account_id, -t.amount); add(t.to_account_id, +t.amount); }

  const sum = (rows: Entry[], key: 'customer_id' | 'vendor_id') => {
    const m = new Map<string, number>();
    for (const e of rows) { const id = e[key]!; m.set(id, (m.get(id) ?? 0) + (e.entry_type === 'debit' ? +e.amount : -e.amount)); }
    return m;
  };
  const receivable = sum(customerLedger, 'customer_id'); // they owe you
  const payable = sum(vendorLedger, 'vendor_id'); // you owe them
  const positive = (m: Map<string, number>) => [...m.values()].reduce((a, v) => a + Math.max(v, 0), 0);

  const total = [...bucket.values()].reduce((a, v) => a + v, 0);
  const inPeriod = (from: string) => txs.filter((t) => dateOf(t) >= from);
  const profit = (rows: Tx[]) => {
    const s = (ty: Tx['type']) => rows.filter((t) => t.type === ty).reduce((a, t) => a + +t.amount, 0);
    return { sales: s('sale'), purchases: s('purchase'), expenses: s('expense'), gross: s('sale') - s('purchase'), net: s('sale') - s('purchase') - s('expense') };
  };
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  return {
    balances: bucket, total,
    receivable, payable, totalReceivable: positive(receivable), totalPayable: positive(payable),
    month: profit(inPeriod(monthStart)), allTime: profit(txs),
  };
}
