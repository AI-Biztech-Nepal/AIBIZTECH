import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('job card takes parts from stock, moves the vehicle to repair, and back when done', async () => {
  const db = new PGlite();
  await db.exec(`
    create schema stock; create role authenticated;
    create table stock.vehicles (id text primary key, company_id text, status text, updated_at text);
    create table stock.spare_parts (id text primary key, company_id text, name text, quantity int default 0, updated_at text);
    create table stock.part_transactions (id text primary key, company_id text, part_id text, part_name text, type text, quantity int, reason text, date text, job_id text, notes text, created_by text, created_at text);
    create table stock.job_cards (id text primary key, company_id text, vehicle_id text, is_external boolean, vehicle_brand text, vehicle_model text, vehicle_year int, registration_number text,
      customer_name text, customer_contact text, work_description text, mechanic_name text, estimated_cost double precision, labour_charge double precision, job_date text, notes text, parts jsonb,
      job_number text, status text, is_warranty boolean, after_sale boolean, created_at text, updated_at text, completed_at text, actual_cost double precision);
    insert into stock.vehicles values ('v1','c1','available',null), ('v2','c1','sold',null);
    insert into stock.spare_parts values ('p1','c1','Pad',5,null);`);
  await db.exec(readFileSync(new URL('../migrations/20261118000700_stock_parts.sql', import.meta.url), 'utf8').replace(/^notify.*$/m, ''));
  await db.exec(readFileSync(new URL('../migrations/20261118000900_stock_jobs.sql', import.meta.url), 'utf8').replace(/^notify.*$/m, ''));
  const open = (v, parts = '[]', w = false) => db.query(`select stock.create_job_card('c1',$1,null,null,null,null,null,null,'Service','Ram',1000,500,null,null,$2::jsonb,$3,false) as id`, [v, parts, w]);

  const a = (await open('v1', '[{"part_id":"p1","part_name":"Pad","quantity":2}]')).rows[0].id;
  assert.equal((await db.query(`select status from stock.vehicles where id='v1'`)).rows[0].status, 'in_repair');
  assert.equal((await db.query(`select quantity from stock.spare_parts`)).rows[0].quantity, 3);
  assert.equal((await db.query(`select job_number from stock.job_cards where id=$1`, [a])).rows[0].job_number.endsWith('-001'), true);
  // not enough parts: refused, and nothing is saved
  await assert.rejects(() => open('v1', '[{"part_id":"p1","quantity":9}]'), /not enough/);
  assert.equal((await db.query(`select count(*)::int c from stock.job_cards`)).rows[0].c, 1);
  // a second open card, then complete both: vehicle only returns when the last one is done
  const b = (await open('v1')).rows[0].id;
  await db.query(`select stock.set_job_status($1,'completed',1200)`, [a]);
  assert.equal((await db.query(`select status from stock.vehicles where id='v1'`)).rows[0].status, 'in_repair');
  await db.query(`select stock.set_job_status($1,'completed')`, [b]);
  assert.equal((await db.query(`select status from stock.vehicles where id='v1'`)).rows[0].status, 'available');
  assert.equal((await db.query(`select actual_cost from stock.job_cards where id=$1`, [a])).rows[0].actual_cost, 1200);
  // warranty job on a sold vehicle: labour free, vehicle stays sold
  const w = (await open('v2', '[]', true)).rows[0].id;
  const row = (await db.query(`select labour_charge from stock.job_cards where id=$1`, [w])).rows[0];
  assert.equal(row.labour_charge, 0);
  assert.equal((await db.query(`select status from stock.vehicles where id='v2'`)).rows[0].status, 'sold');
  await db.close();
});
