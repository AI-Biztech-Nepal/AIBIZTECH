// Runs the core migration on PGlite with a stub of Supabase's auth schema and checks RLS.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// The storage migration needs Supabase's storage schema, which this stub does not have
const migration = ['20261027000000_core_init', '20261028000000_org_verification']
  .map((f) => readFileSync(new URL(`../migrations/${f}.sql`, import.meta.url), 'utf8')).join('\n');

// shortcut: minimal stand-in for Supabase's auth schema, switch to `supabase test db` once the CLI is in use
const authStub = `
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
`;

const OWNER = '00000000-0000-0000-0000-00000000000a';
const OUTSIDER = '00000000-0000-0000-0000-00000000000b';

const db = new PGlite();
await db.exec(authStub);
await db.exec(migration);
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${OWNER}', 'owner@x.np', '{"full_name":"Owner"}'), ('${OUTSIDER}', 'out@x.np', '{}')`);

// Run sql as a signed-in user, inside a transaction that is rolled back
async function as(user, sql, params) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('rollback');
  }
}

// Same, but keeps the changes
async function asCommit(user, sql, params) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true);`);
  try {
    const r = await db.query(sql, params);
    await db.exec('commit');
    return r;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

const details = ['Acme', 'acme', 'Kathmandu', '9841000000', 'info@acme.np', '123456789', 'Ram Shrestha', 'Lalitpur', '9851000000', 'ram@acme.np'];
const create = (...over) => `select core.create_organization(${details.map((_, i) => `$${i + 1}`).join(', ')}) as org`;
const { rows: [{ org }] } = await asCommit(OWNER, create(), details);
await db.exec(`update core.organizations set verification_status = 'verified'`); // what a platform reviewer does
await asCommit(OWNER, `insert into core.org_services (org_id, service_key) values ($1, 'finance')`, [org]);
await asCommit(OWNER, `insert into core.service_roles values ($1, $2, 'finance', 'admin')`, [org, OWNER]);

test('signup trigger creates a profile', async () => {
  const { rows } = await db.query(`select full_name from core.profiles where user_id = $1`, [OWNER]);
  assert.equal(rows[0].full_name, 'Owner');
});

test('my_context shows the org, role and finance access', async () => {
  const { rows: [{ ctx }] } = await as(OWNER, `select core.my_context() as ctx`);
  assert.equal(ctx.active_org_id, org);
  assert.deepEqual(ctx.orgs, [{ id: org, name: 'Acme', org_role: 'owner', verification_status: 'verified', verification_note: null, services: { finance: 'admin' } }]);
});

test('has_service_access respects roles and the service list', async () => {
  const q = `select core.has_service_access($1, 'finance') a, core.has_service_access($1, 'finance', array['viewer']) b,
                    core.has_service_access($1, 'stock') c`;
  assert.deepEqual((await as(OWNER, q, [org])).rows[0], { a: true, b: false, c: false });
  assert.deepEqual((await as(OUTSIDER, q, [org])).rows[0], { a: false, b: false, c: false });
});

test('suspended service removes access', async () => {
  await db.exec('begin');
  await db.query(`update core.org_services set status = 'suspended' where org_id = $1`, [org]);
  await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${OWNER}', true);`);
  const { rows } = await db.query(`select core.has_service_access($1, 'finance') a`, [org]);
  await db.exec('rollback');
  assert.equal(rows[0].a, false);
});

test('outsider sees nothing of the org', async () => {
  for (const t of ['organizations', 'memberships', 'org_services', 'service_roles']) {
    const { rows } = await as(OUTSIDER, `select * from core.${t}`);
    assert.equal(rows.length, 0, t);
  }
  const { rows } = await as(OUTSIDER, `select user_id from core.profiles`);
  assert.deepEqual(rows.map((r) => r.user_id), [OUTSIDER]);
});

test('outsider cannot join, grant roles or switch into the org', async () => {
  await assert.rejects(as(OUTSIDER, `insert into core.memberships values ($1, $2, 'owner')`, [org, OUTSIDER]));
  await assert.rejects(as(OUTSIDER, `insert into core.org_services (org_id, service_key) values ($1, 'stock')`, [org]));
  await assert.rejects(as(OUTSIDER, `update core.profiles set active_org_id = $1 where user_id = $2`, [org, OUTSIDER]));
  const { affectedRows } = await as(OUTSIDER, `update core.organizations set name = 'pwned' where id = $1`, [org]);
  assert.equal(affectedRows, 0);
});

test('admins cannot activate a paid plan themselves', async () => {
  await assert.rejects(as(OWNER, `insert into core.org_services (org_id, service_key, status) values ($1, 'stock', 'active')`, [org]));
  const { affectedRows } = await as(OWNER, `update core.org_services set status = 'active' where org_id = $1`, [org]);
  assert.equal(affectedRows, 0);
});

test('an admin cannot make anyone an owner', async () => {
  await asCommit(OWNER, `insert into core.memberships values ($1, $2, 'admin')`, [org, OUTSIDER]);
  try {
    await assert.rejects(as(OUTSIDER, `update core.memberships set org_role = 'owner' where user_id = $1`, [OUTSIDER]));
    const { affectedRows } = await as(OUTSIDER, `delete from core.memberships where user_id = $1`, [OWNER]);
    assert.equal(affectedRows, 0);
  } finally {
    await asCommit(OWNER, `delete from core.memberships where user_id = $1`, [OUTSIDER]);
  }
});

test('service roles must exist on the service', async () => {
  await assert.rejects(as(OWNER, `update core.service_roles set role = 'staff' where org_id = $1`, [org]), /not valid/);
});

test('create_organization needs a signed-in user', async () => {
  await db.exec('begin; set local role authenticated;');
  await assert.rejects(db.query(create(), details), /not signed in/);
  await db.exec('rollback');
});

test('create_organization rejects bad PAN, phone and email, and a reused PAN', async () => {
  const bad = (i, v) => details.map((d, j) => (j === i ? v : d));
  await assert.rejects(asCommit(OUTSIDER, create(), bad(5, '12345')), /PAN must be 9 digits/);
  await assert.rejects(asCommit(OUTSIDER, create(), bad(3, 'abc')), /valid phone/);
  await assert.rejects(asCommit(OUTSIDER, create(), bad(9, 'not-an-email')), /valid email/);
  await assert.rejects(asCommit(OUTSIDER, create(), bad(2, '  ')), /required/);
  await assert.rejects(asCommit(OUTSIDER, create(), bad(1, 'other')), /organizations_pan_no_key/);
});

test('a new organization starts pending and its owner cannot verify it', async () => {
  const { rows: [{ org: pending }] } = await asCommit(OUTSIDER, create(), details.map((d, i) => (i === 5 ? '987654321' : i === 1 ? 'pending-co' : d)));
  try {
    const { rows } = await as(OUTSIDER, `select verification_status from core.organizations where id = $1`, [pending]);
    assert.equal(rows[0].verification_status, 'pending');
    await assert.rejects(as(OUTSIDER, `update core.organizations set verification_status = 'verified' where id = $1`, [pending]), /permission denied/);
    // and an unverified organization cannot start a service trial
    await assert.rejects(as(OUTSIDER, `insert into core.org_services (org_id, service_key) values ($1, 'stock')`, [pending]));
  } finally {
    await db.exec(`delete from core.organizations where id = '${pending}'`);
  }
});

test('changing the PAN sends a verified organization back to pending', async () => {
  await db.exec('begin');
  await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${OWNER}', true);`);
  await db.query(`update core.organizations set pan_no = '111222333' where id = $1`, [org]);
  await db.exec('reset role');
  const { rows } = await db.query(`select verification_status from core.organizations where id = $1`, [org]);
  await db.exec('rollback');
  assert.equal(rows[0].verification_status, 'pending');
});
