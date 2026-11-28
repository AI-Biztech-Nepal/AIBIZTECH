import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tilesFor } from './app-tiles.ts';

const services = ['attendance', 'finance', 'marketing', 'stock'].map((key) => ({ key, name: key }));

test('a vehicle business, or one that has not said, sees all eight modules in the side panel order', () => {
  for (const kind of ['auto', null] as const) {
    assert.deepEqual(tilesFor(services, kind).map((t) => t.id), ['attendance', 'sales', 'inventory', 'marketing', 'service', 'finance', 'sanakhat', 'ai']);
  }
});

test('a general business has Items and no vehicle-only modules', () => {
  const tiles = tilesFor(services, 'general');
  assert.deepEqual(tiles.map((t) => t.id), ['attendance', 'sales', 'inventory', 'marketing', 'finance', 'ai']);
  assert.equal(tiles.find((t) => t.id === 'inventory')?.href, '/app/stock/items');
});

test('an app the list does not know yet still appears, last', () => {
  assert.equal(tilesFor([...services, { key: 'new', name: 'New' }]).at(-1)?.id, 'new');
});
