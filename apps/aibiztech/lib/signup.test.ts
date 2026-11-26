import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trialDates, validateSignup, type SignupValues } from './signup.ts';

const ok: SignupValues = { full_name: 'Ram Shrestha', business_name: 'Acme', email: 'ram@acme.np', phone: '9841000000', password: 'abcd1234', confirm_password: 'abcd1234' };

test('complete sign-up details pass', () => {
  assert.deepEqual(validateSignup(ok, false), {});
});

test('each bad sign-up field is rejected', () => {
  const bad: SignupValues = { full_name: ' ', business_name: '', email: 'ram@acme', phone: '12', password: 'abcdefgh', confirm_password: 'x' };
  assert.deepEqual(Object.keys(validateSignup(bad, false)), ['full_name', 'business_name', 'email', 'phone', 'password', 'confirm_password']);
  assert.ok(validateSignup({ ...ok, password: 'ab12', confirm_password: 'ab12' }, false).password);
  assert.ok(validateSignup({ ...ok, confirm_password: '' }, false).confirm_password);
});

test('an invited person does not need a business name', () => {
  assert.deepEqual(validateSignup({ ...ok, business_name: '' }, true), {});
});

test('trial dates are seven days in Nepal time', () => {
  // 20:00 UTC on 25 Nov is already 01:45 on 26 Nov in Kathmandu
  const trial = trialDates(new Date('2026-11-25T20:00:00Z'));
  assert.deepEqual(trial.days, ['Thu 26', 'Fri 27', 'Sat 28', 'Sun 29', 'Mon 30', 'Tue 1', 'Wed 2']);
  assert.equal(trial.start, 'Thu 26 Nov');
  assert.equal(trial.end, 'Thu 3 Dec 2026');
});
