-- Per-business switch: does this business sell vehicles? On by default, so every existing business keeps what it has.
-- When a business turns it off, the vehicle parts of Stock Manager (vehicle inventory, sales, EMI, service, Sanakhat) are
-- hidden for it and Stock Manager opens on Items. Only a Stock Manager admin can change it. Safe to run more than once.
begin;

alter table stock.companies add column if not exists sells_vehicles boolean not null default true;

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
