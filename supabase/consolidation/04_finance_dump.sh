#!/usr/bin/env bash
# Step 1 of the Finance move. READ-ONLY on the Finance project; writes only local files and touches no database that holds data.
# Dumps Finance's public schema and rewrites it to target the "finance" schema. Review the output file before loading it.
# Usage: FIN_DB='postgresql://...' ./04_finance_dump.sh
set -euo pipefail
: "${FIN_DB:?set FIN_DB to the Finance project's connection string}"
out="backups/finance-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$out"
pg_dump "$FIN_DB" --schema=public --no-owner --no-privileges --format=plain --file="$out/finance-public.sql"
sed -E \
  -e 's/\bpublic\./finance./g' \
  -e "s/^CREATE SCHEMA public;/CREATE SCHEMA IF NOT EXISTS finance;/" \
  -e "s/^SELECT pg_catalog.set_config\('search_path', '', false\);/SELECT pg_catalog.set_config('search_path', 'finance, extensions', false);/" \
  "$out/finance-public.sql" > "$out/finance-schema-load.sql"
echo "Original : $out/finance-public.sql"
echo "To load  : $out/finance-schema-load.sql  (review it, then run it on the AIBIZTECH project)"
grep -c '^CREATE TABLE' "$out/finance-schema-load.sql" | xargs echo "tables in dump:"
