#!/bin/bash
# Brings the portal's stock tables up to date with the app, without switching anything. Refused after the switch.
set -euo pipefail
. "$HOME/migrate/stock-full-copy/lib.sh"
if switched; then echo "The app already uses the portal database. A refresh would erase newer entries: refused."; exit 1; fi
s=$(date +%s); copy_data; echo "copied in $(( $(date +%s) - s ))s"
compare_data && echo "ALL TABLES MATCH" || echo "Some tables differ: entries made while this was running."
echo "checked, total $(( $(date +%s) - s ))s"
