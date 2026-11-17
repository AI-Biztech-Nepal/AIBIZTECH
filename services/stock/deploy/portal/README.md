# AIBIZTECH's own Stock Manager (fresh, separate from the old one)

A second Stock Manager for AIBIZTECH, cloned from the Auto-Stock-Manager repository. It has its own empty data in the
portal database (schema `stock`) and its own address. It does not read, change or depend on the old Stock Manager, its
database or its customers. People sign in through the AIBIZTECH portal; each business there becomes one company here.

1. Database. In the portal Supabase SQL Editor, run `supabase/migrations/20261118000500_stock_schema.sql`. (45 empty tables in the `stock` schema.)
2. DNS. Add an A record for a new name, e.g. `stock-portal.yourdomain.com`, pointing at the VPS.
3. VPS (as the deploy user): `git clone https://github.com/AI-Biztech-Nepal/AIBIZTECH.git ~/aibiztech` (a private repo needs a deploy key or token).
4. Settings. `cp ~/aibiztech/services/stock/deploy/portal/env.example ~/aibiztech/services/stock/backend/.env` and fill it in
   (database connection, two new random secrets, the new address). `SSO_SECRET` is also set in the portal's Vercel project.
5. Nginx and HTTPS. Use `deploy/portal/nginx-stock-portal.conf` with the new name, then certbot.
6. Run: `bash ~/aibiztech/services/stock/deploy/portal/redeploy-portal.sh` (builds the backend and the front end, starts PM2 `stock-portal-backend` on port 8101).
7. Check: `curl http://127.0.0.1:8101/api/` and open the new address.
8. Portal. In the Supabase SQL Editor: `update core.services set base_url = 'https://<new-stock-address>' where key = 'stock';`
   In Vercel (`aibiztech`): set `SSO_SECRET` (same as the backend) and `SSO_SERVICES=stock`, then redeploy.

Update later: push to AIBIZTECH, then run step 6 again.
