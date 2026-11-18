#!/usr/bin/env bash
# Rehearses 20261204_agreement_follow_through on a THROWAWAY local database shaped like production: exactly the
# migrations production has (read 2026-11-18: everything up to 20261201 except 20261130; not 20261202/03/04), with real
# agreement rows (the family-agreements suite). preflight → snapshot → apply → verify → snapshot unchanged → exercise
# (follow-through suite) → rollback → schema identical to before → agreements identical → apply again → verify.
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash scripts/rehearse-follow-through.sh
# Creates (and drops) the database `follow_through`. Never point it at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=follow_through
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
p() { psql -X -q -v ON_ERROR_STOP=1 -d $DB "$@"; }
q() { p -At -F' | ' "$@"; }
M=supabase/migrations/20261204000000_agreement_follow_through.sql
R=supabase/rollout/follow-through
fail() { echo "FAIL $*"; exit 1; }
schema() { q -c "select 'col ' || table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable from information_schema.columns where table_schema = 'public'
  union all select 'fn ' || p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = 'public'::regnamespace
  union all select 'con ' || conname || ' ' || md5(pg_get_constraintdef(oid)) from pg_constraint where connamespace = 'public'::regnamespace order by 1"; }
agreements() { q -c "select md5(string_agg(r::text, ',' order by r.id)) from (select id, household_id, status, category, owner_ids, helper_ids, agreed_text, agreed_finished, agreed_when, agreed_month, agreed_source, revision, deleted_at, confirmed_at from public.club_responsibilities) r"; }

psql -X -q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
p -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  case "$(basename "$f")" in 20261130*|20261202*|20261203*|20261204*) continue ;; esac
  if ! out=$(p -f "$f" 2>&1 >/dev/null); then
    [[ "$(basename "$f")" =~ (shop_gelato_private_storage|marketing|email|newsletter|subscriber_resource|welcome_delivery|checkout_offers|pinterest_queue) ]] || { echo "$out"; fail "replay: $f"; }
  fi
done
p -o /dev/null -f supabase/tests/family-agreements.sql >/dev/null 2>&1 || fail "seeding agreements"
echo "replay: $(q -c "select count(*) from club_responsibilities where status = 'confirmed'") agreements, $(q -c "select count(*) from club_responsibilities where status in ('existing','desired')") profile rows"

bad=$(q -f $R/preflight.sql | head -6 | grep ' | f$' || true); [[ -z "$bad" ]] || { echo "$bad"; fail preflight; }
echo "ok - preflight: every check passes"
snap0=$(q -f $R/preflight.sql | tail -n +7); schema0=$(schema); ag0=$(agreements)
p -f "$M" >/dev/null && echo "ok - migration applies"
bad=$(q -f $R/verify.sql | grep ' | f$' || true); [[ -z "$bad" ]] || { echo "$bad"; fail verify; }
echo "ok - verify: $(q -f $R/verify.sql | wc -l) checks pass"
[ "$snap0" = "$(q -f $R/preflight.sql | tail -n +7)" ] && echo "ok - row counts and the existing agreement functions are byte-identical" || fail "snapshot changed"
[ "$ag0" = "$(agreements)" ] && echo "ok - every agreement row unchanged by applying"
p -o /dev/null -f supabase/tests/agreement-follow-through.sql >/dev/null 2>&1 && echo "ok - follow-through suite passes on the applied database" || fail "follow-through suite"
p -f $R/rollback.sql >/dev/null && echo "ok - rollback runs"
diff <(echo "$schema0") <(schema) >/dev/null && echo "ok - schema identical to before applying (every column, function and constraint)" || { diff <(echo "$schema0") <(schema) | head; fail "schema differs after rollback"; }
p -f "$M" >/dev/null && echo "ok - applies again after a rollback"
bad=$(q -f $R/verify.sql | grep ' | f$' || true); [[ -z "$bad" ]] && echo "ok - verify passes again" || { echo "$bad"; fail verify2; }
psql -X -q -d postgres -c "drop database $DB with (force)" >/dev/null
echo "rehearsal passed"
