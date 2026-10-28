-- Subscription and verification notifications for an organization's owners and admins.
-- Rows are written only by the triggers below; users can read them and mark them read.

create table core.notifications (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references core.organizations(id) on delete cascade,
  kind        text not null,            -- 'subscription' | 'verification'
  title       text not null,
  body        text,
  created_at  timestamptz not null default now()
);
create index on core.notifications (org_id, created_at desc);

-- Read state is per person, because a notification belongs to the whole organization
create table core.notification_reads (
  notification_id  bigint not null references core.notifications(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  primary key (notification_id, user_id)
);

alter table core.notifications      enable row level security;
alter table core.notification_reads enable row level security;

create policy notifications_read on core.notifications for select to authenticated
  using (core.is_org_admin(org_id));
create policy notification_reads_read on core.notification_reads for select to authenticated
  using (user_id = auth.uid());
-- The exists() runs under notifications' own policy, so you can only mark what you can see
create policy notification_reads_insert on core.notification_reads for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from core.notifications n where n.id = notification_id));

grant select on core.notifications to authenticated;
grant select, insert on core.notification_reads to authenticated;
grant all on core.notifications, core.notification_reads to service_role;

create function core.notify_org_service() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := (select name from core.services where key = new.service_key);
begin
  if tg_op = 'INSERT' then
    insert into core.notifications (org_id, kind, title, body)
      values (new.org_id, 'subscription', v_name || ' trial started', 'Your organization can now use ' || v_name || '.');
  elsif new.status is distinct from old.status then
    insert into core.notifications (org_id, kind, title, body)
      values (new.org_id, 'subscription',
        case new.status
          when 'active'    then v_name || ' subscription is active'
          when 'suspended' then v_name || ' has been suspended'
          else v_name || ' is back on trial' end,
        case new.status
          when 'active'    then 'Thank you. ' || v_name || ' stays available to your organization.'
          when 'suspended' then 'Access is paused for everyone in your organization. Contact support to restore it.'
          else 'Your organization is trying ' || v_name || ' again.' end);
  end if;
  return null;
end
$$;
create trigger org_services_notify after insert or update on core.org_services
  for each row execute function core.notify_org_service();

create function core.notify_org_verification() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.verification_status is not distinct from old.verification_status then
    return null;
  end if;
  insert into core.notifications (org_id, kind, title, body)
    values (new.id, 'verification',
      case new.verification_status
        when 'verified' then 'Organization verified'
        when 'rejected' then 'Verification rejected'
        else 'Verification pending' end,
      case new.verification_status
        when 'verified' then 'You can now start services for your organization.'
        when 'rejected' then coalesce(new.verification_note, 'Contact support for details.')
        else 'We are reviewing your details. Services unlock once your organization is verified.' end);
  return null;
end
$$;
create trigger organizations_notify after insert or update on core.organizations
  for each row execute function core.notify_org_verification();

revoke execute on function core.notify_org_service(), core.notify_org_verification() from public, anon, authenticated;
