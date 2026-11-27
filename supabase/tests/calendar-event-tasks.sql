-- Responsibilities on imported calendar events (supabase/migrations/20261211000000_calendar_event_tasks.sql): rollout
-- flag, household isolation, privacy of private calendars, add/edit/assign/complete/remove, refresh, reschedule,
-- recurring occurrences, cancellation, reconnecting a calendar, members leaving. Throwaway local database only
-- (scripts/test-household-sql.sh).
\set ON_ERROR_STOP 1
\set QUIET 1

create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function pg_temp.fails(q text, err text default null) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception
  when insufficient_privilege then return err is null;
  when raise_exception then return err is null or sqlerrm = err;
end $$;
create function pg_temp.as_user(p_role text, p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_sub is null then '{}' else jsonb_build_object('sub', p_sub)::text end, false);
  execute format('set role %I', p_role);
end $$;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000ce101', 'tasks-ana@example.com', now()),
  ('00000000-0000-0000-0000-0000000ce102', 'tasks-luis@example.com', now()),
  ('00000000-0000-0000-0000-0000000ce103', 'tasks-other@example.com', now());
\set ANA '''00000000-0000-0000-0000-0000000ce101'''
\set LUIS '''00000000-0000-0000-0000-0000000ce102'''
\set OTHER '''00000000-0000-0000-0000-0000000ce103'''

-- The Riveras (Ana, Luis; Sofia, Mateo, Elena) and another household.
select pg_temp.as_user('authenticated', :ANA);
select public.club_household_save('The Riveras', '{}',
  '[{"first_name":"Ana","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Luis","kind":"adult","role":"partner"},
    {"first_name":"Sofia","kind":"child","role":"child","birth_year":2016,"birth_month":3},{"first_name":"Mateo","kind":"child","role":"child","birth_year":2019,"birth_month":6},
    {"first_name":"Elena","kind":"child","role":"child","birth_year":2022,"birth_month":2}]');
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Luis' and household_id = public.household_id_for(auth.uid())), 'tasks-luis@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :LUIS);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('Others', '{}', '[{"first_name":"Ola","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Kim","kind":"child","role":"child","birth_year":2017,"birth_month":1}]');
reset role;
create temp table m as select first_name, id from public.club_family_members
 where household_id in (select household_id from public.household_adults where user_id in ('00000000-0000-0000-0000-0000000ce101', '00000000-0000-0000-0000-0000000ce103'));
grant select on m to authenticated, anon;
\set MATEO '(select id from m where first_name = ''Mateo'')'
\set SOFIA '(select id from m where first_name = ''Sofia'')'
\set ELENA '(select id from m where first_name = ''Elena'')'
\set LUISM '(select id from m where first_name = ''Luis'')'
\set ANAM '(select id from m where first_name = ''Ana'')'
\set KIM '(select id from m where first_name = ''Kim'')'
\set HID '(select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000ce101'')'

-- Calendar subscriptions on for both households (testers), so only the event_tasks flag is under test.
insert into public.calendar_feed_testers (user_id, note) values ('00000000-0000-0000-0000-0000000ce101', 'test'), ('00000000-0000-0000-0000-0000000ce103', 'test');
select pg_temp.as_user('authenticated', :ANA);
create temp table feeds as
  select 'team' as k, public.calendar_feed_add(jsonb_build_object('url', 'https://team.example.org/soccer.ics', 'name', 'Mateo soccer', 'visibility', 'household', 'member_id', :MATEO, 'timezone', 'America/Chicago')) as j
  union all select 'school', public.calendar_feed_add(jsonb_build_object('url', 'https://school.example.org/sofia.ics', 'name', 'Lincoln Elementary', 'visibility', 'household', 'member_id', :SOFIA, 'timezone', 'America/Chicago'))
  union all select 'work', public.calendar_feed_add('{"url":"https://work.example.org/ana.ics","name":"Ana work","visibility":"private","timezone":"America/Chicago"}');
reset role;
grant select on feeds to authenticated, anon;
\set TEAM '(select (j ->> ''id'')::uuid from feeds where k = ''team'')'
\set SCHOOL '(select (j ->> ''id'')::uuid from feeds where k = ''school'')'
\set WORK '(select (j ->> ''id'')::uuid from feeds where k = ''work'')'

-- What the refresher stores (calendar_feed_store, as the Edge Function would). Soccer practice repeats Tue/Thu; Sunday
-- dinner at Abuela's repeats weekly; the field trip is a one-off; Ana's work calendar is private.
-- instance_key in the app's form: the UTC ISO instant of the original start.
create function pg_temp.key(starts text) returns text language sql as $$ select to_char(starts::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"') $$;
create function pg_temp.ev(uid text, title text, starts text, orig text default null, loc text default null) returns jsonb language sql as $$
  select jsonb_build_object('uid', uid, 'instance_key', pg_temp.key(coalesce(orig, starts)), 'title', title, 'location', loc, 'all_day', false,
    'starts_at', starts::timestamptz, 'ends_at', starts::timestamptz + interval '1 hour')
$$;
create function pg_temp.store(feed uuid, events jsonb, result text default 'ok') returns int language sql as $$
  select public.calendar_feed_store(feed, jsonb_build_object('result', result, 'events', events))
$$;
\set SOCCER_TUE '''2026-12-01 17:30-06'''
\set SOCCER_THU '''2026-12-03 17:30-06'''
\set SOCCER_TUE2 '''2026-12-08 17:30-06'''
select pg_temp.store(:TEAM, jsonb_build_array(
  pg_temp.ev('practice@team', 'Soccer practice', :SOCCER_TUE, null, 'Riverside Park field 3'),
  pg_temp.ev('practice@team', 'Soccer practice', :SOCCER_THU, null, 'Riverside Park field 3'),
  pg_temp.ev('practice@team', 'Soccer practice', :SOCCER_TUE2, null, 'Riverside Park field 3'),
  pg_temp.ev('dinner@team', 'Sunday dinner at Abuela’s', '2026-12-06 17:00-06'),
  pg_temp.ev('dinner@team', 'Sunday dinner at Abuela’s', '2026-12-13 17:00-06')));
select pg_temp.store(:SCHOOL, jsonb_build_array(
  jsonb_build_object('uid', 'trip@lincoln', 'instance_key', '2026-12-04', 'title', 'Field trip: Science Museum', 'all_day', true, 'start_date', '2026-12-04', 'end_date', '2026-12-04')));
select pg_temp.store(:WORK, jsonb_build_array(pg_temp.ev('board@work', 'Board review', '2026-12-02 09:00-06')));
create temp table imported_before as select feed_id, uid, instance_key, title from public.calendar_feed_events;
create temp table own_before as select id, revision from public.calendar_events;
create temp table billing_before as select (select count(*) from public.club_subscriptions) + (select count(*) from public.club_entitlements) as n;

-- ---------------------------------------------------------------- staged rollout
-- The V20 launch (20261215000002) turns these on for everyone; this suite tests the gate itself, from off.
update public.calendar_feed_rollout set event_tasks_everyone = false where id;
select pg_temp.as_user('authenticated', :ANA);
select pg_temp.expect(pg_temp.fails($q$select public.calendar_event_tasks('2026-11-01', '2027-01-31')$q$, 'not_enabled'), 'off by default, even where calendar subscriptions are on');
reset role;
update public.calendar_feed_testers set event_tasks = true where user_id = '00000000-0000-0000-0000-0000000ce101';
select pg_temp.as_user('authenticated', :LUIS);
select pg_temp.expect(jsonb_array_length(public.calendar_event_tasks('2026-11-01', '2027-01-31')) = 0, 'the tester''s household: both adults have it');
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.fails($q$select public.calendar_event_tasks('2026-11-01', '2027-01-31')$q$, 'not_enabled'), 'other households still don''t');
select pg_temp.expect(pg_temp.fails('select * from public.calendar_event_tasks') and pg_temp.fails('select public.calendar_event_tasks_enabled(auth.uid())'), 'no direct table or helper access');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($q$select public.calendar_event_tasks('2026-11-01', '2027-01-31')$q$), 'signed out: nothing');
reset role;

-- ---------------------------------------------------------------- add, assign, see on the other phone
create function pg_temp.add(id text, uid text, k text, title text, member uuid) returns jsonb language sql as $$
  select public.calendar_event_task_save(jsonb_build_object('id', id, 'event_uid', uid, 'instance_key', k, 'title', title, 'member_id', member))
$$;
grant execute on function pg_temp.add(text, text, text, text, uuid) to authenticated;
select pg_temp.as_user('authenticated', :ANA);
select pg_temp.add('ce000000-0000-0000-0000-000000000001', 'practice@team', pg_temp.key(:SOCCER_TUE), 'Pack soccer bag', :MATEO);
select pg_temp.add('ce000000-0000-0000-0000-000000000002', 'practice@team', pg_temp.key(:SOCCER_TUE), 'Drive to practice', :LUISM);
select pg_temp.add('ce000000-0000-0000-0000-000000000003', 'practice@team', pg_temp.key(:SOCCER_TUE), 'Make dinner', :ANAM);
select pg_temp.add('ce000000-0000-0000-0000-000000000004', 'trip@lincoln', '2026-12-04', 'Sign permission slip', :ANAM);
select pg_temp.add('ce000000-0000-0000-0000-000000000005', 'trip@lincoln', '2026-12-04', 'Pack lunch', :SOFIA);
select pg_temp.add('ce000000-0000-0000-0000-000000000006', 'dinner@team', pg_temp.key('2026-12-06 17:00-06'), 'Bake flan', :ANAM);
select pg_temp.add('ce000000-0000-0000-0000-000000000007', 'dinner@team', pg_temp.key('2026-12-13 17:00-06'), 'Bring flowers', :ELENA);
select pg_temp.add('ce000000-0000-0000-0000-000000000008', 'board@work', pg_temp.key('2026-12-02 09:00-06'), 'Print slides', :ANAM);
select pg_temp.add('ce000000-0000-0000-0000-000000000001', 'practice@team', pg_temp.key(:SOCCER_TUE), 'Pack soccer bag', :MATEO) ->> 'id' as retried \gset
reset role;
select pg_temp.expect((select count(*) from public.calendar_event_tasks) = 8, 'Ana adds responsibilities to soccer practice, the field trip, two Sunday dinners and her work meeting');
select pg_temp.expect(:'retried' = 'ce000000-0000-0000-0000-000000000001'
  and (select count(*) from public.calendar_event_tasks) = 8, 'a retried save (same id) is the same responsibility');
create temp table t1 as select public.calendar_event_task_json(t) j from public.calendar_event_tasks t where id = 'ce000000-0000-0000-0000-000000000004';
select pg_temp.expect((select j ->> 'event_title' from t1) = 'Field trip: Science Museum' and (select j ->> 'event_on' from t1) = '2026-12-04' and (select (j ->> 'single')::boolean from t1)
  and not (select single from public.calendar_event_tasks where id = 'ce000000-0000-0000-0000-000000000001'), 'it remembers the event''s label and date, and whether it was a one-off (the field trip) or repeats (soccer)');
-- Refused.
select pg_temp.as_user('authenticated', :ANA);
select pg_temp.expect(pg_temp.fails($q$select pg_temp.add(gen_random_uuid()::text, 'nope@team', '2026-12-01T23:30:00.000Z', 'x', null)$q$, 'not_found'), 'an event that isn''t on her calendars: refused');
select pg_temp.expect(pg_temp.fails($q$select pg_temp.add(gen_random_uuid()::text, 'practice@team', '2026-12-01T23:30:00.000Z', 'x', (select id from m where first_name = 'Kim'))$q$, 'invalid'), 'someone from another family: refused');
select pg_temp.expect(pg_temp.fails($q$select pg_temp.add(gen_random_uuid()::text, 'practice@team', '2026-12-01T23:30:00.000Z', '   ', null)$q$, 'invalid')
  and pg_temp.fails($q$select pg_temp.add(gen_random_uuid()::text, 'practice@team', '2026-12-01T23:30:00.000Z', repeat('x', 81), null)$q$, 'invalid'), 'an empty or overlong responsibility: refused');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_event_task_save('{"event_uid":"practice@team","instance_key":"2026-12-01T23:30:00.000Z","title":"x"}')$q$, 'invalid'), 'without an id: refused');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_event_tasks('2027-01-31', '2026-11-01')$q$, 'invalid'), 'a backwards date range: refused');
reset role;
select pg_temp.as_user('authenticated', :LUIS);
create temp table luis_sees as select jsonb_array_elements(public.calendar_event_tasks('2026-11-01', '2027-01-31')) j;
reset role;
select pg_temp.expect((select count(*) from luis_sees) = 7 and not exists (select 1 from luis_sees where j ->> 'title' = 'Print slides'), 'Luis sees the shared calendars'' responsibilities, never those on Ana''s private work calendar');
select pg_temp.expect((select j ->> 'member_id' from luis_sees where j ->> 'title' = 'Drive to practice')::uuid = (select id from m where first_name = 'Luis'), 'and who is responsible');
select pg_temp.as_user('authenticated', :LUIS);
select pg_temp.expect(pg_temp.fails($q$select public.calendar_event_task_done('ce000000-0000-0000-0000-000000000008', true)$q$, 'not_found')
  and not public.calendar_event_task_delete('ce000000-0000-0000-0000-000000000008')
  and pg_temp.fails($q$select public.calendar_event_task_save('{"id":"ce000000-0000-0000-0000-000000000008","title":"x"}')$q$, 'not_found'), 'nor can he change or remove them');
select pg_temp.expect(pg_temp.fails($q$select pg_temp.add(gen_random_uuid()::text, 'board@work', pg_temp.key('2026-12-02 09:00-06'), 'x', null)$q$, 'not_found'), 'nor add to her private event');
-- Luis drives and checks it off; Ana's phone sees it.
select pg_temp.expect((public.calendar_event_task_done('ce000000-0000-0000-0000-000000000002', true) ->> 'done')::boolean, 'Luis marks "Drive to practice" done');
select pg_temp.expect((public.calendar_event_task_done('ce000000-0000-0000-0000-000000000002', true) ->> 'done')::boolean, 'marking it done again is a no-op');
reset role;
select pg_temp.expect((select done_by from public.calendar_event_tasks where id = 'ce000000-0000-0000-0000-000000000002') = :LUIS::uuid, 'it records who checked it off');
select pg_temp.as_user('authenticated', :ANA);
select pg_temp.expect(exists (select 1 from jsonb_array_elements(public.calendar_event_tasks('2026-11-01', '2027-01-31')) j where j ->> 'id' = 'ce000000-0000-0000-0000-000000000002' and (j ->> 'done')::boolean), 'Ana''s phone: done');
-- Edit, reassign, undo, remove.
create temp table edited as select public.calendar_event_task_save('{"id":"ce000000-0000-0000-0000-000000000005","title":"Pack a nut-free lunch"}') j;
select pg_temp.expect((select j ->> 'title' from edited) = 'Pack a nut-free lunch'
  and (select (j ->> 'member_id')::uuid from edited) = (select id from m where first_name = 'Sofia'), 'edit the words; the assignee stays when not sent');
select pg_temp.expect((public.calendar_event_task_save(jsonb_build_object('id', 'ce000000-0000-0000-0000-000000000005', 'member_id', (select id from m where first_name = 'Luis'))) ->> 'member_id')::uuid = (select id from m where first_name = 'Luis'), 'reassign Sofia → Luis');
select pg_temp.expect(public.calendar_event_task_save('{"id":"ce000000-0000-0000-0000-000000000005","member_id":null}') -> 'member_id' = 'null'::jsonb, 'or nobody');
select pg_temp.expect(not (public.calendar_event_task_done('ce000000-0000-0000-0000-000000000002', false) ->> 'done')::boolean, 'not done after all');
select pg_temp.expect(public.calendar_event_task_delete('ce000000-0000-0000-0000-000000000003') and not public.calendar_event_task_delete('ce000000-0000-0000-0000-000000000003'), 'remove; removing again is a no-op');
reset role;
select pg_temp.expect((select count(*) from public.calendar_event_tasks) = 7, 'seven left');

-- Other households.
select pg_temp.as_user('authenticated', :OTHER);
reset role;
update public.calendar_feed_testers set event_tasks = true where user_id = '00000000-0000-0000-0000-0000000ce103';
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(jsonb_array_length(public.calendar_event_tasks('2026-11-01', '2027-01-31')) = 0, 'another household sees none of them');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_event_task_done('ce000000-0000-0000-0000-000000000001', true)$q$, 'not_found')
  and not public.calendar_event_task_delete('ce000000-0000-0000-0000-000000000001')
  and pg_temp.fails($q$select public.calendar_event_task_save('{"id":"ce000000-0000-0000-0000-000000000001","title":"x"}')$q$, 'invalid')
  and pg_temp.fails($q$select pg_temp.add(gen_random_uuid()::text, 'practice@team', pg_temp.key('2026-12-01 17:30-06'), 'x', null)$q$, 'not_found'), 'nor can it change, remove or add to them');
reset role;

-- At most 20 per occurrence.
select pg_temp.as_user('authenticated', :ANA);
select pg_temp.add(gen_random_uuid()::text, 'practice@team', pg_temp.key(:SOCCER_THU), 'Item ' || n, null) from generate_series(1, 20) n;
select pg_temp.expect(pg_temp.fails($q$select pg_temp.add(gen_random_uuid()::text, 'practice@team', pg_temp.key('2026-12-03 17:30-06'), 'One more', null)$q$, 'too_many'), 'at most 20 per occurrence');
reset role;
delete from public.calendar_event_tasks where instance_key = pg_temp.key(:SOCCER_THU);

-- ---------------------------------------------------------------- the calendar changes underneath
-- Recurring: each occurrence has its own.
select pg_temp.expect((select count(*) from public.calendar_event_tasks where event_uid = 'dinner@team' and instance_key = pg_temp.key('2026-12-06 17:00-06')) = 1
  and (select count(*) from public.calendar_event_tasks where event_uid = 'dinner@team' and instance_key = pg_temp.key('2026-12-13 17:00-06')) = 1, 'repeating Sunday dinner: each Sunday has its own responsibilities');
-- A refresh rewrites every imported event: nothing here changes. A failed one, or an empty answer, neither.
select pg_temp.store(:TEAM, (select jsonb_agg(jsonb_build_object('uid', uid, 'instance_key', instance_key, 'title', title, 'all_day', all_day, 'starts_at', starts_at, 'ends_at', ends_at, 'location', location))
                               from public.calendar_feed_events where feed_id = :TEAM));
select public.calendar_feed_store(:TEAM, '{"result":"error","error":"timeout"}');
select pg_temp.store(:TEAM, '[]');
create temp table snap as select id, event_uid, instance_key, title, member_id, done_at from public.calendar_event_tasks;
select pg_temp.as_user('authenticated', :ANA);
select public.calendar_event_tasks('2026-11-01', '2027-01-31');
reset role;
select pg_temp.expect((select count(*) from public.calendar_event_tasks) = 7 and not exists (select id, event_uid, instance_key, title, member_id, done_at from public.calendar_event_tasks except select * from snap),
  'refreshes (the same, a failure, an empty answer): every responsibility is still there, unchanged');
-- The practice moves within its occurrence (RECURRENCE-ID keeps its key) and is renamed: responsibilities stay, the label follows.
select pg_temp.store(:TEAM, jsonb_build_array(
  pg_temp.ev('practice@team', 'Soccer practice (field 5)', '2026-12-01 18:30-06', :SOCCER_TUE, 'Riverside Park field 5'),
  pg_temp.ev('practice@team', 'Soccer practice', :SOCCER_THU), pg_temp.ev('practice@team', 'Soccer practice', :SOCCER_TUE2),
  pg_temp.ev('dinner@team', 'Sunday dinner at Abuela’s', '2026-12-06 17:00-06'), pg_temp.ev('dinner@team', 'Sunday dinner at Abuela’s', '2026-12-13 17:00-06')));
select pg_temp.as_user('authenticated', :LUIS);
create temp table after_move as select jsonb_array_elements(public.calendar_event_tasks('2026-11-01', '2027-01-31')) j;
reset role;
select pg_temp.expect((select count(*) from after_move where j ->> 'event_uid' = 'practice@team') = 2
  and (select min(j ->> 'event_title') from after_move where j ->> 'event_uid' = 'practice@team') = 'Soccer practice (field 5)', 'a moved and renamed practice keeps its responsibilities; the label follows');
-- The one-off field trip is rescheduled 3 days later (a new key): it follows, because it's safe.
select pg_temp.store(:SCHOOL, jsonb_build_array(jsonb_build_object('uid', 'trip@lincoln', 'instance_key', '2026-12-07', 'title', 'Field trip: Science Museum', 'all_day', true, 'start_date', '2026-12-07', 'end_date', '2026-12-07')));
select pg_temp.as_user('authenticated', :ANA);
select public.calendar_event_tasks('2026-11-01', '2027-01-31');
reset role;
select pg_temp.expect((select count(*) from public.calendar_event_tasks where event_uid = 'trip@lincoln' and instance_key = '2026-12-07' and event_on = '2026-12-07') = 2, 'a rescheduled one-off (field trip, 3 days later): its responsibilities follow');
-- Moved far (a different year's event with the same UID): left where it was, never attached to a guess.
select pg_temp.store(:SCHOOL, jsonb_build_array(jsonb_build_object('uid', 'trip@lincoln', 'instance_key', '2027-06-07', 'title', 'Field trip: Science Museum', 'all_day', true, 'start_date', '2027-06-07', 'end_date', '2027-06-07')));
select pg_temp.as_user('authenticated', :ANA);
select public.calendar_event_tasks('2026-11-01', '2027-07-01');
reset role;
select pg_temp.expect((select count(*) from public.calendar_event_tasks where event_uid = 'trip@lincoln' and instance_key = '2026-12-07') = 2, 'moved six months: not followed (kept on the old date)');
-- A repeating event's occurrence that disappears (cancelled game) is never re-attached to another occurrence.
select pg_temp.store(:TEAM, jsonb_build_array(pg_temp.ev('dinner@team', 'Sunday dinner at Abuela’s', '2026-12-13 17:00-06'),
  pg_temp.ev('practice@team', 'Soccer practice', :SOCCER_THU)));
select pg_temp.as_user('authenticated', :ANA);
create temp table after_cancel as select jsonb_array_elements(public.calendar_event_tasks('2026-11-01', '2027-01-31')) j;
reset role;
select pg_temp.expect((select instance_key from public.calendar_event_tasks where id = 'ce000000-0000-0000-0000-000000000006') = pg_temp.key('2026-12-06 17:00-06')
  and (select count(*) from public.calendar_event_tasks where event_uid = 'dinner@team' and instance_key = pg_temp.key('2026-12-13 17:00-06')) = 1
  and exists (select 1 from after_cancel where j ->> 'id' = 'ce000000-0000-0000-0000-000000000006'),
  'a cancelled Sunday: its responsibilities stay on that Sunday (still listed, for the app to show as no longer on the calendar), never moved to another');
-- Remove the calendar and add it again: the same responsibilities, no duplicates.
select pg_temp.as_user('authenticated', :ANA);
select public.calendar_feed_remove(:TEAM);
create temp table readded as select public.calendar_feed_add(jsonb_build_object('url', 'https://team.example.org/soccer.ics', 'name', 'Mateo soccer', 'visibility', 'household', 'member_id', :MATEO, 'timezone', 'America/Chicago')) j;
reset role;
select pg_temp.expect((select count(*) from public.calendar_event_tasks where event_uid in ('practice@team', 'dinner@team')) = 4, 'unsubscribing keeps them (the calendar may come back)');
select pg_temp.store((select (j ->> 'id')::uuid from readded), jsonb_build_array(pg_temp.ev('practice@team', 'Soccer practice', :SOCCER_TUE), pg_temp.ev('practice@team', 'Soccer practice', :SOCCER_THU),
  pg_temp.ev('dinner@team', 'Sunday dinner at Abuela’s', '2026-12-06 17:00-06'), pg_temp.ev('dinner@team', 'Sunday dinner at Abuela’s', '2026-12-13 17:00-06')));
select pg_temp.as_user('authenticated', :LUIS);
create temp table after_reconnect as select jsonb_array_elements(public.calendar_event_tasks('2026-11-01', '2027-01-31')) j;
reset role;
select pg_temp.expect((select count(*) from after_reconnect where j ->> 'event_uid' in ('practice@team', 'dinner@team')) = 4
  and (select count(*) from public.calendar_event_tasks) = 7, 'reconnected: Luis sees the same four again, nothing duplicated');

-- ---------------------------------------------------------------- people change
update public.club_family_members set archived_at = now() where id = (select id from m where first_name = 'Elena');
select pg_temp.as_user('authenticated', :ANA);
select pg_temp.expect((select j -> 'member_id' from jsonb_array_elements(public.calendar_event_tasks('2026-11-01', '2027-01-31')) j where j ->> 'id' = 'ce000000-0000-0000-0000-000000000007') = 'null'::jsonb,
  'a member removed from the family: their responsibility shows unassigned');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_event_task_save(jsonb_build_object('id', 'ce000000-0000-0000-0000-000000000007', 'member_id', (select id from m where first_name = 'Elena')))$q$, 'invalid'), 'and can''t be assigned anymore');
reset role;
delete from public.club_family_members where id = (select id from m where first_name = 'Elena');
select pg_temp.expect((select member_id from public.calendar_event_tasks where id = 'ce000000-0000-0000-0000-000000000007') is null, 'deleted for good: unassigned, the responsibility stays');
-- Luis leaves the household: no access at all.
select pg_temp.as_user('authenticated', :LUIS);
select public.household_leave();
select pg_temp.expect(pg_temp.fails($q$select public.calendar_event_tasks('2026-11-01', '2027-01-31')$q$)
  and pg_temp.fails($q$select public.calendar_event_task_done('ce000000-0000-0000-0000-000000000001', true)$q$), 'an adult who left: no access');
reset role;

-- ---------------------------------------------------------------- nothing else moved
select pg_temp.expect(not exists (select id, revision from public.calendar_events except select * from own_before), 'the family''s own calendar events are untouched');
select pg_temp.expect((select count(*) from public.club_subscriptions) + (select count(*) from public.club_entitlements) = (select n from billing_before), 'no billing, subscription or entitlement rows added');
select pg_temp.expect(not has_table_privilege('authenticated', 'public.calendar_event_tasks', 'select') and not has_table_privilege('anon', 'public.calendar_event_tasks', 'select'), 'the table itself: no grants');
