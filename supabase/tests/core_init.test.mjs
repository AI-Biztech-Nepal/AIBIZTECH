// Runs the core migration on PGlite with a stub of Supabase's auth schema and checks RLS.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// The storage migration needs Supabase's storage schema, which this stub does not have
const migration = ['20261027000000_core_init', '20261028000000_org_verification', '20261028000200_notifications', '20261028000300_trials', '20261028000400_members', '20261028000500_invitations', '20261126000000_trial_7_days']
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

test('subscription and verification events notify owners and admins, who can mark them read', async () => {
  const titles = async (u) => (await as(u, `select title from core.notifications order by id`)).rows.map((r) => r.title);
  assert.deepEqual(await titles(OWNER), ['Verification pending', 'Organization verified', 'Finance trial started']);
  assert.deepEqual(await titles(OUTSIDER), []);

  const { rows: [{ id }] } = await as(OWNER, `select id from core.notifications order by id limit 1`);
  await asCommit(OWNER, `insert into core.notification_reads values ($1, $2)`, [id, OWNER]);
  assert.equal((await as(OWNER, `select * from core.notification_reads`)).rows.length, 1);
  assert.equal((await as(OUTSIDER, `select * from core.notification_reads`)).rows.length, 0);
  // not for someone else, and not for a notification you cannot see
  await assert.rejects(as(OWNER, `insert into core.notification_reads values ($1, $2)`, [id, OUTSIDER]));
  await assert.rejects(as(OUTSIDER, `insert into core.notification_reads values ($1, $2)`, [id, OUTSIDER]));
  await assert.rejects(as(OWNER, `insert into core.notifications (org_id, kind, title) values ($1, 'x', 'forged')`, [org]));
});

test('suspending a service notifies the organization', async () => {
  await db.exec('begin');
  await db.query(`update core.org_services set status = 'suspended' where org_id = $1`, [org]);
  const { rows } = await db.query(`select title from core.notifications where org_id = $1 order by id desc limit 1`, [org]);
  await db.exec('rollback');
  assert.equal(rows[0].title, 'Finance has been suspended');
});

// Runs sql as superuser inside a rolled-back transaction after changing the finance trial
async function withTrial(endsInterval, fn) {
  await db.exec('begin');
  try {
    await db.query(`update core.org_services set trial_ends_at = now() + $1::interval where org_id = $2`, [endsInterval, org]);
    await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${OWNER}', true);`);
    return await fn();
  } finally {
    await db.exec('rollback');
  }
}

test('a new trial lasts 7 days', async () => {
  const { rows } = await db.query(`select extract(epoch from trial_ends_at - enabled_at)::int / 86400 days from core.org_services where org_id = $1`, [org]);
  assert.equal(rows[0].days, 7);
});

test('an expired trial removes access, a running one keeps it', async () => {
  const q = `select core.has_service_access($1, 'finance') a, (core.my_context() -> 'orgs' -> 0 -> 'services') s`;
  const live = await withTrial('2 days', () => db.query(q, [org]));
  assert.deepEqual([live.rows[0].a, live.rows[0].s], [true, { finance: 'admin' }]);
  const gone = await withTrial('-1 hour', () => db.query(q, [org]));
  assert.deepEqual([gone.rows[0].a, gone.rows[0].s], [false, {}]);
});

test('trial notices appear once, 3 days out and again when it ends', async () => {
  const run = () => db.query(`select core.notify_trials($1)`, [org]);
  const last = () => db.query(`select title from core.notifications where org_id = $1 and dedupe_key is not null order by id`, [org]);
  const soon = await withTrial('2 days', async () => { await run(); await run(); return last(); });
  assert.deepEqual(soon.rows.map((r) => r.title), ['Finance trial ends in 2 days']);
  const early = await withTrial('10 days', async () => { await run(); return last(); });
  assert.equal(early.rows.length, 0);
  const ended = await withTrial('-1 hour', async () => { await run(); return last(); });
  assert.deepEqual(ended.rows.map((r) => r.title), ['Finance trial has ended']);
  // someone outside the org triggers nothing
  await db.exec('begin');
  await db.query(`update core.org_services set trial_ends_at = now() + interval '1 day'`);
  await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${OUTSIDER}', true);`);
  await db.query(`select core.notify_trials($1)`, [org]);
  await db.exec('reset role');
  const { rows } = await db.query(`select count(*)::int n from core.notifications where dedupe_key is not null`);
  await db.exec('rollback');
  assert.equal(rows[0].n, 0);
});

test('admins cannot remove a service to restart its trial', async () => {
  const { affectedRows } = await as(OWNER, `delete from core.org_services where org_id = $1`, [org]);
  assert.equal(affectedRows, 0);
});

test('org_members lists the team with emails for admins only', async () => {
  const { rows } = await as(OWNER, `select * from core.org_members($1)`, [org]);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].email, rows[0].org_role, rows[0].status, rows[0].service_roles], ['owner@x.np', 'owner', 'active', { finance: 'admin' }]);
  assert.equal((await as(OUTSIDER, `select * from core.org_members($1)`, [org])).rows.length, 0);
  // a plain member sees nothing either
  await asCommit(OWNER, `insert into core.memberships values ($1, $2, 'member')`, [org, OUTSIDER]);
  try {
    assert.equal((await as(OUTSIDER, `select * from core.org_members($1)`, [org])).rows.length, 0);
  } finally {
    await asCommit(OWNER, `delete from core.memberships where user_id = $1`, [OUTSIDER]);
  }
});

test('the last active owner cannot be demoted, disabled or removed', async () => {
  await assert.rejects(as(OWNER, `update core.memberships set org_role = 'admin' where user_id = $1`, [OWNER]), /keep an active owner/);
  await assert.rejects(as(OWNER, `update core.memberships set status = 'disabled' where user_id = $1`, [OWNER]), /keep an active owner/);
  await assert.rejects(as(OWNER, `delete from core.memberships where user_id = $1`, [OWNER]), /keep an active owner/);
  // with a second owner in place, the first may step down
  await db.exec('begin');
  await db.query(`insert into core.memberships values ($1, $2, 'owner')`, [org, OUTSIDER]);
  await db.query(`update core.memberships set org_role = 'admin' where user_id = $1`, [OWNER]);
  const { rows } = await db.query(`select org_role from core.memberships where user_id = $1`, [OWNER]);
  await db.exec('rollback');
  assert.equal(rows[0].org_role, 'admin');
});

test('deleting a whole organization still works', async () => {
  const { rows: [{ org: temp }] } = await asCommit(OUTSIDER, create(), details.map((d, i) => (i === 5 ? '555666777' : i === 1 ? 'temp-co' : d)));
  await db.exec(`delete from core.organizations where id = '${temp}'`);
  const { rows } = await db.query(`select 1 from core.memberships where org_id = $1`, [temp]);
  assert.equal(rows.length, 0);
});

const INVITEE = '00000000-0000-0000-0000-00000000000c';
const invite = (user, email, role = 'member', roles = '{}') =>
  asCommit(user, `select core.create_invitation($1, $2, $3, $4::jsonb) as id`, [org, email, role, roles]);

test('only admins create valid invitations, and only through the function', async () => {
  await assert.rejects(invite(OUTSIDER, 'x@x.np'), /only owners and admins/);
  await assert.rejects(invite(OWNER, 'not-an-email'), /valid email/);
  await assert.rejects(invite(OWNER, 'x@x.np', 'owner'), /admin or member/);
  await assert.rejects(invite(OWNER, 'owner@x.np'), /already a member/);
  await assert.rejects(invite(OWNER, 'x@x.np', 'member', '{"stock":"admin"}'), /invalid role for service stock/);
  await assert.rejects(invite(OWNER, 'x@x.np', 'member', '{"finance":"wizard"}'), /invalid role for service finance/);
  await assert.rejects(as(OWNER, `insert into core.invitations (org_id, email) values ($1, 'x@x.np')`, [org]), /permission denied/);
});

test('a new invitation replaces the open one for the same email', async () => {
  await invite(OWNER, 'Dup@X.np ');
  await invite(OWNER, 'dup@x.np');
  const { rows } = await as(OWNER, `select email from core.invitations where org_id = $1 and email like 'dup%'`, [org]);
  assert.deepEqual(rows, [{ email: 'dup@x.np' }]);
  assert.equal((await as(OUTSIDER, `select * from core.invitations`)).rows.length, 0);
});

test('invitee previews, accepts once, and gets membership, roles and the active org', async () => {
  await db.exec(`insert into auth.users (id, email) values ('${INVITEE}', 'new@x.np')`);
  const { rows: [{ id }] } = await invite(OWNER, 'new@x.np', 'member', '{"finance":"accountant"}');

  assert.deepEqual((await as(INVITEE, `select * from core.invitation_preview($1)`, [id])).rows,
    [{ org_name: 'Acme', email: 'new@x.np', org_role: 'member', state: 'open' }]);
  await db.exec('begin; set local role authenticated;'); // signed out: sees nothing
  assert.equal((await db.query(`select * from core.invitation_preview($1)`, [id])).rows.length, 0);
  await db.exec('rollback');

  await assert.rejects(asCommit(OUTSIDER, `select core.accept_invitation($1)`, [id]), /meant for a different email/);
  const { rows: [{ accept_invitation }] } = await asCommit(INVITEE, `select core.accept_invitation($1)`, [id]);
  assert.equal(accept_invitation, org);

  const m = await as(INVITEE, `select org_role from core.memberships where user_id = $1`, [INVITEE]);
  assert.equal(m.rows[0].org_role, 'member');
  const sr = await as(INVITEE, `select service_key, role from core.service_roles where user_id = $1`, [INVITEE]);
  assert.deepEqual(sr.rows, [{ service_key: 'finance', role: 'accountant' }]);
  const { rows: [{ ctx }] } = await as(INVITEE, `select core.my_context() as ctx`);
  assert.equal(ctx.active_org_id, org);
  assert.equal((await as(INVITEE, `select state from core.invitation_preview($1)`, [id])).rows[0].state, 'accepted');

  await assert.rejects(asCommit(INVITEE, `select core.accept_invitation($1)`, [id]), /already belong|already used/);
});

test('expired invitations and people who already belong to an organization cannot accept', async () => {
  const { rows: [{ id: late }] } = await invite(OWNER, 'out@x.np');
  await db.exec(`update core.invitations set expires_at = now() - interval '1 day' where id = '${late}'`);
  assert.equal((await as(OUTSIDER, `select state from core.invitation_preview($1)`, [late])).rows[0].state, 'expired');
  await assert.rejects(asCommit(OUTSIDER, `select core.accept_invitation($1)`, [late]), /expired/);

  const { rows: [{ id: own }] } = await db.query(
    `insert into core.invitations (org_id, email) values ($1, 'owner@x.np') returning id`, [org]);
  await assert.rejects(asCommit(OWNER, `select core.accept_invitation($1)`, [own]), /already belong/);
});
