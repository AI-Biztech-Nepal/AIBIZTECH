#!/usr/bin/env bash
# Full, read-only backups of every database before anything is merged. Safe to run: it only reads.
# Usage:  ATT_DB='postgresql://...' FIN_DB='postgresql://...' PORTAL_DB='postgresql://...' ./01_backup.sh
# Connection strings: Supabase dashboard -> Connect -> "Session pooler" URI (include the database password).
set -euo pipefail
out="backups/$(date +%Y%m%d-%H%M%S)"; mkdir -p "$out"
for name in ATT FIN PORTAL; do
  var="${name}_DB"; url="${!var:-}"
  [ -z "$url" ] && { echo "skip $name (not set)"; continue; }
  echo "dumping $name ..."
  pg_dump "$url" --no-owner --no-privileges --format=custom --file="$out/$name.dump"
  pg_dump "$url" --no-owner --no-privileges --schema=auth --data-only --file="$out/$name-auth-users.sql" || true
done
if [ -n "${MYSQL_DB_NAME:-}" ]; then
  echo "dumping MySQL ..."
  mysqldump --single-transaction --routines "$MYSQL_DB_NAME" > "$out/stock-mysql.sql"
fi
echo "Backups in $out  (keep them out of git: backups/ is ignored)"
