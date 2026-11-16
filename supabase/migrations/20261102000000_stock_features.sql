-- Stock's feature catalogue and per-org backfill (plan: docs/STOCK-FEATURES-DRAFT.md).
-- New orgs read the defaults below. Hamro G&G Auto stays exactly as live today: everything on except finance_sync.
-- Deeva does not use Stock, so it gets no rows.

insert into core.features (key, service_key, name, description, requires, default_on) values
  ('stock.vehicles', 'stock', 'Vehicle pack',
   'Vehicle details on items: chassis and engine numbers, engine size, odometer, bluebook, insurance, tax clearance and ownership papers.', '{}', false),
  ('stock.sanakhat', 'stock', 'Sanakhat and name transfer',
   'Track name-transfer and sanakhat paperwork on sold vehicles, with its own desk for the staff who handle it.', '{stock.vehicles}', false),
  ('stock.job_cards', 'stock', 'Job cards and repair status',
   'Repair and service jobs, and the In Repair and Scrap statuses on stock.', '{}', false),
  ('stock.spare_parts', 'stock', 'Spare parts',
   'A parts store with kits and sets, stock-out and a parts department role.', '{}', false),
  ('stock.warranty', 'stock', 'Warranty',
   'Give sold items a warranty period, void or restore it, and count after-sale services.', '{}', true),
  ('stock.bookings', 'stock', 'Bookings',
   'Reserve stock for a customer before the sale.', '{}', true),
  ('stock.crm', 'stock', 'CRM',
   'Lead status, follow-ups and contact history for every customer.', '{}', true),
  ('stock.ai_assistant', 'stock', 'AI assistant',
   'Ask questions about your stock and sales, and get price suggestions.', '{}', true),
  ('stock.leads', 'stock', 'Website leads',
   'Receive enquiries from your own website into the Leads screen, with a key you can replace at any time.', '{}', false),
  ('stock.public_site', 'stock', 'Public site',
   'A public page for your stock on your own domain.', '{}', false),
  ('stock.share', 'stock', 'Social sharing',
   'Share items to Facebook and WhatsApp with a photo card and caption.', '{}', false),
  ('stock.visits', 'stock', 'Website visits',
   'See visits to your public site.', '{stock.public_site}', false),
  ('stock.offers', 'stock', 'Offers and spin wheel',
   'Run a festival offer with prizes and codes on your public site.', '{stock.public_site}', false),
  ('stock.finance_sync', 'stock', 'Post to Finance',
   'Send sales, vendor payments and expenses to your Finance books automatically, so you enter each once.', '{}', false);

-- Hamro G&G Auto: every feature on, so nothing it uses today can disappear, except finance_sync
-- (its Finance books are moved over first, then reconciled, before posting starts).
insert into core.org_features (org_id, feature_key, enabled)
select o.id, f.key, f.key <> 'stock.finance_sync'
from core.organizations o, core.features f
where o.name ~* '\yhamro\s+g\s*&\s*g\y' and f.service_key = 'stock'
on conflict do nothing;
