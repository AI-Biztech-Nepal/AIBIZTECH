-- Fix: core.profiles is keyed by user_id, not id. Recreates the Attendance first-open setup and Marketing's Accept / Reject lead steps.
-- Safe to run more than once.
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
    select full_name into fn from core.profiles where user_id = uid;
    insert into attendance.profiles (id, role, full_name, company_name, company_id) values (uid, r, fn, nm, cid) on conflict (id) do nothing;
  end if;
  return cid;
end $$;
revoke all on function attendance.ensure_workspace(uuid) from public;
grant execute on function attendance.ensure_workspace(uuid) to authenticated;

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
