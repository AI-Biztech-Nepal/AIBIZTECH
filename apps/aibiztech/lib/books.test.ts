import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDashboard } from './books.ts';

const now = new Date('2026-11-17T10:00:00Z');
const at = (s: string) => ({ created_at: s + 'T08:00:00Z' });
const raw = {
  parties: [{ id: 'p1', name: 'Ram' }, { id: 'p2', name: 'Sita Traders' }],
  accounts: [{ id: 'b1', name: 'NIC Asia' }], categories: [{ id: 'c1', name: 'Rent' }], transfers: [{ from_account_id: null, to_account_id: 'b1', amount: 1000 }],
  txs: [
    { id: 't1', type: 'sale', amount: 5000, customer_id: 'p1', party_name: null, bill_date: '2026-10-05', bank_account_id: null, expense_category_id: null, ...at('2026-10-05') },
    { id: 't2', type: 'sale', amount: 300, customer_id: null, party_name: 'Walk-in', bill_date: '2026-11-02', bank_account_id: null, expense_category_id: null, ...at('2026-11-02') },
    { id: 't3', type: 'purchase', amount: 2000, customer_id: 'p2', party_name: null, bill_date: '2026-09-10', bank_account_id: null, expense_category_id: null, ...at('2026-09-10') },
    { id: 't4', type: 'expense', amount: 500, customer_id: null, party_name: null, bill_date: '2026-11-03', bank_account_id: 'b1', expense_category_id: 'c1', ...at('2026-11-03') },
  ],
  // a credit sale books a debit (a database trigger does this); Ram then pays 2000 into the bank
  cl: [
    { id: 'e1', customer_id: 'p1', entry_type: 'debit', amount: 5000, source: 'booking', bank_account_id: null, entry_date: '2026-10-05', note: null, ...at('2026-10-05') },
    { id: 'e2', customer_id: 'p1', entry_type: 'credit', amount: 2000, source: 'manual', bank_account_id: 'b1', entry_date: '2026-11-01', note: null, ...at('2026-11-01') },
  ],
  vl: [{ id: 'v1', vendor_id: 'p2', entry_type: 'debit', amount: 2000, source: 'booking', bank_account_id: null, entry_date: '2026-09-10', note: null, ...at('2026-09-10') }],
} as Parameters<typeof computeDashboard>[0];

test('what is owed, what is held, and how it moved', () => {
  const x = computeDashboard(raw, now);
  assert.equal(x.receivable, 3000);
  assert.equal(x.payable, 2000);
  assert.equal(x.cashAndBank, 1800); // walk-in 300 + received 2000 - expense 500
  assert.deepEqual(x.bankRows.map((r) => [r.name, r.value]), [['NIC Asia', 2500], ['Cash in hand', -700]]);
  assert.deepEqual([x.totals.sales, x.totals.purchases, x.totals.expenses], [5300, 2000, 500]);
  assert.deepEqual([x.totals.received, x.totals.paid], [2300, 500]);
  assert.equal(x.receivableTrend[10], 5000); // at 31 Oct nothing had been paid yet
});

test('ageing, top customers and expense categories', () => {
  const x = computeDashboard(raw, now);
  assert.deepEqual(x.ageBuckets, [0, 3000, 0]); // indebted 43 days ago
  assert.deepEqual(x.topCustomers, [['Ram', 5000], ['Walk-in', 300]]);
  assert.deepEqual(x.expenseRows, [['Rent', 500]]);
  assert.equal(x.months.length, 12);
});
