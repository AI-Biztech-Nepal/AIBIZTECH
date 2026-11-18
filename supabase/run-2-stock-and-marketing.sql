-- ===== 20261118000600_stock_native =====
-- Stock Manager rewritten inside the portal: it now reads and writes the stock tables as the signed-in person,
-- so the rules below (not a separate server) decide who sees what. A business sees only its own rows, and only if
-- it has Stock Manager. The old username/password tables stay closed. Safe to run more than once.
begin;

-- stock.companies row for a business (its id is the portal business id), created on first use
create or replace function stock.ensure_company(p_org uuid) returns void
language plpgsql security definer set search_path = core, stock, public as $$
begin
  if not core.has_service_access(p_org, 'stock') then raise exception 'No access to Stock Manager'; end if;
  insert into stock.companies (id, name, created_at)
  select o.id::text, o.name, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  from core.organizations o where o.id = p_org
  on conflict (id) do nothing;
end $$;
revoke all on function stock.ensure_company(uuid) from public;
grant execute on function stock.ensure_company(uuid) to authenticated;

grant usage on schema stock to authenticated;

-- every table with a company_id column: members of that business with Stock access only
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
    where c.table_schema = 'stock' and c.column_name = 'company_id' and c.table_name not in ('users')
  loop
    execute format('alter table stock.%I enable row level security', t);
    execute format('drop policy if exists %I on stock.%I', 'portal_member_all', t);
    execute format($p$create policy portal_member_all on stock.%I for all to authenticated
      using (core.has_service_access(company_id::uuid, 'stock')) with check (core.has_service_access(company_id::uuid, 'stock'))$p$, t);
    execute format('grant select, insert, update, delete on stock.%I to authenticated', t);
  end loop;
  -- the business row itself: readable by its members
  drop policy if exists portal_member_read on stock.companies;
  create policy portal_member_read on stock.companies for select to authenticated using (core.has_service_access(id::uuid, 'stock'));
  grant select on stock.companies to authenticated;
end $$;

commit;
notify pgrst, 'reload schema';

-- ===== 20261118000700_stock_parts =====
-- Spare parts stock in/out, done in one step so two people adjusting at once cannot lose a count.
begin;
create or replace function stock.adjust_part(p_part text, p_type text, p_qty int, p_reason text default null, p_notes text default null)
returns int language plpgsql security invoker set search_path = stock, core, public as $$
declare v_company text; v_name text; v_left int;
begin
  if p_type not in ('in','out') or coalesce(p_qty, 0) <= 0 then raise exception 'Enter a quantity above zero'; end if;
  update stock.spare_parts set quantity = coalesce(quantity, 0) + case when p_type = 'in' then p_qty else -p_qty end,
         updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
   where id = p_part and (p_type = 'in' or coalesce(quantity, 0) >= p_qty)
   returning company_id, name, quantity into v_company, v_name, v_left;
  if v_company is null then raise exception 'Part not found, or not enough in stock'; end if;
  insert into stock.part_transactions (id, company_id, part_id, part_name, type, quantity, reason, date, notes, created_at)
  values (gen_random_uuid()::text, v_company, p_part, v_name, p_type, p_qty, p_reason, to_char(now(), 'YYYY-MM-DD'), p_notes,
          to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  return v_left;
end $$;
grant execute on function stock.adjust_part(text, text, int, text, text) to authenticated;
commit;
notify pgrst, 'reload schema';

-- ===== 20261118000800_stock_sales =====
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

-- ===== 20261118000900_stock_jobs =====
-- Job cards for Stock Manager. Opening one is ONE step: the card, the parts taken out of spare-part stock (refused if there
-- is not enough), and the vehicle moving to "in_repair". Completing the last open card puts the vehicle back to "available".
begin;

create or replace function stock.create_job_card(
  p_company text, p_vehicle text, p_brand text, p_model text, p_year int, p_reg text, p_customer text, p_contact text,
  p_work text, p_mechanic text, p_estimated double precision, p_labour double precision, p_date text, p_notes text,
  p_parts jsonb default '[]', p_is_warranty boolean default false, p_after_sale boolean default false
) returns text language plpgsql security invoker set search_path = stock, core, public as $$
declare jid text := gen_random_uuid()::text; n int; part jsonb; num text; ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
        vs text;
begin
  select count(*) into n from stock.job_cards where company_id = p_company;
  num := 'JC-' || extract(year from now())::int || '-' || lpad((n + 1)::text, 3, '0');
  if nullif(p_vehicle, '') is not null then
    select status into vs from stock.vehicles where id = p_vehicle and company_id = p_company for update;
    if not found then raise exception 'Vehicle not found'; end if;
    if vs not in ('available', 'in_repair', 'sold') then raise exception 'Job cards can only be opened for available, in-repair or sold vehicles'; end if;
  elsif coalesce(p_brand, '') = '' or coalesce(p_model, '') = '' or coalesce(p_reg, '') = '' then
    raise exception 'Brand, model and registration number are required for an outside vehicle';
  end if;
  insert into stock.job_cards (id, company_id, vehicle_id, is_external, vehicle_brand, vehicle_model, vehicle_year, registration_number, customer_name,
    customer_contact, work_description, mechanic_name, estimated_cost, labour_charge, job_date, notes, parts, job_number, status, is_warranty, after_sale, created_at)
  values (jid, p_company, nullif(p_vehicle, ''), nullif(p_vehicle, '') is null, p_brand, p_model, p_year, p_reg, p_customer, p_contact, p_work, p_mechanic,
    p_estimated, case when p_is_warranty then 0 else p_labour end, coalesce(nullif(p_date, ''), to_char(now(), 'YYYY-MM-DD')), p_notes, coalesce(p_parts, '[]'),
    num, 'pending', p_is_warranty, p_after_sale, ts);
  for part in select * from jsonb_array_elements(coalesce(p_parts, '[]')) loop
    if nullif(part->>'part_id', '') is not null and coalesce((part->>'quantity')::int, 0) > 0 then
      perform stock.adjust_part(part->>'part_id', 'out', (part->>'quantity')::int, 'Used in Job Card', 'Job ' || num);
    end if;
  end loop;
  if vs = 'available' and not p_is_warranty then
    update stock.vehicles set status = 'in_repair', updated_at = ts where id = p_vehicle;
  end if;
  return jid;
end $$;

create or replace function stock.set_job_status(p_job text, p_status text, p_actual double precision default null) returns void
language plpgsql security invoker set search_path = stock, core, public as $$
declare j stock.job_cards%rowtype; ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if p_status not in ('pending', 'in_progress', 'completed') then raise exception 'Unknown status'; end if;
  select * into j from stock.job_cards where id = p_job for update;
  if not found then raise exception 'Job card not found'; end if;
  update stock.job_cards set status = p_status, updated_at = ts,
    completed_at = case when p_status = 'completed' then ts else null end,
    actual_cost = case when p_status = 'completed' then coalesce(p_actual, actual_cost, estimated_cost) else actual_cost end where id = p_job;
  if p_status = 'completed' and j.vehicle_id is not null and not coalesce(j.is_warranty, false)
     and not exists (select 1 from stock.job_cards o where o.vehicle_id = j.vehicle_id and o.id <> p_job and o.status in ('pending', 'in_progress')) then
    update stock.vehicles set status = 'available', updated_at = ts where id = j.vehicle_id and status = 'in_repair';
  end if;
end $$;

grant execute on function stock.create_job_card(text,text,text,text,int,text,text,text,text,text,double precision,double precision,text,text,jsonb,boolean,boolean) to authenticated;
grant execute on function stock.set_job_status(text,text,double precision) to authenticated;
commit;
notify pgrst, 'reload schema';

-- ===== 20261118001000_marketing_app =====
-- Marketing as its own app in the portal (Leads and CRM). It keeps its records in the same stock tables as Stock Manager
-- (leads, customers, follow-ups), so a customer won in Marketing is already there for Sales. Access is by its OWN app:
-- a business needs Marketing enabled, not Stock Manager. Safe to run more than once.
begin;

insert into core.services (key, name, base_url, roles) values
  ('marketing', 'Marketing', 'https://aibiztech.vercel.app/marketing', array['admin', 'marketer'])
on conflict (key) do update set name = excluded.name, roles = excluded.roles;

-- every business gets Marketing on the same 15-day trial as the other apps, and its owners are admin
insert into core.org_services (org_id, service_key)
  select o.id, 'marketing' from core.organizations o on conflict do nothing;
insert into core.service_roles (org_id, user_id, service_key, role)
  select m.org_id, m.user_id, 'marketing', 'admin' from core.memberships m
  where m.org_role = 'owner' and m.status = 'active' on conflict do nothing;

-- the stock record of a business is made on first use by either app
create or replace function stock.ensure_company(p_org uuid) returns void
language plpgsql security definer set search_path = core, stock, public as $$
begin
  if not (core.has_service_access(p_org, 'stock') or core.has_service_access(p_org, 'marketing')) then raise exception 'No access to this app'; end if;
  insert into stock.companies (id, name, created_at)
  select o.id::text, o.name, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  from core.organizations o where o.id = p_org
  on conflict (id) do nothing;
end $$;

-- Marketing's own access to the tables it uses
do $$
declare t text;
begin
  foreach t in array array['leads', 'crm_followups', 'crm_interactions', 'customers'] loop
    execute format('drop policy if exists portal_marketing_all on stock.%I', t);
    execute format($p$create policy portal_marketing_all on stock.%I for all to authenticated
      using (core.has_service_access(company_id::uuid, 'marketing')) with check (core.has_service_access(company_id::uuid, 'marketing'))$p$, t);
  end loop;
  drop policy if exists portal_marketing_read on stock.companies;
  create policy portal_marketing_read on stock.companies for select to authenticated using (core.has_service_access(id::uuid, 'marketing'));
end $$;

-- Accept a lead: the person goes into the CRM (an existing customer with the same phone is reused). Admins only.
create or replace function stock.accept_lead(p_lead text) returns text
language plpgsql security invoker set search_path = stock, core, public as $$
declare l stock.leads%rowtype; cid text; digits text; ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  select * into l from stock.leads where id = p_lead for update;
  if not found then raise exception 'Lead not found'; end if;
  if not core.has_service_access(l.company_id::uuid, 'marketing', array['admin']) then raise exception 'Only a Marketing admin can decide leads'; end if;
  if l.status in ('accepted', 'rejected') then raise exception 'This lead was already %', l.status; end if;
  digits := right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 10);
  if length(digits) >= 7 then
    select id into cid from stock.customers where company_id = l.company_id and right(regexp_replace(coalesce(contact_number, ''), '\D', '', 'g'), 10) = digits limit 1;
  end if;
  if cid is null then
    cid := gen_random_uuid()::text;
    insert into stock.customers (id, company_id, name, contact_number, address, source, lead_status, notes, created_at)
    values (cid, l.company_id, coalesce(nullif(l.name, ''), 'Unnamed'), l.phone, l.address, 'website', 'new', l.message, ts);
  end if;
  update stock.leads set status = 'accepted', remark = null, decided_by = (select full_name from core.profiles where id = auth.uid()), decided_at = ts, customer_id = cid where id = p_lead;
  return cid;
end $$;

create or replace function stock.reject_lead(p_lead text, p_remark text) returns void
language plpgsql security invoker set search_path = stock, core, public as $$
declare l stock.leads%rowtype;
begin
  if length(trim(coalesce(p_remark, ''))) < 3 then raise exception 'Please write why you are rejecting this lead'; end if;
  select * into l from stock.leads where id = p_lead for update;
  if not found then raise exception 'Lead not found'; end if;
  if not core.has_service_access(l.company_id::uuid, 'marketing', array['admin']) then raise exception 'Only a Marketing admin can decide leads'; end if;
  if l.status in ('accepted', 'rejected') then raise exception 'This lead was already %', l.status; end if;
  update stock.leads set status = 'rejected', remark = left(trim(p_remark), 1000), decided_by = (select full_name from core.profiles where id = auth.uid()),
    decided_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') where id = p_lead;
end $$;

grant execute on function stock.accept_lead(text) to authenticated;
grant execute on function stock.reject_lead(text, text) to authenticated;
commit;
notify pgrst, 'reload schema';

