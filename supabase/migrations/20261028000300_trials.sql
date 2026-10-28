-- Trials end. Access stops at trial_ends_at, and owners/admins are warned 3 days before and when it ends.

-- Trial length: change the interval here. Existing trials get a fresh 14 days from when this runs.
alter table core.org_services add column trial_ends_at timestamptz not null default now() + interval '14 days';

-- Admins could delete a service and add it again to restart the trial, so only the service role may remove one
drop policy org_services_delete on core.org_services;

-- One notification per event, however often the generator runs
alter table core.notifications add column dedupe_key text;
create unique index notifications_dedupe_key on core.notifications (org_id, dedupe_key) where dedupe_key is not null;

-- A subscription is live when active, or on trial and not yet expired
create or replace function core.service_role(p_org uuid, p_service text)
returns text
language sql stable security definer set search_path = ''
as $$
  select sr.role
  from core.service_roles sr
  join core.memberships m
    on m.org_id = sr.org_id and m.user_id = sr.user_id and m.status = 'active'
  join core.org_services os
    on os.org_id = sr.org_id and os.service_key = sr.service_key
   and (os.status = 'active' or (os.status = 'trial' and os.trial_ends_at > now()))
  where sr.org_id = p_org
    and sr.user_id = auth.uid()
    and sr.service_key = p_service
$$;

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
        'verification_status', o.verification_status,
        'verification_note', o.verification_note,
        'services', coalesce((
          select jsonb_object_agg(sr.service_key, sr.role)
          from core.service_roles sr
          join core.org_services os
            on os.org_id = sr.org_id and os.service_key = sr.service_key
           and (os.status = 'active' or (os.status = 'trial' and os.trial_ends_at > now()))
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

-- Called when a member opens the portal: adds the "ending soon" and "ended" notices that are due
create function core.notify_trials(p_org uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if core.org_role(p_org) is null then
    return;
  end if;
  insert into core.notifications (org_id, kind, title, body, dedupe_key)
  select os.org_id, 'subscription',
    case when os.trial_ends_at > now()
      then s.name || ' trial ends in ' || ceil(extract(epoch from os.trial_ends_at - now()) / 86400)::int
           || case when ceil(extract(epoch from os.trial_ends_at - now()) / 86400) = 1 then ' day' else ' days' end
      else s.name || ' trial has ended' end,
    case when os.trial_ends_at > now()
      then 'Contact us to subscribe before ' || to_char(os.trial_ends_at at time zone 'Asia/Kathmandu', 'DD Mon YYYY') || ' to keep access.'
      else 'Access has stopped for your organization. Contact us to subscribe and restore it.' end,
    os.service_key || case when os.trial_ends_at > now() then ':ending' else ':ended' end
  from core.org_services os
  join core.services s on s.key = os.service_key
  where os.org_id = p_org and os.status = 'trial' and os.trial_ends_at <= now() + interval '3 days'
  on conflict (org_id, dedupe_key) where dedupe_key is not null do nothing;
end
$$;

revoke execute on function core.notify_trials(uuid) from public, anon;
grant execute on function core.notify_trials(uuid) to authenticated, service_role;
