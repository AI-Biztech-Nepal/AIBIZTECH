import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niceMax, shortAmount } from './chart.ts';

test('chart tops are round numbers that hold every value', () => {
  assert.equal(niceMax([0, 0]), 1);
  assert.equal(niceMax([180000, 3160000]), 5000000);
  assert.equal(niceMax([2400000]), 2500000);
  assert.equal(niceMax([1000]), 1000);
});

test('axis labels use thousand, lakh and crore', () => {
  assert.deepEqual([0, 500, 25000, 250000, 2500000, 12500000].map(shortAmount), ['0', '500', '25k', '2.5L', '25L', '1.3Cr']);
});
