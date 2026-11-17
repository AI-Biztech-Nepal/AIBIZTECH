// Finance schema on PGlite: posting triggers, per-business isolation, ledger rules.  Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const files = ['20261027000000_core_init', '20261028000000_org_verification', '20261028000200_notifications', '20261028000300_trials', '20261028000400_members', '20261028000500_invitations', '20261118000000_finance_schema'];
const migration = files.map((f) => readFileSync(new URL(`../migrations/${f}.sql`, import.meta.url), 'utf8')).join('\n');
const authStub = `
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
`;
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

const db = new PGlite();
await db.exec(authStub);
await db.exec(migration);
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${A}', 'a@x.np', '{"full_name":"A"}'), ('${B}', 'b@x.np', '{"full_name":"B"}')`);

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

const details = (n, pan) => [n, n.toLowerCase(), 'Kathmandu', '9841000000', 'i@x.np', pan, 'Owner', 'Lalitpur', '9851000000', 'o@x.np'];
const mk = async (user, n, pan) => (await as(user, `select core.create_organization($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as org`, details(n, pan), true)).rows[0].org;
const orgA = await mk(A, 'Alpha', '111111111');
const orgB = await mk(B, 'Beta', '222222222');
await db.exec(`update core.organizations set verification_status = 'verified'`);
for (const [o, u] of [[orgA, A], [orgB, B]]) {
  await db.exec(`insert into core.org_services (org_id, service_key) values ('${o}', 'finance'); insert into core.service_roles values ('${o}', '${u}', 'finance', 'admin')`);
}

test('a credit sale books a debit, an edit moves it, a delete removes it', async () => {
  const { rows: [p] } = await as(A, `insert into finance.customers (name) values ('Ram') returning id, owner_id`, [], true);
  assert.equal(p.owner_id, orgA); // stamped from the active business
  const { rows: [bill] } = await as(A, `insert into finance.business_transactions (type, amount, customer_id, bill_date) values ('sale', 5000, $1, current_date) returning id`, [p.id], true);
  let r = await as(A, `select entry_type, amount, source from finance.customer_ledger_entries where customer_id = $1`, [p.id]);
  assert.deepEqual(r.rows.map((x) => [x.entry_type, Number(x.amount), x.source]), [['debit', 5000, 'booking']]);
  await as(A, `update finance.business_transactions set amount = 7000 where id = $1`, [bill.id], true);
  r = await as(A, `select sum(amount) as s, count(*) as n from finance.customer_ledger_entries where customer_id = $1`, [p.id]);
  assert.equal(Number(r.rows[0].s), 7000);
  assert.equal(Number(r.rows[0].n), 1);
  await as(A, `delete from finance.business_transactions where id = $1`, [bill.id], true);
  r = await as(A, `select count(*) as n from finance.customer_ledger_entries where customer_id = $1`, [p.id]);
  assert.equal(Number(r.rows[0].n), 0);
});

test('another business cannot see or write these books', async () => {
  const seen = await as(B, `select count(*) as n from finance.customers`);
  assert.equal(Number(seen.rows[0].n), 0);
  await assert.rejects(as(B, `insert into finance.customers (owner_id, name) values ($1, 'Sneaky')`, [orgA]));
});

test('hand-entered payments are allowed, booking rows cannot be forged', async () => {
  const { rows: [p] } = await as(A, `insert into finance.customers (name) values ('Sita') returning id`, [], true);
  await as(A, `insert into finance.customer_ledger_entries (customer_id, entry_type, amount) values ($1, 'credit', 100)`, [p.id], true);
  await assert.rejects(as(A, `insert into finance.customer_ledger_entries (customer_id, entry_type, amount, source) values ($1, 'debit', 5, 'booking')`, [p.id]));
});

