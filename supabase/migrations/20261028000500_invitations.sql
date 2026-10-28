-- Invitations: owners/admins create them through a function, the invitee accepts through a function.
-- The invitation id is the secret in the link. Accepting also requires the signed-in email to match.

-- Direct writes would bypass the checks below (invited_by, valid roles, no double invites)
revoke insert, update on core.invitations from authenticated;

create function core.create_invitation(p_org uuid, p_email text, p_org_role text, p_service_roles jsonb default '{}')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_roles jsonb := coalesce(p_service_roles, '{}'::jsonb);
  v_id uuid;
  r record;
begin
  if not core.is_org_admin(p_org) then
    raise exception 'only owners and admins can invite people' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'enter a valid email address' using errcode = '22023';
  end if;
  if p_org_role not in ('admin', 'member') then
    raise exception 'organization role must be admin or member' using errcode = '22023';
  end if;
  if exists (select 1 from core.memberships m join auth.users u on u.id = m.user_id
             where m.org_id = p_org and lower(u.email) = v_email) then
    raise exception 'that person is already a member' using errcode = '22023';
  end if;
  for r in select key, value from jsonb_each_text(v_roles) loop
    if not exists (select 1 from core.org_services os join core.services s on s.key = os.service_key
                   where os.org_id = p_org and os.service_key = r.key and r.value = any (s.roles)) then
      raise exception 'invalid role for service %: enable the service and pick one of its roles', r.key using errcode = '22023';
    end if;
  end loop;

  -- A new invitation replaces any open one for the same email
  delete from core.invitations where org_id = p_org and lower(email) = v_email and accepted_at is null;
  insert into core.invitations (org_id, email, org_role, service_roles, invited_by)
    values (p_org, v_email, p_org_role, v_roles, auth.uid())
    returning id into v_id;
  return v_id;
end
$$;

-- What the invitee sees before accepting; signed-in users only
create function core.invitation_preview(p_id uuid)
returns table (org_name text, email text, org_role text, state text)
language sql stable security definer set search_path = ''
as $$
  select o.name, i.email, i.org_role,
         case when i.accepted_at is not null then 'accepted'
              when i.expires_at <= now() then 'expired' else 'open' end
  from core.invitations i join core.organizations o on o.id = i.org_id
  where i.id = p_id and auth.uid() is not null
$$;

create function core.accept_invitation(p_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  v core.invitations;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select lower(email) into v_email from auth.users where id = auth.uid();

  -- One organization per person for now
  if exists (select 1 from core.memberships where user_id = auth.uid()) then
    raise exception 'you already belong to an organization' using errcode = '22023';
  end if;

  -- Claiming the row first means a link can be used once, even by two clicks at once
  update core.invitations set accepted_at = now()
    where id = p_id and accepted_at is null and expires_at > now() and lower(email) = v_email
    returning * into v;
  if v.id is null then
    raise exception 'this invitation is invalid, expired, already used, or meant for a different email address' using errcode = '22023';
  end if;

  insert into core.memberships (org_id, user_id, org_role) values (v.org_id, auth.uid(), v.org_role);
  -- Roles on services that were switched off since the invite was sent are skipped
  insert into core.service_roles (org_id, user_id, service_key, role)
    select v.org_id, auth.uid(), r.key, r.value
    from jsonb_each_text(v.service_roles) r
    where exists (select 1 from core.org_services os where os.org_id = v.org_id and os.service_key = r.key);
  update core.profiles set active_org_id = v.org_id where user_id = auth.uid();
  return v.org_id;
end
$$;

revoke execute on function core.create_invitation(uuid, text, text, jsonb), core.invitation_preview(uuid),
  core.accept_invitation(uuid) from public, anon;
grant execute on function core.create_invitation(uuid, text, text, jsonb), core.invitation_preview(uuid),
  core.accept_invitation(uuid) to authenticated, service_role;
