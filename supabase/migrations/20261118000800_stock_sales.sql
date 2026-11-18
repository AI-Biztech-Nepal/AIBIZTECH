-- Sales for Stock Manager. Each is ONE step: the sale, the vehicle turning "sold", and the customer's last purchase are
-- saved together or not at all. Same rules as the old Stock Manager: total = price + extra charges; what has been paid =
-- cash + bank + advance + exchange value; due = total - paid unless entered; status Paid / Partial / Unpaid.
begin;

create or replace function stock.record_sale(
  p_vehicle text, p_customer text, p_sale_price double precision, p_extra jsonb default '[]',
  p_method text default 'Cash', p_cash double precision default 0, p_bank double precision default 0,
  p_advance double precision default 0, p_exchange_value double precision default 0,
  p_exchange_brand text default null, p_exchange_model text default null, p_exchange_reg text default null,
  p_due_override double precision default null, p_due_date text default null, p_sale_date text default null,
  p_notes text default null, p_witness_name text default null, p_witness_address text default null,
  p_witness_phone text default null, p_witness_id text default null, p_sold_by text default null
) returns text language plpgsql security invoker set search_path = stock, core, public as $$
declare v stock.vehicles%rowtype; extras double precision; total double precision; paid double precision; due double precision;
        ex double precision := greatest(coalesce(p_exchange_value, 0), 0); sid text := gen_random_uuid()::text;
        d text := coalesce(nullif(p_sale_date, ''), to_char(now(), 'YYYY-MM-DD')); ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  select * into v from stock.vehicles where id = p_vehicle for update;
  if not found then raise exception 'Vehicle not found'; end if;
  if v.status is distinct from 'available' then raise exception 'Vehicle is already %', coalesce(v.status, 'not available'); end if;
  if coalesce(p_sale_price, 0) < 0 then raise exception 'Sale price cannot be negative'; end if;
  select coalesce(sum((e->>'amount')::double precision), 0) into extras from jsonb_array_elements(coalesce(p_extra, '[]')) e;
  total := p_sale_price + extras;
  paid := coalesce(p_cash, 0) + coalesce(p_bank, 0) + coalesce(p_advance, 0) + ex;
  due := case when p_due_override is not null then round(p_due_override::numeric, 2) else greatest(round((total - paid)::numeric, 2), 0) end;
  insert into stock.sales (id, company_id, vehicle_id, customer_id, sale_price, extra_expenses, expenses_total, total_amount, payment_method,
    paid_cash, paid_bank, advance_payment, due_amount, due_date, payment_status, sale_date, notes, exchange_valuation, exchange_brand,
    exchange_model, exchange_reg_no, witness_name, witness_address, witness_phone, witness_id_number, sold_by_name, created_at)
  values (sid, v.company_id, p_vehicle, nullif(p_customer, ''), p_sale_price, coalesce(p_extra, '[]'), extras, total, p_method,
    coalesce(p_cash, 0), coalesce(p_bank, 0), coalesce(p_advance, 0), due, nullif(p_due_date, ''),
    case when due <= 0 then 'Paid' when paid > 0 then 'Partial' else 'Unpaid' end, d, p_notes, ex, p_exchange_brand, p_exchange_model,
    p_exchange_reg, p_witness_name, p_witness_address, p_witness_phone, p_witness_id, p_sold_by, ts);
  update stock.vehicles set status = 'sold', selling_price = p_sale_price, sold_date = d, customer_id = nullif(p_customer, ''), updated_at = ts where id = p_vehicle;
  if nullif(p_customer, '') is not null then update stock.customers set last_purchase_date = d where id = p_customer; end if;
  return sid;
end $$;

-- Money received later against what is due
create or replace function stock.receive_sale_payment(p_sale text, p_cash double precision default 0, p_bank double precision default 0)
returns double precision language plpgsql security invoker set search_path = stock, core, public as $$
declare s stock.sales%rowtype; amt double precision := coalesce(p_cash, 0) + coalesce(p_bank, 0); due double precision;
begin
  if coalesce(p_cash, 0) < 0 or coalesce(p_bank, 0) < 0 or amt <= 0 then raise exception 'Enter an amount above zero'; end if;
  select * into s from stock.sales where id = p_sale for update;
  if not found then raise exception 'Sale not found'; end if;
  if coalesce(s.due_amount, 0) <= 0 then raise exception 'Nothing is due on this sale'; end if;
  if amt > s.due_amount + 0.005 then raise exception 'That is more than the % due', s.due_amount; end if;
  due := greatest(round((s.due_amount - amt)::numeric, 2), 0);
  update stock.sales set paid_cash = coalesce(paid_cash, 0) + coalesce(p_cash, 0), paid_bank = coalesce(paid_bank, 0) + coalesce(p_bank, 0),
    due_amount = due, payment_status = case when due <= 0 then 'Paid' else 'Partial' end,
    updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') where id = p_sale;
  return due;
end $$;

-- Undo a sale (admins only): the vehicle goes back to available
create or replace function stock.delete_sale(p_sale text) returns void
language plpgsql security invoker set search_path = stock, core, public as $$
declare s stock.sales%rowtype;
begin
  select * into s from stock.sales where id = p_sale for update;
  if not found then raise exception 'Sale not found'; end if;
  if not core.has_service_access(s.company_id::uuid, 'stock', array['admin']) then raise exception 'Only a Stock Manager admin can delete a sale'; end if;
  delete from stock.sales where id = p_sale;
  update stock.vehicles set status = 'available', sold_date = null, customer_id = null,
    updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') where id = s.vehicle_id;
end $$;

grant execute on function stock.record_sale(text,text,double precision,jsonb,text,double precision,double precision,double precision,double precision,text,text,text,double precision,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function stock.receive_sale_payment(text,double precision,double precision) to authenticated;
grant execute on function stock.delete_sale(text) to authenticated;
commit;
notify pgrst, 'reload schema';
