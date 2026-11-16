-- Owners and admins do not switch features themselves: they ask. A request lists what to turn on and off, platform staff
-- review it (optionally with a price), and approving it applies every change through core.set_feature, all or nothing.
-- shortcut: no in-app acceptance of a price, it is agreed with the customer outside the app; add one when billing per feature exists.

create table core.feature_requests (
  id            bigint generated always as identity primary key,
  org_id        uuid not null references core.organizations(id) on delete cascade,
  requested_by  uuid references auth.users(id),
  turn_on       text[] not null default '{}',
  turn_off      text[] not null default '{}',
  note          text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  quote_amount  numeric check (quote_amount >= 0),
  quote_note    text,
  decided_by    uuid references auth.users(id),
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now(),
  check (cardinality(turn_on) + cardinality(turn_off) > 0)
);
create unique index on core.feature_requests (org_id) where status = 'pending';  -- one open request per organization
create index on core.feature_requests (status, created_at);

alter table core.feature_requests enable row level security;
create policy feature_requests_read on core.feature_requests for select to authenticated
  using (core.is_org_admin(org_id) or core.is_platform_admin());
grant select on core.feature_requests to authenticated;
grant all on core.feature_requests to service_role;

-- An owner or admin asks. Checks the keys and that the result keeps every dependency, like set_feature will.
create function core.request_features(p_org uuid, p_on text[], p_off text[], p_note text default null) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare k text; f core.features; g text; v_on text[] := coalesce(p_on, '{}'); v_off text[] := coalesce(p_off, '{}'); v_id bigint;
begin
  if not core.is_org_admin(p_org) then raise exception 'only owners and admins can ask for features' using errcode = '42501'; end if;
  if v_on && v_off then raise exception 'a feature cannot be turned on and off in the same request'; end if;
  foreach k in array v_on || v_off loop
    select * into f from core.features where key = k and is_active;
    if not found then raise exception 'unknown feature %', k; end if;
    if not exists (select 1 from core.org_services where org_id = p_org and service_key = f.service_key) then
      raise exception 'your organization does not have %', f.service_key;
    end if;
  end loop;
  -- drop what is already the way they want it, so an empty request is refused
  v_on  := array(select x from unnest(v_on)  x where not core.feature_switch(p_org, x));
  v_off := array(select x from unnest(v_off) x where core.feature_switch(p_org, x));
  if cardinality(v_on) + cardinality(v_off) = 0 then raise exception 'nothing to change: those features are already as you asked'; end if;
  foreach k in array v_on loop
    select r into g from unnest((select requires from core.features where key = k)) r
      where not core.feature_switch(p_org, r) and r <> all (v_on) limit 1;
    if found then raise exception '% needs % as well', k, g; end if;
  end loop;
  foreach k in array v_off loop
    select key into g from core.features
      where k = any (requires) and core.feature_switch(p_org, key) and key <> all (v_off) limit 1;
    if found then raise exception '% is needed by %, turn that off too', k, g; end if;
  end loop;

  begin
    insert into core.feature_requests (org_id, requested_by, turn_on, turn_off, note)
      values (p_org, auth.uid(), v_on, v_off, nullif(btrim(p_note), '')) returning id into v_id;
  exception when unique_violation then
    raise exception 'you already have a request waiting for review; cancel it first to send a new one';
  end;
  return v_id;
end $$;

create function core.cancel_feature_request(p_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare r core.feature_requests;
begin
  select * into r from core.feature_requests where id = p_id;
  if not found or not core.is_org_admin(r.org_id) then raise exception 'request not found'; end if;
  if r.status <> 'pending' then raise exception 'this request was already decided'; end if;
  update core.feature_requests set status = 'cancelled', decided_by = auth.uid(), decided_at = now() where id = p_id;
end $$;

-- Staff: every request with the organization's name, open ones first
create function core.platform_feature_requests()
returns table (id bigint, org_id uuid, org_name text, requested_by_email text, turn_on text[], turn_off text[], note text, status text,
               quote_amount numeric, quote_note text, decision_note text, created_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform core.platform_guard();
  return query
    select r.id, r.org_id, o.name, u.email::text, r.turn_on, r.turn_off, r.note, r.status, r.quote_amount, r.quote_note,
           r.decision_note, r.created_at, r.decided_at
    from core.feature_requests r
    join core.organizations o on o.id = r.org_id
    left join auth.users u on u.id = r.requested_by
    order by (r.status = 'pending') desc, r.created_at desc limit 200;
end $$;

-- Staff decide. Approving applies every change in dependency order inside this one transaction, so a failure changes nothing.
create function core.decide_feature_request(p_id bigint, p_approve boolean, p_note text default null,
                                            p_amount numeric default null, p_quote_note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare r core.feature_requests; k text; v_note text := nullif(btrim(p_note), ''); v_reason text;
begin
  perform core.platform_guard();
  select * into r from core.feature_requests where id = p_id for update;
  if not found then raise exception 'request not found'; end if;
  if r.status <> 'pending' then raise exception 'this request was already decided'; end if;
  if not p_approve and v_note is null then raise exception 'give the customer a reason for declining'; end if;

  if p_approve then
    v_reason := 'Request #' || p_id || ' approved';
    -- parents before children when turning on, children before parents when turning off
    for k in select f.key from core.features f where f.key = any (r.turn_on) order by cardinality(f.requires), f.key loop
      if not core.feature_switch(r.org_id, k) then perform core.set_feature(r.org_id, k, true, v_reason); end if;
    end loop;
    for k in select f.key from core.features f where f.key = any (r.turn_off) order by cardinality(f.requires) desc, f.key loop
      if core.feature_switch(r.org_id, k) then perform core.set_feature(r.org_id, k, false, v_reason); end if;
    end loop;
  end if;

  update core.feature_requests
    set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now(),
        decision_note = v_note, quote_amount = p_amount, quote_note = nullif(btrim(p_quote_note), '')
    where id = p_id;
  insert into core.platform_audit (admin_id, org_id, action, detail)
    values (auth.uid(), r.org_id, 'feature_request:' || case when p_approve then 'approved' else 'rejected' end, '#' || p_id || coalesce(' - ' || v_note, ''));
  insert into core.notifications (org_id, kind, title, body)
    values (r.org_id, 'features',
            case when p_approve then 'Your feature request was approved' else 'Your feature request was declined' end,
            case when p_approve then 'The features you chose are now set up.' || coalesce(' ' || nullif(btrim(p_quote_note), ''), '')
                 else v_note end);
end $$;

revoke all on function core.request_features(uuid, text[], text[], text), core.cancel_feature_request(bigint),
  core.platform_feature_requests(), core.decide_feature_request(bigint, boolean, text, numeric, text) from public, anon;
grant execute on function core.request_features(uuid, text[], text[], text), core.cancel_feature_request(bigint),
  core.platform_feature_requests(), core.decide_feature_request(bigint, boolean, text, numeric, text) to authenticated;
