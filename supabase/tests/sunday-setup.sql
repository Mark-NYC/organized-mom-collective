-- Sunday Setup (supabase/migrations/20261126000000_sunday_setup.sql). Run by scripts/test-household-sql.sh on a
-- throwaway local database. Never run on the real project.
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
  ('00000000-0000-0000-0000-00000005e101', 'ss-mom@example.com', now()),
  ('00000000-0000-0000-0000-00000005e102', 'ss-dad@example.com', now()),
  ('00000000-0000-0000-0000-00000005e103', 'ss-other@example.com', now());
\set MOM '''00000000-0000-0000-0000-00000005e101'''
\set DAD '''00000000-0000-0000-0000-00000005e102'''
\set OTHER '''00000000-0000-0000-0000-00000005e103'''

select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Lees', '{}', '[{"first_name":"Mayumi","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Tomasz","kind":"adult","role":"partner"},{"first_name":"Kaito","kind":"child","role":"child","birth_year":2018}]');
reset role;
\set TOM '(select id from public.club_family_members where first_name = ''Tomasz'')'
\set KAI '(select id from public.club_family_members where first_name = ''Kaito'')'
select pg_temp.as_user('authenticated', :MOM);
create temp table inv as select public.household_invite_create(:TOM, 'ss-dad@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('Others', '{}', '[{"first_name":"Bertil","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
-- Bo's id, read with full rights: as Mom, RLS hides other households' people (a lookup there returns nothing).
create temp table bo as select id from public.club_family_members where first_name = 'Bertil';
grant select on bo to authenticated;
\set BO '(select id from bo)'

-- The coming week, relative to today, so the test never ages out.
create temp table wk as select (current_date + ((7 - extract(dow from current_date)::int) % 7))::date as d;
grant select on wk to authenticated;
\set W '(select d from wk)'

select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(public.sunday_setup_get(:W) is null, 'no plan for the week yet');
create temp table s1 as select public.sunday_setup_save(:W,
  jsonb_build_object((select d from wk)::text, jsonb_build_object('meal', 'Tacos', 'cook', :TOM)),
  jsonb_build_object(((select d from wk) + 1)::text, :KAI), '  Grandma visits Saturday ', false, null) as s;
reset role;
grant select on s1 to authenticated;
select pg_temp.expect((select (s ->> 'revision')::int from s1) = 1, 'first save: revision 1');
select pg_temp.expect((select s ->> 'notes' from s1) = 'Grandma visits Saturday', 'notes trimmed');

-- The partner sees it and finishes it.
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(public.sunday_setup_get(:W) #>> array['dinners', (select d from wk)::text, 'meal'] = 'Tacos', 'partner reads the same week');
select pg_temp.expect((public.sunday_setup_save(:W, (select s -> 'dinners' from s1), (select s -> 'chores' from s1), 'Grandma visits Saturday', true, 1) ->> 'completed')::boolean,
  'partner marks it done');
reset role;

-- Her stale copy is refused.
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.sunday_setup_save(%L, ''{}'', ''{}'', null, false, 1)', (select d from wk)), 'conflict'), 'stale save: conflict');
select pg_temp.expect(pg_temp.fails(format('select public.sunday_setup_save(%L, ''{}'', ''{}'', null, false, null)', (select d from wk)), 'conflict'), 'a second "first save" of the same week: conflict, never a duplicate');
-- Validation.
select pg_temp.expect(pg_temp.fails(format('select public.sunday_setup_save(%L, %L, ''{}'', null, false, 2)', (select d from wk), jsonb_build_object('2020-01-01', jsonb_build_object('meal', 'x'))), 'invalid'), 'dinners only on this week''s dates');
select pg_temp.expect((select count(*) from public.club_family_members where first_name = 'Bertil') = 0, 'RLS: she can''t even see another family''s people');
select pg_temp.expect(pg_temp.fails(format('select public.sunday_setup_save(%L, ''{}'', %L, null, false, 2)', (select d from wk), jsonb_build_object((select d from wk)::text, :BO)), 'invalid'), 'only this family''s people');
select pg_temp.expect(pg_temp.fails(format('select public.sunday_setup_save(%L, %L, ''{}'', null, false, 2)', (select d from wk), jsonb_build_object((select d from wk)::text, jsonb_build_object('meal', 'x', 'secret', 1))), 'invalid'), 'dinner entries: meal and cook only');
select pg_temp.expect(pg_temp.fails(format('select public.sunday_setup_save(%L, ''{}'', ''{}'', null, false, null)', current_date + 400), 'invalid'), 'not a year ahead');
reset role;

-- Isolation.
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(public.sunday_setup_get(:W) is null, 'other household: their week isn''t visible');
select pg_temp.expect(pg_temp.count_of('select 1 from public.sunday_setups') = 0, 'other household: RLS shows nothing');
select pg_temp.expect((public.sunday_setup_save(:W, '{}', '{}', null, false, null) ->> 'revision')::int = 1, 'other household: its own week starts fresh');
reset role;
select pg_temp.expect((select count(*) from public.sunday_setups) = 2, 'two households, two plans, nothing shared');
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails('select 1 from public.sunday_setups'), 'anon: no table');
reset role;
