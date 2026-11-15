#!/usr/bin/env bash
# A THROWAWAY local database for the family end-to-end test (docs/ios/FAMILY_E2E.md): the Supabase stub, every
# migration in order (same rules as scripts/test-household-sql.sh), and nothing else. Never point it at a real project.
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash scripts/e2e/family-db.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${E2E_DB:-omc_family_e2e}
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
psql_() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
psql_ -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
psql_ -d "$DB" -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  if ! out=$(psql_ -d "$DB" -f "$f" 2>&1 >/dev/null); then
    if [[ "$(basename "$f")" == 20261102000000_shop_gelato_private_storage.sql ]]; then :
    elif [[ "$(basename "$f")" =~ (marketing|email|newsletter|subscriber_resource|welcome_delivery|checkout_offers|pinterest_queue) ]]; then :
    else echo "$out" | grep -v -e 'already exists, skipping' -e NOTICE; echo "migration failed: $f"; exit 1; fi
  fi
done
echo "e2e database $DB ready ($(ls supabase/migrations/*.sql | wc -l) migrations)"
