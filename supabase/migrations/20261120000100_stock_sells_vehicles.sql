-- Per-business switch: does this business sell vehicles? OFF for new businesses, so Stock Manager starts generic (Items,
-- spare parts, customers, vendors) and a business turns vehicles on only if it needs them. Businesses that exist today and
-- already have a Stock record are switched ON once, when this column is first added, so they lose nothing.
-- When it is off, the vehicle parts (vehicle inventory, sales, EMI, service, Sanakhat) are hidden and Stock Manager opens
-- on Items. Only a Stock Manager admin can change it. Safe to run more than once (the one-time backfill never repeats).
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'stock' and table_name = 'companies' and column_name = 'sells_vehicles') then
    alter table stock.companies add column sells_vehicles boolean not null default false;
    -- everyone who exists today keeps what they see
    update stock.companies set sells_vehicles = true;
  end if;
end $$;

create or replace function stock.set_sells_vehicles(p_org uuid, p_value boolean) returns void
language plpgsql security definer set search_path = core, stock, public as $$
begin
  if not core.has_service_access(p_org, 'stock', array['admin']) then raise exception 'Only a Stock Manager admin can change this'; end if;
  perform stock.ensure_company(p_org);
  update stock.companies set sells_vehicles = p_value where id = p_org::text;
end $$;
revoke all on function stock.set_sells_vehicles(uuid, boolean) from public;
grant execute on function stock.set_sells_vehicles(uuid, boolean) to authenticated;

commit;
notify pgrst, 'reload schema';
