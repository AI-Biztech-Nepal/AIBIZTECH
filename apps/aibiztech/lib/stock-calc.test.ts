import test from 'node:test';
import assert from 'node:assert/strict';
import { emiPlan, warrantyInfo } from './stock-calc.ts';

test('instalment follows the standard loan formula', () => {
  const p = emiPlan(100000, 12, 12); // 1% a month
  assert.equal(p.monthly, 8884.88);
  assert.equal(p.totalPayable, 106618.55);
  assert.equal(p.totalInterest, 6618.55);
});
test('no interest splits the loan evenly; bad input gives zero', () => {
  assert.deepEqual(emiPlan(120000, 0, 12), { monthly: 10000, totalPayable: 120000, totalInterest: 0 });
  assert.equal(emiPlan(0, 10, 12).monthly, 0);
  assert.equal(emiPlan(1000, 10, 0).monthly, 0);
});

const sold = { status: 'sold', sold_date: '2026-01-01', warranty_days: null, warranty_void: false };
const svc = { is_warranty: true, after_sale: true, job_date: '2026-02-01', created_at: null };
test('warranty is awaiting until the 1st service, then active, then expired', () => {
  assert.equal(warrantyInfo(sold, 182, [], '2026-03-01').status, 'awaiting');
  assert.equal(warrantyInfo(sold, 182, [svc], '2026-03-01').status, 'active');
  const w = warrantyInfo(sold, 182, [svc], '2026-03-01');
  assert.equal(w.end, '2026-07-02');
  assert.equal(w.daysLeft, 123);
  assert.equal(warrantyInfo(sold, 182, [svc], '2026-08-01').status, 'expired');
});
test('a job before the sale is not a service; void wins; unsold has none; custom length is used', () => {
  assert.equal(warrantyInfo(sold, 182, [{ ...svc, job_date: '2025-12-01' }], '2026-03-01').status, 'awaiting');
  assert.equal(warrantyInfo({ ...sold, warranty_void: true }, 182, [svc], '2026-03-01').status, 'void');
  assert.equal(warrantyInfo({ ...sold, status: 'available' }, 182, [], '2026-03-01').status, 'none');
  assert.equal(warrantyInfo({ ...sold, warranty_days: 30 }, 182, [svc], '2026-03-01').status, 'expired');
});
