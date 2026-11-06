import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProfile, recommend } from './recommend.ts';

const p = (business_type: string | null, business_needs: string[] | null, team_size: string | null) => ({ business_type, business_needs, team_size });

test('needs map to services, in catalogue order', () => {
  assert.deepEqual(recommend(p('retail', ['finance', 'stock'], '2-5')), ['stock', 'finance']);
  assert.deepEqual(recommend(p('other', ['other'], 'Just me')), []);
});

test('a team of 6 or more adds attendance, a dealership adds stock', () => {
  assert.deepEqual(recommend(p('services', ['finance'], '6-20')), ['finance', 'attendance']);
  assert.deepEqual(recommend(p('vehicles', ['finance'], 'Just me')), ['stock', 'finance']);
});

test('an organization without answers gets no recommendations', () => {
  assert.deepEqual(recommend(p(null, null, null)), []);
});

test('unknown form values are dropped', () => {
  const f = new FormData();
  f.set('business_type', 'spaceship');
  f.append('business_needs', 'finance');
  f.append('business_needs', 'hack');
  f.set('team_size', '20+');
  assert.deepEqual(parseProfile(f), p(null, ['finance'], '20+'));
});
