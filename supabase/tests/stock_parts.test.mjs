import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('adjust_part adds, takes out, refuses to go below zero, and records history', async () => {
  const db = new PGlite();
  await db.exec(`
    create schema stock; create role authenticated;
    create table stock.spare_parts (id text primary key, company_id text, name text, quantity int default 0, updated_at text);
    create table stock.part_transactions (id text primary key, company_id text, part_id text, part_name text, type text, quantity int, reason text, date text, job_id text, notes text, created_by text, created_at text);
    insert into stock.spare_parts (id, company_id, name, quantity) values ('p1', 'c1', 'Brake pad', 0);`);
  const sql = readFileSync(new URL('../migrations/20261118000700_stock_parts.sql', import.meta.url), 'utf8').replace(/^notify.*$/m, '');
  await db.exec(sql);
  const q = async (t, n) => (await db.query('select stock.adjust_part($1,$2,$3,$4) as left', ['p1', t, n, 'test'])).rows[0].left;
  assert.equal(await q('in', 10), 10);
  assert.equal(await q('out', 4), 6);
  await assert.rejects(() => q('out', 7), /not enough/);
  await assert.rejects(() => q('in', 0), /above zero/);
  assert.equal((await db.query('select quantity from stock.spare_parts')).rows[0].quantity, 6);
  assert.equal((await db.query('select count(*)::int c from stock.part_transactions')).rows[0].c, 2);
  await db.close();
});
