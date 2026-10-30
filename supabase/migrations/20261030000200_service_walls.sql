-- Walls between services. Each service schema is reachable only by its own DB role (for backends)
-- and, for signed-in users, only through RLS that checks their service role in the active org.
-- Services never reference each other's tables; both may reference core and auth.

-- Functions default to EXECUTE for PUBLIC; take that away so only named roles can call them.
revoke all on all functions in schema finance, attendance from public, anon;
revoke all on all tables in schema finance, attendance from public, anon;
alter default privileges in schema finance, attendance revoke execute on functions from public, anon;

-- One login-less role per service; a backend connects as it (via set role / its own login) instead of
-- using the service_role key, which bypasses every wall.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'finance_svc')    then create role finance_svc    nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'attendance_svc') then create role attendance_svc nologin; end if;
end $$;

grant usage on schema finance    to finance_svc;
grant all on all tables    in schema finance    to finance_svc;
grant all on all sequences in schema finance    to finance_svc;
grant execute on all functions in schema finance    to finance_svc;

grant usage on schema attendance to attendance_svc;
grant all on all tables    in schema attendance to attendance_svc;
grant all on all sequences in schema attendance to attendance_svc;
grant execute on all functions in schema attendance to attendance_svc;

revoke all on schema finance    from attendance_svc;
revoke all on schema attendance from finance_svc;

-- Fail the migration if a service table points at another service's table.
do $$ declare n int; begin
  select count(*) into n from pg_constraint c
    join pg_class a on a.oid = c.conrelid  join pg_namespace an on an.oid = a.relnamespace
    join pg_class b on b.oid = c.confrelid join pg_namespace bn on bn.oid = b.relnamespace
   where c.contype = 'f' and an.nspname in ('finance','attendance') and bn.nspname in ('finance','attendance') and an.nspname <> bn.nspname;
  if n > 0 then raise exception 'cross-service foreign keys found: %', n; end if;
end $$;
