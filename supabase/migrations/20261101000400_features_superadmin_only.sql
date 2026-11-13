-- Feature switches are changed by platform staff only (never by an organization's own owners or admins).
-- Every change needs a written reason and lands in core.platform_audit; the org's own audit log shows what changed.
-- Replaces set_feature from 20261101000000 (no caller yet: the app only reads flags).

drop function core.set_feature(uuid, text, boolean, jsonb);

create function core.set_feature(p_org uuid, p_feature text, p_enabled boolean, p_reason text, p_config jsonb default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  f core.features; r text; g text; v_reason text := nullif(btrim(p_reason), ''); v_was boolean;
begin
  perform core.platform_guard();
  if v_reason is null then raise exception 'give a reason for the change'; end if;
  select * into f from core.features where key = p_feature and is_active;
  if not found then raise exception 'unknown feature %', p_feature; end if;
  if not exists (select 1 from core.org_services where org_id = p_org and service_key = f.service_key) then
    raise exception 'the organization does not have %', f.service_key;
  end if;

  v_was := core.feature_switch(p_org, p_feature);
  if p_enabled then
    foreach r in array f.requires loop
      if not core.feature_switch(p_org, r) then raise exception '% needs % switched on first', p_feature, r; end if;
    end loop;
  else
    select key into g from core.features
      where p_feature = any (requires) and core.feature_switch(p_org, key) limit 1;
    if found then raise exception '% is needed by %, switch that off first', p_feature, g; end if;
  end if;
  if v_was = p_enabled and p_config is null then raise exception '% is already %', p_feature, case when p_enabled then 'on' else 'off' end; end if;

  insert into core.org_features (org_id, feature_key, enabled, config, updated_by)
  values (p_org, p_feature, p_enabled, coalesce(p_config, '{}'), auth.uid())
  on conflict (org_id, feature_key) do update
    set enabled = excluded.enabled, config = coalesce(p_config, core.org_features.config),
        updated_by = excluded.updated_by, updated_at = now();
  insert into core.platform_audit (admin_id, org_id, action, detail)
    values (auth.uid(), p_org, 'feature:' || p_feature, (case when p_enabled then 'on' else 'off' end) || ' - ' || v_reason);
  insert into core.audit_log (org_id, user_id, service_key, action, detail)
    values (p_org, auth.uid(), f.service_key, 'feature_set', jsonb_build_object('feature', p_feature, 'enabled', p_enabled));
end $$;

-- One org's features as staff see them: the switch itself, whether the org has a saved row, and what each needs
create function core.platform_org_features(p_org uuid)
returns table (feature_key text, service_key text, name text, description text, requires text[], enabled boolean, default_on boolean, has_row boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform core.platform_guard();
  return query
    select f.key, f.service_key, f.name, f.description, f.requires, core.feature_switch(p_org, f.key), f.default_on,
           exists (select 1 from core.org_features o where o.org_id = p_org and o.feature_key = f.key)
    from core.features f
    join core.org_services s on s.org_id = p_org and s.service_key = f.service_key
    where f.is_active order by f.service_key, f.key;
end $$;

revoke all on function core.set_feature(uuid, text, boolean, text, jsonb), core.platform_org_features(uuid) from public, anon;
grant execute on function core.set_feature(uuid, text, boolean, text, jsonb), core.platform_org_features(uuid) to authenticated;
