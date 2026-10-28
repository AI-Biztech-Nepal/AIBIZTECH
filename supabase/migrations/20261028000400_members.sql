-- Team management: list an organization's members with their emails and service roles,
-- and make sure an organization cannot lose its last active owner.

-- Admin view of the team. Emails live in auth.users, which the app cannot read, so this is a function.
create function core.org_members(p_org uuid)
returns table (user_id uuid, full_name text, email text, org_role text, status text, joined_at timestamptz, service_roles jsonb)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, p.full_name, u.email::text, m.org_role, m.status, m.created_at,
         coalesce((select jsonb_object_agg(sr.service_key, sr.role)
                   from core.service_roles sr where sr.org_id = m.org_id and sr.user_id = m.user_id), '{}'::jsonb)
  from core.memberships m
  join auth.users u on u.id = m.user_id
  left join core.profiles p on p.user_id = m.user_id
  where m.org_id = p_org and core.is_org_admin(p_org)
  order by case m.org_role when 'owner' then 0 when 'admin' then 1 else 2 end, p.full_name
$$;

-- Never leave an organization without an active owner (demoting, disabling or removing the last one)
create function core.keep_an_owner() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.org_role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.org_role <> 'owner' or new.status <> 'active')
     and exists (select 1 from core.organizations o where o.id = old.org_id)   -- deleting the whole organization is fine
     and not exists (select 1 from core.memberships m
                     where m.org_id = old.org_id and m.user_id <> old.user_id and m.org_role = 'owner' and m.status = 'active') then
    raise exception 'an organization must keep an active owner' using errcode = '23514';
  end if;
  return coalesce(new, old);
end
$$;
create trigger memberships_keep_owner before update or delete on core.memberships
  for each row execute function core.keep_an_owner();

revoke execute on function core.org_members(uuid), core.keep_an_owner() from public, anon;
grant execute on function core.org_members(uuid) to authenticated, service_role;
