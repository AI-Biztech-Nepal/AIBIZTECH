// The portal and Attendance share auth.users; each must create its own profile row for a new account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const core = ['20261027000000_core_init', '20261117000000_signup_phone'].map((f) => sql(`../migrations/${f}.sql`)).join('\n');
const fix = sql('../migrations/20261126000100_portal_profile_trigger.sql');
const attendance = sql('../../services/attendance/supabase/003_auth_signup.sql');

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles (id uuid primary key, role text);
  `);
  await db.exec(core);
  return db;
}
const id = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const signUp = (db, n) => db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${id(n)}', 'u${n}@x.np', '{"full_name":"U${n}"}')`);
const portalProfiles = async (db) => (await db.query('select count(*)::int n from core.profiles')).rows[0].n;

test('Attendance replaces the portal trigger; the fix restores portal profiles, old and new', async () => {
  const db = await database();
  await db.exec(attendance);
  await signUp(db, 1);
  assert.equal(await portalProfiles(db), 0); // the fault
  await db.exec(fix);
  await signUp(db, 2);
  assert.equal(await portalProfiles(db), 2);
  assert.equal((await db.query('select count(*)::int n from public.profiles')).rows[0].n, 2); // Attendance still works
});

test('with the original portal trigger still in place nothing is created twice, even run again', async () => {
  const db = await database();
  await db.exec(fix);
  await db.exec(fix);
  await signUp(db, 1);
  assert.equal(await portalProfiles(db), 1);
});
