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
- Tried on one Mac: portal build + copied server + these tables + made-up data, every screen clicked through.

## Not done yet
1. Portal dashboard: its stock figures read the stock tables directly; once 01-tables.sql runs they must come from the app.
2. Server: run services/stock/backend against the portal database with its own database login. Automatic backups switch
   themselves off when PG_SCHEMA is set; change that first. Check disk space.
3. Public website: keep its feed, leads and visit tracking working when the server moves.
4. Data: copy the live rows, compare every table, then switch at a quiet time. Nothing here has touched live data.
5. EMI: the removed portal pages had an EMI screen; the original app has none.
6. Changes made to the Auto-Stock-Manager repository after 2c1df2b must be copied into services/stock.
