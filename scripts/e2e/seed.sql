-- Seed for the family end-to-end test (docs/ios/FAMILY_E2E.md), on the THROWAWAY database from family-db.sh only.
-- The Parks: two grown-ups (Jen holds the account; Sam joins as her partner during the test) and two children, Maya
-- (11) and Leo (7). Created through the same database functions the family pages use, as Jen. Plus the Ruizes, a
-- separate household, for the isolation checks. Club access for Jen is a beta grant on this test database only.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000e2e1', 'jen@e2e.test', now()),
  ('00000000-0000-0000-0000-00000000e2e2', 'sam@e2e.test', now()),
  ('00000000-0000-0000-0000-00000000e2e3', 'rosa@e2e.test', now());

-- This month's kit, scheduled and released (it is 'draft' in the migrations), and Club access for Jen.
update public.club_kits set status = 'scheduled', release_at = least(release_at, now()) where month = date_trunc('month', now())::date;
insert into public.club_access_grants (user_id, reason, note) values ('00000000-0000-0000-0000-00000000e2e1', 'beta', 'e2e test');

-- Jen's household, as Jen.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e2e1"}', false) \g /dev/null
select public.club_household_save('The Parks', '{}',
  '[{"first_name":"Jen","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Sam","kind":"adult","role":"partner"},
    {"first_name":"Maya","kind":"child","role":"child","birth_year":2015,"birth_month":3},{"first_name":"Leo","kind":"child","role":"child","birth_year":2019,"birth_month":4}]') \g /dev/null
select public.club_responsibilities_save('existing', jsonb_build_array(
  jsonb_build_object('category', 'meals', 'owner_ids', jsonb_build_array((select id from public.club_family_members where first_name = 'Jen')), 'helper_ids', '[]'::jsonb),
  jsonb_build_object('category', 'transportation', 'owner_ids', jsonb_build_array((select id from public.club_family_members where first_name = 'Sam')), 'helper_ids', '[]'::jsonb))) \g /dev/null
reset role;

-- The Ruizes: another family with its own calendar event and agreement.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e2e3"}', false) \g /dev/null
select public.club_household_save('The Ruizes', '{}',
  '[{"first_name":"Rosa","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Tomas","kind":"child","role":"child","birth_year":2016,"birth_month":1}]') \g /dev/null
select public.calendar_event_save(jsonb_build_object('id', 'ee000000-0000-0000-0000-000000000001', 'title', 'Ruiz private appointment',
  'starts_on', to_char(now(), 'YYYY-MM-DD'), 'timezone', 'America/Chicago', 'member_ids', jsonb_build_array((select id from public.club_family_members where first_name = 'Tomas'))), null) \g /dev/null
select public.household_agreement_save(jsonb_build_object('category', 'cleaning', 'text', 'Ruiz private chore',
  'owner_ids', jsonb_build_array((select id from public.club_family_members where first_name = 'Tomas')))) \g /dev/null
reset role;
