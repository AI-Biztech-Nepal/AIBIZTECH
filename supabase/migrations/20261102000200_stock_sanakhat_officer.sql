-- Stock's sanakhat_officer role (the sanakhat desk) becomes a portal role, but only for orgs that have the sanakhat feature.
-- Without this a Stock user with that role cannot be given a core.service_roles row, so they could only use the old login.

update core.services set roles = array_append(roles, 'sanakhat_officer')
where key = 'stock' and not 'sanakhat_officer' = any (roles);

create or replace function core.check_service_role()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from core.services s
                 where s.key = new.service_key and new.role = any (s.roles)) then
    raise exception 'role % is not valid for service %', new.role, new.service_key
      using errcode = '23514';
  end if;
  -- the desk only exists where the paperwork feature is on (switch only: the service can still be on trial)
  if new.service_key = 'stock' and new.role = 'sanakhat_officer' and not core.feature_switch(new.org_id, 'stock.sanakhat') then
    raise exception 'role sanakhat_officer needs the Sanakhat feature switched on for this organization'
      using errcode = '23514';
  end if;
  return new;
end
$$;
