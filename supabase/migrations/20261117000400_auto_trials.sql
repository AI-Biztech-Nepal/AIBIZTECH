-- Every business gets all apps on a 15-day trial from the moment it is created, and its owner is admin in each.

alter table core.org_services alter column trial_ends_at set default now() + interval '15 days';
update core.org_services set trial_ends_at = enabled_at + interval '15 days' where status = 'trial';

create or replace function core.start_all_services() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.org_role <> 'owner' then return new; end if;
  insert into core.org_services (org_id, service_key)
    select new.org_id, s.key from core.services s where s.is_active
    on conflict do nothing;
  insert into core.service_roles (org_id, user_id, service_key, role)
    select new.org_id, new.user_id, s.key, 'admin' from core.services s
    where s.is_active and 'admin' = any (s.roles)
    on conflict do nothing;
  return new;
end
$$;

create trigger memberships_start_services after insert on core.memberships
  for each row execute function core.start_all_services();

-- Existing businesses: start every app they have not started yet, and give their owners admin
insert into core.org_services (org_id, service_key)
  select o.id, s.key from core.organizations o cross join core.services s where s.is_active
  on conflict do nothing;
insert into core.service_roles (org_id, user_id, service_key, role)
  select m.org_id, m.user_id, s.key, 'admin'
  from core.memberships m cross join core.services s
  where m.org_role = 'owner' and m.status = 'active' and s.is_active and 'admin' = any (s.roles)
  on conflict do nothing;
