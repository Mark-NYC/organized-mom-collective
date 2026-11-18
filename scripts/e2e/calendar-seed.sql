-- Imported calendars for the iPhone simulator's family flow (AppLaunchTests.testFamilyFlowWithTestBackend), on the
-- THROWAWAY database from family-db.sh + seed.sql only. Two subscriptions of Jen's, already fetched: the school
-- calendar shared with the household (Maya's color) and her work calendar, private. Created through the same
-- database functions the app and the calendar-feeds function use; the simulator has no fixture server, so the
-- refresher's store step is called here directly, as the service role would.
\set ON_ERROR_STOP 1
\set QUIET 1
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e2e1"}', false) \g /dev/null
create temp table seeded as
  select public.calendar_feed_add(jsonb_build_object('url', 'https://lincoln.calendar.e2e.test/school.ics', 'name', 'Lincoln Elementary', 'visibility', 'household',
           'member_id', (select id from public.club_family_members where first_name = 'Maya'), 'timezone', 'America/New_York')) as j
  union all
  select public.calendar_feed_add('{"url":"https://work.calendar.e2e.test/work.ics","name":"Jen work","visibility":"private","timezone":"America/New_York"}');
reset role;
select public.calendar_feed_store((select (j ->> 'id')::uuid from seeded where j ->> 'name' = 'Lincoln Elementary'), jsonb_build_object('result', 'ok', 'events', jsonb_build_array(
  jsonb_build_object('uid', 'pic@lincoln', 'instance_key', current_date::text, 'title', 'Picture day', 'all_day', true, 'start_date', current_date, 'end_date', current_date)))) \g /dev/null
select public.calendar_feed_store((select (j ->> 'id')::uuid from seeded where j ->> 'name' = 'Jen work'), jsonb_build_object('result', 'ok', 'events', jsonb_build_array(
  jsonb_build_object('uid', 'board@work', 'instance_key', current_date::text, 'title', 'Board review', 'all_day', true, 'start_date', current_date, 'end_date', current_date)))) \g /dev/null
