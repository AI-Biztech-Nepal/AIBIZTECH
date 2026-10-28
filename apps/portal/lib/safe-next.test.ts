import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext } from './safe-next.ts';

test('relative portal paths pass, protocol-relative do not', () => {
  assert.equal(safeNext('/reset-password'), '/reset-password');
  assert.equal(safeNext('//evil.com'), '/');
  assert.equal(safeNext('/\\evil.com'), '/');
  assert.equal(safeNext(undefined), '/');
  assert.equal(safeNext('javascript:alert(1)', '.aibiz.np'), '/');
});

test('only https hosts under the cookie domain pass', () => {
  const d = '.aibiz.np';
  assert.equal(safeNext('https://finance.aibiz.np/bills', d), 'https://finance.aibiz.np/bills');
  assert.equal(safeNext('https://aibiz.np/', d), 'https://aibiz.np/');
  assert.equal(safeNext('http://finance.aibiz.np/', d), '/');
  assert.equal(safeNext('https://evilaibiz.np/', d), '/');
  assert.equal(safeNext('https://aibiz.np.evil.com/', d), '/');
});

test('without a cookie domain only localhost passes', () => {
  assert.equal(safeNext('http://localhost:3001/', ''), 'http://localhost:3001/');
  assert.equal(safeNext('https://finance.aibiz.np/', ''), '/');
});
