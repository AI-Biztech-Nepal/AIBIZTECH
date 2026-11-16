// Owners ask for features, platform staff decide. Real core migrations + Stock's catalogue, dummy orgs, throwaway PGlite database.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const mig = (f) => readFileSync(new URL(`../migrations/${f}.sql`, import.meta.url), 'utf8');
const files = ['20261027000000_core_init', '20261028000000_org_verification', '20261028000200_notifications', '20261028000300_trials',
  '20261028000400_members', '20261028000500_invitations', '20261031000000_business_profile', '20261031000100_platform_console',
  '20261101000000_features', '20261101000300_feature_on_service_role', '20261101000400_features_superadmin_only',
  '20261102000000_stock_features', '20261102000100_feature_requests'];

const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
const UA = '00000000-0000-0000-0000-0000000000a1', UB = '00000000-0000-0000-0000-0000000000b1', MA = '00000000-0000-0000-0000-0000000000a2';
const PS = '00000000-0000-0000-0000-0000000000f3';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;`);
// the dummy orgs go in before the Stock migration, as real orgs do
for (const f of files.slice(0, -2)) await db.exec(mig(f));
await db.exec(`
  insert into auth.users (id, email) values ('${UA}','a@x.np'), ('${UB}','b@x.np'), ('${MA}','m@x.np'), ('${PS}','staff@x.np');
  insert into core.platform_admins (user_id) values ('${PS}');
  insert into core.organizations (id, name, slug, pan_no, verification_status) values
    ('${A}', 'Fresh Bakery', 'a', '100000001', 'verified'), ('${B}', 'Other Shop', 'b', '100000002', 'verified');
  insert into core.memberships (org_id, user_id, org_role) values ('${A}','${UA}','owner'), ('${B}','${UB}','owner'), ('${A}','${MA}','member');
  insert into core.org_services (org_id, service_key, status) values ('${A}','stock','active'), ('${B}','stock','active');
  insert into core.service_roles values ('${A}','${UA}','stock','admin'), ('${B}','${UB}','stock','admin'), ('${A}','${MA}','stock','admin');
`);
for (const f of files.slice(-2)) await db.exec(mig(f));

async function as(user, sql, params) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`);
  try { const r = await db.query(sql, params); await db.exec('commit'); return r; }
  catch (e) { await db.exec('rollback'); throw e; }
}
const ask = (u, org, on, off = [], note = null) => as(u, `select core.request_features($1,$2,$3,$4) id`, [org, on, off, note]);
const open = async (u, org) => (await as(u, `select id from core.feature_requests where org_id = $1 and status = 'pending'`, [org])).rows[0]?.id;
const on = async (org, key) => (await db.query(`select core.feature_on($1,$2) v`, [org, key])).rows[0].v;

test('a member cannot ask; an owner can', async () => {
  await assert.rejects(ask(MA, A, ['stock.job_cards']), /only owners and admins/);
  assert.ok((await ask(UA, A, ['stock.job_cards'], [], 'we repair fridges')).rows[0].id);
});

test('only one open request per organization, until it is cancelled', async () => {
  await assert.rejects(ask(UA, A, ['stock.spare_parts']), /already have a request waiting/);
  await as(UA, `select core.cancel_feature_request($1)`, [await open(UA, A)]);
  assert.equal(await open(UA, A), undefined);
});

test('asking is checked: unknown keys, no-ops, and broken dependencies are refused', async () => {
  await assert.rejects(ask(UA, A, ['stock.nope']), /unknown feature/);
  await assert.rejects(ask(UA, A, ['finance.emi']), /unknown feature/);
  await assert.rejects(ask(UA, A, ['stock.crm']), /nothing to change/);
  await assert.rejects(ask(UA, A, ['stock.sanakhat']), /needs stock.vehicles as well/);
  await assert.rejects(ask(UA, A, ['stock.vehicles'], ['stock.vehicles']), /on and off/);
});

test("nobody sees another organization's requests", async () => {
  await ask(UB, B, ['stock.leads']);
  await ask(UA, A, ['stock.sanakhat', 'stock.vehicles'], ['stock.crm']);
  const own = await as(UA, `select org_id from core.feature_requests`);
  assert.ok(own.rows.length > 0 && own.rows.every((r) => r.org_id === A));
  assert.equal((await as(PS, `select count(distinct org_id)::int n from core.feature_requests`)).rows[0].n, 2);
});

test('only platform staff decide; an owner cannot approve their own request', async () => {
  await assert.rejects(as(UB, `select core.decide_feature_request($1, true)`, [await open(UB, B)]), /not allowed/);
  assert.equal(await on(B, 'stock.leads'), false);
});

test('approving applies a parent and its child together, notifies the org and audits', async () => {
  const id = await open(UA, A);
  await as(PS, `select core.decide_feature_request($1, true, null, 1500, 'Rs 1,500 per month')`, [id]);
  assert.equal(await on(A, 'stock.vehicles'), true);
  assert.equal(await on(A, 'stock.sanakhat'), true);
  assert.equal(await on(A, 'stock.crm'), false);
  const q = (await as(UA, `select status, quote_amount from core.feature_requests where id = $1`, [id])).rows[0];
  assert.deepEqual([q.status, Number(q.quote_amount)], ['approved', 1500]);
  const n = (await db.query(`select title, body from core.notifications where org_id = $1 and kind = 'features'`, [A])).rows;
  assert.match(n[0].title, /approved/);
  assert.match(n[0].body, /1,500/);
  assert.ok((await db.query(`select 1 from core.platform_audit where action = 'feature_request:approved'`)).rows.length);
  await assert.rejects(as(PS, `select core.decide_feature_request($1, true)`, [id]), /already decided/);
});

test('declining needs a reason and changes nothing', async () => {
  const id = await open(UB, B);
  await assert.rejects(as(PS, `select core.decide_feature_request($1, false)`, [id]), /reason/);
  await as(PS, `select core.decide_feature_request($1, false, 'Please verify your domain first')`, [id]);
  assert.equal(await on(B, 'stock.leads'), false);
});

test('turning a parent off together with its child works in the right order', async () => {
  await ask(UA, A, [], ['stock.vehicles', 'stock.sanakhat']);
  await as(PS, `select core.decide_feature_request($1, true)`, [await open(UA, A)]);
  assert.equal(await on(A, 'stock.vehicles'), false);
  assert.equal(await on(A, 'stock.sanakhat'), false);
});
