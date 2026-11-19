#!/usr/bin/env bash
# Rehearses the Connect Google Calendar rollout (20261206) on a THROWAWAY local database, the way
# docs/calendar/GOOGLE_CALENDAR.md describes it. Never point it at a real project.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash scripts/rehearse-calendar-google-rollout.sh
#
# 1. Every migration through 20261205 (production's state), a real family, a live iCal subscription.
# 2. preflight.sql: every check ok; snapshot and schema fingerprint taken.
# 3. Apply 20261206; verify.sql ok; snapshot identical (no family data, iCal subscription or function touched).
# 4. Use it: the calendar-google suite, and the calendar-feeds (iCal) suite on top.
# 5. rollback.sql: fingerprint identical to step 2, no Google tokens left in Vault, the iCal subscription intact.
# 6. Apply again.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=calendar_google_rollout_rehearsal
R=supabase/rollout/calendar-google
M=supabase/migrations/20261206000000_calendar_google.sql
WORK=$(mktemp -d)
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
psql_() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_ -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null 2>&1
psql_ -d "$DB" -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  [[ "$(basename "$f")" < "20261206" ]] || continue
  if ! out=$(psql_ -d "$DB" -f "$f" 2>&1 >/dev/null); then
    case "$(basename "$f")" in
      20261102000000_shop_gelato_private_storage.sql) ;;
      *marketing*|*email*|*newsletter*|*subscriber_resource*|*welcome_delivery*|*checkout_offers*|*pinterest_queue*) ;;
      *) echo "$out" | grep -v -e 'already exists, skipping' -e NOTICE; echo "migration failed: $f"; exit 1 ;;
    esac
  fi
done
psql_ -d "$DB" -f scripts/e2e/seed.sql
psql_ -d "$DB" -f scripts/e2e/calendar-seed.sql
echo "before 20261206: $(psql_ -d "$DB" -At -c 'select count(*) from public.calendar_feeds') iCal subscriptions, $(psql_ -d "$DB" -At -c 'select count(*) from public.calendar_feed_events') imported events"

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
psql_ -d "$DB" -At -F ' | ' -f "$R/preflight.sql" | grep -vE ' \| [tf]$' | grep -v 'calendar_feed_events(' > "$WORK/snapshot-after.txt"
grep -v 'calendar_feed_events(' "$WORK/snapshot-before.txt" > "$WORK/snapshot-before-cmp.txt"
diff -u "$WORK/snapshot-before-cmp.txt" "$WORK/snapshot-after.txt" || { echo "APPLYING CHANGED DATA OR FUNCTIONS IT MUST NOT TOUCH"; exit 1; }
echo "applying left family data, the iCal subscriptions and $(grep -c '(' "$WORK/snapshot-before-cmp.txt") unrelated functions identical"
# The iCal subscription still refreshes through the new claim, with its link.
[[ "$(psql_ -d "$DB" -At -c "update public.calendar_feeds set last_attempt_at = null; select count(*) from jsonb_array_elements(public.calendar_feed_claim(50)) c where c->>'kind' = 'ical' and c ? 'url'")" == "2" ]] || { echo "iCAL CLAIM BROKEN"; exit 1; }
echo "the refresher still claims the iCal subscriptions with their links"

for t in calendar-feeds calendar-google; do
  out=$(psql_ -d "$DB" -o /dev/null -f "supabase/tests/$t.sql" 2>&1) || { echo "$out" | tail -5; echo "$t suite failed"; exit 1; }
  echo "in use: $t ($(grep -c 'ok - ' <<<"$out") checks ok)"
done

psql_ -d "$DB" -f "$R/rollback.sql" >/dev/null
psql_ -d "$DB" -At -F ' | ' -f supabase/rollout/household/fingerprint.sql > "$WORK/fp-after.txt"
diff -u "$WORK/fp-before.txt" "$WORK/fp-after.txt" || { echo "ROLLBACK LEFT DIFFERENCES"; exit 1; }
[[ "$(psql_ -d "$DB" -At -c "select count(*) from vault.secrets where name like 'calendar\\_google:%'")" == "0" ]] || { echo "ROLLBACK LEFT GOOGLE TOKENS"; exit 1; }
[[ "$(psql_ -d "$DB" -At -c "select count(*) from public.calendar_feeds where kind = 'ical' and name = 'Lincoln Elementary'")" == "1" ]] || { echo "ROLLBACK LOST AN iCAL SUBSCRIPTION"; exit 1; }
echo "rolled back: schema identical to after 20261205 ($(wc -l < "$WORK/fp-before.txt") objects); no Google tokens left; iCal subscriptions kept"

psql_ -d "$DB" -f "$M" >/dev/null
! psql_ -d "$DB" -At -F ' | ' -f "$R/verify.sql" | grep -q ' | f$' || { echo "RE-APPLY FAILED"; exit 1; }
echo "re-applied after rollback: verify ok"
psql_ -d postgres -c "drop database $DB with (force)" >/dev/null
rm -rf "$WORK"
echo "Google Calendar rollout rehearsal passed"
