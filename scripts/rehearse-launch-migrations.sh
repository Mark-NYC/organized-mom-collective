#!/usr/bin/env bash
# Rehearses the App Store launch's two migrations (docs/ios/APP_STORE_LAUNCH.md → Migrations) on a THROWAWAY local
# database built at production's migration set: every migration except the ones production doesn't have
# (20261130, 20261202-04, 20261207, 20261208; checked read-only on 2026-11-21; and 20261209 onward, which come after). Never point it at a real project.
#
#   PGHOST=localhost PGUSER=postgres bash scripts/rehearse-launch-migrations.sh
#
# 1. Production's set + realistic rows: households with a second adult, agreements, a paid subscription with its
#    paid month, a beta grant. Fingerprint (every function, column, policy, trigger, grant) and a data snapshot.
# 2. 20261207 alone: preflight, apply, verify. Then 20261208 alone: preflight, apply, verify. Data snapshot unchanged.
# 3. Uses both: a development record, an owner's complimentary grant (both adults see it), a revoke, a re-grant.
#    The paid subscription row is unchanged throughout.
# 4. Rolls back 20261208, then 20261207. Fingerprint identical to step 1; the data snapshot identical except the one
#    grant made in step 3 (kept, as beta, so the family keeps access).
# 5. Re-applies 20261207 and 20261208 (preflight, apply, verify).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=launch_migrations_rehearsal
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
PENDING='^20261130|^2026120[234]|^20261207|^20261208|^20261209|^20261210|^20261211|^20261212|^20261213|^20261214|^20261215|^20261216'
M1207=supabase/migrations/20261207000000_family_development_records.sql
M1208=supabase/migrations/20261208000000_club_complimentary_access.sql
FD=supabase/rollout/family-development
CC=supabase/rollout/club-complimentary
WORK=$(mktemp -d)
psql_() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
step() { echo; echo "== $*"; }
fail() { echo "FAILED: $*"; exit 1; }
checks() { # every row of a preflight/verify file must say ok = t
  local out; out=$(psql_ -At -F '|' -f "$1")
  echo "$out" | sed 's/^/   /'
  if echo "$out" | grep -q '|f$'; then fail "$1"; fi
  echo "   $(echo "$out" | grep -c '|t$') ok"
}
rows() { psql_ -At -c "select t from (
  select 'h' || id || display_name || owner_user_id as t from public.club_households
  union all select 'a' || household_id || user_id || role from public.household_adults
  union all select 'm' || id || first_name || kind || coalesce(archived_at::text, '') from public.club_family_members
  union all select 'r' || id || coalesce(agreed_text, '') || status || coalesce(deleted_at::text, '') from public.club_responsibilities
  union all select 's' || stripe_subscription_id || status || cancel_at_period_end || coalesce(access_revoked_at::text, '') || current_period_end from public.club_subscriptions
  union all select 'e' || id || resource_month || coalesce(revoked_at::text, '') from public.club_entitlements
  union all select 'g' || user_id || reason || coalesce(note, '') || coalesce(revoked_at::text, '') from public.club_access_grants
    where coalesce(note, '') <> 'rehearsal grant') x order by t"; }
snapshot() { rows | md5sum | cut -c1-32; }
fingerprint() { psql_ -At -F ' | ' -f supabase/rollout/household/fingerprint.sql > "$1"; }
as_user() { echo "select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = '$1'))::text, false); set role authenticated;"; }

step "1. production's migration set on a throwaway database"
psql -X -q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
psql_ -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
n=0
for f in supabase/migrations/*.sql; do
  b=$(basename "$f")
  [[ "$b" =~ $PENDING ]] && continue
  if ! out=$(psql_ -f "$f" 2>&1 >/dev/null); then
    case "$b" in
      20261102000000_shop_gelato_private_storage.sql) ;; # never applied in production
      *marketing*|*email*|*newsletter*|*subscriber_resource*|*welcome_delivery*|*checkout_offers*|*pinterest_queue*) ;; # Supabase-only extensions
      *) echo "$out" | grep -v -e 'already exists, skipping' -e NOTICE; fail "migration $b" ;;
    esac
  fi
  n=$((n + 1))
done
echo "   $n migrations; left out (pending): $(ls supabase/migrations | grep -E "$PENDING" | tr '\n' ' ')"
[[ -z "$(psql_ -At -c "select to_regclass('public.household_development')")" ]] || fail "20261207 objects already present"

psql_ >/dev/null <<SQL
insert into auth.users (id, email, email_confirmed_at) values
  (gen_random_uuid(), 'owner-admin@rehearsal.test', now()), (gen_random_uuid(), 'ana@rehearsal.test', now()),
  (gen_random_uuid(), 'tom@rehearsal.test', now()), (gen_random_uuid(), 'pia@rehearsal.test', now()),
  (gen_random_uuid(), 'bea@rehearsal.test', now());
insert into public.admin_users (user_id, role) select id, 'owner' from auth.users where email = 'owner-admin@rehearsal.test';
update public.club_kits set status = 'scheduled', release_at = least(release_at, now()) where month = date_trunc('month', now())::date;
$(as_user ana@rehearsal.test)
select public.club_household_save('The Riveras', '{}', '[{"first_name":"Ana","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Tom","kind":"adult","role":"partner"},{"first_name":"Lily","kind":"child","role":"child","birth_year":2015,"birth_month":3}]');
select public.household_agreement_save(jsonb_build_object('id', gen_random_uuid(), 'category', 'cleaning', 'text', 'Lily feeds the cat', 'owner_ids', jsonb_build_array((select id from public.club_family_members where first_name = 'Lily'))), null);
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Tom'), 'tom@rehearsal.test') ->> 'code' as code;
reset role;
$(as_user tom@rehearsal.test)
select public.household_invite_accept((select code from inv));
reset role;
$(as_user pia@rehearsal.test)
select public.club_household_save('The Payers', '{}', '[{"first_name":"Pia","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Ola","kind":"child","role":"child","birth_year":2017,"birth_month":5}]');
reset role;
$(as_user bea@rehearsal.test)
select public.club_household_save('The Betas', '{}', '[{"first_name":"Bea","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, current_period_start, current_period_end, started_at, livemode)
  select 'sub_Rehearsal', 'cus_Rehearsal', id, 'active', 'price_1', now() - interval '2 days', now() + interval '28 days', now(), false from auth.users where email = 'pia@rehearsal.test';
insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source, note, subscription_id)
  select u.id, h.id, k.month, k.id, 'digital', 1, 'monthly', 'admin', 'rehearsal paid month', s.id from auth.users u
    join public.club_households h on h.owner_user_id = u.id join public.club_kits k on k.month = date_trunc('month', now())::date
    join public.club_subscriptions s on s.stripe_subscription_id = 'sub_Rehearsal' where u.email = 'pia@rehearsal.test';
insert into public.club_access_grants (user_id, reason, note) select id, 'beta', 'existing beta' from auth.users where email = 'bea@rehearsal.test';
SQL
[[ "$(psql_ -At -c "select count(*) from public.household_adults a join public.club_households h on h.id = a.household_id where h.display_name = 'The Riveras'")" == 2 ]] || fail "second adult setup"
fingerprint "$WORK/before.txt"
DATA0=$(snapshot); rows > "$WORK/data-before.txt"
paid=$(psql_ -At -c "select public.club_has_access(id) from auth.users where email = 'pia@rehearsal.test'")
echo "   fingerprint $(wc -l < "$WORK/before.txt") lines; data $DATA0; paid member has access: $paid"

step "2a. 20261207 by itself: preflight, apply, verify"
checks "$FD/preflight.sql"
psql_ -f "$M1207" >/dev/null
checks "$FD/verify.sql"
step "2b. 20261208 by itself: preflight, apply, verify"
checks "$CC/preflight.sql"
psql_ -f "$CC/preflight.sql" -At >/dev/null
psql_ -f "$M1208" >/dev/null
checks "$CC/verify.sql"
[[ "$(snapshot)" == "$DATA0" ]] || fail "existing rows changed by applying 20261207 + 20261208"
echo "   existing households, adults, people, agreements, subscriptions, paid months and grants: unchanged"

step "3. use both"
uid() { psql_ -At -c "select id from auth.users where email = '$1'"; }
q() { psql_ -At -c "$(as_user "$1") $2" | tail -1; }
q owner-admin@rehearsal.test "select public.club_admin_access_grant('$(uid tom@rehearsal.test)', null, 'rehearsal grant') ->> 'status'" | grep -qx complimentary || fail "grant"
for who in ana tom; do
  [[ "$(q $who@rehearsal.test "select (public.club_me() ->> 'access') || ',' || coalesce(public.club_me() ->> 'grant', 'null')")" == "true,complimentary" ]] || fail "$who: club_me after grant"
done
echo "   granted from the second adult's email: both adults see access and the grant"
q ana@rehearsal.test "select public.household_development_decide(jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', (select id from public.club_family_members where first_name = 'Lily'), 'skill_id', 'school-bag', 'title', 'Pack my backpack', 'stage', 'model', 'category', 'school-prep', 'agreement_id', gen_random_uuid(), 'library_version', 1)) is not null" | grep -qx t || fail "development record"
echo "   a development record (and its agreement) made under the grant"
if q ana@rehearsal.test "select public.club_admin_access_grant('$(uid ana@rehearsal.test)')" >/dev/null 2>&1; then fail "a family granted itself"; fi
echo "   a family member calling the grant function: refused"
q owner-admin@rehearsal.test "select public.club_admin_access_revoke('$(uid ana@rehearsal.test)', 'rehearsal')" >/dev/null
[[ "$(q tom@rehearsal.test "select public.club_me() ->> 'access'")" == false ]] || fail "revoke"
q owner-admin@rehearsal.test "select public.club_admin_access_grant('$(uid ana@rehearsal.test)', null, 'rehearsal grant')" >/dev/null
[[ "$(q tom@rehearsal.test "select public.club_me() ->> 'access'")" == true ]] || fail "re-grant"
echo "   revoke closes it for both; re-grant opens it"
q owner-admin@rehearsal.test "select public.club_admin_access_grant('$(uid pia@rehearsal.test)', null, 'rehearsal grant') ->> 'status'" | grep -qx paid_and_complimentary || fail "paid + complimentary"
q owner-admin@rehearsal.test "select public.club_admin_access_revoke('$(uid pia@rehearsal.test)', 'rehearsal') ->> 'status'" | grep -qx paid || fail "revoke leaves paid"
[[ "$(psql_ -At -c "select status || ',' || cancel_at_period_end || ',' || (access_revoked_at is null) from public.club_subscriptions where stripe_subscription_id = 'sub_Rehearsal'")" == "active,false,true" ]] || fail "subscription touched"
echo "   paid household: grant → Paid + Complimentary; revoke → Paid; the subscription row is unchanged"
echo "   audit entries: $(psql_ -At -c "select count(*) from public.admin_audit_log where action like 'club.access.%'")"

step "4. roll back 20261208, then 20261207"
psql_ -f "$CC/rollback.sql" >/dev/null
psql_ -f "$FD/rollback.sql" >/dev/null
fingerprint "$WORK/after.txt"
if ! diff -q "$WORK/before.txt" "$WORK/after.txt" >/dev/null; then diff "$WORK/before.txt" "$WORK/after.txt" | head -20; fail "schema differs after rollback"; fi
echo "   schema identical to before (fingerprint)"
rows > "$WORK/data-after.txt"
# The only expected difference: the agreement made through the development step in step 3, which the 20261207
# rollback deliberately keeps (an ordinary agreement, agreed_source 'skill:…').
extra=$(comm -13 "$WORK/data-before.txt" "$WORK/data-after.txt")
missing=$(comm -23 "$WORK/data-before.txt" "$WORK/data-after.txt")
[[ -z "$missing" ]] || { echo "$missing"; fail "rows lost or changed after rollback"; }
[[ "$(echo "$extra" | grep -c .)" == 1 && "$extra" == r*"Pack my backpack"* ]] || { echo "$extra"; fail "unexpected rows after rollback"; }
echo "   every row from before is still there, unchanged; one addition: the agreement made through the development step (kept by design)"
echo "   the rehearsal's own grants kept as: $(psql_ -At -c "select string_agg(distinct reason, ',') from public.club_access_grants where note = 'rehearsal grant'") (families keep access)"
[[ "$(psql_ -At -c "select public.club_has_access(id) from auth.users where email = 'pia@rehearsal.test'")" == "$paid" ]] || fail "paid access after rollback"

step "5. re-apply 20261207 and 20261208"
psql_ -c "delete from public.club_access_grants where note = 'rehearsal grant'" >/dev/null # preflight expects a clean slate
checks "$FD/preflight.sql"; psql_ -f "$M1207" >/dev/null; checks "$FD/verify.sql"
checks "$CC/preflight.sql"; psql_ -f "$M1208" >/dev/null; checks "$CC/verify.sql"

psql -X -q -d postgres -c "drop database $DB with (force)" >/dev/null
echo; echo "launch migrations rehearsal passed"
