-- Per-organization features (contract in docs/FEATURE-FLAGS.md).
-- The catalogue (core.features) is filled by each service's own migration, not here.

create table core.features (
  key         text primary key,                                -- 'finance.emi'
  service_key text not null references core.services(key),
  name        text not null,
  description text not null,
  requires    text[] not null default '{}',                    -- feature keys that must be on
  default_on  boolean not null default true,                   -- value for orgs with no row
  is_active   boolean not null default true,
  check (key like service_key || '.%')
);

create table core.org_features (
  org_id      uuid not null references core.organizations(id) on delete cascade,
  feature_key text not null references core.features(key),
  enabled     boolean not null,
  config      jsonb not null default '{}',
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  primary key (org_id, feature_key)
);

alter table core.features     enable row level security;
alter table core.org_features enable row level security;
create policy features_read     on core.features     for select to authenticated using (true);
create policy org_features_read on core.org_features for select to authenticated
  using (core.org_role(org_id) is not null);
-- Writes go through core.set_feature, which checks dependencies and writes the audit row
grant select on core.features, core.org_features to authenticated;
grant all on core.features, core.org_features to service_role;

-- The org's own switch, ignoring service access: row (or default) and every `requires` on.
-- shortcut: no cycle check on `requires`, the catalogue is curated; add one if services can edit it.
create function core.feature_switch(p_org uuid, p_feature text) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare f core.features; o boolean; r text;
begin
  select * into f from core.features where key = p_feature;
  if not found or not f.is_active then return false; end if;
  select enabled into o from core.org_features where org_id = p_org and feature_key = p_feature;
  if not coalesce(o, f.default_on) then return false; end if;
  foreach r in array f.requires loop
    if not core.feature_switch(p_org, r) then return false; end if;
  end loop;
  return true;
end $$;

-- What services call: the service is live for the caller (same rule as has_service_access) and the switch is on
create function core.feature_on(p_org uuid, p_feature text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select core.has_service_access(p_org, f.service_key) and core.feature_switch(p_org, f.key)
                   from core.features f where f.key = p_feature), false)
$$;

-- Everything the UI needs for one org, for members only
create function core.org_features(p_org uuid)
returns table (feature_key text, enabled boolean, config jsonb)
language sql stable security definer set search_path = ''
as $$
  select f.key, core.feature_on(p_org, f.key), coalesce(o.config, '{}')
  from core.features f
  join core.org_services s on s.org_id = p_org and s.service_key = f.service_key
  left join core.org_features o on o.org_id = p_org and o.feature_key = f.key
  where core.org_role(p_org) is not null and f.is_active
$$;

-- Owners and admins switch a feature; refuses a switch that breaks a dependency
create function core.set_feature(p_org uuid, p_feature text, p_enabled boolean, p_config jsonb default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare f core.features; r text; g text;
begin
  if not core.is_org_admin(p_org) then raise exception 'only owners and admins can change features'; end if;
  select * into f from core.features where key = p_feature and is_active;
  if not found then raise exception 'unknown feature %', p_feature; end if;
  if not exists (select 1 from core.org_services where org_id = p_org and service_key = f.service_key) then
    raise exception 'the organization does not have %', f.service_key;
  end if;
  if p_enabled then
    foreach r in array f.requires loop
      if not core.feature_switch(p_org, r) then raise exception '% needs % switched on first', p_feature, r; end if;
    end loop;
  else
    select key into g from core.features
      where p_feature = any (requires) and core.feature_switch(p_org, key) limit 1;
    if found then raise exception '% is needed by %, switch that off first', p_feature, g; end if;
  end if;

  insert into core.org_features (org_id, feature_key, enabled, config, updated_by)
  values (p_org, p_feature, p_enabled, coalesce(p_config, '{}'), auth.uid())
  on conflict (org_id, feature_key) do update
    set enabled = excluded.enabled, config = coalesce(p_config, core.org_features.config),
        updated_by = excluded.updated_by, updated_at = now();
  insert into core.audit_log (org_id, user_id, service_key, action, detail)
  values (p_org, auth.uid(), f.service_key, 'feature_set',
          jsonb_build_object('feature', p_feature, 'enabled', p_enabled, 'config', p_config));
end $$;

revoke execute on function core.feature_switch(uuid, text), core.feature_on(uuid, text),
  core.org_features(uuid), core.set_feature(uuid, text, boolean, jsonb) from public, anon;
grant execute on function core.feature_on(uuid, text), core.org_features(uuid),
  core.set_feature(uuid, text, boolean, jsonb) to authenticated, service_role;
