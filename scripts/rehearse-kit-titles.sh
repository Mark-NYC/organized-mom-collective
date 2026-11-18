#!/usr/bin/env bash
# Rehearses 20261202000000_club_kit_titles_january_september.sql (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §10) on
# a throwaway local database shaped like production: exactly the migrations production has (read 2026-11-18: all up
# to 20261201 except 20261130), the founding-member seed, the kit rows' production titles and statuses, January
# held by 12 members with 2 saved versions. Then: snapshot → apply → exactly two titles change, nothing else →
# apply again changes nothing → an admin-edited title is never touched → rollback → back exactly → apply again.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash scripts/rehearse-kit-titles.sh
# Creates (and drops) the database `kit_titles`. Never point it at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=kit_titles
export PGHOST=${PGHOST:-localhost} PGPORT=${PGPORT:-5432} PGUSER=${PGUSER:-postgres}
p() { psql -X -q -v ON_ERROR_STOP=1 -d $DB "$@"; }
q() { p -At -F'|' "$@"; }
M=supabase/migrations/20261202000000_club_kit_titles_january_september.sql
RB=supabase/rollout/kit-titles/rollback-20261202.sql
fail() { echo "FAIL $*"; exit 1; }

psql -X -q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB" >/dev/null
p -f supabase/tests/supabase-stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do
  case "$(basename "$f")" in 20261130*|20261202*|20261203*) continue ;; esac
  # Same tolerance as scripts/e2e/family-db.sh: storage and email migrations need Supabase services the stub lacks.
  if ! out=$(p -f "$f" 2>&1 >/dev/null); then
    [[ "$(basename "$f")" =~ (shop_gelato_private_storage|marketing|email|newsletter|subscriber_resource|welcome_delivery|checkout_offers|pinterest_queue) ]] || { echo "$out"; fail "replay: $f"; }
  fi
done
p -o /dev/null -f supabase/tests/club-dev-seed.sql

# Production's kit titles and statuses (club_kits, read-only, 2026-11-18). Kit rows hold no customer data.
p <<'SQL' >/dev/null
update public.club_kits k set title = v.title, status = v.status from (values
  ('2026-11-family-ownership','Our Family, Our Team','draft'), ('2026-12-christmas-mission','Your Christmas Mission','draft'),
  ('2027-01-fresh-start-together','A Fresh Start, Together','scheduled'), ('2027-02-better-together','Better Together','draft'),
  ('2027-03-spring-clean-together','Spring Clean as a Team','draft'), ('2027-04-everybody-helps-at-mealtime','Everybody Helps at Mealtime','draft'),
  ('2027-05-finish-the-school-year','Finish the School Year Well','draft'), ('2027-06-summer-with-a-plan','Summer With a Plan','draft'),
  ('2027-07-ready-to-go','Ready to Go','draft'), ('2027-08-school-year','Ready for the School Year','draft'),
  ('2027-09-a-week-everyone-can-see','A Week Everyone Can See','draft'), ('2027-10-home-works-together','A Home That Works Together','draft')
) v(slug, title, status) where k.slug = v.slug;
SQL
# 12 more January holders (production has 12; the seed brings its own), 2 with saved work, like production.
p <<'SQL' >/dev/null
do $$ declare i int; uid uuid; hid uuid; jan uuid := (select id from public.club_kits where slug = '2027-01-fresh-start-together');
begin
  for i in 1..12 loop
    uid := gen_random_uuid();
    insert into auth.users (id, email) values (uid, format('holder%s@rehearsal.test', i));
    insert into public.club_households (owner_user_id, display_name) values (uid, format('Rehearsal %s', i)) returning id into hid;
    insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note)
      values (uid, hid, '2027-01-01', 'digital', 1, 'admin', 'admin', 'rehearsal');
    if i <= 2 then insert into public.club_resource_versions (household_id, kit_id, state, profile_version) values (hid, jan, '{"rehearsal":true}', 1); end if;
  end loop;
end $$;
SQL
titles() { q -c "select slug, title, status, release_at, mailer_cutoff_at from public.club_kits order by month"; }
data() { q -f supabase/rollout/snapshot.sql; }
t0=$(titles); d0=$(data)
echo "replay: $(q -c "select count(*) from club_kits") kits, January holders $(q -c "select count(*) from club_entitlements where resource_month = '2027-01-01'"), saved versions $(q -c "select count(*) from club_resource_versions")"

p -f "$M" >/dev/null && echo "ok - migration applies"
changed=$(diff <(echo "$t0") <(titles) | grep -c '^>' || true)
[ "$changed" = 2 ] && echo "ok - exactly 2 kit rows changed:" || { diff <(echo "$t0") <(titles); fail "expected 2 changed rows, got $changed"; }
{ diff <(echo "$t0") <(titles) || true; } | grep '^[<>]' | sed 's/^/     /'
[ "$(q -c "select title from club_kits where slug = '2027-01-fresh-start-together'")" = 'Our First Family Meeting' ] || fail January
[ "$(q -c "select title from club_kits where slug = '2027-09-a-week-everyone-can-see'")" = 'Our Family Habit Cards' ] || fail September
[ "$(q -c "select status from club_kits where slug = '2027-01-fresh-start-together'")" = scheduled ] && echo "ok - January stays scheduled (status, release and cutoff untouched)"
[ "$d0" = "$(data)" ] && echo "ok - member data unchanged (households, members, orders, entitlements, versions, subscriptions, addresses, emails)" || fail "member data changed"

t1=$(titles); p -f "$M" >/dev/null
[ "$t1" = "$(titles)" ] && echo "ok - applying again changes nothing"

# An admin-edited title is never overwritten, by the migration or the rollback.
p -f "$RB" >/dev/null
q -c "update club_kits set title = 'Admin Edit' where slug = '2027-09-a-week-everyone-can-see'" >/dev/null
p -f "$M" >/dev/null
[ "$(q -c "select title from club_kits where slug = '2027-09-a-week-everyone-can-see'")" = 'Admin Edit' ] && echo "ok - an admin-edited title is left alone by the migration"
p -f "$RB" >/dev/null
[ "$(q -c "select title from club_kits where slug = '2027-09-a-week-everyone-can-see'")" = 'Admin Edit' ] && echo "ok - and by the rollback"
q -c "update club_kits set title = 'A Week Everyone Can See' where slug = '2027-09-a-week-everyone-can-see'" >/dev/null

# Rollback from the applied state returns exactly to production's titles.
p -f "$M" >/dev/null; p -f "$RB" >/dev/null
[ "$t0" = "$(titles)" ] && echo "ok - rollback restores every title exactly" || { diff <(echo "$t0") <(titles); fail rollback; }
[ "$d0" = "$(data)" ] && echo "ok - member data unchanged after rollback"
p -f "$M" >/dev/null && [ "$t1" = "$(titles)" ] && echo "ok - applies again after a rollback"

psql -X -q -d postgres -c "drop database $DB with (force)" >/dev/null
echo "rehearsal passed"
