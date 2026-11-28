#!/usr/bin/env bash
# Two engine workers reserve inference budget at the same moment (supabase/migrations/20261216000000_household_intelligence_engine.sql,
# intel_private.budget_reserve). Only one fits under the household's cap: exactly one must succeed, never both.
# THROWAWAY local database only:  PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash scripts/test-intel-budget-concurrency.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=intel_budget_race
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
psql_() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
psql -X -q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
psql_ -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do psql -X -q -d "$DB" -f "$f" >/dev/null 2>&1 || true; done
psql_ >/dev/null <<'SQL'
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000bd01', 'race@example.com');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000bd01"}', false);
set role authenticated;
select public.club_household_save('Race', '{}', '[{"first_name":"Ann","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
update public.intel_settings set ai_enabled = true, ai_consent_version = 1, monthly_budget_micro_usd = 300000
 where household_id = public.household_id_for('00000000-0000-0000-0000-00000000bd01');
insert into public.intel_settings (household_id, ai_enabled, ai_consent_version, monthly_budget_micro_usd)
  select public.household_id_for('00000000-0000-0000-0000-00000000bd01'), true, 1, 300000 on conflict do nothing;
SQL
race() { # one worker: reserve $0.20 inside a transaction that stays open for a moment
  psql_ -At -c "begin; select (intel_private.budget_reserve(public.household_id_for('00000000-0000-0000-0000-00000000bd01'), 'household', 'race-$1-request', 1, 200000, 'meeting-brief', 'terra')) ->> 'ok'; select pg_sleep(1.5); commit;" | head -1
}
race a > /tmp/race-a.$$ & race b > /tmp/race-b.$$ & wait
a=$(cat /tmp/race-a.$$); b=$(cat /tmp/race-b.$$); rm -f /tmp/race-a.$$ /tmp/race-b.$$
rows=$(psql_ -At -c "select count(*) from public.intel_usage where status = 'reserved'")
echo "worker a: $a · worker b: $b · reservations kept: $rows"
oks=0; [[ "$a" == "true" ]] && oks=$((oks + 1)) || true; [[ "$b" == "true" ]] && oks=$((oks + 1)) || true
if [[ "$rows" == "1" && "$oks" == "1" ]]; then echo "budget concurrency test passed"; else echo "FAILED: concurrent reservations overspent the cap"; exit 1; fi
psql -X -q -d postgres -c "drop database $DB with (force)" >/dev/null
