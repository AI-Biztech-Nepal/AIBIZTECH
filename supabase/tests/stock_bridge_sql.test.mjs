// Runs the SQL that Stock's portal bridge (aibiz_auth + portal_bridge.py) sends to the portal database, for real, on dummy orgs
// in a throwaway PGlite database, as a read-only role like the one Stock will use. Also covers the sanakhat_officer role.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const mig = (f) => readFileSync(new URL(`../migrations/${f}.sql`, import.meta.url), 'utf8');
const files = ['20261027000000_core_init', '20261028000000_org_verification', '20261028000200_notifications', '20261028000300_trials',
  '20261028000400_members', '20261028000500_invitations', '20261031000000_business_profile', '20261031000100_platform_console',
  '20261101000000_features', '20261101000300_feature_on_service_role', '20261101000400_features_superadmin_only',
  '20261102000000_stock_features', '20261102000200_stock_sanakhat_officer'];

// The role query exactly as aibiz_auth ships it, read from the Python file so the two cannot drift apart
const py = readFileSync(new URL('../../python/aibiz_auth/aibiz_auth/__init__.py', import.meta.url), 'utf8');
let n = 0;
const ROLE_SQL = py.match(/ROLE_SQL = """([\s\S]*?)"""/)[1].replace(/%s/g, () => `$${++n}`);
assert.equal(n, 3, 'ROLE_SQL takes org, user, service');
// The two queries portal_bridge.py sends itself
const FEATURE_SQL = 'select core.feature_on($1, $2)';
const COMPANY_SQL = `select case when count(*) = 1 then min(legacy_id) end from core.legacy_tenant_map where service_key = 'stock' and org_id = $1`;

const H = '00000000-0000-0000-0000-0000000000a1', N = '00000000-0000-0000-0000-0000000000b1', E = '00000000-0000-0000-0000-0000000000c1';
const UH = '00000000-0000-0000-0000-00000000a001', UN = '00000000-0000-0000-0000-00000000b001', UE = '00000000-0000-0000-0000-00000000c001';
const UX = '00000000-0000-0000-0000-00000000d001'; // belongs to no org
const UM = '00000000-0000-0000-0000-00000000b002'; // a non-owner member of the bakery

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;`);
for (const f of files.slice(0, -2)) await db.exec(mig(f));
await db.exec(`
  insert into auth.users (id, email) values ('${UH}','h@x.np'), ('${UN}','n@x.np'), ('${UE}','e@x.np'), ('${UX}','x@x.np'), ('${UM}','m@x.np');
  insert into core.organizations (id, name, slug, pan_no, verification_status) values
    ('${H}', 'HAMRO G&G AUTO ENTERPRISES', 'hamro', '100000001', 'verified'),
    ('${N}', 'Fresh Bakery', 'bakery', '100000002', 'verified'), ('${E}', 'Old Shop', 'old', '100000003', 'verified');
  insert into core.memberships (org_id, user_id, org_role) values ('${H}','${UH}','owner'), ('${N}','${UN}','owner'), ('${E}','${UE}','owner'), ('${N}','${UM}','member');
  insert into core.org_services (org_id, service_key, status) values ('${H}','stock','active'), ('${N}','stock','active');
  insert into core.org_services (org_id, service_key, status, trial_ends_at) values ('${E}','stock','trial', now() - interval '1 day');
  insert into core.service_roles values ('${H}','${UH}','stock','admin'), ('${N}','${UN}','stock','admin'), ('${N}','${UM}','stock','stock_supervisor');
  insert into core.legacy_tenant_map values ('stock', 'old-company-1', '${H}'), ('stock', 'old-company-2', '${N}'), ('stock', 'old-company-3', '${N}');
`);
for (const f of files.slice(-2)) await db.exec(mig(f));
// (Hamro is backfilled by the Stock migration only when it runs after the org exists, as it does in production)

// The Stock backend's database role: read-only on exactly what the bridge reads. If this list is wrong the bridge fails in production.
await db.exec(`
  create role stock_bridge login bypassrls;  -- bypassrls: legacy_tenant_map has RLS and no policy for non-service roles
  grant usage on schema core to stock_bridge;
  grant select on core.service_roles, core.memberships, core.org_services, core.legacy_tenant_map to stock_bridge;
  grant execute on function core.feature_on(uuid, text) to stock_bridge;
`);
const q = async (sql, params) => {
  await db.exec('begin; set local role stock_bridge;');
  try { return (await db.query(sql, params)).rows[0] ?? null; } finally { await db.exec('rollback'); }
};
const first = (r) => (r ? Object.values(r)[0] : null);

test('role query: a member with a role in a live service gets the role', async () => {
  assert.equal(first(await q(ROLE_SQL, [H, UH, 'stock'])), 'admin');
});

test('role query: wrong org, non-member, wrong service and no role all return nothing', async () => {
  assert.equal(first(await q(ROLE_SQL, [N, UH, 'stock'])), null);
  assert.equal(first(await q(ROLE_SQL, [H, UX, 'stock'])), null);
  assert.equal(first(await q(ROLE_SQL, [H, UH, 'finance'])), null);
  assert.equal(first(await q(ROLE_SQL, [E, UE, 'stock'])), null);
});

test('role query: a suspended service or a disabled member loses access, and comes back when restored', async () => {
  await db.exec(`update core.org_services set status = 'suspended' where org_id = '${N}'`);
  assert.equal(first(await q(ROLE_SQL, [N, UM, 'stock'])), null);
  await db.exec(`update core.org_services set status = 'active' where org_id = '${N}'`);
  assert.equal(first(await q(ROLE_SQL, [N, UM, 'stock'])), 'stock_supervisor');
  await db.exec(`update core.memberships set status = 'disabled' where org_id = '${N}' and user_id = '${UM}'`);
  assert.equal(first(await q(ROLE_SQL, [N, UM, 'stock'])), null);
  await db.exec(`update core.memberships set status = 'active' where org_id = '${N}' and user_id = '${UM}'`);
  assert.equal(first(await q(ROLE_SQL, [N, UM, 'stock'])), 'stock_supervisor');
});

test('feature check works for the read-only role with no signed-in user', async () => {
  assert.equal(first(await q(FEATURE_SQL, [H, 'stock.vehicles'])), true);   // Hamro: everything on
  assert.equal(first(await q(FEATURE_SQL, [N, 'stock.vehicles'])), false);  // new business: off by default
  assert.equal(first(await q(FEATURE_SQL, [N, 'stock.warranty'])), true);   // on by default
  assert.equal(first(await q(FEATURE_SQL, [E, 'stock.warranty'])), false);  // ended trial turns everything off
  assert.equal(first(await q(FEATURE_SQL, [H, 'stock.nope'])), false);
});

test('company lookup: exactly one company per org, none or several give nothing', async () => {
  assert.equal(first(await q(COMPANY_SQL, [H])), 'old-company-1');
  assert.equal(first(await q(COMPANY_SQL, [N])), null);  // two companies mapped: a setup problem, never guessed
  assert.equal(first(await q(COMPANY_SQL, [E])), null);
});

test('the read-only role cannot write to anything', async () => {
  await assert.rejects(q(`insert into core.legacy_tenant_map values ('stock','x','${H}')`), /permission denied/);
  await assert.rejects(q(`update core.service_roles set role = 'admin'`), /permission denied/);
});

test('sanakhat_officer is a valid Stock role, only where the Sanakhat feature is on', async () => {
  assert.ok((await db.query(`select 'sanakhat_officer' = any (roles) v from core.services where key = 'stock'`)).rows[0].v);
  await db.exec(`insert into core.service_roles values ('${H}','${UH}','stock','sanakhat_officer') on conflict (org_id, user_id, service_key) do update set role = excluded.role`);
  await assert.rejects(db.exec(`insert into core.service_roles values ('${N}','${UN}','stock','sanakhat_officer')
    on conflict (org_id, user_id, service_key) do update set role = excluded.role`), /needs the Sanakhat feature/);
  assert.equal(first(await q(ROLE_SQL, [H, UH, 'stock'])), 'sanakhat_officer');
  assert.equal(first(await q(ROLE_SQL, [N, UN, 'stock'])), 'admin'); // unchanged
});
