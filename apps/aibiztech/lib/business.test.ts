import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessAlerts, plural, roleName } from './business.ts';
import type { Member } from './supabase.ts';

const now = new Date('2026-11-26T06:00:00Z');
const at = (days: number) => new Date(now.getTime() + days * 864e5).toISOString();
const member = (status: Member['status'], service_roles: Record<string, string>): Member => ({ user_id: 'u', full_name: 'A', email: 'a@x.np', org_role: 'member', status, joined_at: at(-9), service_roles });
const row = (service_key: string, status: string, endsIn: number) => ({ service_key, status, trial_ends_at: at(endsIn), enabled_at: at(-2) });
const services = [{ key: 'finance', name: 'Finance' }, { key: 'stock', name: 'Stock Manager' }, { key: 'marketing', name: 'Marketing' }];
const fine = { verification: { status: 'verified', note: null }, services, enabled: [row('finance', 'trial', 5)], members: [member('active', { finance: 'admin' })], pending: [] };

test('a business in good order has nothing to report', () => {
  assert.deepEqual(businessAlerts(fine, now), []);
});

test('alerts come in order and lead somewhere useful', () => {
  const list = businessAlerts({
    verification: { status: 'rejected', note: 'PAN is unreadable' },
    services,
    enabled: [row('finance', 'trial', 2), row('stock', 'trial', -1), row('marketing', 'suspended', 5)],
    members: [member('active', { finance: 'admin', stock: 'admin' }), member('disabled', { marketing: 'admin' })],
    pending: [{ id: 'i', email: 'b@x.np', org_role: 'member', expires_at: at(-1) }],
  }, now);
  assert.deepEqual(list.map((a) => [a.text, a.href]), [
    ['Verification was rejected: PAN is unreadable. Contact support.', undefined],
    ['Finance trial ends in 2 days.', '/plans'],
    ['Stock Manager trial has ended. Subscribe to open it again.', '/plans'],
    ['Marketing is suspended.', undefined],
    ['Nobody has a role in Marketing yet.', '/team'],
    ['1 invitation expired without being accepted.', '/team'],
    ['1 member disabled and cannot sign in to apps.', '/team'],
  ]);
});

test('an unloaded member list does not claim nobody has access', () => {
  assert.deepEqual(businessAlerts({ ...fine, members: [] }, now), []);
});

test('words', () => {
  assert.deepEqual([plural(1, 'person', 'people'), plural(2, 'person', 'people'), plural(0, 'day')], ['1 person', '2 people', '0 days']);
  assert.deepEqual(['hr', 'admin', 'stock_keeper'].map(roleName), ['HR', 'Admin', 'Stock keeper']);
});
