# Stock Manager: full copy inside the portal

Goal: the portal's Stock Manager is the original Auto Stock Manager, table for table and feature for feature, replacing
the earlier partial pages. Source copied: Auto-Stock-Manager `2c1df2b`.

## Done on this branch
- `services/stock`: the whole current app (screens and server), identical to the source (private notes and test reports
  left out). `deploy/portal` and `frontend/src/utils/portalFlag.js` from the earlier copy are kept.
- `01-tables.sql`: the live app's 47 tables, columns, keys, rules and indexes, in the portal database's `stock` schema.
  The earlier `stock` schema is kept as `stock_before_full_copy`. Tried on a throwaway Postgres together with the copied
  server (`PG_SCHEMA=stock`).

## Not done yet
1. Screens: build `services/stock/frontend` into the portal (as Finance is, under its own path), one sign-in, one menu.
2. Replace the portal's earlier pages (`app/stock`, `app/marketing`, dashboard figures) with the copied ones.
3. Server: run `services/stock/backend` against the portal database, with its own database login. Automatic backups
   switch themselves off when `PG_SCHEMA` is set; change that first. Check disk space.
4. Public website: keep its feed, leads and visit tracking working against the new tables.
5. Data: copy the live rows, compare every table, then switch at a quiet time. Nothing here has touched live data.
