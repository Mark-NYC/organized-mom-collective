#!/usr/bin/env bash
# A local development copy of the Club's database for scripts/club-onboarding-e2e.mjs: database `club_dev_template`
# with every migration and supabase/tests/club-dev-seed.sql (an owner admin and one founding member right after
# checkout). The e2e script copies it fresh for each scenario. Never point it at a real project.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash scripts/club-dev-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB=club_dev_template
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
psql_() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_ -d postgres -c "drop database if exists club_dev with (force)" -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null 2>&1
psql_ -d "$DB" -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  psql_ -d "$DB" -f "$f" 2>&1 >/dev/null | { grep -v -e 'already exists, skipping' -e 'NOTICE' || true; }
done
psql_ -d "$DB" -o /dev/null -f supabase/tests/club-dev-seed.sql
echo "$DB ready: $(psql -X -At -d "$DB" -c "select count(*) from public.club_fulfillment_orders") orders for the seeded founding member"
