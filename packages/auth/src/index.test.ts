import assert from 'node:assert/strict';
import test from 'node:test';
import { configure, deniedUrl, loginUrl } from './index.ts';

configure({ supabaseUrl: 'http://x', anonKey: 'k', portalUrl: 'https://app.example.com' });

test('loginUrl encodes the return address', () => {
  assert.equal(loginUrl('https://finance.example.com/a?b=1'), 'https://app.example.com/login?next=https%3A%2F%2Ffinance.example.com%2Fa%3Fb%3D1');
});

test('deniedUrl names the service', () => {
  assert.equal(deniedUrl('stock'), 'https://app.example.com/?denied=stock');
});
