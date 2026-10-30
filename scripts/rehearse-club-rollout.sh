#!/usr/bin/env bash
# Rehearses the production rollout of 20261108000000_club_welcome_kit.sql and 20261109000000_club_family_profile.sql
# (docs/club/PRODUCTION_ROLLOUT.md) on a throwaway local database shaped like production: every migration production
# has, a founding member with a welcome print and a January order (supabase/tests/club-dev-seed.sql). Then:
# fingerprint and snapshot → apply both → verify → snapshot unchanged → rollback refuses once a member saved profile
# answers → rollback → definitions and data exactly as before → apply both again → verify.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash scripts/rehearse-club-rollout.sh
#
# Creates (and drops) the database `club_rollout`. Never point it at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=club_rollout
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
p() { psql -X -q -v ON_ERROR_STOP=1 -d $DB "$@"; }
q() { p -At -F' ' "$@"; }
WK=supabase/migrations/20261108000000_club_welcome_kit.sql
FP=supabase/migrations/20261109000000_club_family_profile.sql
fail() { echo "FAIL $*"; exit 1; }

psql -X -q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
p -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  [[ "$f" == "$WK" || "$f" == "$FP" ]] && continue
  p -f "$f" 2>&1 >/dev/null | { grep -v -e 'already exists, skipping' -e NOTICE || true; }
done
p -o /dev/null -f supabase/tests/club-dev-seed.sql

snap0=$(q -f supabase/rollout/snapshot.sql)
# The replay matches production's definitions, except a comment-only difference in club_admin_set_fulfillment.
diff <(grep -v '^#' supabase/rollout/production-fingerprint.txt | sort | grep -v club_admin_set_fulfillment) <(q -f supabase/rollout/fingerprint.sql | sort | grep -v club_admin_set_fulfillment) >/dev/null \
  && echo "ok - the replay matches production's definitions (club_admin_set_fulfillment: comment only)" || fail "replay differs from production"

echo "production replay: $(q -c 'select count(*) from club_fulfillment_orders') orders, $(q -c 'select count(*) from club_households') households"

p -f "$WK" >/dev/null && p -f "$FP" >/dev/null && echo "ok - both migrations apply, in order"
checks=$(q -f supabase/rollout/verify.sql)
echo "$checks" | grep -q ' f$' && { echo "$checks"; fail "verify.sql"; }
echo "ok - verify.sql: $(echo "$checks" | grep -c ' t$') checks pass"
echo "$checks" | grep '^queue' | sed 's/^/     /'
[ "$snap0" = "$(q -f supabase/rollout/snapshot.sql)" ] && echo "ok - snapshot unchanged (households, members, orders, entitlements, versions, subscriptions, addresses, emails)" || fail "snapshot changed"

# Rollback refuses once a member has saved profile answers.
q -c "update public.club_households set priority = 'mornings' where id = (select id from public.club_households limit 1)" >/dev/null
p -f supabase/rollout/rollback.sql >/dev/null 2>&1 && fail "rollback ran over saved profile answers"
echo "ok - rollback refuses when members saved profile answers (and changes nothing): $(q -c "select count(*) from public.club_households where priority is not null") answer kept"
q -c "update public.club_households set priority = null" >/dev/null

p -f supabase/rollout/rollback.sql >/dev/null && echo "ok - rollback runs"
# Back to production's definitions exactly (supabase/rollout/production-fingerprint.txt: the repo's, except a comment
# missing from production's club_admin_set_fulfillment).
prod=$(grep -v '^#' supabase/rollout/production-fingerprint.txt | sort)
[ "$prod" = "$(q -f supabase/rollout/fingerprint.sql | sort)" ] && echo "ok - every replaced definition is back, identical to production's" || { diff <(echo "$prod") <(q -f supabase/rollout/fingerprint.sql | sort); fail "definitions differ from production's after rollback"; }
[ "$snap0" = "$(q -f supabase/rollout/snapshot.sql)" ] && echo "ok - data unchanged after rollback" || fail "data changed after rollback"
[ -z "$(q -c "select 1 from pg_proc where proname in ('club_family_profile', 'club_admin_set_welcome_kit')")" ] && echo "ok - new functions gone"

p -f "$WK" >/dev/null && p -f "$FP" >/dev/null && echo "ok - both apply again after a rollback"
q -f supabase/rollout/verify.sql | grep -q ' f$' && fail "verify after re-apply" || echo "ok - verify.sql passes again"

psql -X -q -d postgres -c "drop database $DB with (force)" >/dev/null
echo "rollout rehearsal passed"
