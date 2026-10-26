#!/usr/bin/env bash
# The Organized Family Club's paid membership end to end (tests/club-billing-e2e.test.ts): the real Edge Function
# handlers against a throwaway database with every migration, a fake Stripe in test mode, fake Auth and Resend.
#
# Needs a local PostgreSQL 15+ you can connect to as a superuser, and `psql`. No PostgREST needed.
#
#   PGHOST=localhost PGUSER=postgres npm run test:club
#
# Creates (and drops first) the database `club_e2e`. Never point it at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."

DB=club_e2e
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
psql_() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_ -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
psql_ -d "$DB" -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  psql_ -d "$DB" -f "$f" 2>&1 >/dev/null | { grep -v -e 'already exists, skipping' -e 'NOTICE' || true; }
done
if [[ "$PGHOST" == /* ]]; then
  export CLUB_E2E_PSQL="postgresql:///${DB}?host=${PGHOST}&port=${PGPORT}&user=${PGUSER}"
else
  export CLUB_E2E_PSQL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${DB}"
fi
npx vitest run tests/club-billing-e2e.test.ts "$@"
