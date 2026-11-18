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
