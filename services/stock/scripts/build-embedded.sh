#!/usr/bin/env bash
# Builds Stock Manager's screens and places them in the portal at /stock-app (apps/aibiztech/public/stock-app).
# Run from anywhere after changing the app, then commit the result. The server's address is not built in: the portal
# passes /api on to it (STOCK_SERVER in apps/aibiztech/next.config.ts).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="$here/../../apps/aibiztech/public/stock-app"
cd "$here/frontend"
[ -d node_modules ] || npx --yes yarn@1.22.22 install --frozen-lockfile
PUBLIC_URL=/stock-app REACT_APP_BACKEND_URL= REACT_APP_PORTAL_URL=/ CI=false GENERATE_SOURCEMAP=false npx --yes yarn@1.22.22 build
rm -rf "$dest"; mkdir -p "$dest"
cp -R build/. "$dest/"
echo "Stock Manager placed in $dest"
