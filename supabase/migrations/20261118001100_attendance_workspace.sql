-- First open of Attendance inside the portal: the business gets its Attendance company (linked in core.legacy_tenant_map) and the
-- person gets their Attendance profile (admin / hr / employee, from their Attendance role in the portal). Safe to run again: it
-- only creates what is missing, and never changes an existing company or profile.
begin;

create or replace function attendance.ensure_workspace(p_org uuid) returns uuid
language plpgsql security definer set search_path = core, attendance, public as $$
declare cid uuid; r text; nm text; fn text; uid uuid := auth.uid();
begin
  if uid is null or not core.has_service_access(p_org, 'attendance') then raise exception 'No access to Attendance'; end if;
  perform pg_advisory_xact_lock(hashtext('attendance_ws_' || p_org::text));
  select legacy_id::uuid into cid from core.legacy_tenant_map where service_key = 'attendance' and org_id = p_org limit 1;
  if cid is null then
    select name into nm from core.organizations where id = p_org;
    insert into attendance.companies (name, created_by) values (nm, uid) returning id into cid;
    insert into core.legacy_tenant_map (service_key, legacy_id, org_id) values ('attendance', cid::text, p_org);
  end if;
  if not exists (select 1 from attendance.profiles where id = uid) then
    select name into nm from core.organizations where id = p_org;
    r := case core.service_role(p_org, 'attendance') when 'admin' then 'admin' when 'hr' then 'hr' else 'employee' end;
    select full_name into fn from core.profiles where id = uid;
    insert into attendance.profiles (id, role, full_name, company_name, company_id) values (uid, r, fn, nm, cid) on conflict (id) do nothing;
  end if;
  return cid;
end $$;
revoke all on function attendance.ensure_workspace(uuid) from public;
grant execute on function attendance.ensure_workspace(uuid) to authenticated;
commit;
notify pgrst, 'reload schema';
