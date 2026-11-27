# Stock Manager: full copy inside the portal

Goal: the portal's Stock Manager is the original Auto Stock Manager, table for table and feature for feature, replacing
the earlier partial pages. Source copied: Auto-Stock-Manager `2c1df2b`.

## Done on this branch
- `services/stock`: the whole current app (screens and server), identical to the source (private notes and test reports
  left out). `deploy/portal` and `frontend/src/utils/portalFlag.js` from the earlier copy are kept.
- `01-tables.sql`: the live app's 47 tables, columns, keys, rules and indexes, in the portal database's `stock` schema.
  The earlier `stock` schema is kept as `stock_before_full_copy`. Tried on a throwaway Postgres together with the copied
  server (`PG_SCHEMA=stock`).

- Screens: built into the portal at /stock-app (services/stock/scripts/build-embedded.sh), shown in the portal page area
  like Finance, signed in by the portal. The portal passes /api to the server named in STOCK_SERVER (default: the live
  server). The earlier portal pages (app/stock, app/marketing and their libraries) are removed.
- One side panel: the app draws none of its own inside the portal. It sends its menu (by role and staff access) to the
  portal's panel (app/stock-nav.tsx, utils/portalMenu.js). Dashboard, Finance, Marketing and Settings appear once. A
  business with records in the earlier Finance app (5 on 2026-11-27) keeps it as "Old Finance" plus the portal Dashboard.
- Each business gets its version (apps/aibiztech/lib/business-kind.ts), none by name: a vehicle switch (stock.vehicles,
  finance.vehicles, or Finance's sells_vehicles) or business_type "vehicles"/"workshop" => vehicle screens and Stock
  Manager's own Finance; another business_type => generic Items and the portal's general Finance; nothing recorded => the
  owner or admin is asked once (/business-type; members see the general version meanwhile). Sign-up asks the kind; My
  Business can change it. A vehicle business with general Finance records keeps them as "General Finance". The app hides
  the screens (utils/businessKind.js); its server does not refuse them.
- Tried on one Mac: portal build + copied server + these tables + made-up data, every screen clicked through.

## Data (done 2026-11-27)
01-tables.sql plus the data are in the portal database's `stock` schema: 47 tables, compared record by record. The earlier
empty tables are `stock_before_full_copy`. The app's login is `stock_app` (owns that schema, nothing else). Portal
database backups keep the latest of the last 2 days. The scripts in `server/` are on the server in
`~/migrate/stock-full-copy/`: `refresh.sh` (bring the copy up to date; rehearsed, about 2 minutes), `switch.sh` (move the
app to this database; not run yet), `undo.sh`.

## Not done yet
1. Switch: run `switch.sh` at a quiet time.
2. Portal: publish this branch (until then the portal's earlier Marketing pages error and its stock figures are blank).
3. Portal dashboard stock figures for general businesses: read them from the app.
4. Run the server from services/stock/backend and move its settings and scheduled jobs, before the old app is deleted.
5. EMI: the removed portal pages had an EMI screen; the original app has none.
6. Changes made to the Auto-Stock-Manager repository after 2c1df2b must be copied into services/stock.
