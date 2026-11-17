# Attendance inside AIBIZTECH, on the VPS

The existing admin-web on the VPS keeps running untouched. A second copy, built from the AIBIZTECH repository, runs beside it
(PM2 name `attendance-portal`, port 3100). It signs people in with the portal and serves its pages under `/attendance`.

1. DNS: add an A record for a new name, e.g. `attendance-portal.yourdomain.com`, pointing at the VPS.
2. On the VPS (as the deploy user): `git clone <AIBIZTECH repo url> ~/aibiztech`
   (a private repo needs a deploy key or token on the VPS).
3. Create `~/aibiztech/services/attendance/admin-web/.env.local` (never commit it):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://feylbretbknouzxxyjwg.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<the portal's publishable key>
   SUPABASE_SERVICE_ROLE_KEY=<the portal project's secret key>
   PORTAL_SIGNUP_URL=https://aibiztech.vercel.app/signup
   ```
   The URL and publishable key are built into the pages, so rebuild after changing them.
4. `bash ~/aibiztech/services/attendance/deploy/redeploy-portal.sh` (installs, builds, starts or restarts the process).
5. Nginx and HTTPS: use `nginx-attendance-portal.conf`, then certbot for the new name.
6. Check from the VPS: `curl -I http://localhost:3100/attendance/login` returns 200.
7. In Vercel, project `aibiztech`, add `ATTENDANCE_URL=https://attendance-portal.yourdomain.com` (no trailing slash) and redeploy.

Every later update: `git push` to AIBIZTECH, then run step 4 again.
