import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuShown, planModules, tilesFor, SOON, soonShown, withSoon } from './app-tiles.ts';

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

const plan = (over: Partial<Parameters<typeof planModules>[0]>) =>
  planModules({ tiles: tilesFor(services, 'auto'), access: ['attendance', 'finance', 'marketing', 'stock'], closed: [], kind: 'auto', ticked: [], hidden: [], ...over });
const all = ['attendance', 'sales', 'inventory', 'marketing', 'service', 'finance', 'sanakhat', 'ai'];

test('unticked modules are left out, and ticking one brings it back', () => {
  assert.deepEqual(plan({ ticked: all.filter((id) => id !== 'service' && id !== 'ai') }), { add: [], hidden: ['ai', 'service'] });
  assert.deepEqual(plan({ ticked: all, hidden: ['ai', 'service'] }), { add: [], hidden: [] });
});

test('ticking one module of an app not added yet adds the app and shows only what was ticked', () => {
  const result = plan({ access: ['attendance'], kind: 'auto', ticked: ['attendance', 'sales'] });
  assert.deepEqual(result.add, ['stock']);
  assert.deepEqual(result.hidden, ['ai', 'finance', 'inventory', 'marketing', 'sanakhat', 'service']);
});

test('what the person cannot manage keeps the business choice, and a closed app cannot be added', () => {
  assert.deepEqual(plan({ access: ['attendance'], ticked: ['attendance'], hidden: ['sales'] }), { add: [], hidden: ['sales'] });
  assert.deepEqual(plan({ access: ['attendance'], closed: ['stock'], ticked: ['attendance', 'sales'] }), { add: [], hidden: [] });
});

test('side panel entries follow their tile; the rest always show', () => {
  assert.equal(menuShown('jobs', ['service']), false);
  assert.equal(menuShown('items', ['inventory']), false);
  assert.equal(menuShown('sales', ['service']), true);
  assert.equal(menuShown('dashboard', all), true);
  assert.equal(menuShown('ledger', all), true);
});

test('coming-soon apps start unticked and keep their ticks beside the unticked modules', () => {
  assert.deepEqual(SOON.map((t) => t.id), ['website', 'chats', 'emails', 'emi', 'rental']);
  assert.deepEqual(soonShown(['sales']), []);
  const saved = withSoon(['sales', '+emails'], ['chats', 'inventory']);
  assert.deepEqual(saved, ['+chats', 'sales']);
  assert.deepEqual(soonShown(saved).map((t) => t.name), ['Chats']);
  assert.equal(menuShown('sales', saved), false);
});
