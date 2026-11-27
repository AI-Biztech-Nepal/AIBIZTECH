# Shared by refresh.sh, switch.sh and undo.sh (source it; do not run it).
DIR="$HOME/migrate/stock-full-copy"; APP="$HOME/auto-stock-manager/backend"; ENVF="$APP/.env"
PM2() { bash -ic "pm2 $1 auto-stock-backend" </dev/null >/dev/null 2>&1; }
switched() { grep -qE '^PG_SCHEMA=stock' "$ENVF"; }
dst_sql() { docker exec -i -e PGOPTIONS="${PGOPT:-}" supabase-db psql -h localhost -U supabase_admin -d postgres -X -q -At -v ON_ERROR_STOP=1 "$@" -f -; }

# Replace everything in the portal's stock tables with what the app's database holds now. All or nothing.
copy_data() {
  {
    echo "begin;"; echo "set session_replication_role = replica;"
    echo "do \$\$ declare l text; begin select string_agg(format('stock.%I', tablename), ', ') into l from pg_tables where schemaname = 'stock'; execute 'truncate ' || l; end \$\$;"
    nice pg_dump -w -h 127.0.0.1 -U asm -d asm --data-only --schema=public --no-owner --no-privileges |
      awk 'copy { print; if ($0 == "\\.") copy = 0; next }
           /^\\(un)?restrict/ { next }
           /^COPY public\./ { sub(/^COPY public\./, "COPY stock."); copy = 1 }
           /^SELECT pg_catalog\.setval\(.public\./ { sub(/public\./, "stock.") }
           { print }' &&
      printf '%s\n' "commit;"   # only when the whole export succeeded
  } | dst_sql >/dev/null
}

# Every table: same number of records and same content? Prints the differences; fails if there are any.
compare_data() {
  local opt='-c default_transaction_read_only=on -c TimeZone=UTC -c extra_float_digits=1' a b
  a=$(PGOPTIONS="$opt" nice psql -w -h 127.0.0.1 -U asm -d asm -X -At -F'|' -v ON_ERROR_STOP=1 -v schema=public -f "$DIR/compare.sql" </dev/null) || return 2
  b=$(PGOPT="$opt" dst_sql -F'|' -v schema=stock < "$DIR/compare.sql") || return 2
  echo "tables: $(grep -c '|' <<<"$a") / $(grep -c '|' <<<"$b"), records: $(awk -F'|' '{s+=$2} END {print s}' <<<"$a") / $(awk -F'|' '{s+=$2} END {print s}' <<<"$b"), identical tables: $(comm -12 <(sort <<<"$a") <(sort <<<"$b") | wc -l)"
  [ "$(sort <<<"$a")" = "$(sort <<<"$b")" ] && return 0
  join -t'|' <(sort -t'|' -k1,1 <<<"$a") <(sort -t'|' -k1,1 <<<"$b") | awk -F'|' '$2!=$4 || $3!=$5 {print "  differs: " $1 " (app " $2 ", portal " $4 ")"}'
  return 1
}
