-- The family calendar (supabase/migrations/20261125000000_family_calendar.sql). Run by scripts/test-household-sql.sh
-- on a throwaway local database, after household-partners.sql's migration. Never run on the real project.
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
create function pg_temp.count_of(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') x' into n;
  return n;
end $$;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000ca101', 'cal-mom@example.com', now()),
  ('00000000-0000-0000-0000-0000000ca102', 'cal-dad@example.com', now()),
  ('00000000-0000-0000-0000-0000000ca103', 'cal-other@example.com', now()),
  ('00000000-0000-0000-0000-0000000ca104', 'cal-nobody@example.com', now());
\set MOM '''00000000-0000-0000-0000-0000000ca101'''
\set DAD '''00000000-0000-0000-0000-0000000ca102'''
\set OTHER '''00000000-0000-0000-0000-0000000ca103'''
\set NOBODY '''00000000-0000-0000-0000-0000000ca104'''

-- A free household (no Club membership) with a typical week, and its partner.
select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Parks', '{}',
  '[{"first_name":"Jen","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Sam","kind":"adult","role":"partner"},
    {"first_name":"Ivy","kind":"child","role":"child","birth_year":2017,"birth_month":2}]');
reset role;
\set HID '(select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000ca101'')'
\set JEN '(select id from public.club_family_members where first_name = ''Jen'')'
\set SAM '(select id from public.club_family_members where first_name = ''Sam'')'
\set IVY '(select id from public.club_family_members where first_name = ''Ivy'')'
select pg_temp.as_user('authenticated', :MOM);
select public.club_activities_save(jsonb_build_array(
  jsonb_build_object('category', 'sports', 'name', 'Swim team', 'member_ids', jsonb_build_array(:IVY), 'days', '[1,3]'::jsonb, 'starts_at', '16:15'),
  jsonb_build_object('category', 'lessons', 'member_ids', '[]'::jsonb, 'days', '[]'::jsonb)));
create temp table inv as select public.household_invite_create(:SAM, 'cal-dad@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('Others', '{}', '[{"first_name":"Lee","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
\set LEE '(select id from public.club_family_members where first_name = ''Lee'')'

-- ---------------------------------------------------------------- create, read, edit

select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(public.club_me() ->> 'member' is distinct from 'true', 'free household: no Club membership needed');
create temp table e1 as select public.calendar_event_save(jsonb_build_object(
  'id', '11111111-0000-0000-0000-000000000001', 'title', ' Dentist ', 'starts_on', '2026-11-18', 'start_time', '15:30', 'end_time', '16:15',
  'timezone', 'America/Chicago', 'member_ids', jsonb_build_array(:IVY), 'owner_member_id', :SAM), null) as e;
reset role;
grant select on e1 to authenticated;
select pg_temp.expect((select e ->> 'title' from e1) = 'Dentist', 'save: trimmed title');
select pg_temp.expect((select (e ->> 'revision')::int from e1) = 1, 'save: revision 1');
select pg_temp.expect((select e ->> 'start_time' from e1) = '15:30' and (select e ->> 'timezone' from e1) = 'America/Chicago', 'save: local time and zone kept');

select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(pg_temp.count_of('select 1 from public.calendar_events') = 1, 'partner reads the shared calendar (RLS)');
select pg_temp.expect(jsonb_array_length(public.calendar_changes(null) -> 'events') = 1, 'partner: changes since forever = 1');
create temp table e2 as select public.calendar_event_save(
  (select e from e1) || '{"title":"Dentist (Dr. Park)","start_time":"15:45","end_time":"16:30"}', 1) as e;
reset role;
grant select on e2 to authenticated;
select pg_temp.expect((select (e ->> 'revision')::int from e2) = 2, 'partner edits: revision 2');

-- Mom's phone still has revision 1: her stale edit is refused, nothing overwritten.
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.calendar_event_save(%L, 1)', (select e || '{"title":"Dentist moved"}' from e1)), 'conflict'),
  'concurrent edit: a stale save gets conflict');
select pg_temp.expect((select title from public.calendar_events where id = '11111111-0000-0000-0000-000000000001') = 'Dentist (Dr. Park)', 'concurrent edit: his version stands');
select pg_temp.expect(pg_temp.fails(format('select public.calendar_event_save(%L, null)', (select e from e1)), 'conflict'),
  'retrying a create of an id that exists (lost response) is a conflict, never a duplicate');
select pg_temp.expect((select count(*) from public.calendar_events where id = '11111111-0000-0000-0000-000000000001') = 1, 'still one event');

-- Recurrence and validation.
select pg_temp.expect(public.calendar_event_save(jsonb_build_object(
  'id', '11111111-0000-0000-0000-000000000002', 'title', 'Piano', 'starts_on', '2026-11-16', 'start_time', '17:00',
  'recurrence', '{"freq":"weekly","interval":1,"by_day":[1],"until":"2027-06-01"}'::jsonb, 'skip_dates', '["2026-11-23"]'::jsonb,
  'member_ids', jsonb_build_array(:IVY)), null) ->> 'recurrence' is not null, 'weekly repeat with an end date and a skipped week');
select pg_temp.expect(pg_temp.fails($$select public.calendar_event_save('{"id":"11111111-0000-0000-0000-000000000003","title":"x","starts_on":"2026-11-16","recurrence":{"freq":"hourly"}}', null)$$, 'invalid'), 'repeat: only daily/weekly/monthly/yearly');
select pg_temp.expect(pg_temp.fails($$select public.calendar_event_save('{"id":"11111111-0000-0000-0000-000000000003","title":"x","starts_on":"2026-11-16","recurrence":{"freq":"weekly","by_day":[9]}}', null)$$, 'invalid'), 'repeat: weekdays 0-6');
select pg_temp.expect(pg_temp.fails($$select public.calendar_event_save('{"id":"11111111-0000-0000-0000-000000000003","title":"x","starts_on":"2026-11-16","recurrence":{"freq":"daily","interval":500}}', null)$$, 'invalid'), 'repeat: every 1-52');
select pg_temp.expect(pg_temp.fails($$select public.calendar_event_save('{"id":"11111111-0000-0000-0000-000000000003","title":"  ","starts_on":"2026-11-16"}', null)$$, 'invalid'), 'a title is required');
select pg_temp.expect(pg_temp.fails($$select public.calendar_event_save('{"id":"11111111-0000-0000-0000-000000000003","title":"x","starts_on":"2026-11-16","start_time":"10:00","end_time":"09:00"}', null)$$, 'invalid'), 'end after start');
select pg_temp.expect(pg_temp.fails($$select public.calendar_event_save('{"id":"11111111-0000-0000-0000-000000000003","title":"x","starts_on":"not a date"}', null)$$, 'invalid'), 'a real date');
select pg_temp.expect(pg_temp.fails(format('select public.calendar_event_save(%L, null)', jsonb_build_object('id', '11111111-0000-0000-0000-000000000003', 'title', 'x', 'starts_on', '2026-11-16', 'member_ids', jsonb_build_array(:LEE))), 'invalid'),
  'people must be in this family');

-- Typical week → calendar, once.
select pg_temp.expect(public.calendar_import_activities('2026-11-16', 'America/Chicago') = 1, 'import: the one activity with days becomes a weekly event');
select pg_temp.expect(public.calendar_import_activities('2026-11-16', 'America/Chicago') = 0, 'import: running it again adds nothing');
select pg_temp.expect((select recurrence ->> 'freq' from public.calendar_events where source = 'activity') = 'weekly'
  and (select start_time from public.calendar_events where source = 'activity') = '16:15', 'import: weekly at the activity''s time');
reset role;

-- ---------------------------------------------------------------- delete and sync

select pg_temp.as_user('authenticated', :DAD);
create temp table since as select (public.calendar_changes(null) ->> 'now')::timestamptz as t;
select pg_temp.expect(pg_temp.fails($$select public.calendar_event_delete('11111111-0000-0000-0000-000000000002', 99)$$, 'conflict'), 'delete: stale revision refused');
select public.calendar_event_delete('11111111-0000-0000-0000-000000000002', 1);
select pg_temp.expect((public.calendar_event_delete('11111111-0000-0000-0000-000000000002', 1) ->> 'deleted')::boolean, 'delete twice: no-op');
reset role;
grant select on since to authenticated;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((select jsonb_agg(x ->> 'id') from jsonb_array_elements(public.calendar_changes((select t from since)) -> 'events') x) = '["11111111-0000-0000-0000-000000000002"]'::jsonb,
  'sync: her phone hears about his delete');
select pg_temp.expect((public.calendar_changes((select t from since)) #>> '{events,0,deleted}')::boolean, 'sync: as a tombstone');
select pg_temp.expect(jsonb_array_length(public.calendar_changes(null) -> 'events') = 2, 'sync from scratch: only live events');
select pg_temp.expect(pg_temp.fails($$select public.calendar_event_save('{"id":"11111111-0000-0000-0000-000000000002","title":"Piano","starts_on":"2026-11-16"}', 2)$$, 'conflict'),
  'editing an event the other adult deleted: conflict');
reset role;

-- ---------------------------------------------------------------- isolation

select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.count_of('select 1 from public.calendar_events') = 0, 'other household: reads none of their events');
select pg_temp.expect(jsonb_array_length(public.calendar_changes(null) -> 'events') = 0, 'other household: changes() empty');
select pg_temp.expect(pg_temp.fails($$select public.calendar_event_save('{"id":"11111111-0000-0000-0000-000000000001","title":"Hijack","starts_on":"2026-11-18"}', 2)$$, 'invalid'),
  'other household: can''t overwrite their event by id');
select pg_temp.expect(public.calendar_event_delete('11111111-0000-0000-0000-000000000001', 2) is null, 'other household: can''t delete it either');
select pg_temp.expect(pg_temp.fails('update public.calendar_events set title = ''x'''), 'no direct writes');
reset role;
select pg_temp.expect((select title from public.calendar_events where id = '11111111-0000-0000-0000-000000000001') = 'Dentist (Dr. Park)', 'their event untouched');
select pg_temp.as_user('authenticated', :NOBODY);
select pg_temp.expect(pg_temp.fails($$select public.calendar_event_save('{"id":"11111111-0000-0000-0000-000000000009","title":"x","starts_on":"2026-11-16"}', null)$$, 'no_household'), 'no household: set up the family first');
select pg_temp.expect(jsonb_array_length(public.calendar_changes(null) -> 'events') = 0, 'no household: nothing');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails('select 1 from public.calendar_events'), 'anon: no table');
select pg_temp.expect(pg_temp.fails('select public.calendar_changes(null)'), 'anon: no changes');
reset role;

-- A removed partner loses the calendar at once.
select pg_temp.as_user('authenticated', :MOM);
select public.household_partner_remove();
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(pg_temp.count_of('select 1 from public.calendar_events') = 0, 'removed partner: no events');
reset role;
