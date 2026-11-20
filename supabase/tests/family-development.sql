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
\set R6 '''11111111-0000-0000-0000-0000000d7006'''
\set R7 '''11111111-0000-0000-0000-0000000d7007'''
\set A1 '''22222222-0000-0000-0000-0000000d7001'''
\set A3 '''22222222-0000-0000-0000-0000000d7003'''
\set A4 '''22222222-0000-0000-0000-0000000d7004'''
\set A4B '''22222222-0000-0000-0000-0000000d7014'''
\set A6 '''22222222-0000-0000-0000-0000000d7006'''
\set A6B '''22222222-0000-0000-0000-0000000d7016'''
\set A7 '''22222222-0000-0000-0000-0000000d7007'''
\set A7B '''22222222-0000-0000-0000-0000000d7017'''


-- ---------------------------------------------------------------- Club entitlement on writes, household on reads
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', :R1, 'decision', 'start', 'member_id', :MIA, 'skill_id', 'school-bag', 'title', 'Pack my backpack', 'stage', 'model', 'cue', 'After dinner', 'finish', 'Everything for tomorrow is in the bag', 'category', 'school-prep', 'agreement_id', :A1, 'library_version', 1)), 'club_required'), 'a free household cannot save development decisions (paid layer)');
select pg_temp.expect(public.household_development() = '[]'::jsonb, 'a free household can read its (empty) development records');
select pg_temp.expect((select count(*) from public.club_responsibilities) = 0, 'a refused start leaves no agreement behind');
reset role;
insert into public.club_access_grants (user_id, reason, note) values (:MOM, 'beta', 'family development test');

-- ---------------------------------------------------------------- "We agreed": record and agreement in one step
select pg_temp.as_user('authenticated', :MOM);
create temp table started as select public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'start', 'member_id', :MIA, 'skill_id', 'school-bag', 'title', 'Pack my backpack', 'stage', 'model', 'cue', 'After dinner', 'finish', 'Everything for tomorrow is in the bag', 'category', 'school-prep', 'agreement_id', :A1, 'library_version', 1)) as r;
select pg_temp.expect((select r ->> 'stage' from started) = 'model', 'a Club adult starts a record at the stage the family chose');
select pg_temp.expect((select r -> 'agreement' ->> 'id' from started) = :A1 and (select (r ->> 'agreement_live')::boolean from started), 'the agreement is saved in the same transaction and returned for the phone''s list');
select pg_temp.expect((select agreed_text || '|' || agreed_when || '|' || agreed_finished || '|' || agreed_source || '|' || category || '|' || scope from public.club_responsibilities where id = :A1)
  = 'Pack my backpack|After dinner|Everything for tomorrow is in the bag|skill:school-bag|school-prep|individual', 'the agreement is an ordinary confirmed club_responsibilities row, owned by the child');
select pg_temp.expect((select owner_ids from public.club_responsibilities where id = :A1) = array[:MIA]::uuid[], 'owned by the child alone');
select pg_temp.expect((select agreement_id from public.household_development where id = :R1) = :A1, 'the record links its agreement');
select pg_temp.expect(exists (select 1 from jsonb_array_elements(public.household_agreements(null) -> 'agreements') a where a ->> 'id' = :A1), 'the existing agreement sync sees it (Today, Who does what, other phones)');
select pg_temp.expect((select agreement_change from public.household_development_events where record_id = :R1 and decision = 'start') = 'created', 'the history says the agreement was created');
-- Retry after a lost answer: the same request returns what was saved, nothing doubles.
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'start', 'member_id', :MIA, 'skill_id', 'school-bag', 'title', 'Pack my backpack', 'stage', 'model', 'category', 'school-prep', 'agreement_id', :A1, 'library_version', 1)) -> 'agreement' ->> 'id') = :A1, 'a retried start returns the saved record and agreement');
select pg_temp.expect((select count(*) from public.household_development where member_id = :MIA) = 1 and (select count(*) from public.club_responsibilities where agreed_source = 'skill:school-bag') = 1, 'retries never create a second record or agreement');
select pg_temp.expect((select count(*) from public.household_development_events where record_id = :R1) = 1, 'a retry adds no history');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', :R1, 'decision', 'start', 'member_id', :NOAH, 'skill_id', 'school-bag', 'title', 'x', 'stage', 'model', 'agreement_id', :A1, 'library_version', 1)), 'invalid'), 'a start reusing a record id for another child is refused');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :MIA, 'skill_id', 'bed', 'title', 'Bed', 'stage', 'model', 'library_version', 1)), 'invalid'), 'starting needs an agreement id from the phone');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :MIA, 'skill_id', 'bed', 'title', 'Bed', 'agreement_id', gen_random_uuid(), 'library_version', 1)), 'invalid'), 'starting needs a family-chosen stage (never inferred)');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :ANA, 'skill_id', 'bed', 'title', 'Bed', 'stage', 'model', 'agreement_id', gen_random_uuid(), 'library_version', 1)), 'invalid'), 'records are for children only');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :KIT, 'skill_id', 'bed', 'title', 'Bed', 'stage', 'model', 'agreement_id', gen_random_uuid(), 'library_version', 1)), 'invalid'), 'cannot create a record for another household''s child');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'advance', 'member_id', :MIA, 'skill_id', 'bed', 'title', 'Bed', 'library_version', 1)), 'invalid'), 'advance needs an existing record');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :MIA, 'skill_id', 'bed', 'title', 'Bed', 'stage', 'model', 'library_version', 1, 'extra', 1)), 'invalid'), 'unknown fields are refused');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :MIA, 'skill_id', 'bed', 'title', 'Bed', 'stage', 'model', 'category', 'chores', 'agreement_id', gen_random_uuid(), 'library_version', 1)), 'invalid'), 'an unknown category is refused, and nothing is half saved');
select pg_temp.expect((select count(*) from public.household_development where skill_id = 'bed') = 0 and (select count(*) from public.club_responsibilities where agreed_source = 'skill:bed') = 0, 'a failed start leaves neither a record nor an agreement');
reset role;

-- Two adults agree to the same skill for the same child at the same time (different phones, different ids).
select pg_temp.as_user('authenticated', :DAD);
create temp table race as select public.household_development_decide(jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :MIA, 'skill_id', 'school-bag', 'title', 'Backpack', 'stage', 'assist', 'category', 'school-prep', 'agreement_id', gen_random_uuid(), 'library_version', 1)) as r;
select pg_temp.expect((select (r ->> 'adopted')::boolean and r ->> 'id' = :R1 and r ->> 'stage' = 'model' from race), 'the second adult gets the first adult''s record (their decision stands)');
select pg_temp.expect((select count(*) from public.household_development where member_id = :MIA) = 1 and (select count(*) from public.club_responsibilities where agreed_source = 'skill:school-bag') = 1, 'one record and one agreement after a race');
reset role;
select pg_temp.as_user('authenticated', :MOM);

-- ---------------------------------------------------------------- one stage at a time, only on a decision
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'advance', 'library_version', 1), 1) ->> 'stage') = 'assist', 'advance moves exactly one stage (model → assist)');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 1)', jsonb_build_object('id', :R1, 'decision', 'stay', 'library_version', 1)), 'conflict'), 'a stale revision is a conflict (the other adult''s change stands)');
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
select pg_temp.expect((select deleted_at is null and revision = 1 from public.club_responsibilities where id = :A1), 'stage changes and check-ins leave the agreement exactly as it was');
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
select pg_temp.expect((select deleted_at is null from public.club_responsibilities where id = :A1), 'Launch keeps the agreement: it''s theirs now, and still on the list');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, %s)', jsonb_build_object('id', :R1, 'decision', 'advance', 'library_version', 2), (select revision from public.household_development where id = :R1)), 'invalid'), 'nothing past Launch');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R1, 'decision', 'step-back', 'library_version', 2), (select revision from public.household_development where id = :R1)) ->> 'status') = 'active', 'revisiting a launched skill: back to an active Watch');
select pg_temp.expect((select stage from public.household_development where id = :R1) = 'watch' and (select deleted_at is null from public.club_responsibilities where id = :A1), 'launch → watch, agreement unchanged');
select pg_temp.expect((select library_version from public.household_development where id = :R1) = 2, 'the record notes the newest library version it was decided under');
reset role;

-- ---------------------------------------------------------------- pause, dismiss, resume, and their agreements
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R2, 'decision', 'dismiss', 'member_id', :NOAH, 'skill_id', 'dishwasher', 'title', 'Unload safe dishwasher items', 'library_version', 1)) ->> 'status') = 'dismissed', '"Not for us" is remembered');
select pg_temp.expect((select stage is null and agreement_id is null from public.household_development where id = :R2), 'a dismissed suggestion gets no stage and no agreement');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R3, 'decision', 'pause', 'member_id', :NOAH, 'skill_id', 'snack', 'title', 'Prepare an approved snack', 'category', 'meals', 'library_version', 1)) ->> 'status') = 'paused', '"Not now" is remembered');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 1)', jsonb_build_object('id', :R3, 'decision', 'resume', 'agreement_id', :A3, 'library_version', 1)), 'invalid'), 'resuming a never-started suggestion needs the family''s stage');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 1)', jsonb_build_object('id', :R3, 'decision', 'resume', 'stage', 'assist', 'library_version', 1)), 'invalid'), 'resuming needs an agreement id (it goes back on the list)');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R3, 'decision', 'resume', 'stage', 'assist', 'agreement_id', :A3, 'library_version', 1), 1) ->> 'status') = 'active', 'the family deliberately reopens it at the stage they choose');
select pg_temp.expect((select deleted_at is null and category = 'meals' from public.club_responsibilities where id = :A3), 'resuming puts a new agreement on the list');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 2)', jsonb_build_object('id', :R3, 'decision', 'resume', 'stage', 'model', 'agreement_id', gen_random_uuid(), 'library_version', 1)), 'invalid'), 'an active record cannot be resumed');

select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R4, 'decision', 'start', 'member_id', :NOAH, 'skill_id', 'bed', 'title', 'Make my bed', 'stage', 'launch', 'category', 'cleaning', 'agreement_id', :A4, 'library_version', 1)) ->> 'status') = 'launched', 'a family can record something the child already owns as launched');
create temp table paused as select public.household_development_decide(jsonb_build_object('id', :R4, 'decision', 'pause', 'library_version', 1), 1) as r;
select pg_temp.expect((select r ->> 'stage' from paused) = 'launch', 'pausing keeps the stage');
select pg_temp.expect((select (r -> 'agreement' ->> 'deleted')::boolean and not (r ->> 'agreement_live')::boolean from paused), 'pausing takes the agreement off every list, and says so');
select pg_temp.expect((select deleted_at is not null from public.club_responsibilities where id = :A4), 'the paused agreement is a tombstone, not a hard delete');
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.household_agreements(null) -> 'agreements') a where a ->> 'id' = :A4), 'a paused responsibility no longer appears as a current agreement');
select pg_temp.expect(exists (select 1 from jsonb_array_elements(public.household_agreements(now() - interval '1 minute') -> 'agreements') a where a ->> 'id' = :A4 and (a ->> 'deleted')::boolean), 'other phones learn about the removal through the existing sync');
select pg_temp.expect(pg_temp.fails(format('select public.household_agreement_save(%L::jsonb, 1)', jsonb_build_object('id', :A4, 'category', 'cleaning', 'text', 'Make my bed!', 'owner_ids', jsonb_build_array(:NOAH))), 'removed'), 'an offline edit to a paused agreement gets the existing "removed" answer');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R4, 'decision', 'resume', 'agreement_id', :A4B, 'library_version', 1), 2) ->> 'status') = 'launched', 'resuming a paused launched skill keeps it launched');
select pg_temp.expect((select agreement_id from public.household_development where id = :R4) = :A4B and (select deleted_at is null from public.club_responsibilities where id = :A4B), 'resuming makes a new agreement; the old one stays removed');
select pg_temp.expect((select deleted_at is not null from public.club_responsibilities where id = :A4), 'nothing is brought back silently');
create temp table modified as select public.household_development_decide(jsonb_build_object('id', :R4, 'decision', 'modify', 'cue', 'After getting dressed', 'finish', 'Covers straight, pillow on top', 'library_version', 1), 3) as r;
select pg_temp.expect((select r ->> 'cue' from modified) = 'After getting dressed', 'the family can change the cue and finish line');
select pg_temp.expect((select agreed_when || '|' || agreed_finished from public.club_responsibilities where id = :A4B) = 'After getting dressed|Covers straight, pillow on top', 'the agreement''s words follow');
select pg_temp.expect((select stage || status from public.household_development where id = :R4) = 'launchlaunched', 'modify never changes the stage');

-- Dismissing an active responsibility.
select public.household_development_decide(jsonb_build_object('id', :R6, 'decision', 'start', 'member_id', :NOAH, 'skill_id', 'trash', 'title', 'Take out household trash', 'stage', 'assist', 'category', 'cleaning', 'agreement_id', :A6, 'library_version', 1));
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R6, 'decision', 'dismiss', 'library_version', 1), 1) ->> 'status') = 'dismissed', 'an active responsibility can be dismissed');
select pg_temp.expect((select deleted_at is not null from public.club_responsibilities where id = :A6), 'dismissing removes its agreement from the lists');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R6, 'decision', 'resume', 'agreement_id', :A6B, 'library_version', 1), 2) ->> 'stage') = 'assist', 'reopening a dismissed responsibility keeps its stage');

-- An agreement removed elsewhere ("We're done with this" in Who does what) while the record is active.
select public.household_development_decide(jsonb_build_object('id', :R7, 'decision', 'start', 'member_id', :MIA, 'skill_id', 'teeth', 'title', 'Brush my teeth', 'stage', 'watch', 'category', 'routines', 'agreement_id', :A7, 'library_version', 1));
select public.household_agreement_remove(:A7, 1);
select pg_temp.expect(not ((select r from jsonb_array_elements(public.household_development()) r where r ->> 'id' = :R7) ->> 'agreement_live')::boolean, 'the read says the record''s agreement is no longer on the list');
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R7, 'decision', 'restore', 'agreement_id', :A7B, 'library_version', 1), 1) -> 'agreement' ->> 'id') = :A7B, '"Put it back on the list" makes a new agreement');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 2)', jsonb_build_object('id', :R7, 'decision', 'restore', 'agreement_id', gen_random_uuid(), 'library_version', 1)), 'invalid'), 'restore only when the agreement is really gone');
-- A skill agreement that already exists for the child is linked, not duplicated.
select public.household_agreement_save(jsonb_build_object('id', gen_random_uuid(), 'category', 'cleaning', 'text', 'Tidy my floor', 'owner_ids', jsonb_build_array(:MIA), 'source', 'skill:floor'), null);
select pg_temp.expect((public.household_development_decide(jsonb_build_object('id', :R5, 'decision', 'start', 'member_id', :MIA, 'skill_id', 'floor', 'title', 'Tidy my bedroom floor', 'stage', 'model', 'category', 'cleaning', 'agreement_id', gen_random_uuid(), 'library_version', 1)) -> 'agreement' ->> 'text') = 'Tidy my floor', 'an existing agreement for the same skill and child is linked');
select pg_temp.expect((select count(*) from public.club_responsibilities where agreed_source = 'skill:floor') = 1, 'no duplicate agreement');

select pg_temp.expect((select count(*) from public.household_development_events where record_id = :R1) = 19, 'every decision is in the history (start, 2 advances, 12 check-ins, partner''s 4; retries and refused calls leave none)');
select pg_temp.expect(jsonb_array_length((select r -> 'history' from jsonb_array_elements(public.household_development()) r where r ->> 'id' = :R1)) = 12, 'the read carries the most recent history');
select pg_temp.expect((select string_agg(coalesce(agreement_change, '-'), ',' order by id) from public.household_development_events where record_id = :R4) = 'created,removed,created,updated', 'the history records what happened to the agreement each time');
reset role;

-- ---------------------------------------------------------------- isolation and append-only history
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(public.household_development() = '[]'::jsonb, 'another household sees none of these records');
select pg_temp.expect((select count(*) from public.household_development) = 0, 'RLS: another household reads no rows');
select pg_temp.expect((select count(*) from public.household_development_events) = 0, 'RLS: another household reads no history');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 2)', jsonb_build_object('id', :R3, 'decision', 'pause', 'library_version', 1))), 'another household cannot change a record (no Club here either)');
reset role;
insert into public.club_access_grants (user_id, reason, note) values (:OTHER, 'beta', 'family development test');
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, 2)', jsonb_build_object('id', :R3, 'decision', 'pause', 'library_version', 1)), 'invalid'), 'another Club household cannot change a record by id');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :MIA, 'skill_id', 'hands', 'title', 'Hands', 'stage', 'model', 'agreement_id', gen_random_uuid(), 'library_version', 1)), 'invalid'), 'another Club household cannot create a record for this child');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb)', jsonb_build_object('id', gen_random_uuid(), 'decision', 'start', 'member_id', :KIT, 'skill_id', 'hands', 'title', 'Hands', 'stage', 'model', 'agreement_id', :A1, 'library_version', 1)), 'invalid'), 'another household cannot attach to this household''s agreement id');
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = (select household_id from public.household_adults where user_id = :OTHER)) = 0, 'and nothing was written for them');
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
select pg_temp.expect(pg_temp.fails(format('select public.household_development_ensure_agreement(r, %L, %L) from public.household_development r limit 1', gen_random_uuid(), :MOM)), 'the internal agreement helper is not callable');
reset role;

-- ---------------------------------------------------------------- a lapsed membership keeps the family's history
update public.club_access_grants set revoked_at = now() where user_id = :MOM;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(jsonb_array_length(public.household_development()) = 7, 'after the Club ends, the family still reads its records');
select pg_temp.expect(pg_temp.fails(format('select public.household_development_decide(%L::jsonb, %s)', jsonb_build_object('id', :R1, 'decision', 'stay', 'library_version', 1), (select revision from public.household_development where id = :R1)), 'club_required'), 'but cannot make new paid-layer decisions');
select pg_temp.expect((select deleted_at is null from public.club_responsibilities where id = :A1), 'and their agreements stay on the list (free features keep working)');
reset role;

-- ---------------------------------------------------------------- the family profile is untouched
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = (select household_id from public.household_adults where user_id = :MOM) and status <> 'confirmed') = 0, 'development decisions never create existing/desired profile rows');
