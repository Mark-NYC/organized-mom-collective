-- Pilot measurement and feedback (supabase/migrations/20261210000000_app_events.sql, docs/pilot/ANALYTICS.md).
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

-- ---------------------------------------------------------------- events
select pg_temp.expect((select array_agg(column_name::text order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'app_events')
  = array['at', 'day', 'event', 'platform', 'user_id'], 'an event holds only who, which event, where and when: no household, names or content');
select pg_temp.as_user(:MOM);
select public.household_save(null, 'The Moms', '{}', '[{"first_name":"Kim","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Zoe","kind":"child","role":"child","birth_year":2016,"birth_month":2}]');
select public.app_event('app_open', 'ios');
select public.app_event('app_open', 'ios');
select public.app_event('onboarding_completed', 'web');
select public.app_event('meeting_started', 'ios');
select pg_temp.expect(pg_temp.fails('select public.app_event(''looked_at_zoe'', ''ios'')', 'invalid'), 'only allowlisted event names');
select pg_temp.expect(pg_temp.fails('select * from public.app_events'), 'a family cannot read events, not even their own');
select pg_temp.expect(pg_temp.fails('select public.pilot_funnel()', 'forbidden'), 'a family cannot read the funnel');
reset role;
select pg_temp.expect((select count(*) from public.app_events where user_id = :MOM and event = 'app_open') = 1, 'an event counts once a day, however many times it happens');
select pg_temp.expect((select platform from public.app_events where user_id = :MOM and event = 'onboarding_completed') = 'web', 'the platform is recorded');
select pg_temp.as_user(null);
select pg_temp.expect(pg_temp.fails('select public.app_event(''app_open'', ''web'')'), 'signed-out callers can''t record anything');
reset role;
-- yesterday's and last week's opens, to see returns
insert into public.app_events (user_id, event, platform, day) values (:MOM, 'app_open', 'ios', current_date - 8), (:MOM, 'app_open', 'ios', current_date - 7), (:MOM, 'app_open', 'ios', current_date - 1);
select pg_temp.as_user(:DEMO);
select public.app_event('app_open', 'ios');
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
select pg_temp.expect((select count(*) from public.app_events where user_id = :MOM and event = 'feedback_sent') = 1, 'sending feedback is counted');

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
