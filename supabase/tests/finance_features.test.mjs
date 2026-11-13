// Real core migrations + Finance's guards migration, on dummy orgs in a throwaway PGlite database. Nothing live.
// finance.* are minimal stand-ins (same policy names as the live tables), the guards migration is the real file.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const mig = (f) => readFileSync(new URL(`../migrations/${f}.sql`, import.meta.url), 'utf8');
const core = ['20261027000000_core_init', '20261028000000_org_verification', '20261028000200_notifications', '20261028000300_trials',
  '20261028000400_members', '20261028000500_invitations', '20261031000000_business_profile', '20261031000100_platform_console',
  '20261101000000_features', '20261101000300_feature_on_service_role'].map(mig).join('\n');

const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b'; // orgs
const UA = '00000000-0000-0000-0000-0000000000a1', UB = '00000000-0000-0000-0000-0000000000b1'; // their owners

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role finance_svc;
  create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;`);
await db.exec(core);
await db.exec(`
  create schema finance;
  create function finance.finance_current_owner() returns uuid language sql stable security definer
    as $$ select active_org_id from core.profiles where user_id = auth.uid() $$;
  create function finance.finance_is_admin() returns boolean language sql as $$ select false $$;
  create table finance.rentals (id serial primary key, owner_id uuid not null, name text);
  create table finance.emi_plans (id serial primary key, owner_id uuid not null);
  create table finance.customer_ledger_entries (owner_id uuid, customer_id uuid, source_type text, source_id uuid,
    entry_type text, amount numeric, note text, source text, entry_date date);
  create unique index on finance.customer_ledger_entries (source_type, source_id) where source_type is not null and source_id is not null;
  create table finance.vendor_ledger_entries (owner_id uuid, source_type text);
  create function finance.rental_wage_rows(uuid) returns table (owner_id uuid, employee_id uuid, source_id uuid, amount numeric, note text, day date)
    language sql as $$ select null::uuid, null::uuid, null::uuid, null::numeric, null::text, null::date where false $$;
  alter table finance.rentals enable row level security; alter table finance.emi_plans enable row level security;
  create policy rentals_all_owner on finance.rentals using (owner_id = finance.finance_current_owner());
  create policy rentals_admin_all on finance.rentals using (finance.finance_is_admin());
  create policy emi_plans_all_owner on finance.emi_plans using (owner_id = finance.finance_current_owner());
  create policy emi_plans_admin_all on finance.emi_plans using (finance.finance_is_admin());
  grant usage on schema finance to authenticated;
  grant select, insert, update, delete on all tables in schema finance to authenticated;
  grant usage on all sequences in schema finance to authenticated;
`);
await db.exec(mig('20261101000200_finance_feature_guards'));
// two dummy orgs, both with Finance, Finance rent catalogue on for A only (B has no row: default off)
await db.exec(`
  insert into auth.users (id, email) values ('${UA}', 'a@x.np'), ('${UB}', 'b@x.np');
  insert into core.organizations (id, name, slug, pan_no, verification_status) values
    ('${A}', 'Org A', 'a', '100000001', 'verified'), ('${B}', 'Org B', 'b', '100000002', 'verified');
  insert into core.memberships (org_id, user_id, org_role) values ('${A}', '${UA}', 'owner'), ('${B}', '${UB}', 'owner');
  update core.profiles set active_org_id = '${A}' where user_id = '${UA}';
  update core.profiles set active_org_id = '${B}' where user_id = '${UB}';
  insert into core.org_services (org_id, service_key, status) values ('${A}', 'finance', 'active'), ('${B}', 'finance', 'active');
  insert into core.service_roles values ('${A}', '${UA}', 'finance', 'admin'), ('${B}', '${UB}', 'finance', 'admin');
  insert into core.features (key, service_key, name, description, default_on) values
    ('finance.rent', 'finance', 'Rent', 'r', false), ('finance.emi', 'finance', 'EMI', 'e', false);
  insert into core.org_features (org_id, feature_key, enabled) values ('${A}', 'finance.rent', true), ('${A}', 'finance.emi', true);
  insert into finance.rentals (owner_id, name) values ('${A}', 'existing');
`);

async function as(user, sql, params, keep = false) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true);`);
  try {
    const r = await db.query(sql, params);
    await db.exec(keep ? 'commit' : 'rollback');
    return r;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}
const count = async (u, t) => (await as(u, `select count(*)::int n from finance.${t}`)).rows[0].n;

test('guards: the old admin policies are gone and writes carry the flag check', async () => {
  const { rows } = await db.query(`select polname from pg_policy where polrelid = 'finance.rentals'::regclass order by 1`);
  assert.deepEqual(rows.map((r) => r.polname), ['rentals_admin_delete', 'rentals_admin_insert', 'rentals_admin_read', 'rentals_admin_update',
    'rentals_owner_delete', 'rentals_owner_insert', 'rentals_owner_read', 'rentals_owner_update']);
});

test('flag off (no row, default off): writes are refused, reading is fine', async () => {
  await assert.rejects(as(UB, `insert into finance.rentals (owner_id, name) values ($1, 'x')`, [B]), /row-level security/);
  await assert.rejects(as(UB, `insert into finance.emi_plans (owner_id) values ($1)`, [B]), /row-level security/);
  assert.equal(await count(UB, 'rentals'), 0);
});

test('flag on: the owner can add, edit and delete; another org cannot touch the rows', async () => {
  await as(UA, `insert into finance.rentals (owner_id, name) values ($1, 'new')`, [A], true);
  assert.equal((await as(UA, `update finance.rentals set name = 'renamed' where name = 'new'`)).affectedRows, 1);
  assert.equal(await count(UB, 'rentals'), 0);
  assert.equal((await as(UB, `delete from finance.rentals`)).affectedRows, 0);
  await as(UA, `delete from finance.rentals where name = 'new'`, [], true);
});

test('switching off pauses writes but keeps and shows every row; switching on restores', async () => {
  await as(UA, `select core.set_feature($1, 'finance.rent', false)`, [A], true);
  try {
    assert.equal(await count(UA, 'rentals'), 1); // still there, still readable
    await assert.rejects(as(UA, `insert into finance.rentals (owner_id, name) values ($1, 'x')`, [A]), /row-level security/);
    assert.equal((await as(UA, `update finance.rentals set name = 'y'`)).affectedRows, 0);
    assert.equal((await as(UA, `delete from finance.rentals`)).affectedRows, 0);
    assert.equal((await as(UA, `select core.feature_on($1, 'finance.rent') a`, [A])).rows[0].a, false);
  } finally {
    await as(UA, `select core.set_feature($1, 'finance.rent', true)`, [A], true);
  }
  await as(UA, `insert into finance.rentals (owner_id, name) values ($1, 'back')`, [A], true);
  assert.equal(await count(UA, 'rentals'), 2);
  await db.exec(`delete from finance.rentals where name = 'back'`);
});

test('the rent sync leaves ledger lines alone while Rent is off', async () => {
  await db.exec(`insert into finance.customer_ledger_entries values ('${A}', '${UA}', 'rental_wage', '${UA}')`);
  const lines = async () => (await db.query(`select count(*)::int n from finance.customer_ledger_entries`)).rows[0].n;
  await as(UA, `select core.set_feature($1, 'finance.rent', false)`, [A], true);
  try {
    await as(UA, `select finance.sync_rental_wages()`);
    assert.equal(await lines(), 1);
  } finally {
    await as(UA, `select core.set_feature($1, 'finance.rent', true)`, [A], true);
  }
  await db.exec(`delete from finance.customer_ledger_entries`);
});

test('people cannot call the org-wide sync or the wage view directly', async () => {
  await assert.rejects(as(UA, `select finance.sync_rental_wages_for($1)`, [A]), /permission denied/);
  await assert.rejects(as(UA, `select * from finance.rental_wage_rows($1)`, [A]), /permission denied/);
});

test('control: with Rent on the same sync does rebuild the lines (so the pause above is real)', async () => {
  await db.exec(`insert into finance.customer_ledger_entries values ('${A}', '${UA}', 'rental_wage', '${UA}')`);
  await as(UA, `select finance.sync_rental_wages()`, [], true);
  assert.equal((await db.query(`select count(*)::int n from finance.customer_ledger_entries`)).rows[0].n, 0);
});

test('a job with no signed-in user (service role) still sees a live org as feature-on', async () => {
  await db.exec(`begin; set local role service_role;`);
  try {
    const { rows } = await db.query(`select core.feature_on($1, 'finance.rent') a, core.feature_on($2, 'finance.rent') b`, [A, B]);
    assert.deepEqual(rows[0], { a: true, b: false });
  } finally {
    await db.exec('rollback');
  }
});
