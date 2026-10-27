-- core: identity, organizations, services and access. See docs/SCAFFOLD.md §5.

create schema if not exists core;

-- Catalogue of services the platform offers
create table core.services (
  key        text primary key,                 -- 'finance' | 'stock' | 'attendance'
  name       text not null,
  base_url   text not null,                    -- https://finance.<domain>
  roles      text[] not null,                  -- valid roles inside this service
  is_active  boolean not null default true
);

create table core.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  address     text,
  phone       text,
  logo_url    text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create table core.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  full_name      text,
  phone          text,
  avatar_url     text,
  active_org_id  uuid references core.organizations(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Person <-> organization
create table core.memberships (
  org_id      uuid not null references core.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_role    text not null check (org_role in ('owner', 'admin', 'member')),
  status      text not null default 'active' check (status in ('active', 'disabled')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on core.memberships (user_id);

-- Organization <-> service (subscription / entitlement)
create table core.org_services (
  org_id       uuid not null references core.organizations(id) on delete cascade,
  service_key  text not null references core.services(key),
  status       text not null default 'trial' check (status in ('trial', 'active', 'suspended')),
  plan         text,
  enabled_at   timestamptz not null default now(),
  primary key (org_id, service_key)
);

-- Person's role inside one service of one organization
create table core.service_roles (
  org_id       uuid not null,
  user_id      uuid not null,
  service_key  text not null,
  role         text not null,
  primary key (org_id, user_id, service_key),
  foreign key (org_id, user_id)     references core.memberships (org_id, user_id)     on delete cascade,
  foreign key (org_id, service_key) references core.org_services(org_id, service_key) on delete cascade
);
create index on core.service_roles (user_id);

create table core.invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references core.organizations(id) on delete cascade,
  email        text not null,
  org_role     text not null default 'member' check (org_role in ('admin', 'member')),
  service_roles jsonb not null default '{}',     -- {"finance":"accountant","attendance":"hr"}
  invited_by   uuid references auth.users(id),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz
);
create index on core.invitations (org_id);

-- Maps old per-app tenants to organizations during migration
create table core.legacy_tenant_map (
  service_key  text not null references core.services(key),
  legacy_id    text not null,                  -- old company_id / owner user id
  org_id       uuid not null references core.organizations(id),
  primary key (service_key, legacy_id)
);

create table core.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid,
  user_id     uuid,
  service_key text,
  action      text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index on core.audit_log (org_id, created_at);

insert into core.services (key, name, base_url, roles) values
  ('finance',    'Finance',              'https://finance.TBD',    array['admin','accountant','viewer']),
  ('stock',      'Auto Stock Manager',   'https://stock.TBD',      array['admin','stock_supervisor','parts_supervisor','social_media']),
  ('attendance', 'Attendance Nepal',     'https://attendance.TBD', array['admin','hr','employee']);

-- ---------------------------------------------------------------------------
-- Access helpers (used by RLS and by FastAPI)
-- security definer so policies can call them without recursing into RLS.
-- ---------------------------------------------------------------------------

-- The caller's org role ('owner' | 'admin' | 'member'), or null if not an active member
create or replace function core.org_role(p_org uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select m.org_role from core.memberships m
  where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
$$;

create or replace function core.is_org_admin(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(core.org_role(p_org) in ('owner', 'admin'), false)
$$;

-- The caller's role in a service for an org, or null if no access
create or replace function core.service_role(p_org uuid, p_service text)
returns text
language sql stable security definer set search_path = ''
as $$
  select sr.role
  from core.service_roles sr
  join core.memberships m
    on m.org_id = sr.org_id and m.user_id = sr.user_id and m.status = 'active'
  join core.org_services os
    on os.org_id = sr.org_id and os.service_key = sr.service_key and os.status in ('trial', 'active')
  where sr.org_id = p_org
    and sr.user_id = auth.uid()
    and sr.service_key = p_service
$$;

create or replace function core.has_service_access(p_org uuid, p_service text, p_roles text[] default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(r is not null and (p_roles is null or r = any (p_roles)), false)
  from (select core.service_role(p_org, p_service) as r) x
$$;

-- Everything the portal and services need after sign-in, in one call
create or replace function core.my_context()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id',       p.user_id,
    'full_name',     p.full_name,
    'active_org_id', p.active_org_id,
    'orgs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'org_role', m.org_role,
        'services', coalesce((
          select jsonb_object_agg(sr.service_key, sr.role)
          from core.service_roles sr
          join core.org_services os
            on os.org_id = sr.org_id and os.service_key = sr.service_key and os.status in ('trial', 'active')
          where sr.org_id = o.id and sr.user_id = p.user_id
        ), '{}'::jsonb)))
      from core.memberships m
      join core.organizations o on o.id = m.org_id
      where m.user_id = p.user_id and m.status = 'active'
    ), '[]'::jsonb)
  )
  from core.profiles p
  where p.user_id = auth.uid()
$$;

-- First sign-in: create an org with the caller as owner and make it active.
-- A function, because RLS cannot let a non-member insert the first owner membership.
create or replace function core.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  insert into core.organizations (name, slug, created_by)
    values (p_name, p_slug, auth.uid()) returning id into v_org;
  insert into core.memberships (org_id, user_id, org_role) values (v_org, auth.uid(), 'owner');
  update core.profiles set active_org_id = v_org where user_id = auth.uid();
  return v_org;
end
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function core.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into core.profiles (user_id, full_name)
    values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function core.handle_new_user();

-- A service role must be one the service defines (also guards service_role-key writes)
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
  return new;
end
$$;

create trigger service_roles_valid
  before insert or update on core.service_roles
  for each row execute function core.check_service_role();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Tables without a write policy are written only by the service role
-- (migration scripts, platform staff, billing).
-- ---------------------------------------------------------------------------

alter table core.services          enable row level security;
alter table core.organizations     enable row level security;
alter table core.profiles          enable row level security;
alter table core.memberships       enable row level security;
alter table core.org_services      enable row level security;
alter table core.service_roles     enable row level security;
alter table core.invitations       enable row level security;
alter table core.legacy_tenant_map enable row level security;
alter table core.audit_log         enable row level security;

create policy services_read on core.services for select to authenticated using (true);

create policy orgs_read   on core.organizations for select to authenticated
  using (core.org_role(id) is not null);
create policy orgs_update on core.organizations for update to authenticated
  using (core.is_org_admin(id)) with check (core.is_org_admin(id));

-- Own profile, plus profiles of people in a shared org (member lists)
create policy profiles_read on core.profiles for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from core.memberships m
    where m.user_id = profiles.user_id and core.org_role(m.org_id) is not null));
create policy profiles_update on core.profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and (active_org_id is null or core.org_role(active_org_id) is not null));

create policy memberships_read on core.memberships for select to authenticated
  using (core.org_role(org_id) is not null);
-- Admins manage members; only an owner may create, change or remove an owner row
create policy memberships_insert on core.memberships for insert to authenticated
  with check (core.is_org_admin(org_id) and (org_role <> 'owner' or core.org_role(org_id) = 'owner'));
create policy memberships_update on core.memberships for update to authenticated
  using      (core.is_org_admin(org_id) and (org_role <> 'owner' or core.org_role(org_id) = 'owner'))
  with check (core.is_org_admin(org_id) and (org_role <> 'owner' or core.org_role(org_id) = 'owner'));
create policy memberships_delete on core.memberships for delete to authenticated
  using (core.is_org_admin(org_id) and (org_role <> 'owner' or core.org_role(org_id) = 'owner'));

-- Admins can start a trial or remove a service; status/plan changes are billing (service role)
create policy org_services_read   on core.org_services for select to authenticated
  using (core.org_role(org_id) is not null);
create policy org_services_insert on core.org_services for insert to authenticated
  with check (core.is_org_admin(org_id) and status = 'trial' and plan is null);
create policy org_services_delete on core.org_services for delete to authenticated
  using (core.is_org_admin(org_id));

create policy service_roles_read  on core.service_roles for select to authenticated
  using (core.org_role(org_id) is not null);
create policy service_roles_write on core.service_roles for all to authenticated
  using (core.is_org_admin(org_id)) with check (core.is_org_admin(org_id));

create policy invitations_admin on core.invitations for all to authenticated
  using (core.is_org_admin(org_id)) with check (core.is_org_admin(org_id));

create policy audit_log_read on core.audit_log for select to authenticated
  using (core.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- Grants (custom schemas get none by default). RLS decides which rows.
-- ---------------------------------------------------------------------------

grant usage on schema core to authenticated, service_role;
grant select, insert, update, delete on all tables in schema core to authenticated;
grant all on all tables in schema core to service_role;
grant usage on all sequences in schema core to service_role;

revoke execute on all functions in schema core from public, anon;
grant execute on function
  core.org_role(uuid), core.is_org_admin(uuid),
  core.service_role(uuid, text), core.has_service_access(uuid, text, text[]),
  core.my_context(), core.create_organization(text, text)
  to authenticated, service_role;
