#!/bin/sh
# Rebuild the scratch portal_test DB from the latest portal backup. Scratch Postgres must be running on :54329.
B="$1"; Q="$B/psql.exe -h 127.0.0.1 -p 54329 -U postgres -At"
$Q -c "drop database if exists portal_test" -c "create database portal_test" >/dev/null
$Q -d portal_test -c "create schema extensions; create extension pgcrypto schema extensions; create extension \"uuid-ossp\" schema extensions;" >/dev/null 2>&1
"$B/pg_restore.exe" -h 127.0.0.1 -p 54329 -U postgres -d portal_test --no-owner --no-privileges $(ls -t backups/portal-*.dump | head -1) 2>&1 | grep -v "already exists" | grep error:
