#!/bin/bash
# Moves Stock Manager onto the portal database. It is unavailable for a few minutes. If any step fails, the old setup
# is started again and nothing is changed. Choose a time when nobody is entering data.
set -euo pipefail
. "$HOME/migrate/stock-full-copy/lib.sh"
if switched; then echo "Already switched."; exit 0; fi
[ -s "$DIR/db-url" ] || { echo "The database login is missing. Nothing changed."; exit 1; }
BEFORE="$ENVF.bak-before-switch"
done_=0
cleanup() {
  if [ "$done_" = 0 ]; then
    if [ -f "$BEFORE" ] && switched; then cp -p "$BEFORE" "$ENVF"; fi
    PM2 restart || true
    echo; echo "NOT SWITCHED. The old setup is running again. Send a screenshot of this."
  fi
  [ -f "$DIR/crontab.before" ] && crontab "$DIR/crontab.before"
}
crontab -l > "$DIR/crontab.before"
trap cleanup EXIT
trap 'exit 1' INT TERM HUP
sed 's|^\([^#].*healthcheck\.sh.*\)|#paused-for-switch \1|' "$DIR/crontab.before" | crontab -   # or it would restart the app mid-copy
echo "1/4 Stopping Stock Manager"; PM2 stop
curl -s -m 3 http://127.0.0.1:8001/api/health >/dev/null && { echo "It did not stop."; exit 1; }
echo "2/4 Copying the latest data"; copy_data
echo "3/4 Comparing every table"; compare_data || { echo "The copy does not match."; exit 1; }
echo "4/4 Starting on the portal database"
cp -p "$ENVF" "$BEFORE"; chmod 600 "$BEFORE"
sed -i -E 's/^(SUPABASE_DB_URL=.*)$/#before-switch \1/; /^PG_SCHEMA=/d' "$ENVF"
[ -z "$(tail -c1 "$ENVF")" ] || echo >> "$ENVF"
printf 'SUPABASE_DB_URL=%s\nPG_SCHEMA=stock\n' "$(cat "$DIR/db-url")" >> "$ENVF"
PM2 restart
ok=0
for i in $(seq 1 45); do
  sleep 2
  curl -s -m 5 http://127.0.0.1:8001/api/health | grep -q '"database":"ok"' || continue
  [ "$(curl -s -m 20 -o /dev/null -w '%{http_code}' https://api.hamroauto.com.np/api/public/vehicles)" = 200 ] || continue
  n=$(echo "select count(*) from pg_stat_activity where usename = 'stock_app'" | dst_sql)
  [ "$n" -gt 0 ] && { ok=1; break; }
done
[ "$ok" = 1 ] || { echo "It did not come up on the new database."; exit 1; }
done_=1
# From now on this script would erase live data (it empties the portal database and reloads the old cloud copy).
if [ -f "$HOME/migrate/refresh-portal.sh" ]; then mv "$HOME/migrate/refresh-portal.sh" "$HOME/migrate/refresh-portal.sh.disabled-do-not-run"; chmod 400 "$HOME/migrate/refresh-portal.sh.disabled-do-not-run"; echo "refresh-portal.sh disabled."; fi
echo; echo "SWITCHED. Stock Manager now uses the portal database. Check the app and the website."
