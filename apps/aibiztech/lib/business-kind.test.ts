import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kindFrom } from './business-kind.ts';

test('automobile sales and workshops get the automobile version', () => {
  assert.equal(kindFrom('vehicles'), 'auto');
  assert.equal(kindFrom('workshop'), 'auto');
});
test('other kinds get the general version', () => {
  for (const type of ['retail', 'services', 'other']) assert.equal(kindFrom(type), 'general');
});
test('any vehicle mark counts, not only the stock one', () => {
  assert.equal(kindFrom(null, { stockPack: true }), 'auto');
  assert.equal(kindFrom(null, { financePack: true }), 'auto');
  assert.equal(kindFrom(null, { sellsVehicles: true }), 'auto');
  assert.equal(kindFrom('retail', { financePack: true }), 'auto');
});
test('a vehicle pack switched off is respected', () => assert.equal(kindFrom('vehicles', { stockPack: false }), 'general'));
test('nothing recorded: not assumed either way', () => {
  assert.equal(kindFrom(null), null);
  assert.equal(kindFrom('', { sellsVehicles: false }), null);
});
