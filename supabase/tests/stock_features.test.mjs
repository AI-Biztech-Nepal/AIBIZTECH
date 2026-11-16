// Real core migrations + Stock's feature catalogue, on dummy orgs in a throwaway PGlite database. Nothing live.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const mig = (f) => readFileSync(new URL(`../migrations/${f}.sql`, import.meta.url), 'utf8');
const core = ['20261027000000_core_init', '20261028000000_org_verification', '20261028000200_notifications', '20261028000300_trials',
  '20261028000400_members', '20261028000500_invitations', '20261031000000_business_profile', '20261031000100_platform_console',
  '20261101000000_features', '20261101000300_feature_on_service_role', '20261101000400_features_superadmin_only'].map(mig).join('\n');

const H = '00000000-0000-0000-0000-0000000000a1'; // Hamro G&G Auto: live today
const N = '00000000-0000-0000-0000-0000000000b1'; // a brand-new business
const E = '00000000-0000-0000-0000-0000000000c1'; // a business whose trial ended
const UH = '00000000-0000-0000-0000-00000000a001', UN = '00000000-0000-0000-0000-00000000b001', UE = '00000000-0000-0000-0000-00000000c001';
const PS = '00000000-0000-0000-0000-0000000000f3'; // platform staff

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;`);
await db.exec(core);
// the orgs exist BEFORE the migration, as Hamro does in production, so the backfill has something to match
await db.exec(`
  insert into auth.users (id, email) values ('${UH}','h@x.np'), ('${UN}','n@x.np'), ('${UE}','e@x.np'), ('${PS}','staff@x.np');
  insert into core.platform_admins (user_id) values ('${PS}');
  insert into core.organizations (id, name, slug, pan_no, verification_status) values
    ('${H}', 'HAMRO G&G AUTO ENTERPRISES', 'hamro', '100000001', 'verified'),
    ('${N}', 'Fresh Bakery', 'bakery', '100000002', 'verified'),
    ('${E}', 'Old Shop', 'old', '100000003', 'verified');
  insert into core.memberships (org_id, user_id, org_role) values ('${H}','${UH}','owner'), ('${N}','${UN}','owner'), ('${E}','${UE}','owner');
  insert into core.org_services (org_id, service_key, status) values ('${H}','stock','active'), ('${N}','stock','active');
  insert into core.org_services (org_id, service_key, status, trial_ends_at) values ('${E}','stock','trial', now() - interval '1 day');
  insert into core.service_roles values ('${H}','${UH}','stock','admin'), ('${N}','${UN}','stock','admin'), ('${E}','${UE}','stock','admin');
`);
await db.exec(mig('20261102000000_stock_features'));

const on = async (org, key, user = UN) => {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`);
  try { return (await db.query(`select core.feature_on($1,$2) v`, [org, key])).rows[0].v; } finally { await db.exec('rollback'); }
};
const staffSet = async (org, key, enabled) => {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${PS}',true);`);
  try { await db.query(`select core.set_feature($1,$2,$3,'test')`, [org, key, enabled]); } finally { await db.exec('rollback'); }
};

test('catalogue: 14 stock features with the agreed defaults', async () => {
  const { rows } = await db.query(`select key, default_on from core.features where service_key = 'stock' order by key`);
  assert.equal(rows.length, 14);
  const onByDefault = rows.filter((r) => r.default_on).map((r) => r.key);
  assert.deepEqual(onByDefault, ['stock.ai_assistant', 'stock.bookings', 'stock.crm', 'stock.warranty']);
});

test('Hamro G&G: everything stays on, except finance_sync', async () => {
  const { rows } = await db.query(`select feature_key, enabled from core.org_features where org_id = $1`, [H]);
  assert.equal(rows.length, 14, 'the name match found Hamro');
  for (const k of ['stock.vehicles', 'stock.sanakhat', 'stock.job_cards', 'stock.spare_parts', 'stock.leads', 'stock.public_site',
    'stock.share', 'stock.visits', 'stock.offers', 'stock.warranty']) assert.equal(await on(H, k, UH), true, k);
  assert.equal(await on(H, 'stock.finance_sync', UH), false);
});

test('a new business gets only the defaults, no backfill rows', async () => {
  assert.equal((await db.query(`select count(*)::int n from core.org_features where org_id = $1`, [N])).rows[0].n, 0);
  assert.equal(await on(N, 'stock.warranty'), true);
  assert.equal(await on(N, 'stock.vehicles'), false);
  assert.equal(await on(N, 'stock.job_cards'), false);
  assert.equal(await on(N, 'stock.leads'), false);
});

test('requires: visits and sanakhat stay off while their parent is off', async () => {
  await assert.rejects(staffSet(N, 'stock.sanakhat', true), /needs stock.vehicles/);
  await assert.rejects(staffSet(N, 'stock.visits', true), /needs stock.public_site/);
});

test('turning the parent off is refused while a child is on, and Hamro is unaffected by the new business', async () => {
  await assert.rejects(staffSet(H, 'stock.vehicles', false), /needed by stock.sanakhat/);
});

test('an ended trial turns every feature off, even the ones that are on by default', async () => {
  assert.equal(await on(E, 'stock.warranty', UE), false);
});

test('missing flag falls back to the default', async () => {
  assert.equal(await on(N, 'stock.crm'), true);
  assert.equal(await on(N, 'stock.offers'), false);
});

test('an owner cannot switch features themselves (platform staff only, for now)', async () => {
  await assert.rejects(async () => {
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${UN}',true);`);
    try { await db.query(`select core.set_feature($1,'stock.crm',false,'x')`, [N]); } finally { await db.exec('rollback'); }
  });
});
