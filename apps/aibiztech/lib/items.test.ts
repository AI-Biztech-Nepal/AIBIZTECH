import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFieldLines, readAttributes, slugify } from './items.ts';

test('slugify makes a website key', () => {
  assert.equal(slugify('Home Appliances'), 'home-appliances');
  assert.equal(slugify('  Luggage! '), 'luggage');
  assert.equal(slugify('Sizes & Colours', '_'), 'sizes_colours');
});

test('parseFieldLines: labels, long flag, blanks and repeats', () => {
  const f = parseFieldLines('Sizes\n\nKey features | long\nsizes\nWarranty  ');
  assert.deepEqual(f, [
    { key: 'sizes', label: 'Sizes', long: false },
    { key: 'key_features', label: 'Key features', long: true },
    { key: 'warranty', label: 'Warranty', long: false },
  ]);
  assert.deepEqual(parseFieldLines(' \n | long'), []);
});

test('readAttributes keeps only the category fields that were filled in', () => {
  const fields = parseFieldLines('Sizes\nColour');
  const form: Record<string, string> = { f_sizes: ' 20-inch ', f_colour: '', f_other: 'x' };
  assert.deepEqual(readAttributes(fields, (n) => form[n] ?? ''), { sizes: '20-inch' });
});
