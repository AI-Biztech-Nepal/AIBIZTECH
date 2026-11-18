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
  update stock.leads set status = 'accepted', remark = null, decided_by = (select full_name from core.profiles where user_id = auth.uid()), decided_at = ts, customer_id = cid where id = p_lead;
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
  update stock.leads set status = 'rejected', remark = left(trim(p_remark), 1000), decided_by = (select full_name from core.profiles where user_id = auth.uid()),
    decided_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') where id = p_lead;
end $$;

grant execute on function stock.accept_lead(text) to authenticated;
grant execute on function stock.reject_lead(text, text) to authenticated;
commit;
notify pgrst, 'reload schema';
