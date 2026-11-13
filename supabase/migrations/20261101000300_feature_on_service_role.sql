-- feature_on borrowed has_service_access, which needs a signed-in user, so jobs run as the service role
-- (nightly syncs, billing) always saw every feature as off. With no user, ask only whether the service is live.
create or replace function core.feature_on(p_org uuid, p_feature text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select (case when auth.uid() is null
                 then exists (select 1 from core.org_services os
                              where os.org_id = p_org and os.service_key = f.service_key
                                and (os.status = 'active' or (os.status = 'trial' and os.trial_ends_at > now())))
                 else core.has_service_access(p_org, f.service_key) end)
           and core.feature_switch(p_org, f.key)
    from core.features f where f.key = p_feature), false)
$$;
