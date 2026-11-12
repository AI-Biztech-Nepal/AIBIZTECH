-- Finance's feature catalogue and per-org backfill (source: FINANCE-NEPAL supabase/feature-backfill/finance.json).
-- Backfill = what each org sees today; everyone else gets no row and reads the default (off).

insert into core.features (key, service_key, name, description, requires, default_on) values
  ('finance.vehicles', 'finance', 'Vehicle accounts',
   'Names the vehicle on bills, ledgers and reports, adds a Model No. to purchase bills, and splits Stock (what is in hand) from Inventory (every vehicle).', '{}', false),
  ('finance.rent', 'finance', 'Rent',
   'Give vehicles out on rent by the day. The daily rent is posted to the renter''s ledger and counts as income.', '{}', false),
  ('finance.emi', 'finance', 'EMI',
   'Sell or buy vehicles on monthly instalments, with a plan and a schedule for each vehicle.', '{}', false);

insert into core.org_features (org_id, feature_key, enabled)
select o.id, f.key, true
from core.organizations o, core.features f
where o.slug = 'deeva-auto-enterprises' and f.service_key = 'finance'
on conflict do nothing;

-- Vehicle accounts: the old switch, or a business name that reads "Deeva Auto"
insert into core.org_features (org_id, feature_key, enabled)
select o.org_id, f.key, true
from (select org_id from finance.org_settings where sells_vehicles
      union select id from core.organizations where name ~* '\ydee?va\s+auto\y') o,
     core.features f
where f.service_key = 'finance'
on conflict do nothing;

-- Orgs that already hold rentals or EMI plans keep those pages
insert into core.org_features (org_id, feature_key, enabled)
select distinct owner_id, 'finance.rent', true from finance.rentals on conflict do nothing;
insert into core.org_features (org_id, feature_key, enabled)
select distinct owner_id, 'finance.emi', true from finance.emi_plans on conflict do nothing;
