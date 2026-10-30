-- Per-org Finance settings. The Finance app used to pick Deeva's vehicle screens by regex on one user's
-- business name; the flag now belongs to the org, so every member of it sees the same app.
create table finance.org_settings (
  org_id         uuid primary key references core.organizations(id) on delete cascade,
  sells_vehicles boolean not null default false
);
alter table finance.org_settings enable row level security;

create policy org_settings_read on finance.org_settings for select to authenticated
  using (core.has_service_access(org_id, 'finance'));
create policy org_settings_admin_write on finance.org_settings for all to authenticated
  using (core.has_service_access(org_id, 'finance', array['admin']))
  with check (core.has_service_access(org_id, 'finance', array['admin']));

grant select, insert, update, delete on finance.org_settings to authenticated, service_role, finance_svc;

-- Deeva Auto Enterprises sells vehicles (no-op where the org does not exist, e.g. a fresh dev DB).
insert into finance.org_settings (org_id, sells_vehicles)
  select id, true from core.organizations where slug = 'deeva-auto-enterprises'
  on conflict (org_id) do update set sells_vehicles = true;
