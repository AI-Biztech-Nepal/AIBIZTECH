-- 1. The tenant helpers behind every finance/attendance policy now go through core.service_role(), which already
--    honours a suspended service, an expired trial and a disabled member. Before this they only checked that a
--    role row existed, so a suspended org kept its access.
create or replace function attendance.my_company_id() returns uuid language sql stable security definer set search_path = '' as $$
  select p.active_org_id from core.profiles p
  where p.user_id = auth.uid() and core.service_role(p.active_org_id, 'attendance') is not null
$$;
create or replace function attendance.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(core.service_role(attendance.my_company_id(), 'attendance') = 'admin', false)
$$;
create or replace function attendance.is_admin_or_hr() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(core.service_role(attendance.my_company_id(), 'attendance') in ('admin', 'hr'), false)
$$;
create or replace function finance.finance_current_owner() returns uuid language sql stable security definer set search_path = '' as $$
  select p.active_org_id from core.profiles p
  where p.user_id = auth.uid() and core.service_role(p.active_org_id, 'finance') is not null
$$;

-- 2. For the legacy superadmin screens (service_role only): mirror a company's suspend/reactivate/delete into core.
create or replace function core.set_service_status(p_org uuid, p_service text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('active', 'suspended') then raise exception 'status must be active or suspended'; end if;
  update core.org_services set status = p_status where org_id = p_org and service_key = p_service;
  if not found then raise exception 'org % does not have service %', p_org, p_service using errcode = '23503'; end if;
end $$;

-- Drops one service from an org. The org itself goes only when that was its last service. Returns true if the org was removed.
create or replace function core.remove_org_service(p_org uuid, p_service text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from core.legacy_tenant_map where org_id = p_org and service_key = p_service;
  delete from core.org_services where org_id = p_org and service_key = p_service; -- cascades its service roles
  if exists (select 1 from core.org_services where org_id = p_org) then return false; end if;
  delete from core.legacy_tenant_map where org_id = p_org;
  delete from core.organizations where id = p_org;
  return true;
end $$;

revoke all on function core.set_service_status(uuid, text, text) from public, anon, authenticated;
revoke all on function core.remove_org_service(uuid, text) from public, anon, authenticated;
grant execute on function core.set_service_status(uuid, text, text) to service_role;
grant execute on function core.remove_org_service(uuid, text) to service_role;
