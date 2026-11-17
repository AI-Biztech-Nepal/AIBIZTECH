#!/bin/bash
# Second Attendance instance for AIBIZTECH. It runs next to the existing admin-web (which is left alone) from the
# AIBIZTECH repository, on port 3100, and the portal serves it under /attendance.
# Run on the VPS as the deploy user, from anywhere:  bash ~/aibiztech/services/attendance/deploy/redeploy-portal.sh
set -e
cd ~/aibiztech
git fetch origin main
git reset --hard origin/main
cd services/attendance/admin-web
[ -f .env.local ] || { echo "Missing .env.local in $(pwd) - see deploy/README-portal.md"; exit 1; }
npm ci
npm run build
pm2 describe attendance-portal >/dev/null 2>&1 \
  && pm2 restart attendance-portal \
  || pm2 start npm --name attendance-portal -- start -- -p 3100
pm2 save
echo "attendance-portal is running on 127.0.0.1:3100"
