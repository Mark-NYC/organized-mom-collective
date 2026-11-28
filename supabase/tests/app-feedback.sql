-- Pilot measurement and feedback (supabase/migrations/20261210000000_app_feedback.sql; the funnel now reads the behavioral
-- log, household_signals, from 20261216000000_household_intelligence_engine.sql; docs/pilot/ANALYTICS.md).
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
  when insufficient_privilege then return err is null or err = 'forbidden';
  when raise_exception then return err is null or sqlerrm = err;
end $$;
create function pg_temp.as_user(p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_sub is null then '{}' else jsonb_build_object('sub', p_sub)::text end, false);
  execute format('set role %I', case when p_sub is null then 'anon' else 'authenticated' end);
end $$;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000ae001', 'ae-owner@organizedmom.test', now()),
  ('00000000-0000-0000-0000-0000000ae002', 'ae-mom@gmail.test', now()),
  ('00000000-0000-0000-0000-0000000ae003', 'ae-demo@example.com', now());
\set OWNER '''00000000-0000-0000-0000-0000000ae001'''
\set MOM '''00000000-0000-0000-0000-0000000ae002'''
\set DEMO '''00000000-0000-0000-0000-0000000ae003'''
insert into public.admin_users (user_id, role) values (:OWNER, 'owner');

-- ---------------------------------------------------------------- product moments (household_signals)
create function pg_temp.sig(k text, plat text default 'ios', d date default (now() at time zone 'utc')::date) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('kind', k, 'platform', plat, 'local_day', d, 'local_hour', 9, 'local_dow', extract(dow from d)::int, 'at', d::timestamptz + interval '9 hours'))
$$;
select pg_temp.as_user(:MOM);
select public.household_save(null, 'The Moms', '{}', '[{"first_name":"Kim","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Zoe","kind":"child","role":"child","birth_year":2016,"birth_month":2}]');
select public.household_signal_log(pg_temp.sig('app_open'));
select public.household_signal_log(pg_temp.sig('app_open'));
select public.household_signal_log(pg_temp.sig('onboarding_completed', 'web'));
select public.household_signal_log(pg_temp.sig('meeting_started'));
select pg_temp.expect(public.household_signal_log(jsonb_build_array(jsonb_build_object('kind', 'looked_at_zoe', 'local_day', current_date, 'local_hour', 9, 'local_dow', 1))) = 0, 'only allowlisted moments');
select pg_temp.expect(pg_temp.fails('select * from public.household_signals'), 'a family cannot read the log, not even their own');
select pg_temp.expect(pg_temp.fails('select public.pilot_funnel()'), 'a family cannot read the funnel');
reset role;
select pg_temp.expect((select count(*) from public.household_signals where user_id = :MOM and kind = 'app_open') = 1, 'a moment counts once a day (an hour band for opens), however many times it happens');
select pg_temp.expect((select platform from public.household_signals where user_id = :MOM and kind = 'onboarding_completed') = 'web', 'the platform is recorded');
select pg_temp.expect((select bool_and(subject_ref is null and value is null) from public.household_signals where user_id = :MOM), 'a product moment carries nothing but the moment: no names or content');
select pg_temp.as_user(null);
select pg_temp.expect(pg_temp.fails('select public.household_signal_log(''[]'')'), 'signed-out callers can''t record anything');
reset role;
-- yesterday's and last week's opens, to see returns (the app can only log the last few days; the past is inserted)
insert into public.household_signals (household_id, user_id, kind, platform, at, local_day, local_hour, local_dow)
  select public.household_id_for(:MOM), :MOM, 'app_open', 'ios', d::timestamptz, d, 9, extract(dow from d)::int
    from unnest(array[current_date - 8, current_date - 7, current_date - 1]) d;
select pg_temp.as_user(:DEMO);
select public.household_signal_log(pg_temp.sig('app_open'));
reset role;

-- ---------------------------------------------------------------- feedback
select pg_temp.as_user(:MOM);
select pg_temp.expect((public.app_feedback('confusing', 'I could not find where to add my son''s soccer.', '/app/family-calendar', 'ios', 393) ->> 'reference') ~ '^OMC-[A-Z0-9]{6}$', 'feedback is saved with a support reference');
select pg_temp.expect(pg_temp.fails('select public.app_feedback(''angry'', ''This is long enough text.'', ''/app'', ''ios'', 393)', 'invalid'), 'only the three kinds');
select pg_temp.expect(pg_temp.fails('select public.app_feedback(''idea'', ''short'', ''/app'', ''ios'', 393)', 'invalid'), 'a message needs a few words');
select pg_temp.expect(pg_temp.fails('select public.app_feedback(''idea'', ''This is long enough text.'', ''https://evil.example'', ''ios'', 393)', 'invalid'), 'the screen is a path in the app, nothing else');
select pg_temp.expect(pg_temp.fails('select public.pilot_feedback()', 'forbidden'), 'a family cannot read feedback');
reset role;
select pg_temp.as_user(null);
select pg_temp.expect(pg_temp.fails('select public.app_feedback(''idea'', ''This is long enough text.'', ''/app'', ''ios'', 393)'), 'signed-out callers can''t send feedback');
reset role;
select pg_temp.expect((select topic = 'companion' and name = 'Kim' and email = 'ae-mom@gmail.test' and notify_status = 'skipped' and message like '[Pilot · confusing · /app/family-calendar · ios · 393px] I could not find%'
  from public.support_requests where email = 'ae-mom@gmail.test'), 'it is an ordinary support request (companion), with where it came from and no emails sent');
select pg_temp.as_user(:MOM);
select public.household_signal_log(pg_temp.sig('feedback_sent'));
reset role;
select pg_temp.expect((select count(*) from public.household_signals where user_id = :MOM and kind = 'feedback_sent') = 1, 'sending feedback is counted (the app logs the moment)');

-- ---------------------------------------------------------------- the owner's view
select pg_temp.as_user(:OWNER);
create temp table f as select public.pilot_funnel(current_date - 30) as r;
create temp table fb as select public.pilot_feedback(current_date - 30) as r;
reset role;
select pg_temp.expect((select (r ->> 'onboarding_completed')::int >= 1 and (r ->> 'meeting_started')::int >= 1 and (r ->> 'feedback_sent')::int >= 1 from f), 'the funnel counts events and households');
select pg_temp.expect((select (r ->> 'returned_day_1')::int >= 1 and (r ->> 'returned_day_7')::int >= 1 from f), 'returns on day 1 and day 7 are counted');
select pg_temp.expect((select r::text not like '%ae-mom%' and r::text not like '%Kim%' and r::text not like '%Zoe%' from f), 'the funnel is numbers only: no emails or names');
select pg_temp.expect((select (r -> 'platforms' ->> 'ios')::int = 1 from f), 'demo accounts (@example.com) are left out');
select pg_temp.expect((select jsonb_array_length(r) = 1 and r -> 0 ->> 'screen' = '/app/family-calendar' and r -> 0 ->> 'kind' = 'confusing' and r -> 0 ->> 'platform' = 'ios' from fb), 'the owner sees each piece of feedback with its screen, kind and platform');
