-- A connected Google account for the iPhone simulator's family flow (AppLaunchTests.testFamilyFlowWithTestBackend),
-- on the THROWAWAY database from family-db.sh + seed.sql + calendar-seed.sql only (needs migration 20261206).
-- The simulator has no mock Google, so the account and one imported calendar are created through the same database
-- functions the calendar-google function and the refresher use. The OAuth hop itself is covered by
-- scripts/e2e/calendar-google-e2e.mjs. The token below is a placeholder that exists only on this test database.
\set ON_ERROR_STOP 1
\set QUIET 1
update public.calendar_feed_testers set google = true where user_id = '00000000-0000-0000-0000-00000000e2e1';
create temp table acc as select public.calendar_google_account_save('00000000-0000-0000-0000-00000000e2e1', 'sim-google-sub', 'jen.parks@gmail.test', 'e2e-placeholder-not-a-token', 'calendar.events.readonly calendar.calendarlist.readonly') as id;
grant select on acc to authenticated;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e2e1"}', false) \g /dev/null
select public.calendar_google_select((select id from acc), '[{"id":"jen.parks@gmail.test","name":"Jen (Google)","visibility":"private"}]') \g /dev/null
reset role;
select public.calendar_feed_store((select id from public.calendar_feeds where google_calendar_id = 'jen.parks@gmail.test'), jsonb_build_object('result', 'ok', 'events', jsonb_build_array(
  jsonb_build_object('uid', 'book1@google.com', 'instance_key', current_date::text, 'title', 'Book club', 'all_day', true, 'start_date', current_date, 'end_date', current_date)))) \g /dev/null
