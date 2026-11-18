import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('accepting a lead reuses a customer with the same phone, otherwise makes one; each lead is decided once', async () => {
  const db = new PGlite();
  await db.exec(`
    create schema auth; create schema core; create schema stock; create role authenticated;
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000aa'::uuid $$;
    create table core.profiles (id uuid primary key, full_name text); insert into core.profiles values ('00000000-0000-0000-0000-0000000000aa', 'Owner');
    create table core.services (key text primary key, name text, base_url text, roles text[]);
    create table core.organizations (id uuid primary key, name text); create table core.memberships (org_id uuid, user_id uuid, org_role text, status text);
    create table core.org_services (org_id uuid, service_key text, primary key (org_id, service_key)); create table core.service_roles (org_id uuid, user_id uuid, service_key text, role text, primary key (org_id, user_id, service_key));
    create function core.has_service_access(p uuid, s text, r text[] default null) returns boolean language sql as $$ select true $$;
    create table stock.companies (id text primary key, name text, created_at text);
    create table stock.customers (id text primary key, company_id text, name text, contact_number text, address text, source text, lead_status text, notes text, created_at text);
    create table stock.leads (id text primary key, company_id text, name text, phone text, address text, message text, status text default 'new', remark text, decided_by text, decided_at text, customer_id text);
    create table stock.crm_followups (company_id text); create table stock.crm_interactions (company_id text);
    insert into stock.customers (id, company_id, name, contact_number) values ('c1','00000000-0000-0000-0000-000000000001','Ram','98-41 234567');
    insert into stock.leads (id, company_id, name, phone) values
      ('l1','00000000-0000-0000-0000-000000000001','Ram K','9841234567'),
      ('l2','00000000-0000-0000-0000-000000000001','Sita','9800000000'),
      ('l3','00000000-0000-0000-0000-000000000001','Hari','9811111111');`);
  await db.exec(readFileSync(new URL('../migrations/20261118001000_marketing_app.sql', import.meta.url), 'utf8').replace(/^notify.*$/m, ''));
  const accept = async (id) => (await db.query('select stock.accept_lead($1) as c', [id])).rows[0].c;
  assert.equal(await accept('l1'), 'c1'); // same phone, different punctuation: reused
  const c2 = await accept('l2');
  assert.notEqual(c2, 'c1');
  assert.equal((await db.query('select count(*)::int c from stock.customers')).rows[0].c, 2);
  await assert.rejects(() => accept('l1'), /already accepted/);
  await assert.rejects(() => db.query(`select stock.reject_lead('l3', 'x')`), /why you are rejecting/);
  await db.query(`select stock.reject_lead('l3', 'Not serious')`);
  const l3 = (await db.query(`select status, remark, decided_by from stock.leads where id='l3'`)).rows[0];
  assert.deepEqual(l3, { status: 'rejected', remark: 'Not serious', decided_by: 'Owner' });
  await assert.rejects(() => accept('l3'), /already rejected/);
  assert.equal((await db.query(`select count(*)::int c from stock.leads where status = 'new'`)).rows[0].c, 0);
  await db.close();
});
