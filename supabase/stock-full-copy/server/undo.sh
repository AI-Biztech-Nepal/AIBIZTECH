#!/bin/bash
# Goes back to the old database. Entries made AFTER the switch stay only in the portal database and will not show.
set -euo pipefail
. "$HOME/migrate/stock-full-copy/lib.sh"
switched || { echo "Not switched: nothing to undo."; exit 0; }
[ "${1:-}" = yes ] || { echo "Entries made since the switch will not show in the old database."; echo "To go back anyway: bash ~/migrate/stock-full-copy/undo.sh yes"; exit 1; }
cp -p "$ENVF" "$ENVF.bak-switched-$(date +%F-%H%M)"; cp -p "$ENVF.bak-before-switch" "$ENVF"
PM2 restart
[ -f "$DIR/crontab.before" ] && crontab "$DIR/crontab.before"
sleep 10; echo "Back on the old database: $(curl -s -m 10 http://127.0.0.1:8001/api/health)"
