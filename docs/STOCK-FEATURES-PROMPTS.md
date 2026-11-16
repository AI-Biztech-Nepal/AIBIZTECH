# Auto Stock Manager: make it versatile (feature flags) — paste-ready prompts

Run these in order, each in a fresh Claude Code session, and confirm each result before the next.
Prompts 0 and 1 run in the **portal** repo. Prompts 2 to 5 run in the **Auto-Stock-Manager** repo.
They follow `docs/FEATURE-FLAGS.md` (the contract) and copy what Finance already did
(`supabase/migrations/20261101000100_finance_features.sql`, `..200_finance_feature_guards.sql`).

## What the repos show (checked, not guessed)

- Stock is the one service **not yet on the portal**. Its data is now in its own Supabase Postgres project (keyed by `company_id`), but it signs its own JWTs
  and has no `portal-supabase` branch. `core.feature_on()` does not exist for it until it has one. **Prompt 0 is done: see `docs/STOCK-FEATURES-DRAFT.md`.**
- "Automobile" is baked in at three layers, and flags only fix the first two:
  1. **Modules** that only some businesses want: Job Cards, Warranty, Sanakhat, Bookings, CRM, Leads, Offers, Share, Visits, AI Assistant.
  2. **The vehicle data model**: `vehicles` has chassis, engine, engine_cc, bluebook, insurance, tax clearance, ownership transfer, sanakhat, kilometer_run.
  3. **Words**: "Vehicle", "Inventory > Product", "Bike" icon, "Sales > sold vehicle", dealership copy in `PRODUCT.md`.
- Stock ships its own Finance, EMI and Rent (`finance_books.py`, `emi_records`, `migration_add_finance_rent.sql`). The portal already has a Finance service with `finance.emi` and `finance.rent`. Do not flag these twice: they are removed from Stock, not flagged (see decision 2).

## Decisions I need from you before Prompt 1 (my defaults in bold)

1. **Generic item model.** Do non-vehicle businesses get (a) **a generic `items` core (name, SKU, category, cost, price, quantity, optional serial number) with vehicles as the `stock.vehicles` pack on top**, or (b) the vehicle table reused with most columns hidden? (a) is cleaner; (b) is cheaper but leaves a vehicle schema under every shop.
2. **Stock's built-in Finance/EMI/Rent**: **hand over to the Finance service and remove from Stock**, or keep behind flags until the migration is done.
3. **Defaults for new orgs**: **core only on; every pack off, owner picks in the builder.** Existing orgs: backfilled to what they have today (Hamro G&G keeps everything).
4. **Automobile-only parts become optional packs (your call):** `stock.job_cards`, `stock.spare_parts` (parts, kits/sets, part transactions, parts vendors), `stock.sanakhat` and the "In Repair" status (part of `stock.job_cards`) are all **off by default for new orgs**. Warranty stays, made generic: it applies to any sold item (`stock.warranty`, default on for orgs that sell warranted goods), not just vehicles. The generic quantity-based `items` core is new; it is not the spare-parts module.

---

## Prompt 0 — Bring Stock onto the portal contract (portal repo + Stock repo)

```
Read docs/FEATURE-FLAGS.md, docs/SCAFFOLD.md (Family B) and python/aibiz_auth.
Then read Auto-Stock-Manager (sibling folder): backend/server.py auth + ROLE_PERMISSIONS, backend/pgdb.py, docs/SUPABASE_MIGRATION.md, branches multitenant-restore and finance-services.

Goal: find out exactly what stands between Stock and `core.feature_on(org_id, 'stock.x')`. Report, do not change anything:
1. Does Stock's company_id map 1:1 to core.organizations.id? What is the plan for the existing companies (Hamro G&G, Deeva)?
2. Which auth path does Stock use today (own JWT or Supabase)? What is missing to call aibiz_auth.require_service / require_feature?
3. Is the data in MySQL or Supabase now? If MySQL, the DB guard in the feature brief cannot work yet: say so and propose the smallest bridge.
4. A step list with sizes. Flag anything that touches production data.
Stop after the report.
```

## Prompt 1 — Feature inventory + catalogue migration (portal repo)

```
Read docs/FEATURE-FLAGS.md, docs/ATTENDANCE-FEATURES-DRAFT.md (format to copy), and supabase/migrations/20261101000000_features.sql through 20261101000400.
Read Auto-Stock-Manager: frontend/src/components/Layout.jsx, frontend/src/utils/permissions.js, backend/schema.sql, PRODUCT.md.

Step 0 only. Write docs/STOCK-FEATURES-DRAFT.md in the same table format as the Attendance draft. Starting candidates (confirm or kill each against the code, rule 5 says no speculative flags):
stock.vehicles (vehicle pack: chassis/engine/CC, bluebook, insurance, tax, ownership transfer, odometer; default off),
stock.sanakhat (needs stock.vehicles; default off), stock.job_cards (repair/service jobs, includes the In Repair status and Scrap; default off),
stock.spare_parts (parts, kits/sets, part transactions, parts vendors; default off), stock.warranty (generic: any sold item, days, void, after-sale service count; default on), stock.bookings,
stock.crm, stock.leads (public website leads), stock.offers (public spin wheel and codes), stock.share (Facebook pages), stock.visits (page_views), stock.ai_assistant.
Core, not flags: dashboard, generic items inventory (status without In Repair), sales, customers, vendors, staff, reports, settings, team.
For every row list the tables, endpoints, pages and the public/security-definer entry points that touch it, and what each existing org sees today (backfill).
Mark open questions. Do NOT write the migration until I confirm the table.
```

After you confirm the table:

```
Write the migration supabase/migrations/<next timestamp>_stock_features.sql following 20261101000100_finance_features.sql: catalogue rows, per-org backfill (what each org sees today), default_on per my confirmed table. Add PGlite tests in supabase/tests like finance_features.test.mjs: off refuses, on works, missing row falls back to default, requires is enforced, expired trial turns all off. Run npm test and show the result.
```

## Prompt 2a — Accept the portal login and resolve the org in Stock (Stock repo, runs BEFORE Prompt 2)

Added after Prompt 0 showed Stock cannot verify the portal login yet. Facts (checked): the portal already has `core.legacy_tenant_map (service_key, legacy_id text, org_id)`, built for this: Stock company ids go in with `service_key='stock'`. Hamro G&G Auto already exists as a portal org (it came from Finance and Attendance); its Stock `company_id` is NOT its org id, so it needs a map row. Deeva does not use Stock. The `stock.*` feature and feature-request migrations are already applied to the live portal database (do not touch it). Migrated portal users keep their old UUID.

```
Read docs/SCAFFOLD.md (Family B), python/aibiz_auth/aibiz_auth/__init__.py in the portal repo (decode_token, check_access, require_service, require_feature) and supabase/migrations/20261027000000_core_init.sql (core.legacy_tenant_map, core.service_roles, the roles of service 'stock').
In Auto-Stock-Manager read backend/server.py get_current_user, ROLE_PERMISSIONS, require(), the users and companies tables, and /auth/login and /auth/signup.
Plan first, wait for my OK, new branch, LOCAL test setup only (local Postgres or a throwaway Supabase; never the live portal or Stock project):
1. A bridge, not a rewrite: get_current_user accepts EITHER the old Stock token (unchanged, so installed apps and the live site keep working) OR a portal Supabase token. A portal token needs X-Org-Id; verify it with the portal's public keys (aibiz_auth.decode_token), read the role from core.service_roles, and map it to a Stock role (admin, stock_supervisor, parts_supervisor, social_media). Propose how sanakhat_officer fits, since core.services.stock does not list it.
2. Company to org: resolve company_id from org_id through core.legacy_tenant_map (service_key='stock'), cached. Write a script that prints the proposed map rows (Hamro first) as a DRY RUN; I apply it to the live portal myself.
3. People: Stock users have their own passwords. Propose how a Stock user becomes a portal user (same UUID, same bcrypt hash if compatible, shared emails = one login, see docs/MIGRATION-MAPPING.md) and how someone in several companies picks an org. Do not migrate anyone.
4. Then support require_feature('stock.x') (aibiz_auth.check_feature) behind the bridge, with a seam so tests can fake core.feature_on.
5. Remove nothing yet: Stock's own /auth/signup and staff screens stay until the cut-over; list what must change then.
Tests: old token still works; portal token works with the right role; wrong org, wrong service, expired trial, a member without a role are refused; missing X-Org-Id is refused. Show output and list what you could not check.
```

## Prompt 2 — Guard every feature in the backend (Stock repo, branch off portal-supabase)

```
Read docs/FEATURE-FLAGS.md in the portal repo ("Enforce in three places", "Lessons from the Finance inventory") and the confirmed docs/STOCK-FEATURES-DRAFT.md.

For each stock.* feature:
- API: add require_feature('stock.x') to every endpoint it owns; return 403 {"feature": "stock.x"}. Grep ALL routes in backend/server.py and backend/crm.py first and list which feature owns each one. Routes with no owner stay core, say so.
- Public endpoints (website leads, offers/spin wheel, visit tracking, Share) need the check inside the handler: they have no logged-in user.
- Database: guard the feature's tables with core.feature_on(company_id, 'stock.x') in policy or function body (security definer bypasses RLS).
- Off means paused, not emptied: no job, sync or trigger may delete or recompute rows because a feature is off.
- Missing flag = catalogue default, never off, for installed Android APKs.
Tests: for each feature one test each for off refuses, on works, missing falls back to default. Extend backend/tests/test_tenant_isolation.py style. Show test output.
```

## Prompt 3 — Hide disabled features in the UI (Stock repo)

```
Read frontend/src/components/Layout.jsx, frontend/src/utils/permissions.js, frontend/src/App.js and frontend/src/context/AuthContext.jsx.

Load org_features once per session next to the user (AuthContext). Make permissions.js the single place that combines role AND feature: canAccessPath(role, path, features). Then:
- hide nav items, Marketing sub-tabs and dashboard cards of disabled features;
- in forms, hide the fields of disabled packs (vehicle-only fields when stock.vehicles is off);
- opening a hidden URL shows a polite "not enabled for your organization" page, and a 403 {"feature"} from the API shows the same page.
Do not restyle anything (PRODUCT.md: keep the look). Keep data-testid values. Run the frontend tests and the build.
```

## Prompt 3b — Public site per organization (Stock repo, after Prompt 2)

```
Read docs/STOCK-FEATURES-DRAFT.md (finding 4) in the portal repo, then backend/server.py: _scope_to_default_company, _default_company_id, every /public/* route, /share/*, /facebook/*, and the website-leads and visits code.
Goal: stock.leads, stock.share and stock.visits work for ANY organization, not only the first company.
1. Add stock.public_site with CUSTOM DOMAINS as the main route: a table of (org, hostname, verified, is_primary) plus a free slug address as the fallback until a domain is connected. Resolve the org from the request Host in one dependency that replaces _scope_to_default_company (cache the lookup; unknown host = 404). Owner flow in the portal: enter domain, show the DNS records to add, verify, then serve. Hosting is the VPS only (nginx, see deploy/nginx-stock.conf; no Vercel), so new domains need automatic HTTPS there: propose Caddy on-demand TLS or certbot, with an "ask" endpoint that only issues certificates for hostnames in the domains table (so nobody can point random domains at the VPS and burn certificate quota). Also find out who serves the public pages today: the storefront for hamroauto.com.np looks like the separate Hamro-GNG-Auto site calling /api/public/*. Other orgs have no such site, so propose a generic storefront served from the VPS (items, contact form, share pages) and report the size before coding. hamroauto.com.np keeps working unchanged as the original company's primary domain.
2. Every /public/* handler checks the feature inside the body (anonymous callers).
3. Leads, wired to the business's OWN website (this is how most orgs will use it; a generic storefront is optional and comes later): each org gets a public lead key (revocable, shown in Settings) and an allowed-origins list. POST /api/public/leads accepts the key (header or field), resolves the org from it, checks stock.leads inside the handler, and applies CORS only for that org's allowed origins. Provide (a) a copy-paste HTML form snippet, (b) a plain JSON/webhook description for developers (WordPress, Wix, Shopify and custom sites can all post to it), (c) abuse protection, designed on the assumption that a key placed in a web form is PUBLIC (any visitor can read it): the key is write-only (it can create a lead, never read anything); two key kinds, a public form key (browser, with allowed origins) and a SECRET server key (HMAC-signed requests from the business's own server, never shipped to browsers); Cloudflare Turnstile or similar captcha on browser submissions; rate limit per key, IP and phone; a daily cap per org with an alert to the owner on a spike; honeypot field; size limits; duplicate detection; one-click rotate/revoke. Leads still need a human accept/reject, so junk never reaches the CRM. Leads land in the same Leads screen, accept/reject into CRM exactly as today. Generic fields: name, phone, email, message, optional item, images, source page. Dealership types (Sell / Exchange / Book Service) only for orgs with stock.vehicles. Existing lead rows and the Hamro website's current calls keep working untouched.
3b. (old item 3 continues) Lead form fields: generic form (name, phone, message, optional item, images). Dealership types (Sell / Exchange / Book Service) only for orgs with stock.vehicles. Existing lead rows untouched.
4. Share: item pages with Open Graph photo cards for any org with stock.public_site; storefront_url from the org, not the default company. Facebook connect stays per company.
5. Visits: scope page_views by the resolved org.
Rate-limit the public POST routes and keep the signed share links as they are. Tests: org A's lead never appears for org B; flag off returns 403 {"feature": ...}; the original company's site behaves exactly as before. Show output.
```

## Prompt 3c — Stock stops keeping its own books: Finance is the single place (Stock repo + portal repo)

```
Read the Finance service's tables and the Jageer mirror functions (public.finance_apply_jageer_* in the portal supabase/migrations/20261030000300_finance_jageer_door.sql) and finance.apply_bill_stock. Then read Auto-Stock-Manager backend/finance_books.py, the /emi* and /partners* routes, sales and vendor-payment code, and import_old_finance_data.py.
Goal: no double entry. Plan first, wait for my OK:
1. Posting: Stock sales, vendor payments and expenses post to portal Finance through one defined entry point (copy the Jageer pattern), one-way, with an idempotency key per Stock record; edits and deletes in Stock update or reverse the same Finance entry. Post MONEY ONLY, no item lines, so Finance's stock trigger never adjusts a second inventory.
2. Gate it with a flag stock.finance_sync (needs the org's Finance service live). Off = paused, nothing deleted; Stock must work fully for orgs without Finance.
3. Posted entries are read-only in Finance and labelled "from Stock".
4. Screens: Stock's Finance nav opens the portal Finance for the same org and login; then remove /fin/*, /emi*, /partners* and their pages. Do this LAST.
5. One-time migration of existing Stock books (Hamro G&G etc.) into Finance, dry run first, with a reconciliation report of totals. Never touch production data without my explicit go.
List tables, functions, routes touched and a safe order.
```

## Prompt 4 — Generic core: items and vocabulary (Stock repo, only after decision 1)

```
Using my decision on the generic item model: introduce the generic item core so an org with stock.vehicles OFF sees "Items" with name, SKU, category, cost, price, quantity, status, photos, optional serial number, and sales/customers/vendors/ledger work on items.
Rules: one schema for everyone, no per-customer columns; existing vehicle rows keep working untouched and stay reachable when stock.vehicles is on; no data is deleted or migrated destructively; Sales, Dashboard and Reports must read both (reconcile: PRODUCT.md principle 4).
Also: move the In Repair / Scrap statuses and the parts_supervisor role behind stock.job_cards / stock.spare_parts (roles whose feature is off are hidden, not deleted). Make warranty work on any sold item, not only vehicles.
Vocabulary: one terms map (item/vehicle, inventory, sold) chosen from the org's business_type, so "Vehicle" never shows for a bakery. Replace the Bike icon and dealership copy in generic screens only.
Do it as a plan first: list tables, endpoints, pages touched, and the order that keeps production working at each step. Wait for my OK before coding.
```

## Prompt 5 — Builder starter sets + verification (portal repo)

```
Read apps/portal/lib/recommend.ts (+ test), docs/revamp-from-auto-stock-manager/BUSINESS-BUILDER.md, FEATURE-FLAGS.md ("Builder").
Extend recommend() from service keys to a starter feature set per business type (e.g. vehicle dealership: stock.vehicles, stock.sanakhat, stock.warranty, stock.job_cards; retail/wholesale: core + stock.warranty; repair workshop: stock.job_cards, stock.spare_parts, stock.warranty). Preselect, never enable silently: the owner confirms in Settings > Features. Add node --test cases.
Then verify end to end with a dummy org: minimal set -> smaller app in Stock, hidden URL and direct API call both refused; existing Hamro G&G -> unchanged; off then on loses nothing. Report what passed and what you could not check.
```

## Risks

- Prompt 0 may show that Stock's data is still MySQL; then DB-level guards (rule 4) have to wait for the Supabase move.
- Prompt 4 is the only risky one for live data. Keep it plan-first and run it against a copy.
