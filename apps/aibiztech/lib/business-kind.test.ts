import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kindFrom } from './business-kind.ts';

test('a vehicle dealership gets the automobile version', () => assert.equal(kindFrom('vehicles', null), 'auto'));
test('other kinds get the general version', () => {
  for (const type of ['retail', 'services', 'other', null, undefined, '']) assert.equal(kindFrom(type, null), 'general');
});
test('a workshop keeps its own kind', () => assert.equal(kindFrom('workshop', null), 'workshop'));
test('the vehicle pack switch wins both ways', () => {
  assert.equal(kindFrom(null, true), 'auto');
  assert.equal(kindFrom('retail', true), 'auto');
  assert.equal(kindFrom('vehicles', false), 'general');
});
