import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appStatus, COMPARISON, contactHref, PLANS, priceText, subscription, type Access } from './plans.ts';

const now = new Date('2026-11-26T10:00:00Z');
const at = (days: number) => new Date(now.getTime() + days * 864e5).toISOString();
const trial = (startedAgo: number, endsIn: number): Access => ({ status: 'trial', enabled_at: at(-startedAgo), trial_ends_at: at(endsIn) });

test('a running trial knows its day and what is left', () => {
  const s = subscription([trial(2, 5)], now);
  assert.equal(s.kind, 'trial');
  assert.deepEqual(s.kind === 'trial' && [s.day, s.days, s.left], [3, 7, 5]);
  const first = subscription([trial(0, 7)], now);
  assert.deepEqual(first.kind === 'trial' && [first.day, first.left], [1, 7]);
  const last = subscription([trial(6.5, 0.5)], now);
  assert.deepEqual(last.kind === 'trial' && [last.day, last.left], [7, 1]);
});

test('the trial ending soonest counts; ended, paid and new businesses are told apart', () => {
  const soonest = subscription([trial(1, 14), trial(2, 5), trial(20, -1)], now);
  assert.equal(soonest.kind === 'trial' && soonest.left, 5);
  const over = subscription([trial(20, -5), trial(10, -3)], now);
  assert.equal(over.kind === 'ended' && over.ended.toISOString(), at(-3));
  assert.equal(subscription([trial(20, -5), { ...trial(1, 6), status: 'active' }], now).kind, 'active');
  assert.equal(subscription([], now).kind, 'none');
});

test('each app says where it stands', () => {
  assert.deepEqual(appStatus(trial(2, 5), now), { text: 'Trial, 5 days left', tone: 'good' });
  assert.deepEqual(appStatus(trial(6, 1), now), { text: 'Trial, 1 day left', tone: 'warn' });
  assert.deepEqual(appStatus(trial(9, -1), now), { text: 'Trial ended 25 Nov 2026', tone: 'bad' });
  assert.equal(appStatus({ ...trial(1, 1), status: 'suspended' }, now).tone, 'bad');
});

test('no paid price is shown until one is set', () => {
  const [free, basic, , enterprise] = PLANS;
  assert.equal(priceText(free, 'monthly').amount, 'NPR 0');
  assert.deepEqual(priceText(basic, 'yearly'), { amount: 'To be announced', per: 'billed yearly' });
  assert.deepEqual(priceText({ ...basic, price: { monthly: 1500, yearly: 15000 } }, 'monthly'), { amount: 'NPR 1,500', per: 'per month' });
  assert.equal(priceText(enterprise, 'monthly').amount, 'Custom');
  for (const group of COMPARISON) for (const row of group.rows) assert.equal(row.length, PLANS.length + 1);
});

test('contact becomes the right kind of link', () => {
  assert.equal(contactHref('sales@example.com'), 'mailto:sales@example.com');
  assert.equal(contactHref('+977 98-0000 0000'), 'tel:+9779800000000');
  assert.equal(contactHref('https://example.com/contact'), 'https://example.com/contact');
});
