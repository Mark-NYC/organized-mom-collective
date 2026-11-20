-- Family development records (supabase/migrations/20261207000000_family_development_records.sql).
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
  ('00000000-0000-0000-0000-0000000d7101', 'dev-mom@example.com', now()),
  ('00000000-0000-0000-0000-0000000d7102', 'dev-dad@example.com', now()),
  ('00000000-0000-0000-0000-0000000d7103', 'dev-other@example.com', now()),
  ('00000000-0000-0000-0000-0000000d7104', 'dev-nobody@example.com', now());
\set MOM '''00000000-0000-0000-0000-0000000d7101'''
\set DAD '''00000000-0000-0000-0000-0000000d7102'''
\set OTHER '''00000000-0000-0000-0000-0000000d7103'''
\set NOBODY '''00000000-0000-0000-0000-0000000d7104'''

select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('The Reyes', '{}',
  '[{"first_name":"Ana","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Luis","kind":"adult","role":"partner"},
    {"first_name":"Mia","kind":"child","role":"child","birth_year":2018,"birth_month":3},{"first_name":"Noah","kind":"child","role":"child","birth_year":2015,"birth_month":9}]');
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Luis'), 'dev-dad@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('Others', '{}', '[{"first_name":"Lee","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Kit","kind":"child","role":"child","birth_year":2017}]');
reset role;
\set ANA '(select id from public.club_family_members where first_name = ''Ana'')'
\set MIA '(select id from public.club_family_members where first_name = ''Mia'')'
\set NOAH '(select id from public.club_family_members where first_name = ''Noah'')'
\set KIT '(select id from public.club_family_members where first_name = ''Kit'')'
\set R1 '''11111111-0000-0000-0000-0000000d7001'''
\set R2 '''11111111-0000-0000-0000-0000000d7002'''
\set R3 '''11111111-0000-0000-0000-0000000d7003'''
\set R4 '''11111111-0000-0000-0000-0000000d7004'''
\set R5 '''11111111-0000-0000-0000-0000000d7005'''


-- ---------------------------------------------------------------- Club entitlement on writes, household on reads
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', :R1, 'decision', 'start', 'member_id', :MIA, 'skill_id', 'school-bag', 'title', 'Pack my backpack', 'stage', 'model', 'cue', 'After dinner', 'finish', 'Everything for tomorrow is in the bag', 'library_version', 1)), 'club_required'), 'a free household cannot save development decisions (paid layer)');
select pg_temp.expect(public.household_development() = '[]'::jsonb, 'a free household can read its (empty) development records');
reset role;
insert into public.club_access_grants (user_id, reason, note) values (:MOM, 'beta', 'family development test');

select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((select (public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'start', 'member_id', :MIA, 'skill_id', 'school-bag', 'title', 'Pack my backpack', 'stage', 'model', 'cue', 'After dinner', 'finish', 'Everything for tomorrow is in the bag', 'library_version', 1)) ->> 'stage')) = 'model', 'a Club adult starts a record at the stage the family chose');
select pg_temp.expect((select status from public.household_development where id = :R1) = 'active', 'started records are active');
select pg_temp.expect((select count(*) from public.household_development_events where record_id = :R1 and decision = 'start') = 1, 'the start is in the history');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :MIA, 'skill_id', 'school-bag', 'title', 'Again', 'stage', 'model', 'library_version', 1)), 'exists'), 'one record per child per skill: no duplicates');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :MIA, 'skill_id', 'bed', 'title', 'Bed', 'library_version', 1)), 'invalid'), 'starting needs a family-chosen stage (never inferred)');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :ANA, 'skill_id', 'bed', 'title', 'Bed', 'stage', 'model', 'library_version', 1)), 'invalid'), 'records are for children only');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :KIT, 'skill_id', 'bed', 'title', 'Bed', 'stage', 'model', 'library_version', 1)), 'invalid'), 'cannot create a record for another household''s child');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'advance', 'member_id', :MIA, 'skill_id', 'bed', 'title', 'Bed', 'library_version', 1)), 'invalid'), 'advance needs an existing record');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :MIA, 'skill_id', 'bed', 'title', 'Bed', 'stage', 'model', 'library_version', 1, 'extra', 1)), 'invalid'), 'unknown fields are refused');

-- ---------------------------------------------------------------- one stage at a time, only on a decision
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'advance', 'library_version', 1), 1) ->> 'stage') = 'assist', 'advance moves exactly one stage (model → assist)');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 1)', jsonb_build_object('id', :R1, 'decision', 'stay', 'library_version', 1)), 'conflict'), 'a stale revision is a conflict');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'advance', 'library_version', 1), 2) ->> 'stage') = 'watch', 'assist → watch');
-- Prolonged Watch: many stays and check-ins never move the stage.
do $$ declare i int; rev int; begin
  for i in 1..12 loop
    select revision into rev from public.household_development where id = '11111111-0000-0000-0000-0000000d7001';
    perform public.household_development_decide(jsonb_build_object('id', '11111111-0000-0000-0000-0000000d7001', 'decision', case when i % 2 = 0 then 'stay' else 'check-in' end,
      'library_version', 1, 'check', jsonb_build_object('signal', 'consistency', 'value', 'strong', 'variation', i % 3 = 0)), rev);
  end loop;
end $$;
select pg_temp.expect((select stage from public.household_development where id = :R1) = 'watch', 'twelve "going well" check-ins in Watch never advance the stage');
select pg_temp.expect((select variations_practiced from public.household_development where id = :R1) = 4, 'practice in new circumstances is counted, not converted into a stage');
select pg_temp.expect((select last_check_in_on from public.household_development where id = :R1) = current_date, 'check-ins record the date');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, %s)', jsonb_build_object('id', :R1, 'decision', 'check-in', 'library_version', 1), (select revision from public.household_development where id = :R1)), 'invalid'), 'a check-in needs an answer');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, %s)', jsonb_build_object('id', :R1, 'decision', 'check-in', 'library_version', 1, 'check', jsonb_build_object('signal', 'mood', 'value', 'strong')), (select revision from public.household_development where id = :R1)), 'invalid'), 'unknown check-in signals are refused');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, %s)', jsonb_build_object('id', :R1, 'decision', 'stay', 'title', 'Renamed', 'library_version', 1), (select revision from public.household_development where id = :R1)), 'invalid'), 'a stage decision cannot quietly rewrite the family''s words');
reset role;

-- The other adult: same household, sees and decides on the same record.
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(jsonb_array_length(public.household_development()) = 1, 'the partner reads the household''s records');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'step-back', 'note', 'Busy weeks, back to doing it together', 'library_version', 1), (select revision from public.household_development where id = :R1)) ->> 'stage') = 'assist', 'either adult can step back (watch → assist), using the household''s Club');
select pg_temp.expect((select note from public.household_development where id = :R1) = 'Busy weeks, back to doing it together', 'notes are kept');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'advance', 'library_version', 1), (select revision from public.household_development where id = :R1)) ->> 'stage') = 'watch', 'back to watch');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'advance', 'library_version', 1), (select revision from public.household_development where id = :R1)) ->> 'status') = 'launched', 'launch only by the family''s explicit advance from Watch');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, %s)', jsonb_build_object('id', :R1, 'decision', 'advance', 'library_version', 2), (select revision from public.household_development where id = :R1)), 'invalid'), 'nothing past Launch');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'step-back', 'library_version', 2), (select revision from public.household_development where id = :R1)) ->> 'status') = 'active', 'a launched skill can be stepped back to an active Watch');
select pg_temp.expect((select stage from public.household_development where id = :R1) = 'watch', 'launch → watch');
select pg_temp.expect((select library_version from public.household_development where id = :R1) = 2, 'the record notes the newest library version it was decided under');
reset role;

-- ---------------------------------------------------------------- pause, dismiss, resume (no inferred stage)
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R2, 'decision', 'dismiss', 'member_id', :NOAH, 'skill_id', 'dishwasher', 'title', 'Unload safe dishwasher items', 'library_version', 1)) ->> 'status') = 'dismissed', '"Not for us" is remembered');
select pg_temp.expect((select stage from public.household_development where id = :R2) is null, 'a dismissed suggestion gets no stage');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R3, 'decision', 'pause', 'member_id', :NOAH, 'skill_id', 'snack', 'title', 'Prepare an approved snack', 'library_version', 1)) ->> 'status') = 'paused', '"Not now" is remembered');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 1)', jsonb_build_object('id', :R3, 'decision', 'resume', 'library_version', 1)), 'invalid'), 'resuming a never-started suggestion needs the family''s stage');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R3, 'decision', 'resume', 'stage', 'assist', 'library_version', 1), 1) ->> 'status') = 'active', 'the family deliberately reopens it at the stage they choose');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 2)', jsonb_build_object('id', :R3, 'decision', 'resume', 'stage', 'model', 'library_version', 1)), 'invalid'), 'an active record cannot be resumed');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R4, 'decision', 'start', 'member_id', :NOAH, 'skill_id', 'bed', 'title', 'Make my bed', 'stage', 'launch', 'library_version', 1)) ->> 'status') = 'launched', 'a family can record something the child already owns as launched');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R4, 'decision', 'pause', 'library_version', 1), 1) ->> 'stage') = 'launch', 'pausing keeps the stage');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R4, 'decision', 'resume', 'library_version', 1), 2) ->> 'status') = 'launched', 'resuming a paused launched skill keeps it launched');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R4, 'decision', 'modify', 'cue', 'After getting dressed', 'finish', 'Covers straight, pillow on top', 'library_version', 1), 3) ->> 'cue') = 'After getting dressed', 'the family can change the cue and finish line');
select pg_temp.expect((select stage || status from public.household_development where id = :R4) = 'launchlaunched', 'modify never changes the stage');
select pg_temp.expect((select count(*) from public.household_development_events where record_id = :R1) = 19, 'every decision is in the history (start, 2 advances, 12 check-ins, partner''s 4; refused calls leave none)');
select pg_temp.expect(jsonb_array_length((select r -> 'history' from jsonb_array_elements(public.household_development()) r where r ->> 'id' = :R1)) = 12, 'the read carries the most recent history');
reset role;

-- ---------------------------------------------------------------- isolation and append-only history
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(public.household_development() = '[]'::jsonb, 'another household sees none of these records');
select pg_temp.expect((select count(*) from public.household_development) = 0, 'RLS: another household reads no rows');
select pg_temp.expect((select count(*) from public.household_development_events) = 0, 'RLS: another household reads no history');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 1)', jsonb_build_object('id', :R3, 'decision', 'pause', 'library_version', 1))), 'another household cannot change a record (no Club here either)');
reset role;
insert into public.club_access_grants (user_id, reason, note) values (:OTHER, 'beta', 'family development test');
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 2)', jsonb_build_object('id', :R3, 'decision', 'pause', 'library_version', 1)), 'invalid'), 'another Club household cannot change a record by id');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', :R5, 'decision', 'start', 'member_id', :MIA, 'skill_id', 'teeth', 'title', 'Teeth', 'stage', 'model', 'library_version', 1)), 'invalid'), 'another Club household cannot create a record for this child');
reset role;
select pg_temp.as_user('authenticated', :NOBODY);
select pg_temp.expect(pg_temp.fails('select public.household_development()', 'no_household'), 'an account without a household has nothing');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails('select public.household_development()'), 'anonymous callers are refused');
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('update public.household_development set stage = %L where id = %L', 'launch', :R1)), 'no direct writes: stages change only through a decision');
select pg_temp.expect(pg_temp.fails(format('delete from public.household_development_events where record_id = %L', :R1)), 'history cannot be deleted');
select pg_temp.expect(pg_temp.fails(format('update public.household_development_events set decision = %L', 'start')), 'history cannot be edited');
reset role;

-- ---------------------------------------------------------------- a lapsed membership keeps the family's history
update public.club_access_grants set revoked_at = now() where user_id = :MOM;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(jsonb_array_length(public.household_development()) = 4, 'after the Club ends, the family still reads its records');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, %s)', jsonb_build_object('id', :R1, 'decision', 'stay', 'library_version', 1), (select revision from public.household_development where id = :R1)), 'club_required'), 'but cannot make new paid-layer decisions');
reset role;

-- ---------------------------------------------------------------- nothing existing changed
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = (select household_id from public.household_adults where user_id = :MOM)) = 0, 'development decisions never create agreements or profile rows');
