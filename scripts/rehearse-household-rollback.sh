#!/usr/bin/env bash
# Rehearses rolling back the household migrations (20261124 → 20261204) on a THROWAWAY local database, the way
# docs/ios/MIGRATION_DEPLOYMENT_PLAN.md describes it. Never point it at a real project.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash scripts/rehearse-household-rollback.sh
#
# 1. Builds the state before 20261124 (every earlier migration), runs preflight.sql, takes its fingerprint and captures
#    the functions. After applying, verify.sql must pass.
# 2. Applies 20261124 → 20261203 (20261203 also on its own: applied, tested, rolled back, re-applied) and runs their test suites, so the rollback meets real rows (partners, events,
#    agreements, cleaning marks, archives), not empty tables.
# 3. Runs rollback.sql, the captured restore-functions.sql and finish.sql.
# 4. The fingerprint must be identical to step 1's (every function, column, policy, trigger and grant), no household
#    or family member may be lost, and the pre-household Club suites must pass on the result.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=household_rollback_rehearsal
R=supabase/rollout/household
WORK=$(mktemp -d)
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
psql_() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
apply() {
  for f in "$@"; do
    if ! out=$(psql_ -d "$DB" -f "$f" 2>&1 >/dev/null); then
      case "$(basename "$f")" in
        20261102000000_shop_gelato_private_storage.sql) ;; # known, never applied in production
        *marketing*|*email*|*newsletter*|*subscriber_resource*|*welcome_delivery*|*checkout_offers*|*pinterest_queue*) ;; # need Supabase-only extensions
        *) echo "$out" | grep -v -e 'already exists, skipping' -e NOTICE; echo "migration failed: $f"; exit 1 ;;
      esac
    fi
  done
}
fingerprint() { psql_ -d "$DB" -At -F ' | ' -f "$R/fingerprint.sql" > "$1"; }

psql_ -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null 2>&1
psql_ -d "$DB" -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
before=(); household=()
for f in supabase/migrations/*.sql; do
  if [[ "$(basename "$f")" < "20261124" ]]; then before+=("$f"); else household+=("$f"); fi
done
apply "${before[@]}"
fingerprint "$WORK/before.txt"
bad=$(psql_ -d "$DB" -At -F ' | ' -f "$R/preflight.sql" | grep ' | f | ' || true)
[[ -z "$bad" ]] || { echo "PREFLIGHT FAILED on the state before 20261124:"; echo "$bad"; exit 1; }
echo "preflight: every check ok"
psql_ -d "$DB" -At -f "$R/capture.sql" > "$WORK/restore-functions.sql"
echo "before 20261124: $(wc -l < "$WORK/before.txt") objects fingerprinted, $(grep -c '^CREATE OR REPLACE FUNCTION' "$WORK/restore-functions.sql") functions captured"

early=(); billing=()
for f in "${household[@]}"; do
  if [[ "$(basename "$f")" == 20261203* ]]; then billing+=("$f"); else early+=("$f"); fi
done
apply "${early[@]}"
# 20261203 alone: apply, exercise, roll back with its own capture, and the schema must be what it was just before.
fingerprint "$WORK/before-billing.txt"
psql_ -d "$DB" -At -f "$R/capture-billing.sql" > "$WORK/restore-billing-functions.sql"
apply "${billing[@]}"
psql_ -d "$DB" -c "create table public._kits_before as select id, status, release_at, month from public.club_kits" >/dev/null # the suite schedules a kit; the older suites count drafts
psql_ -d "$DB" -o /dev/null -f supabase/tests/household-billing.sql >/dev/null 2>&1 || { echo "FAILED before rollback: household-billing"; exit 1; }
psql_ -d "$DB" -c "update public.club_kits k set status = b.status, release_at = b.release_at, month = b.month from public._kits_before b where b.id = k.id" -c "drop table public._kits_before" >/dev/null
psql_ -d "$DB" -f "$R/rollback-billing.sql" >/dev/null
psql_ -d "$DB" -f "$WORK/restore-billing-functions.sql" >/dev/null
psql_ -d "$DB" -c "drop function if exists public.club_household_of(uuid)" >/dev/null
fingerprint "$WORK/after-billing.txt"
if ! diff -u "$WORK/before-billing.txt" "$WORK/after-billing.txt" > "$WORK/diff-billing.txt"; then
  echo "BILLING ROLLBACK LEFT DIFFERENCES:"; head -40 "$WORK/diff-billing.txt"; exit 1
fi
echo "20261203 alone: applied, tested, rolled back; schema identical to just before it ($(grep -c '^CREATE OR REPLACE FUNCTION' "$WORK/restore-billing-functions.sql") functions restored)"
apply "${billing[@]}"
bad=$(psql_ -d "$DB" -At -F ' | ' -f "$R/verify.sql" | grep -v ' | t | t$' || true)
[[ -z "$bad" ]] || { echo "VERIFY FAILED after applying:"; echo "$bad"; exit 1; }
echo "verify: every step applied and ok ($(psql_ -d "$DB" -At -f "$R/verify.sql" | wc -l) checks)"
for t in household-partners family-calendar family-agreements household-join-from-own household-cleaning-progress agreement-follow-through; do # (household-club-access reschedules kits, which the older suites count)
  psql_ -d "$DB" -o /dev/null -f "supabase/tests/$t.sql" >/dev/null 2>&1 || { echo "FAILED before rollback: $t"; exit 1; }
done
kept=$(psql_ -d "$DB" -At -c "select (select count(*) from public.club_households) || ' households, ' || (select count(*) from public.club_family_members) || ' family members'")
rows=$(psql_ -d "$DB" -At -c "select (select count(*) from public.household_adults where role = 'partner') || ' partners, ' || (select count(*) from public.calendar_events) || ' events, ' || (select count(*) from public.household_cleaning_marks) || ' cleaning marks, ' || (select count(*) from public.household_archives) || ' archives'")
echo "applied ${#household[@]} migrations; to be removed by the rollback: $rows"

psql_ -d "$DB" -f "$R/rollback.sql" >/dev/null
psql_ -d "$DB" -f "$WORK/restore-functions.sql" >/dev/null
psql_ -d "$DB" -f "$R/finish.sql" >/dev/null
fingerprint "$WORK/after.txt"
if ! diff -u "$WORK/before.txt" "$WORK/after.txt" > "$WORK/diff.txt"; then
  echo "ROLLBACK LEFT DIFFERENCES:"; head -40 "$WORK/diff.txt"; exit 1
fi
after=$(psql_ -d "$DB" -At -c "select (select count(*) from public.club_households) || ' households, ' || (select count(*) from public.club_family_members) || ' family members'")
[[ "$kept" == "$after" ]] || { echo "ROLLBACK LOST FAMILY DATA: $kept → $after"; exit 1; }
echo "rolled back: schema identical to before 20261124; kept $after"
# The older suites count their own rows exactly, so the families the household suites made are cleared first; what's
# being proven here is that the restored functions and policies work.
psql_ -d "$DB" -c "delete from auth.users" >/dev/null
for t in accounts-access club-access club-profile club-welcome-plan; do
  if out=$(psql_ -d "$DB" -o /dev/null -f "supabase/tests/$t.sql" 2>&1); then echo "ok after rollback: $t ($(grep -c 'ok - ' <<<"$out") checks)"
  else echo "$out" | tail -5; echo "FAILED after rollback: $t"; exit 1; fi
done
psql_ -d postgres -c "drop database $DB with (force)" >/dev/null
rm -rf "$WORK"
echo "household rollback rehearsal passed"
