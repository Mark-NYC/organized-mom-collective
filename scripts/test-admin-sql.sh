#!/usr/bin/env bash
# Database access tests for /admin, customer accounts and the Club (supabase/tests/admin-access.sql,
# accounts-access.sql, club-access.sql, club-membership.sql) on a throwaway database.
#
# Needs a local PostgreSQL 15+ you can connect to as a superuser, and `psql`. No PostgREST needed.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… npm run test:admin-sql
#
# Creates (and drops first) the database `admin_e2e`. Never point it at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."

DB=admin_e2e
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
psql_() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_ -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
psql_ -d "$DB" -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  psql_ -d "$DB" -f "$f" 2>&1 >/dev/null | { grep -v -e 'already exists, skipping' -e 'NOTICE' || true; }
done
psql_ -d "$DB" -o /dev/null -f supabase/tests/admin-access.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
psql_ -d "$DB" -o /dev/null -f supabase/tests/accounts-access.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
psql_ -d "$DB" -o /dev/null -f supabase/tests/club-access.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
psql_ -d "$DB" -o /dev/null -f supabase/tests/club-membership.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
psql_ -d postgres -c "drop database $DB with (force)" >/dev/null
echo "admin, account, club access and membership tests passed"
