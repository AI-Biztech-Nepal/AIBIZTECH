-- Platform console: a short list of staff accounts that can review organizations and manage subscriptions.
-- Everything goes through the functions below, which check core.is_platform_admin() themselves,
-- so the web app needs no service-role key and no table is readable across organizations.
--
-- Add yourself once, in the SQL editor:
--   insert into core.platform_admins (user_id) select id from auth.users where email = 'you@example.com';

create table core.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table core.platform_admins enable row level security; -- no policies: only the functions read it

create table core.platform_audit (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users(id) on delete set null,
  org_id      uuid references core.organizations(id) on delete set null,
  action      text not null,
  detail      text,
  created_at  timestamptz not null default now()
);
alter table core.platform_audit enable row level security;

create function core.is_platform_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from core.platform_admins where user_id = auth.uid()) $$;

create function core.platform_guard() returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not core.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
end
$$;

-- Numbers and queues for the overview page
create function core.platform_overview() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform core.platform_guard();
  return jsonb_build_object(
    'orgs', (select jsonb_build_object(
        'total', count(*),
        'pending', count(*) filter (where verification_status = 'pending'),
        'verified', count(*) filter (where verification_status = 'verified'),
        'rejected', count(*) filter (where verification_status = 'rejected'),
        'new_7d', count(*) filter (where created_at > now() - interval '7 days'))
      from core.organizations),
    'users', (select count(*) from core.profiles),
    'services', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.name) from (
        select s.key, s.name,
          count(os.org_id) filter (where os.status = 'active') as active,
          count(os.org_id) filter (where os.status = 'trial' and os.trial_ends_at > now()) as trial,
          count(os.org_id) filter (where os.status = 'trial' and os.trial_ends_at > now() and os.trial_ends_at <= now() + interval '3 days') as ending,
          count(os.org_id) filter (where os.status = 'trial' and os.trial_ends_at <= now()) as expired,
          count(os.org_id) filter (where os.status = 'suspended') as suspended
        from core.services s left join core.org_services os on os.service_key = s.key
        where s.is_active group by s.key, s.name) t), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select id, name, owner_name, created_at from core.organizations
        where verification_status = 'pending' order by created_at limit 5) t), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select id, name, verification_status, created_at from core.organizations order by created_at desc limit 6) t), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select a.action, a.detail, a.created_at, a.org_id, o.name as org_name, p.full_name as admin_name
        from core.platform_audit a
        left join core.organizations o on o.id = a.org_id
        left join core.profiles p on p.user_id = a.admin_id
        order by a.id desc limit 8) t), '[]'::jsonb)
  );
end
$$;

-- Organizations list: filter by review status, search by name, owner, email or PAN
create function core.platform_orgs(p_status text default null, p_search text default null, p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_search text := nullif(btrim(p_search), '');
begin
  perform core.platform_guard();
  return jsonb_build_object(
    'counts', (select jsonb_build_object(
        'all', count(*),
        'pending', count(*) filter (where verification_status = 'pending'),
        'verified', count(*) filter (where verification_status = 'verified'),
        'rejected', count(*) filter (where verification_status = 'rejected'))
      from core.organizations),
    'total', (select count(*) from core.organizations o
        where (p_status is null or o.verification_status = p_status)
          and (v_search is null or strpos(lower(concat_ws(' ', o.name, o.owner_name, o.owner_email, o.pan_no)), lower(v_search)) > 0)),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (
        select o.id, o.name, o.verification_status, o.created_at, o.owner_name, o.owner_email, o.pan_no,
          (select count(*) from core.memberships m where m.org_id = o.id) as members,
          coalesce((select jsonb_agg(jsonb_build_object('key', os.service_key, 'status', os.status, 'trial_ends_at', os.trial_ends_at) order by os.service_key)
                    from core.org_services os where os.org_id = o.id), '[]'::jsonb) as services
        from core.organizations o
        where (p_status is null or o.verification_status = p_status)
          and (v_search is null or strpos(lower(concat_ws(' ', o.name, o.owner_name, o.owner_email, o.pan_no)), lower(v_search)) > 0)
        order by o.created_at desc
        limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) t), '[]'::jsonb)
  );
end
$$;

-- One organization: details, review state, services and people
create function core.platform_org(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  perform core.platform_guard();
  select to_jsonb(t) into v from (
    select o.id, o.name, o.address, o.phone, o.email, o.owner_name, o.owner_address, o.owner_phone, o.owner_email,
           o.pan_no, o.pan_photo_path, o.verification_status, o.verification_note, o.verified_at, o.created_at,
           o.business_type, o.business_needs, o.team_size
    from core.organizations o where o.id = p_org) t;
  if v is null then raise exception 'organization not found' using errcode = 'P0002'; end if;
  return v || jsonb_build_object(
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('key', s.key, 'name', s.name, 'status', os.status, 'trial_ends_at', os.trial_ends_at, 'enabled_at', os.enabled_at,
               'people', (select count(*) from core.service_roles sr where sr.org_id = p_org and sr.service_key = s.key)) order by s.name)
      from core.org_services os join core.services s on s.key = os.service_key where os.org_id = p_org), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.full_name, 'email', u.email, 'org_role', m.org_role, 'status', m.status) order by
               case m.org_role when 'owner' then 0 when 'admin' then 1 else 2 end, p.full_name)
      from core.memberships m join auth.users u on u.id = m.user_id left join core.profiles p on p.user_id = m.user_id
      where m.org_id = p_org), '[]'::jsonb));
end
$$;

-- Approve or reject an organization. A rejection needs a reason, which the owner sees on their home page.
create function core.platform_review_org(p_org uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
begin
  perform core.platform_guard();
  if p_status not in ('verified', 'rejected', 'pending') then raise exception 'status must be verified, rejected or pending'; end if;
  if p_status = 'rejected' and v_note is null then raise exception 'give a reason for the rejection'; end if;
  update core.organizations set
    verification_status = p_status,
    verification_note = case when p_status = 'rejected' then v_note end,
    verified_at = case when p_status = 'verified' then now() end,
    verified_by = case when p_status = 'verified' then auth.uid() end
  where id = p_org;
  if not found then raise exception 'organization not found' using errcode = 'P0002'; end if;
  insert into core.platform_audit (admin_id, org_id, action, detail) values (auth.uid(), p_org, 'review:' || p_status, v_note);
end
$$;

-- Change a subscription: activate (paid), suspend, put back on trial, and/or extend the trial
create function core.platform_set_service(p_org uuid, p_service text, p_status text default null, p_extend_days int default 0) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform core.platform_guard();
  if p_status is not null and p_status not in ('trial', 'active', 'suspended') then raise exception 'status must be trial, active or suspended'; end if;
  if p_extend_days < 0 or p_extend_days > 90 then raise exception 'extend by 0 to 90 days'; end if;
  update core.org_services set
    status = coalesce(p_status, status),
    trial_ends_at = case when p_extend_days > 0 then greatest(trial_ends_at, now()) + make_interval(days => p_extend_days) else trial_ends_at end
  where org_id = p_org and service_key = p_service;
  if not found then raise exception 'organization does not have this service' using errcode = 'P0002'; end if;
  insert into core.platform_audit (admin_id, org_id, action, detail)
    values (auth.uid(), p_org, 'service:' || p_service, concat_ws(', ', p_status, case when p_extend_days > 0 then 'trial +' || p_extend_days || ' days' end));
end
$$;

revoke all on function core.is_platform_admin(), core.platform_guard(), core.platform_overview(), core.platform_orgs(text, text, int, int),
  core.platform_org(uuid), core.platform_review_org(uuid, text, text), core.platform_set_service(uuid, text, text, int) from public, anon;
grant execute on function core.is_platform_admin(), core.platform_overview(), core.platform_orgs(text, text, int, int),
  core.platform_org(uuid), core.platform_review_org(uuid, text, text), core.platform_set_service(uuid, text, text, int) to authenticated;
