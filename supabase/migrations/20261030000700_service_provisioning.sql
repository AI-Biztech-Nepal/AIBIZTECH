-- Backends that create logins for an org's admin (Attendance create-login, bridge-credentials) call these with the
-- service_role key right after auth.admin.createUser / deleteUser. Nothing else may call them.

create or replace function core.provision_service_user(p_org uuid, p_user uuid, p_service text, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from core.org_services where org_id = p_org and service_key = p_service) then
    raise exception 'org % does not have service %', p_org, p_service using errcode = '23503';
  end if;
  insert into core.memberships (org_id, user_id, org_role)
    values (p_org, p_user, case when p_role = 'admin' then 'admin' else 'member' end)
    on conflict do nothing;
  insert into core.service_roles (org_id, user_id, service_key, role) values (p_org, p_user, p_service, p_role)
    on conflict (org_id, user_id, service_key) do update set role = excluded.role;
  update core.profiles set active_org_id = coalesce(active_org_id, p_org) where user_id = p_user;
end $$;

-- Removes the service role; the membership goes too unless the person is the owner or holds another service role there.
create or replace function core.deprovision_service_user(p_org uuid, p_user uuid, p_service text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from core.service_roles where org_id = p_org and user_id = p_user and service_key = p_service;
  delete from core.memberships m where m.org_id = p_org and m.user_id = p_user and m.org_role <> 'owner'
    and not exists (select 1 from core.service_roles r where r.org_id = p_org and r.user_id = p_user);
end $$;

revoke all on function core.provision_service_user(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function core.deprovision_service_user(uuid, uuid, text) from public, anon, authenticated;
grant execute on function core.provision_service_user(uuid, uuid, text, text) to service_role;
grant execute on function core.deprovision_service_user(uuid, uuid, text) to service_role;

-- The old project published attendance_logs to Realtime (the dashboards listen for new punches).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'attendance' and tablename = 'attendance_logs') then
    alter publication supabase_realtime add table attendance.attendance_logs;
  end if;
end $$;
