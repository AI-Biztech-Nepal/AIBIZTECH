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
