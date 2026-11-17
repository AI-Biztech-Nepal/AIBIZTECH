-- The rest of the Finance app's database (its migrations 0002-0027), in the finance schema and owned by a business.
-- Data-only fixes from the old project (renames, backfills, the Deeva-specific EMI adjustments) are left out: this is a fresh set of books.
begin;

-- Company profile: one per business (id = the business), shown on bills and in Store Details
create table if not exists finance.profiles (
  id                 uuid primary key references core.organizations(id) on delete cascade,
  role               text not null default 'store' check (role = 'store'),
  full_name          text,
  phone              text,
  avatar_url         text,
  city               text,
  is_active          boolean not null default true,
  business_name      text,
  business_reg_no    text,
  business_vat_no    text,
  business_address   text,
  business_phone     text,
  business_logo_path text,
  cash_account       jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table finance.profiles enable row level security;
create policy profiles_own on finance.profiles for all using (finance.can_use(id)) with check (finance.can_use(id) and role = 'store');
create trigger profiles_touch before update on finance.profiles for each row execute function finance.touch_updated_at();

-- Called by the Finance app on start: makes sure the business has its profile (name and address from the business itself)
create or replace function finance.ensure_profile() returns finance.profiles
language plpgsql security definer set search_path = finance, core
as $$
declare org uuid := finance.current_org(); p finance.profiles;
begin
  if org is null or not finance.can_use(org) then raise exception 'no Finance access' using errcode = '42501'; end if;
  insert into finance.profiles (id, full_name, business_name, business_address, business_phone)
    select o.id, o.owner_name, o.name, o.address, o.phone from core.organizations o where o.id = org
    on conflict (id) do nothing;
  select * into p from finance.profiles where id = org;
  return p;
end $$;
grant execute on function finance.ensure_profile() to authenticated;

-- Products: the shelf
create table if not exists finance.products (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references core.organizations(id) on delete cascade,
  name           text not null,
  sku            text,
  barcode        text,
  category       text,
  unit           text not null default 'pcs',
  price          numeric not null default 0 check (price >= 0),
  purchase_price numeric check (purchase_price is null or purchase_price >= 0),
  stock_level    numeric not null default 0,
  reorder_level  numeric not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists products_owner_name_idx on finance.products (owner_id, lower(btrim(name)));
create unique index if not exists products_owner_barcode_idx on finance.products (owner_id, barcode) where barcode is not null and barcode <> '';
alter table finance.products enable row level security;
create policy products_owner on finance.products for all using (finance.can_use(owner_id)) with check (finance.can_use(owner_id));
create trigger products_touch before update on finance.products for each row execute function finance.touch_updated_at();
create trigger products_stamp_owner before insert on finance.products for each row execute function finance.stamp_owner();

-- Stock movement: a sale takes items off the shelf, a purchase puts them on (matched by item name)
create or replace function finance.apply_bill_stock(p_owner uuid, p_type finance.business_transaction_type, p_items jsonb, p_sign int)
returns void language plpgsql set search_path = finance, core as $$
declare it jsonb; delta numeric;
begin
  if p_type not in ('sale', 'purchase') then return; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    delta := coalesce((it ->> 'qty')::numeric, 0) * p_sign * case when p_type = 'sale' then -1 else 1 end;
    if delta <> 0 then
      update finance.products set stock_level = stock_level + delta
       where owner_id = p_owner and lower(btrim(name)) = lower(btrim(it ->> 'description'));
    end if;
  end loop;
end $$;

create or replace function finance.business_transactions_stock() returns trigger
language plpgsql security definer set search_path = finance, core as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform finance.apply_bill_stock(old.owner_id, old.type, old.items, -1); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform finance.apply_bill_stock(new.owner_id, new.type, new.items, 1); end if;
  return coalesce(new, old);
end $$;
create trigger business_transactions_stock_trg after insert or update of items, type or delete on finance.business_transactions
  for each row execute function finance.business_transactions_stock();

-- Bills may be zero-amount (free items), but an expense must be above zero
alter table finance.business_transactions drop constraint if exists business_transactions_amount_check;
alter table finance.business_transactions add constraint business_transactions_amount_check check (amount >= 0 and (type <> 'expense' or amount > 0));
alter table finance.business_transactions add column if not exists installation_charge numeric not null default 0;
alter table finance.business_transactions add column if not exists service_charges jsonb not null default '[]'::jsonb;
alter table finance.expense_categories add column if not exists expense_group text check (expense_group in ('direct', 'indirect'));

-- Party types
create table if not exists finance.party_types (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references core.organizations(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists party_types_owner_name_idx on finance.party_types (owner_id, name);
alter table finance.party_types enable row level security;
create policy party_types_all_owner on finance.party_types for all using (finance.can_use(owner_id)) with check (finance.can_use(owner_id));
create trigger party_types_stamp_owner before insert on finance.party_types for each row execute function finance.stamp_owner();
alter table finance.customers add column if not exists party_type_id uuid references finance.party_types(id) on delete set null;
create index if not exists customers_party_type_idx on finance.customers (party_type_id);

create or replace function finance.party_type_id_for(p_owner uuid, p_name text) returns uuid
language plpgsql security definer set search_path = finance, core as $$
declare tid uuid;
begin
  select id into tid from party_types where owner_id = p_owner and lower(btrim(name)) = lower(p_name) order by created_at limit 1;
  if tid is null then
    insert into party_types (owner_id, name) values (p_owner, p_name) on conflict (owner_id, name) do nothing returning id into tid;
    if tid is null then select id into tid from party_types where owner_id = p_owner and name = p_name; end if;
  end if;
  return tid;
end $$;
revoke execute on function finance.party_type_id_for(uuid, text) from public, anon, authenticated;

create or replace function finance.type_party_from_ledger() returns trigger
language plpgsql security definer set search_path = finance, core as $$
declare pid uuid; kind text;
begin
  if tg_table_name = 'customer_ledger_entries' then pid := (to_jsonb(new) ->> 'customer_id')::uuid; kind := 'Customer';
  else pid := (to_jsonb(new) ->> 'vendor_id')::uuid; kind := 'Vendor'; end if;
  update customers set party_type_id = party_type_id_for(new.owner_id, kind) where id = pid and party_type_id is null;
  return new;
end $$;
create trigger customer_ledger_types_party after insert on finance.customer_ledger_entries for each row execute function finance.type_party_from_ledger();
create trigger vendor_ledger_types_party after insert on finance.vendor_ledger_entries for each row execute function finance.type_party_from_ledger();

-- A renamed party's bills follow
create or replace function finance.sync_customer_name_to_records() returns trigger
language plpgsql security definer set search_path = finance, core as $$
begin
  if new.name is distinct from old.name then
    update business_transactions set party_name = new.name where customer_id = new.id and party_name is distinct from new.name;
  end if;
  return new;
end $$;
create trigger customers_sync_name_to_records after update of name on finance.customers for each row execute function finance.sync_customer_name_to_records();

-- Rent
create table if not exists finance.rentals (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references core.organizations(id) on delete cascade,
  car            text not null,
  model          text,
  customer_id    uuid references finance.customers(id) on delete set null,
  customer_name  text,
  employee_id    uuid references finance.customers(id) on delete set null,
  employee_name  text,
  wage_per_day   numeric not null default 0 check (wage_per_day >= 0),
  start_date     date not null,
  end_date       date,
  returned_on    date,
  rate_per_day   numeric not null default 0 check (rate_per_day >= 0),
  payments       jsonb not null default '[]'::jsonb,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists rentals_owner_start_idx on finance.rentals (owner_id, start_date desc);
create unique index if not exists rentals_one_out_per_car on finance.rentals (owner_id, lower(regexp_replace(btrim(car), '\s+', ' ', 'g'))) where returned_on is null;
alter table finance.rentals enable row level security;
create policy rentals_all_owner on finance.rentals for all using (finance.can_use(owner_id)) with check (finance.can_use(owner_id));
create trigger rentals_stamp_owner before insert on finance.rentals for each row execute function finance.stamp_owner();
create trigger rentals_touch before update on finance.rentals for each row execute function finance.touch_updated_at();

-- Daily rent becomes a receivable from the renter, one line per day
create or replace function finance.rental_wage_rows(p_owner uuid)
returns table (owner_id uuid, employee_id uuid, day date, amount numeric, note text, source_id uuid)
language sql stable security definer set search_path = finance, core as $$
  select r.owner_id, r.customer_id, d::date, r.rate_per_day, 'Daily rent · ' || r.car,
         md5('rental_wage:' || r.id::text || ':' || d::date::text)::uuid
    from finance.rentals r
   cross join lateral generate_series(r.start_date,
           least(coalesce(r.returned_on, (now() at time zone 'Asia/Kathmandu')::date), (now() at time zone 'Asia/Kathmandu')::date),
           interval '1 day') d
   where r.customer_id is not null and r.rate_per_day > 0 and (p_owner is null or r.owner_id = p_owner)
$$;

create or replace function finance.sync_rental_wages_for(p_owner uuid) returns void
language plpgsql security definer set search_path = finance, core as $$
begin
  delete from finance.vendor_ledger_entries v where v.source_type = 'rental_wage' and (p_owner is null or v.owner_id = p_owner);
  delete from finance.customer_ledger_entries c
   where c.source_type = 'rental_wage' and (p_owner is null or c.owner_id = p_owner)
     and (c.source_id, c.customer_id) not in (select w.source_id, w.employee_id from finance.rental_wage_rows(p_owner) w);
  insert into finance.customer_ledger_entries (customer_id, owner_id, entry_type, amount, note, source, source_type, source_id, entry_date)
  select w.employee_id, w.owner_id, 'debit', w.amount, w.note, 'booking', 'rental_wage', w.source_id, w.day
    from finance.rental_wage_rows(p_owner) w
  on conflict (source_type, source_id) where source_type is not null and source_id is not null
  do update set amount = excluded.amount, customer_id = excluded.customer_id, note = excluded.note, entry_date = excluded.entry_date;
end $$;
revoke execute on function finance.sync_rental_wages_for(uuid), finance.rental_wage_rows(uuid) from public, anon, authenticated;

-- What the app calls: the active business's own rent lines
create or replace function finance.sync_rental_wages() returns void
language plpgsql security definer set search_path = finance, core as $$
declare org uuid := finance.current_org();
begin
  if org is null or not finance.can_use(org) then return; end if;
  perform finance.sync_rental_wages_for(org);
end $$;
grant execute on function finance.sync_rental_wages() to authenticated;

create or replace function finance.rentals_sync_wages() returns trigger
language plpgsql security definer set search_path = finance, core as $$
begin perform finance.sync_rental_wages_for(coalesce(new.owner_id, old.owner_id)); return null; end $$;
create trigger rentals_sync_wages after insert or update or delete on finance.rentals for each row execute function finance.rentals_sync_wages();

-- EMI
create table if not exists finance.emi_plans (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references core.organizations(id) on delete cascade,
  car            text not null,
  model          text,
  customer_id    uuid references finance.customers(id) on delete set null,
  customer_name  text,
  sale_price     numeric not null default 0 check (sale_price >= 0),
  down_payment   numeric not null default 0 check (down_payment >= 0),
  installment    numeric not null default 0 check (installment >= 0),
  months         integer not null default 1 check (months > 0),
  first_due      date not null,
  note           text,
  closed_on      date,
  direction      text not null default 'sale' check (direction in ('sale', 'purchase')),
  interest_rate  numeric not null default 0 check (interest_rate >= 0),
  product_id     uuid references finance.products(id) on delete set null,
  ledger_paid    numeric not null default 0 check (ledger_paid >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists emi_plans_owner_idx on finance.emi_plans (owner_id, first_due desc);
create index if not exists emi_plans_product_idx on finance.emi_plans (product_id);
alter table finance.emi_plans enable row level security;
create policy emi_plans_all_owner on finance.emi_plans for all using (finance.can_use(owner_id)) with check (finance.can_use(owner_id));
create trigger emi_plans_stamp_owner before insert on finance.emi_plans for each row execute function finance.stamp_owner();
create trigger emi_plans_touch before update on finance.emi_plans for each row execute function finance.touch_updated_at();

grant select, insert, update, delete on all tables in schema finance to authenticated, service_role;
grant execute on all functions in schema finance to authenticated, service_role;
revoke execute on function finance.sync_rental_wages_for(uuid), finance.rental_wage_rows(uuid), finance.party_type_id_for(uuid, text) from authenticated;

commit;
notify pgrst, 'reload schema';
