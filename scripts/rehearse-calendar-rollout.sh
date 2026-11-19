#!/usr/bin/env bash
# Rehearses the calendar subscriptions rollout (20261205) on a THROWAWAY local database, the way docs/calendar/ROLLOUT.md
# describes it. Never point it at a real project.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash scripts/rehearse-calendar-rollout.sh
#
# 1. Every migration before 20261205, plus a real family with family-calendar events (scripts/e2e/seed.sql).
# 2. preflight.sql: every check ok; snapshot and schema fingerprint taken.
# 3. Apply 20261205; verify.sql: every check ok; the snapshot is identical (no family data or function touched).
# 4. Use it: subscriptions, imported events (calendar-seed.sql and the full calendar-feeds suite).
# 5. rollback.sql: fingerprint identical to step 2, snapshot identical, family events intact.
# 6. Apply again (a second rollout after a rollback works).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=calendar_rollout_rehearsal
R=supabase/rollout/calendar
M=supabase/migrations/20261205000000_calendar_feeds.sql
WORK=$(mktemp -d)
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
psql_() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
ok_only() { psql_ -d "$DB" -At -F ' | ' -f "$1" | head -n "$2"; }

psql_ -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null 2>&1
psql_ -d "$DB" -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  [[ "$(basename "$f")" < "20261205" ]] || continue
  if ! out=$(psql_ -d "$DB" -f "$f" 2>&1 >/dev/null); then
    case "$(basename "$f")" in
      20261102000000_shop_gelato_private_storage.sql) ;;
      *marketing*|*email*|*newsletter*|*subscriber_resource*|*welcome_delivery*|*checkout_offers*|*pinterest_queue*) ;;
      *) echo "$out" | grep -v -e 'already exists, skipping' -e NOTICE; echo "migration failed: $f"; exit 1 ;;
    esac
  fi
done
psql_ -d "$DB" -f scripts/e2e/seed.sql
echo "before 20261205: $(psql_ -d "$DB" -At -c 'select count(*) from public.calendar_events') family events, $(psql_ -d "$DB" -At -c 'select count(*) from public.club_households') households"

checks=$(psql_ -d "$DB" -At -F ' | ' -f "$R/preflight.sql" | grep -E ' \| [tf]$')
bad=$(grep ' | f$' <<<"$checks" || true)
[[ -z "$bad" ]] || { echo "PREFLIGHT FAILED:"; echo "$bad"; exit 1; }
echo "preflight: $(wc -l <<<"$checks") checks ok"
psql_ -d "$DB" -At -F ' | ' -f "$R/preflight.sql" | grep -vE ' \| [tf]$' > "$WORK/snapshot-before.txt"
psql_ -d "$DB" -At -F ' | ' -f supabase/rollout/household/fingerprint.sql > "$WORK/fp-before.txt"

psql_ -d "$DB" -f "$M" >/dev/null
v=$(psql_ -d "$DB" -At -F ' | ' -f "$R/verify.sql")
bad=$(grep ' | f$' <<<"$v" || true)
[[ -z "$bad" ]] || { echo "VERIFY FAILED:"; echo "$bad"; exit 1; }
echo "applied; verify: $(wc -l <<<"$v") checks ok"
psql_ -d "$DB" -At -F ' | ' -f "$R/preflight.sql" | grep -vE ' \| [tf]$' > "$WORK/snapshot-after.txt"
diff -u "$WORK/snapshot-before.txt" "$WORK/snapshot-after.txt" || { echo "APPLYING CHANGED FAMILY DATA OR FUNCTIONS"; exit 1; }
echo "applying left family data and existing functions identical ($(wc -l < "$WORK/snapshot-before.txt") rows compared)"

psql_ -d "$DB" -f scripts/e2e/calendar-seed.sql
out=$(psql_ -d "$DB" -o /dev/null -f supabase/tests/calendar-feeds.sql 2>&1) || { echo "$out" | tail -5; echo "calendar suite failed"; exit 1; }
echo "in use: $(psql_ -d "$DB" -At -c 'select count(*) from public.calendar_feeds') subscriptions, $(psql_ -d "$DB" -At -c 'select count(*) from public.calendar_feed_events') imported events ($(grep -c 'ok - ' <<<"$out") suite checks ok)"
psql_ -d "$DB" -At -F ' | ' -f "$R/preflight.sql" | grep -vE ' \| [tf]$' | grep -v '^rows: \|^max ' > "$WORK/fns-in-use.txt"

psql_ -d "$DB" -f "$R/rollback.sql" >/dev/null
psql_ -d "$DB" -At -F ' | ' -f supabase/rollout/household/fingerprint.sql > "$WORK/fp-after.txt"
diff -u "$WORK/fp-before.txt" "$WORK/fp-after.txt" || { echo "ROLLBACK LEFT DIFFERENCES"; exit 1; }
grep -v '^rows: \|^max ' "$WORK/snapshot-before.txt" > "$WORK/fns-before.txt"
diff -u "$WORK/fns-before.txt" "$WORK/fns-in-use.txt" || { echo "EXISTING FUNCTIONS CHANGED WHILE IN USE"; exit 1; }
echo "rolled back: schema identical to before 20261205 ($(wc -l < "$WORK/fp-before.txt") objects); family calendar functions unchanged"
[[ "$(psql_ -d "$DB" -At -c "select count(*) from public.calendar_events where title = 'Ruiz private appointment'")" == "1" ]] || { echo "ROLLBACK LOST A FAMILY EVENT"; exit 1; }
[[ "$(psql_ -d "$DB" -At -c "select count(*) from vault.secrets where name like 'calendar\\_feed:%'")" == "0" ]] || { echo "ROLLBACK LEFT CALENDAR LINKS IN VAULT"; exit 1; }
echo "rollback left no calendar links in Vault"

psql_ -d "$DB" -f "$M" >/dev/null
v=$(psql_ -d "$DB" -At -F ' | ' -f "$R/verify.sql")
! grep -q ' | f$' <<<"$v" || { echo "RE-APPLY FAILED"; exit 1; }
echo "re-applied after rollback: verify ok"
psql_ -d postgres -c "drop database $DB with (force)" >/dev/null
rm -rf "$WORK"
echo "calendar rollout rehearsal passed"
