import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('first open creates the company, the link and the profile once; repeat opens change nothing', async () => {
  const db = new PGlite();
  await db.exec(`
    create schema core; create schema attendance; create schema auth; create role authenticated;
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-0000000000aa'::uuid $$;
    create table core.organizations (id uuid primary key, name text); insert into core.organizations values ('00000000-0000-0000-0000-000000000001', 'Allinoneabroad');
    create table core.profiles (id uuid primary key, full_name text); insert into core.profiles values ('00000000-0000-0000-0000-0000000000aa', 'Luv Kush');
    create table core.legacy_tenant_map (service_key text not null, legacy_id text not null, org_id uuid not null);
    create function core.has_service_access(p uuid, s text, r text[] default null) returns boolean language sql as $$ select true $$;
    create function core.service_role(p uuid, s text) returns text language sql as $$ select 'admin'::text $$;
    create table attendance.companies (id uuid primary key default gen_random_uuid(), name text not null, created_by uuid, created_at timestamptz not null default now());
    create table attendance.profiles (id uuid primary key, role text not null, full_name text, company_name text, company_id uuid not null);`);
  await db.exec(readFileSync(new URL('../migrations/20261118001100_attendance_workspace.sql', import.meta.url), 'utf8').replace(/^notify.*$/m, ''));
  const org = '00000000-0000-0000-0000-000000000001';
  const a = (await db.query('select attendance.ensure_workspace($1) as c', [org])).rows[0].c;
  const b = (await db.query('select attendance.ensure_workspace($1) as c', [org])).rows[0].c;
  assert.equal(a, b);
  assert.equal((await db.query('select count(*)::int c from attendance.companies')).rows[0].c, 1);
  assert.equal((await db.query('select count(*)::int c from core.legacy_tenant_map')).rows[0].c, 1);
  const p = (await db.query('select role, full_name, company_name, company_id from attendance.profiles')).rows;
  assert.deepEqual(p, [{ role: 'admin', full_name: 'Luv Kush', company_name: 'Allinoneabroad', company_id: a }]);
  await db.close();
});
