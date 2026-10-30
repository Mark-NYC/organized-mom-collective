-- Tests for the expanded family profile (supabase/migrations/20261109000000_club_family_profile.sql). Run by
-- scripts/test-admin-sql.sh on a throwaway local database after every migration. Never run on the real project.
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
  ('00000000-0000-0000-0000-0000000f0a01', 'profile-a@example.com', now()),
  ('00000000-0000-0000-0000-0000000f0a02', 'profile-b@example.com', now()),
  ('00000000-0000-0000-0000-0000000f0a03', 'profile-new@example.com', now());

\set A '''00000000-0000-0000-0000-0000000f0a01'''
\set B '''00000000-0000-0000-0000-0000000f0a02'''
\set N '''00000000-0000-0000-0000-0000000f0a03'''

-- ---------------------------------------------------------------- before the family step

select pg_temp.as_user('authenticated', :N);
select pg_temp.expect(public.club_family_profile() is null, 'no household yet: no profile');
select pg_temp.expect(pg_temp.fails($$select public.club_activities_save('[]')$$, 'no_household'), 'the family step comes first');
reset role;

-- ---------------------------------------------------------------- an existing household (saved before this migration's columns mattered)

select pg_temp.as_user('authenticated', :A);
select public.club_household_save('Team A', '{"pets":true}',
  '[{"first_name":"Mia","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Lee","kind":"adult","role":"partner"},{"first_name":"Ava","kind":"child","role":"child","birth_year":2018,"birth_month":4},{"first_name":"Bo","kind":"child","role":"child","birth_year":2020,"birth_month":9}]');
create temp table a_ids as select (m ->> 'id')::uuid as id, m ->> 'first_name' as name from jsonb_array_elements(public.club_household() -> 'members') m;
grant select on a_ids to authenticated;
\set MIA '(select id from a_ids where name = ''Mia'')'
\set LEE '(select id from a_ids where name = ''Lee'')'
\set AVA '(select id from a_ids where name = ''Ava'')'
\set BO '(select id from a_ids where name = ''Bo'')'

select pg_temp.expect((public.club_family_profile() ->> 'setup_completed')::boolean = false, 'existing household: setup not complete');
select pg_temp.expect(jsonb_array_length(public.club_family_profile() -> 'setup_done') = 0, 'nothing answered yet');
select pg_temp.expect(public.club_household() ->> 'onboarded' = 'true', 'onboarding (the family step) is unchanged');

-- Step 2: the week.
select public.club_activities_save(jsonb_build_array(
  jsonb_build_object('category', 'school', 'member_ids', jsonb_build_array(:AVA, :BO), 'days', '[1,2,3,4,5]'::jsonb),
  jsonb_build_object('category', 'sports', 'name', 'Soccer', 'member_ids', jsonb_build_array(:AVA), 'days', '[2,4]'::jsonb, 'starts_at', '17:30'),
  jsonb_build_object('category', 'work')));
select pg_temp.expect(jsonb_array_length(public.club_family_profile() -> 'activities') = 3, 'three activities saved');
select pg_temp.expect((select a ->> 'starts_at' from jsonb_array_elements(public.club_family_profile() -> 'activities') a where a ->> 'name' = 'Soccer') = '17:30', 'time kept');
select pg_temp.expect(public.club_family_profile() -> 'setup_done' ? 'week', 'week step marked done');
select pg_temp.expect((public.club_household() ->> 'profile_version')::int = 1, 'profile answers do not bump profile_version');

-- Update one, remove one.
create temp table soccer as select (a ->> 'id')::uuid id from jsonb_array_elements(public.club_family_profile() -> 'activities') a where a ->> 'name' = 'Soccer';
grant select on soccer to authenticated;
select public.club_activities_save(jsonb_build_array(
  jsonb_build_object('id', (select id from soccer), 'category', 'sports', 'name', 'Soccer practice', 'days', '[3]'::jsonb)));
select pg_temp.expect(jsonb_array_length(public.club_family_profile() -> 'activities') = 1, 'left-out activities are removed');
select pg_temp.expect((public.club_family_profile() -> 'activities' -> 0 ->> 'id')::uuid = (select id from soccer), 'an edited activity keeps its id');
select pg_temp.expect(public.club_family_profile() -> 'activities' -> 0 ->> 'starts_at' is null, 'time cleared');

select pg_temp.expect(pg_temp.fails($$select public.club_activities_save('[{"category":"skydiving"}]')$$, 'invalid'), 'unknown activity category refused');
select pg_temp.expect(pg_temp.fails($$select public.club_activities_save('[{"category":"sports","days":[7]}]')$$, 'invalid'), 'day out of range refused');
select pg_temp.expect(pg_temp.fails($$select public.club_activities_save('[{"category":"sports","starts_at":"25:00"}]')$$, 'invalid'), 'bad time refused');
select pg_temp.expect(pg_temp.fails($$select public.club_activities_save('[{"category":"sports","member_ids":["00000000-0000-0000-0000-000000000bad"]}]')$$, 'invalid'), 'a stranger can''t be a participant');
select pg_temp.expect(pg_temp.fails($$select public.club_activities_save((select jsonb_agg(jsonb_build_object('category','other')) from generate_series(1,31)))$$, 'invalid'), 'at most 30 activities');

-- Step 3: existing responsibilities. Owner vs helper; individual vs shared; unassigned allowed.
select public.club_responsibilities_save('existing', jsonb_build_array(
  jsonb_build_object('category', 'meals', 'owner_ids', jsonb_build_array(:MIA, :LEE)),
  jsonb_build_object('category', 'laundry', 'owner_ids', jsonb_build_array(:MIA), 'helper_ids', jsonb_build_array(:AVA)),
  jsonb_build_object('category', 'transportation')));
select pg_temp.expect((select string_agg(r ->> 'category' || ':' || coalesce(r ->> 'scope', 'none'), ',' order by r ->> 'category')
                         from jsonb_array_elements(public.club_family_profile() -> 'responsibilities') r where r ->> 'status' = 'existing')
                      = 'laundry:individual,meals:shared,transportation:none', 'scope comes from the owners');
select pg_temp.expect(pg_temp.fails(format($$select public.club_responsibilities_save('existing', '[{"category":"laundry","owner_ids":["%s"],"helper_ids":["%s"]}]')$$, :AVA, :AVA), 'invalid'),
  'nobody both owns and helps');
select pg_temp.expect(pg_temp.fails($$select public.club_responsibilities_save('suggested', '[]')$$, 'invalid'), 'the browser can''t write suggestions');
select pg_temp.expect(pg_temp.fails($$select public.club_responsibilities_save('confirmed', '[]')$$, 'invalid'), 'or confirmed assignments');

-- Step 4: desired, kept apart from existing.
select public.club_responsibilities_save('desired', jsonb_build_array(
  jsonb_build_object('category', 'school-prep', 'item', 'pack-school-bag', 'owner_ids', jsonb_build_array(:AVA)),
  jsonb_build_object('category', 'other', 'label', 'Feeding the fish')));
select pg_temp.expect((select count(*) from jsonb_array_elements(public.club_family_profile() -> 'responsibilities') r where r ->> 'status' = 'existing') = 3,
  'saving desired leaves existing alone');
select public.club_responsibilities_save('desired', '[]');
select pg_temp.expect((select count(*) from jsonb_array_elements(public.club_family_profile() -> 'responsibilities') r where r ->> 'status' = 'desired') = 0,
  'an empty answer clears desired');
select pg_temp.expect(public.club_family_profile() -> 'setup_done' ? 'growth', 'skipping still marks the step');

-- Steps 5–6.
select public.club_focus_save('challenges', array['knowing-plans', 'routines'], null, null, null);
select pg_temp.expect((public.club_family_profile() ->> 'setup_completed')::boolean = false, 'not complete until every step');
select public.club_focus_save('priority', array['knowing-plans', 'routines'], null, 'mornings', '  The 7am scramble ');
select pg_temp.expect((public.club_family_profile() ->> 'setup_completed')::boolean, 'every step answered: complete');
select pg_temp.expect(public.club_family_profile() ->> 'priority_note' = 'The 7am scramble', 'note trimmed');
select pg_temp.expect(pg_temp.fails($$select public.club_focus_save('priority', array['<b>'], null, null, null)$$, 'invalid'), 'challenge ids checked');
select pg_temp.expect(pg_temp.fails($$select public.club_focus_save('priority', '{}', null, null, repeat('x', 121))$$, 'invalid'), 'note length checked');
select pg_temp.expect(pg_temp.fails($$select public.club_focus_save('week', '{}', null, null, null)$$, 'invalid'), 'only focus steps');

-- Saving the family again (step 1) leaves the rest of the profile alone; removed people keep their ids in answers.
select public.club_household_save('Team A', '{"pets":true}', (select jsonb_agg(jsonb_build_object('id', id, 'first_name', name, 'kind', 'adult', 'role', case name when 'Mia' then 'parent' else 'partner' end, 'is_account_holder', name = 'Mia')) from a_ids where name in ('Mia', 'Lee')));
select pg_temp.expect((select count(*) from jsonb_array_elements(public.club_family_profile() -> 'responsibilities')) = 3, 'family save keeps responsibilities');
select pg_temp.expect((public.club_family_profile() ->> 'setup_completed')::boolean, 'and setup state');
reset role;

-- ---------------------------------------------------------------- isolation

select pg_temp.as_user('authenticated', :B);
select public.club_household_save(null, '{}', '[{"first_name":"Bea","kind":"adult","role":"parent","is_account_holder":true}]');
select pg_temp.expect(jsonb_array_length(public.club_family_profile() -> 'activities') = 0, 'B sees none of A''s activities');
select pg_temp.expect((select count(*) from public.club_activities) = 0, 'B reads no activity rows of A''s');
select pg_temp.expect((select count(*) from public.club_responsibilities) = 0, 'B reads no responsibility rows of A''s');
select pg_temp.expect(pg_temp.fails(format($$select public.club_activities_save('[{"id":"%s","category":"other"}]')$$, (select id from soccer)), 'invalid'), 'B can''t edit A''s activity by id');
select pg_temp.expect(pg_temp.fails(format($$select public.club_activities_save('[{"category":"school","member_ids":["%s"]}]')$$, (select id from a_ids where name = 'Ava')), 'invalid'), 'B can''t name A''s child');
select pg_temp.expect(pg_temp.fails($$insert into public.club_activities (household_id, category) select id, 'other' from public.club_households limit 1$$), 'no direct writes');
select pg_temp.expect(pg_temp.fails($$update public.club_households set priority = 'x'$$), 'no direct household writes');
reset role;

select pg_temp.as_user('authenticated', :A);
select pg_temp.expect((select count(*) from public.club_activities) = 1, 'A reads her own activity rows');
reset role;

select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($$select public.club_family_profile()$$), 'anon can''t read a profile');
select pg_temp.expect(pg_temp.fails($$select count(*) from public.club_activities$$), 'anon reads no activities');
reset role;

-- Internals stay server-only.
select pg_temp.expect(not has_function_privilege('authenticated', 'public.club_setup_mark(uuid, text)', 'execute'), 'setup_mark is internal');
select pg_temp.expect(not has_function_privilege('authenticated', 'public.club_members_belong(uuid, uuid[])', 'execute'), 'members_belong is internal');
select pg_temp.expect(not has_function_privilege('authenticated', 'public.club_my_household()', 'execute'), 'my_household is internal');
