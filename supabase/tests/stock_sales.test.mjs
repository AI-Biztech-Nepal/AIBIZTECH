import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create schema core; create schema stock; create role authenticated;
    create function core.has_service_access(p uuid, s text, r text[] default null) returns boolean language sql as $$ select true $$;
    create table stock.vehicles (id text primary key, company_id text, status text, selling_price double precision, sold_date text, customer_id text, updated_at text);
    create table stock.customers (id text primary key, company_id text, last_purchase_date text);
    create table stock.sales (id text primary key, company_id text, vehicle_id text, customer_id text, sale_price double precision, extra_expenses jsonb, expenses_total double precision,
      total_amount double precision, payment_method text, paid_cash double precision, paid_bank double precision, advance_payment double precision, due_amount double precision, due_date text,
      payment_status text, sale_date text, notes text, exchange_valuation double precision, exchange_brand text, exchange_model text, exchange_reg_no text, witness_name text, witness_address text,
      witness_phone text, witness_id_number text, sold_by_name text, created_at text, updated_at text);
    insert into stock.vehicles (id, company_id, status) values ('v1','00000000-0000-0000-0000-000000000001','available'), ('v2','00000000-0000-0000-0000-000000000001','sold');
    insert into stock.customers (id, company_id) values ('c1','00000000-0000-0000-0000-000000000001');`);
  await db.exec(readFileSync(new URL('../migrations/20261118000800_stock_sales.sql', import.meta.url), 'utf8').replace(/^notify.*$/m, ''));
  return db;
}

test('a sale totals, marks the vehicle sold, and tracks what is due', async () => {
  const db = await setup();
  const sid = (await db.query(`select stock.record_sale('v1','c1',500000,'[{"name":"Transfer","amount":5000}]','Cash',200000,100000,0,50000) as id`)).rows[0].id;
  const s = (await db.query('select * from stock.sales where id=$1', [sid])).rows[0];
  assert.equal(s.total_amount, 505000);
  assert.equal(s.due_amount, 155000); // 505000 - (200000 + 100000 + 50000)
  assert.equal(s.payment_status, 'Partial');
  assert.equal((await db.query(`select status, selling_price from stock.vehicles where id='v1'`)).rows[0].status, 'sold');
  assert.ok((await db.query(`select last_purchase_date d from stock.customers`)).rows[0].d);
  // cannot sell it twice, or sell one that is already sold
  await assert.rejects(() => db.query(`select stock.record_sale('v1','c1',1)`), /already sold/);
  await assert.rejects(() => db.query(`select stock.record_sale('v2','c1',1)`), /already sold/);
  // payments reduce the due; too much is refused; paying in full marks Paid
  assert.equal((await db.query(`select stock.receive_sale_payment($1, 100000, 0) as d`, [sid])).rows[0].d, 55000);
  await assert.rejects(() => db.query(`select stock.receive_sale_payment($1, 60000, 0)`, [sid]), /more than/);
  await db.query(`select stock.receive_sale_payment($1, 0, 55000)`, [sid]);
  assert.equal((await db.query('select payment_status from stock.sales')).rows[0].payment_status, 'Paid');
  await assert.rejects(() => db.query(`select stock.receive_sale_payment($1, 1, 0)`, [sid]), /Nothing is due/);
  // deleting the sale puts the vehicle back on sale
  await db.query(`select stock.delete_sale($1)`, [sid]);
  assert.equal((await db.query(`select status from stock.vehicles where id='v1'`)).rows[0].status, 'available');
  assert.equal((await db.query('select count(*)::int c from stock.sales')).rows[0].c, 0);
  await db.close();
});

test('fully paid sale is Paid, unpaid is Unpaid', async () => {
  const db = await setup();
  await db.exec(`insert into stock.vehicles (id, company_id, status) values ('v3','00000000-0000-0000-0000-000000000001','available')`);
  const a = (await db.query(`select stock.record_sale('v1','c1',100,'[]','Cash',100,0) as id`)).rows[0].id;
  const b = (await db.query(`select stock.record_sale('v3','c1',100,'[]','Cash',0,0) as id`)).rows[0].id;
  const st = async (id) => (await db.query('select payment_status s, due_amount d from stock.sales where id=$1', [id])).rows[0];
  assert.deepEqual(await st(a), { s: 'Paid', d: 0 });
  assert.deepEqual(await st(b), { s: 'Unpaid', d: 100 });
  await db.close();
});
