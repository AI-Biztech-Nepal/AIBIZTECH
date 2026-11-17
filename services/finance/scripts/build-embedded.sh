#!/usr/bin/env bash
# Builds Finance's web app and places it in the portal at /finance (apps/aibiztech/public/finance).
# Run from services/finance after changing the app, then commit the result.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="$here/../../apps/aibiztech/public/finance"
# The real values come from the portal at run time (see /finance-config.js); these only let the build start
EXPO_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=placeholder \
  npx --prefix "$here" expo export -p web --output-dir "$here/dist-embedded"
rm -rf "$dest"; mkdir -p "$dest"
cp -R "$here/dist-embedded/." "$dest/"
rm -rf "$here/dist-embedded"
# Load the portal's config before the app starts
sed -i.bak 's#<head>#<head><script src="/finance-config.js"></script>#' "$dest/index.html" && rm "$dest/index.html.bak"
echo "Finance placed in $dest"
