#!/usr/bin/env bash
# Upgrade check for 20261109000000_club_family_profile.sql against production's migration state (no Supabase branch:
# branching needs the Pro plan). Builds a throwaway database with every migration production has (skips the ones it
# doesn't: club_welcome_kit, and this one), seeds households shaped like production's through the pre-migration
# functions, applies the migration, and checks that existing rows are unchanged, legacy answers survive, isolation
# and grants hold, and supabase/tests/club-profile.sql passes. Re-check production's list (Supabase → list_migrations)
# before relying on the skip list.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash scripts/verify-family-profile-upgrade.sh
#
# Creates (and drops) the database `prod_replay`. Never point it at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=prod_replay
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
p() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
p -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
p -d $DB -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  case "$f" in *20261108000000_club_welcome_kit.sql|*20261109000000_club_family_profile.sql) continue;; esac
  p -d $DB -f "$f" 2>&1 >/dev/null | { grep -v -e 'already exists, skipping' -e NOTICE || true; }
done
p -d $DB -f supabase/tests/family-profile-upgrade-seed.sql >/dev/null
snap="select md5(string_agg(t::text, '|' order by t::text)) from (select h.id, h.owner_user_id, h.display_name, h.preferences, h.profile_version, h.onboarded_at, h.created_at, h.enrolled_at, h.first_paid_month from public.club_households h) t"
msnap="select md5(string_agg(m::text, '|' order by m.id)) from public.club_family_members m"
before=$(p -d $DB -At -c "$snap"); mbefore=$(p -d $DB -At -c "$msnap")
echo "before: $(p -d $DB -At -c 'select count(*) from club_households')/$(p -d $DB -At -c 'select count(*) from club_households where onboarded_at is not null') households, $(p -d $DB -At -c 'select count(*) from club_family_members') members"
p -d $DB -f supabase/migrations/20261109000000_club_family_profile.sql >/dev/null
after=$(p -d $DB -At -c "$snap"); mafter=$(p -d $DB -At -c "$msnap")
[ "$before" = "$after" ] && echo "ok - every existing household's original columns unchanged" || { echo "FAIL households changed"; exit 1; }
[ "$mbefore" = "$mafter" ] && echo "ok - every family member row unchanged" || { echo "FAIL members changed"; exit 1; }
p -d $DB -At -c "select 'ok - new columns default safely: ' || bool_and(challenges = '{}' and setup_done = '{}' and priority is null and setup_completed_at is null) from club_households"
p -d $DB -At -c "select 'ok - legacy priorities kept: ' || (preferences -> 'priorities')::text from club_households where preferences ? 'priorities'"
# Existing onboarded customer: reads her profile, saves a step, re-saves family through the updated form shape; legacy priorities survive.
p -d $DB -At <<'SQL'
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}',false) \g /dev/null
set role authenticated;
select 'ok - existing customer profile readable, setup open: ' || (public.club_family_profile() ->> 'setup_completed');
select 'ok - existing customer saves a step: ' || (public.club_activities_save('[{"category":"school"}]') -> 'setup_done')::text;
select public.club_household_save('The Rivera Family', (select preferences from public.club_households), (select jsonb_agg(jsonb_build_object('id',id,'first_name',first_name,'kind',kind,'role',role,'birth_year',birth_year,'birth_month',birth_month,'is_account_holder',is_account_holder)) from public.club_family_members)) \g /dev/null
select 'ok - legacy priorities survive a family save: ' || (preferences -> 'priorities')::text from public.club_households;
reset role;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000003"}',false) \g /dev/null
set role authenticated;
select 'ok - enrolled-not-onboarded household reads an empty profile: ' || jsonb_array_length(public.club_family_profile() -> 'activities');
select 'ok - and sees none of another household''s rows: ' || ((select count(*) from public.club_activities) = 0);
reset role;
SQL
p -d $DB -At -c "select 'ok - RLS on new tables: ' || bool_and(relrowsecurity) from pg_class where oid in ('public.club_activities'::regclass,'public.club_responsibilities'::regclass)"
p -d $DB -At -c "select 'ok - anon can execute none of the new functions: ' || not bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p where pronamespace='public'::regnamespace and proname in ('club_my_household','club_members_belong','club_uuid_list','club_setup_mark','club_family_profile','club_activities_save','club_responsibilities_save','club_focus_save')"
p -d $DB -At -c "select 'ok - anon has no table privileges on new tables: ' || not (has_table_privilege('anon','public.club_activities','select,insert,update,delete') or has_table_privilege('anon','public.club_responsibilities','select,insert,update,delete'))"
p -d $DB -At -c "select 'ok - authenticated cannot write new tables directly: ' || not (has_table_privilege('authenticated','public.club_activities','insert,update,delete') or has_table_privilege('authenticated','public.club_responsibilities','insert,update,delete'))"
p -d $DB -At -c "select 'ok - new functions are security definer with empty search_path: ' || bool_and(prosecdef and proconfig = array['search_path=\"\"']) from pg_proc where pronamespace='public'::regnamespace and proname in ('club_my_household','club_members_belong','club_setup_mark','club_family_profile','club_activities_save','club_responsibilities_save','club_focus_save')"
p -d $DB -o /dev/null -f supabase/tests/club-profile.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //' | grep -c '^ok' | sed 's/^/ok - club-profile.sql checks passed on the production replay: /'
p -d postgres -c "drop database $DB with (force)" >/dev/null
