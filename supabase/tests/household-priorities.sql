-- This week's family priorities (supabase/migrations/20261212000000_household_priorities.sql): both adults, one adult
-- alone, household isolation, private calendars, links to events (moved, cancelled), the weekly limit.
-- Throwaway local database only (scripts/test-household-sql.sh).
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
  ('00000000-0000-0000-0000-0000000fa101', 'prio-mom@example.com', now()),
  ('00000000-0000-0000-0000-0000000fa102', 'prio-dad@example.com', now()),
  ('00000000-0000-0000-0000-0000000fa103', 'prio-solo@example.com', now());
\set MOM '''00000000-0000-0000-0000-0000000fa101'''
\set DAD '''00000000-0000-0000-0000-0000000fa102'''
\set SOLO '''00000000-0000-0000-0000-0000000fa103'''

select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Goerings', '{}',
  '[{"first_name":"Mara","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Tom","kind":"adult","role":"partner"},
    {"first_name":"Andrew","kind":"child","role":"child","birth_year":2016,"birth_month":3},{"first_name":"Philip","kind":"child","role":"child","birth_year":2019,"birth_month":6}]');
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Tom' and household_id = public.household_id_for(auth.uid())), 'prio-dad@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :SOLO);
select public.club_household_save('Solo', '{}', '[{"first_name":"Jo","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Kai","kind":"child","role":"child","birth_year":2014,"birth_month":2}]');
reset role;
\set HID '(select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000fa101'')'

-- The family's own event (a repeating one) and two imported calendars: one shared with the household, one private.
select pg_temp.as_user('authenticated', :MOM);
select public.calendar_event_save(jsonb_build_object('id', 'fa000000-0000-0000-0000-0000000000e1', 'title', 'School presentation', 'starts_on', '2026-12-03', 'timezone', 'America/Chicago'), null);
reset role;
insert into public.calendar_feed_testers (user_id, note) values ('00000000-0000-0000-0000-0000000fa101', 'test');
select pg_temp.as_user('authenticated', :MOM);
create temp table feeds as
  select 'shared' k, public.calendar_feed_add('{"url":"https://family.example.org/trips.ics","name":"Family trips","visibility":"household","timezone":"America/Chicago"}') j
  union all select 'private', public.calendar_feed_add('{"url":"https://work.example.org/mara.ics","name":"Mara work","visibility":"private","timezone":"America/Chicago"}');
reset role;
grant select on feeds to authenticated, anon;
select public.calendar_feed_store((select (j ->> 'id')::uuid from feeds where k = 'shared'), jsonb_build_object('result', 'ok', 'events', jsonb_build_array(
  jsonb_build_object('uid', 'trip@family', 'instance_key', '2026-12-04', 'title', 'Family trip to the lake', 'all_day', true, 'start_date', '2026-12-04', 'end_date', '2026-12-06'))));
select public.calendar_feed_store((select (j ->> 'id')::uuid from feeds where k = 'private'), jsonb_build_object('result', 'ok', 'events', jsonb_build_array(
  jsonb_build_object('uid', 'review@work', 'instance_key', '2026-12-02', 'title', 'Performance review', 'all_day', true, 'start_date', '2026-12-02', 'end_date', '2026-12-02'))));
create temp table own_before as select id, revision from public.calendar_events;
create temp table billing_before as select (select count(*) from public.club_subscriptions) + (select count(*) from public.club_entitlements) as n;

create function pg_temp.save(id text, wk text, p jsonb) returns jsonb language sql as $$
  select public.household_priority_save(jsonb_build_object('id', id, 'week_of', wk) || p)
$$;
grant execute on function pg_temp.save(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------- choosing
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($q$select public.household_priorities('2026-11-30', '2026-11-30')$q$), 'signed out: nothing');
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(jsonb_array_length(public.household_priorities('2026-11-30', '2026-11-30')) = 0, 'nothing is a priority until someone chooses it (no calendar event is elevated on its own)');
select pg_temp.save('fa000000-0000-0000-0000-000000000001', '2026-11-30', '{"kind":"event","source":"imported","event_uid":"trip@family","instance_key":"2026-12-04"}');
select pg_temp.save('fa000000-0000-0000-0000-000000000002', '2026-11-30', '{"kind":"event","source":"family","event_uid":"fa000000-0000-0000-0000-0000000000e1","instance_key":"2026-12-03","title":"ignored"}');
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.save('fa000000-0000-0000-0000-000000000003', '2026-11-30', '{"kind":"note","title":"Working together on the morning rush"}');
-- The other adult highlights the same trip: the same priority, not a second one.
select pg_temp.expect((pg_temp.save('fa000000-0000-0000-0000-000000000099', '2026-11-30', '{"kind":"event","source":"imported","event_uid":"trip@family","instance_key":"2026-12-04"}') ->> 'id') = 'fa000000-0000-0000-0000-000000000001',
  'the other adult highlighting the same event finds the same priority');
create temp table dad_sees as select jsonb_array_elements(public.household_priorities('2026-11-30', '2026-11-30')) j;
reset role;
select pg_temp.expect((select count(*) from dad_sees) = 3, 'both adults see the same plan: the trip, the presentation and the note');
select pg_temp.expect((select j ->> 'title' from dad_sees where j ->> 'source' = 'imported') = 'Family trip to the lake'
  and (select j ->> 'event_on' from dad_sees where j ->> 'source' = 'imported') = '2026-12-04', 'an imported priority links to its occurrence, labeled from the event itself');
select pg_temp.expect((select j ->> 'title' from dad_sees where j ->> 'source' = 'family') = 'School presentation', 'a family event''s title comes from the event, not the request');
select pg_temp.expect((select (j ->> 'mine')::boolean from dad_sees where j ->> 'kind' = 'note') and not (select (j ->> 'mine')::boolean from dad_sees where j ->> 'source' = 'family'), 'each adult knows which ones they added (nobody is the administrator)');

-- Refused.
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails($q$select pg_temp.save(gen_random_uuid()::text, '2026-11-30', '{"kind":"event","source":"imported","event_uid":"review@work","instance_key":"2026-12-02"}')$q$, 'not_found'),
  'an event from her PRIVATE calendar can''t be made a household priority');
select pg_temp.expect(pg_temp.fails($q$select pg_temp.save(gen_random_uuid()::text, '2026-12-01', '{"kind":"note","title":"x"}')$q$, 'invalid'), 'week_of must be a Monday');
select pg_temp.expect(pg_temp.fails($q$select pg_temp.save(gen_random_uuid()::text, '2026-11-30', '{"kind":"note","title":"  "}')$q$, 'invalid'), 'an empty priority: refused');
select pg_temp.expect(pg_temp.fails($q$select pg_temp.save(gen_random_uuid()::text, '2026-11-30', '{"kind":"event","source":"family","event_uid":"fa000000-0000-0000-0000-0000000000ff","instance_key":"2026-12-03"}')$q$, 'not_found'), 'an event that isn''t the family''s: refused');
select pg_temp.save('fa000000-0000-0000-0000-000000000004', '2026-11-30', '{"kind":"note","title":"Four"}');
select pg_temp.save('fa000000-0000-0000-0000-000000000005', '2026-11-30', '{"kind":"note","title":"Five"}');
select pg_temp.expect(pg_temp.fails($q$select pg_temp.save(gen_random_uuid()::text, '2026-11-30', '{"kind":"note","title":"Six"}')$q$, 'too_many'), 'at most five a week (the app shows three)');
select pg_temp.expect(public.household_priority_remove('fa000000-0000-0000-0000-000000000005') and public.household_priority_remove('fa000000-0000-0000-0000-000000000004')
  and not public.household_priority_remove('fa000000-0000-0000-0000-000000000004'), 'remove (either adult); again is a no-op');
-- Rename a note; an event's title can't be overwritten.
select pg_temp.expect((pg_temp.save('fa000000-0000-0000-0000-000000000003', '2026-11-30', '{"title":"Calmer mornings, together"}') ->> 'title') = 'Calmer mornings, together'
  and (pg_temp.save('fa000000-0000-0000-0000-000000000001', '2026-11-30', '{"title":"Hacked"}') ->> 'title') = 'Family trip to the lake', 'rename a note; an event keeps its own title');
reset role;

-- ---------------------------------------------------------------- isolation and privacy
select pg_temp.as_user('authenticated', :SOLO);
select pg_temp.expect(jsonb_array_length(public.household_priorities('2026-11-01', '2026-12-31')) = 0, 'another household sees none of them');
select pg_temp.expect(not public.household_priority_remove('fa000000-0000-0000-0000-000000000001')
  and pg_temp.fails($q$select pg_temp.save('fa000000-0000-0000-0000-000000000001', '2026-11-30', '{"title":"x"}')$q$, 'invalid')
  and pg_temp.fails($q$select pg_temp.save(gen_random_uuid()::text, '2026-11-30', '{"kind":"event","source":"family","event_uid":"fa000000-0000-0000-0000-0000000000e1","instance_key":"2026-12-03"}')$q$, 'not_found'),
  'nor change, remove or borrow their events');
select pg_temp.expect(pg_temp.fails('select * from public.household_priorities'), 'no direct table access');
-- One adult is a whole household: the single parent plans too.
select pg_temp.save('fa000000-0000-0000-0000-0000000005a1', '2026-11-30', '{"kind":"note","title":"Kai''s science fair"}');
select pg_temp.expect(jsonb_array_length(public.household_priorities('2026-11-30', '2026-11-30')) = 1, 'a single-parent household chooses priorities the same way');
reset role;
-- The trip's calendar is made private: Tom (who didn't choose it) no longer sees it; Mara still does.
select pg_temp.as_user('authenticated', :MOM);
select public.calendar_feed_update((select (j ->> 'id')::uuid from feeds where k = 'shared'), '{"visibility":"private"}');
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.household_priorities('2026-11-30', '2026-11-30')) j where j ->> 'source' = 'imported'), 'a calendar made private: its priority leaves the other adult''s plan');
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(exists (select 1 from jsonb_array_elements(public.household_priorities('2026-11-30', '2026-11-30')) j where j ->> 'source' = 'imported'), '…and stays for the adult who chose it');
select public.calendar_feed_update((select (j ->> 'id')::uuid from feeds where k = 'shared'), '{"visibility":"household"}');
reset role;
-- Cancelled at the source: the priority stays (linked), the app shows it's no longer on the calendar.
select public.calendar_feed_store((select (j ->> 'id')::uuid from feeds where k = 'shared'), jsonb_build_object('result', 'ok', 'events', jsonb_build_array(
  jsonb_build_object('uid', 'other@family', 'instance_key', '2026-12-10', 'title', 'Something else', 'all_day', true, 'start_date', '2026-12-10', 'end_date', '2026-12-10'))));
select pg_temp.expect((select count(*) from public.household_priorities where source = 'imported') = 1, 'the trip cancelled at the source: the priority is kept, linked, for the app to say so');

-- ---------------------------------------------------------------- nothing else moved
select pg_temp.expect(not exists (select id, revision from public.calendar_events except select * from own_before), 'the family''s calendar events are untouched');
select pg_temp.expect((select count(*) from public.club_subscriptions) + (select count(*) from public.club_entitlements) = (select n from billing_before), 'no billing, subscription or entitlement rows');
select pg_temp.expect(not has_table_privilege('authenticated', 'public.household_priorities', 'select') and not has_function_privilege('authenticated', 'public.household_shared_occurrence(uuid,text,text)', 'execute'), 'no table grants; helpers are server-only');
