-- Follow-through on agreements (supabase/migrations/20261204000000_agreement_follow_through.sql): weekly check-ins.
-- Run by scripts/test-household-sql.sh on a throwaway local database. Never run on the real project.
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
  ('00000000-0000-0000-0000-0000000a9201', 'fol-mom@example.com', now()),
  ('00000000-0000-0000-0000-0000000a9202', 'fol-dad@example.com', now()),
  ('00000000-0000-0000-0000-0000000a9203', 'fol-other@example.com', now()),
  ('00000000-0000-0000-0000-0000000a9204', 'fol-nobody@example.com', now());
\set MOM '''00000000-0000-0000-0000-0000000a9201'''
\set DAD '''00000000-0000-0000-0000-0000000a9202'''
\set OTHER '''00000000-0000-0000-0000-0000000a9203'''
\set NOBODY '''00000000-0000-0000-0000-0000000a9204'''

-- A household with existing and desired responsibilities from the family profile, and a partner.
select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Followers', '{}',
  '[{"first_name":"Ada","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Obi","kind":"adult","role":"partner"},
    {"first_name":"Zara","kind":"child","role":"child","birth_year":2017,"birth_month":2},{"first_name":"Kofi","kind":"child","role":"child","birth_year":2019,"birth_month":5}]');
reset role;
\set ADA '(select id from public.club_family_members where first_name = ''Ada'' and household_id in (select household_id from public.household_adults where user_id in (''00000000-0000-0000-0000-0000000a9201'',''00000000-0000-0000-0000-0000000a9203'')))'
\set OBI '(select id from public.club_family_members where first_name = ''Obi'' and household_id in (select household_id from public.household_adults where user_id in (''00000000-0000-0000-0000-0000000a9201'',''00000000-0000-0000-0000-0000000a9203'')))'
\set ZARA '(select id from public.club_family_members where first_name = ''Zara'' and household_id in (select household_id from public.household_adults where user_id in (''00000000-0000-0000-0000-0000000a9201'',''00000000-0000-0000-0000-0000000a9203'')))'
\set KOFI '(select id from public.club_family_members where first_name = ''Kofi'' and household_id in (select household_id from public.household_adults where user_id in (''00000000-0000-0000-0000-0000000a9201'',''00000000-0000-0000-0000-0000000a9203'')))'
\set HID '(select household_id from public.household_adults where user_id = ''00000000-0000-0000-0000-0000000a9201'')'
select pg_temp.as_user('authenticated', :MOM);
select public.club_responsibilities_save('existing', jsonb_build_array(
  jsonb_build_object('category', 'meals', 'owner_ids', jsonb_build_array(:ADA), 'helper_ids', jsonb_build_array(:ZARA))));
select public.club_responsibilities_save('desired', jsonb_build_array(
  jsonb_build_object('category', 'school-prep', 'item', 'pack-school-bag', 'owner_ids', jsonb_build_array(:ZARA), 'helper_ids', '[]'::jsonb)));
create temp table inv as select public.household_invite_create(:OBI, 'fol-dad@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);

-- An agreement from the meeting, and a profile row that is not an agreement.
select pg_temp.as_user('authenticated', :MOM);
create temp table a as select public.household_agreement_save(jsonb_build_object('id', gen_random_uuid(), 'category', 'school-prep',
  'text', 'Pack my bag before bed', 'owner_ids', jsonb_build_array(:ZARA), 'month', '2026-11'), null) as j;
reset role;
grant select on a to authenticated, anon;
\set AID '(select (j ->> ''id'')::uuid from a)'
select pg_temp.expect(not (select j ? 'progress' from a), 'the agreement read is unchanged (no new fields for older phones)');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((public.household_follow_through() -> 0 ->> 'progress') is null and (public.household_follow_through() -> 0 ->> 'revision') = '1', 'follow-through read: a new agreement, not checked in yet');
reset role;
select pg_temp.expect((select count(*) from public.club_responsibilities where progress is not null) = 0, 'the migration changed no row');

-- Either adult checks in; the revision moves like any change.
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect((public.household_agreement_check_in(:AID, 'reminders', null, 1) ->> 'progress') = 'improving', 'the other adult checks in: needs reminders → improving');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_check_in(%L, %L, null, 1)', :AID, 'on-own'), 'conflict'), 'a stale revision is a conflict (the other adult answered first)');
select pg_temp.expect((public.household_agreement_check_in(:AID, 'struggling', 'forgets', 2) ->> 'barrier') = 'forgets', 'struggling, with what gets in the way');
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((public.household_agreement_check_in(:AID, 'on-own', null, 3) ->> 'progress') = 'independent', 'on my own → independent');
select pg_temp.expect((select barrier from public.club_responsibilities where id = :AID) is null, 'the barrier clears once it is going well');
select pg_temp.expect((select checked_on from public.club_responsibilities where id = :AID) = current_date, 'checked_on is today');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_check_in(%L, %L, %L, 4)', :AID, 'on-own', 'forgets'), 'invalid'), 'a barrier only with struggling');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_check_in(%L, %L, null, 4)', :AID, 'retired'), 'invalid'), 'only the three answers');
select pg_temp.expect((public.household_follow_through() -> 0 ->> 'progress') = 'independent', 'the other phone reads it');
select pg_temp.expect((public.household_agreements(null) -> 'agreements' -> 0 ->> 'revision') = '4', 'the agreement sync sees the new revision, so a stale edit is a conflict');
reset role;

-- Nobody else.
select pg_temp.as_user('authenticated', :OTHER);
do $$ begin if public.household_id_for(auth.uid()) is null then
  perform public.club_household_save('Another family', '{}', '[{"first_name":"Lee","kind":"adult","role":"parent","is_account_holder":true}]');
end if; end $$;
select pg_temp.expect(public.household_id_for(auth.uid()) is not null, 'another family with its own household');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_check_in(%L, %L, null, 4)', :AID, 'reminders'), 'invalid'), 'another household cannot check in');
select pg_temp.expect(jsonb_array_length(public.household_follow_through()) = 0, 'or read it');
reset role;
select pg_temp.as_user('authenticated', :NOBODY);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_check_in(%L, %L, null, 4)', :AID, 'reminders'), 'no_household'), 'a signed-in adult with no household cannot');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_check_in(%L, %L, null, 4)', :AID, 'reminders')), 'signed out cannot');
reset role;
do $$ begin
  update public.club_responsibilities set progress = 'improving' where status = 'existing';
  raise exception 'FAIL: a profile row took progress';
exception when check_violation then raise notice 'ok - only agreements can carry progress (the database refuses it on profile rows)';
end $$;

-- Removed agreements can't be checked in on; the profile's own rows are never touched.
select pg_temp.as_user('authenticated', :MOM);
select public.household_agreement_remove(:AID, 4);
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_check_in(%L, %L, null, 5)', :AID, 'reminders'), 'removed'), 'a removed agreement is not checked in on');
reset role;
select pg_temp.expect((select count(*) from public.club_responsibilities where status in ('existing', 'desired') and (progress is not null or checked_on is not null)) = 0, 'existing and desired rows untouched');
