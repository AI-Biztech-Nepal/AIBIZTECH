#!/bin/bash
# AIBIZTECH's own Stock Manager, built from the AIBIZTECH repository next to (and separate from) the old one.
# Backend: PM2 "stock-portal-backend" on 127.0.0.1:8101.  Frontend: /var/www/stock-portal-frontend.
# Run on the VPS:  bash ~/aibiztech/services/stock/deploy/portal/redeploy-portal.sh
set -e
cd ~/aibiztech
git fetch origin main
git reset --hard origin/main
APP=~/aibiztech/services/stock

cd $APP/backend
[ -f .env ] || { echo "Missing $APP/backend/.env - copy deploy/portal/env.example and fill it in"; exit 1; }
[ -d venv ] || python3 -m venv venv
venv/bin/pip install -q -r requirements.txt
pm2 describe stock-portal-backend >/dev/null 2>&1 \
  && pm2 restart stock-portal-backend \
  || pm2 start venv/bin/uvicorn --name stock-portal-backend --interpreter none -- server:app --host 127.0.0.1 --port 8101
pm2 save

# Frontend: same-origin /api, so no backend address is built in
cd $APP/frontend
export GENERATE_SOURCEMAP=false NODE_OPTIONS="--max-old-space-size=1400" CI=false REACT_APP_BACKEND_URL=""
nice -n 15 npx --yes yarn@1.22.22 install --frozen-lockfile --ignore-scripts --prefer-offline --silent
nice -n 15 npx --yes yarn@1.22.22 build
test -f build/index.html
rsync -a --delete build/ "${FRONTEND_DIR:-/var/www/stock-portal-frontend}/"
echo "Stock Manager (AIBIZTECH) published $(date -Is)"
