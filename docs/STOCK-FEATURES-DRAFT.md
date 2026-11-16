# Stock feature inventory (draft, Step 0) + integration findings

Read from `Auto-Stock-Manager` `main`: `backend/server.py` (190 routes, all listed), `crm.py`, `finance_books.py`, `schema.sql`, `permissions.js`, `Layout.jsx`, `PRODUCT.md`.
**Not confirmed.** I cannot see which company uses what in production, so every existing org is backfilled ON for what it has today. Tell me what to change.

## Inventory

Goal: any business can use Stock. Automobile-only parts are optional packs, **off for new orgs**.

| Key | Name | Needs | New orgs | Touches |
|---|---|---|---|---|
| `stock.vehicles` | Vehicle pack | | off | `vehicles` columns chassis/engine/CC/bluebook/insurance/tax/ownership/odometer, `/vehicles/*` vehicle forms, `legal_documents`, `/vehicles/{id}/qr-data` |
| `stock.sanakhat` | Sanakhat and name transfer | `stock.vehicles` | off | `/sanakhat/vehicles*`, `/vehicles/{id}/sale-statuses`, `sanakhat_*`/`ownership_*`/`transfer_status`, role `sanakhat_officer` |
| `stock.job_cards` | Job cards and repair status | | off | `/jobs*`, `job_cards`, status `in_repair`, `PARTS_ALLOWED_STATUSES`, page `/jobs` |
| `stock.spare_parts` | Spare parts | | off | `/spare-parts*` (kits, set components, stock-out), `spare_parts`, `part_transactions`, `kit_components`, role `parts_supervisor`; `stock.job_cards` uses it when both on |
| `stock.warranty` | Warranty | | on | `/warranties*`, `warranty_*` columns, WarrantyBadge, service count; **today vehicle-only, must be generalised to any sold item** |
| `stock.bookings` | Bookings and reservations | | on | `/bookings*`, `bookings`, status `reserved` |
| `stock.crm` | CRM | | on | `/crm/*`, `crm_followups`, `crm_interactions`, customer lead status |
| `stock.leads` | Website leads | | off | `/leads*`, `/public/leads*`, `leads` |
| `stock.public_site` | Public storefront | | off | `/public/*` (items, settings), per-org address (slug or domain), `_scope_to_default_company` |
| `stock.offers` | Offers and spin wheel | `stock.public_site` | off | `/offers/dashain*`, `/public/offers/*`, `offer_prizes`, `offer_codes` |
| `stock.share` | Social sharing | | off | `/share/*`, `/facebook/*`, `facebook_pages`, `/public/share/{vid}` |
| `stock.visits` | Website visits | `stock.public_site` | off | `/visits/*`, `/public/visit`, `page_views` |
| `stock.ai_assistant` | AI assistant | | on | `/ai/*`, `/assistant/*`, `ai_chat_sessions` |

**Core (not flags):** dashboard, items inventory (new generic core), sales, customers, vendors and vendor payments, staff, reports, expenses, photos, settings, team, audit log, backups.

**Not flagged on purpose:**
- `/fin/*` (books, ledgers, quotations, rentals, journal), `/emi*`, `/finance/summary`, `/partners*`: this duplicates the Finance service (`finance.emi`, `finance.rent`). Proposal: hand over to Finance, then remove from Stock. EMI and Partners are already hidden in the Stock UI.
- `/sync/*`, `/admin/*`, `/platform/*`, `/auth/*`: infrastructure. `/auth/*` and `/platform/*` are replaced by the portal.

## Findings for Prompt 0 (what stands between Stock and `core.feature_on`)

1. **Database: good news.** Stock's data is in its own Supabase Postgres project (`DB_BACKEND=postgres`, `pgdb.py`, 45 tables, `company_id` text keys). So it can be copied into the portal project as a `stock` schema with the same method as Finance and Attendance (`scripts/migrate`). The backend uses a Mongo-style wrapper over psycopg, not Supabase RLS, so database guards mean policies or functions on the portal `stock` schema plus checks in the API.
2. **Auth: not on the portal.** Stock signs its own HS256 tokens with `JWT_SECRET` (`get_current_user`, `/auth/*`), has its own `companies` and `users` tables and its own roles (`admin`, `stock_supervisor`, `parts_supervisor`, `social_media`, `sanakhat_officer`, `platform_owner`). Needs the Family B work from `SCAFFOLD.md`: verify the portal JWT, resolve the role from `core`, drop sign-up and staff screens. `core.services.stock` already lists the roles `admin, stock_supervisor, parts_supervisor, social_media`; `sanakhat_officer` is missing there.
3. **`company_id` to org.** Companies are text UUIDs created by `/auth/signup`. They need a company to org mapping in the copy (as Finance did: org id = old company id) and a decision for users who exist in several companies.
4. **Public endpoints serve one company only, and you want leads, share and visits for every business.** `/public/*` is scoped by `_scope_to_default_company`, whose own comment says per-company routing was skipped "because nothing has asked for it yet". Now it is asked for, so `stock.public_site` is a real prerequisite: each org gets a public address (slug or domain), every `/public/*` call resolves the org from it, and the flag check goes inside the handler (anonymous callers, `security definer` rule). Without it `stock.leads` and `stock.visits` only work for the first company.
   - Leads today are dealership-shaped: types Sell / Exchange / Book Service, columns `vehicle_type`, `requested_service`, `vehicle_id`. For other businesses the lead form must be generic (name, phone, message, optional item). Keep the old fields working for orgs with `stock.vehicles`.
   - Share: `storefront_url` is only returned for the default company, captions and `/public/share/{vid}` are vehicle pages. They become item pages (photo card via Open Graph) for any org with `stock.public_site`.
   - Visits: `page_views` already has `company_id`, so it is the easy one once routing exists.
5. **Sales are welded to vehicles.** `sales.vehicle_id` has a foreign key to `vehicles`, plus `exchange_vehicle_id`, ownership-transfer and sanakhat columns. A generic items core means sales get an item reference. This is the risky change (Prompt 4); production sales data must keep working.
6. **Roles are hard-coded.** `ROLE_PERMISSIONS` (server.py) and `permissions.js` mirror each other. Feature checks must combine with roles in both, otherwise a feature switched off still shows for a role that has it.
7. **Missing-flag rule.** The Android APK (Capacitor WebView) loads the web app, so it follows the server; a missing flag must read as the catalogue default.

## Open questions for you

1. Confirm or change each row's "New orgs" default above.
2. Hamro G&G and Deeva: do both use everything today? I backfill ON for any org that has rows in the feature's tables, and OFF where it has none, unless you say otherwise.
3. Public address per org: decided, custom domain per org (market-realistic), with a free slug address as fallback until the domain is connected. Hosting is the VPS only (nginx), so domains need automatic HTTPS there (Caddy on-demand TLS or certbot). Leads do not need a domain or storefront: each org wires its own existing website to a per-org lead key (so `stock.leads` no longer needs `stock.public_site`; share, visits and offers still do). Open: the original storefront is the separate Hamro-GNG-Auto site; other orgs need a generic storefront built and served from the VPS.
4. (Decided: Finance becomes the single place; Stock posts money events one-way. See Prompt 3c.)
5. `sanakhat_officer`: add to `core.services.stock` roles when the `stock.sanakhat` feature is on?

Nothing is written to the database. The migration waits for your answers.

## Decisions made

- Public address per org: custom domain, slug as fallback; VPS only (nginx + automatic HTTPS).
- Leads: wired to the business's own website. Two key kinds are offered: a public form key (allowed origins + captcha) and a secret server key (signed requests). Recommend the secret key to anyone with a server.
- Optional packs (off for new orgs): vehicles, sanakhat, job cards (incl. In Repair), spare parts. Warranty stays and becomes generic.

## Database role for Stock's bridge (tested in `supabase/tests/stock_bridge_sql.test.mjs`)

Stock reads the portal database through `PORTAL_DB_URL`. Use a dedicated read-only role with exactly these grants; the test
runs the bridge's real queries as this role. Create it yourself in the portal project and set the password there (never in git):

```sql
create role stock_bridge login password '<set in the dashboard>' bypassrls;  -- legacy_tenant_map has RLS and no policy for it
grant usage on schema core to stock_bridge;
grant select on core.service_roles, core.memberships, core.org_services, core.legacy_tenant_map to stock_bridge;
grant execute on function core.feature_on(uuid, text) to stock_bridge;       -- feature_on is revoked from public by default
```

It can read, never write (the test checks that). `bypassrls` only lets it see those four tables; it has no grants on anything else.
