-- Household Intelligence Engine, Stage B (supabase/migrations/20261216000000_household_intelligence_engine.sql):
-- household isolation, permissions, private visibility, the behavioral log's rules, memory precedence and forgetting,
-- consent (AI and personal calendars) and its withdrawal, erasure and deletion cascades, pseudonyms, the budget
-- (household, global, synthetic; retries; idempotency; concurrency serialization), retention and the pilot funnel.
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
  when undefined_function then return err is null;
  when raise_exception then return err is null or sqlerrm = err;
end $$;
create function pg_temp.as_user(p_role text, p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_sub is null then '{}' else jsonb_build_object('sub', p_sub)::text end, false);
  execute format('set role %I', p_role);
end $$;
-- A signal as the app sends it, for today (UTC).
create function pg_temp.sig(k text, extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object('kind', k, 'local_day', (now() at time zone 'utc')::date, 'local_hour', extract(hour from now() at time zone 'utc')::int,
    'local_dow', extract(dow from now() at time zone 'utc')::int) || extra
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000ae101', 'intel-mom@example.com', now()),
  ('00000000-0000-0000-0000-0000000ae102', 'intel-dad@example.com', now()),
  ('00000000-0000-0000-0000-0000000ae103', 'intel-other@example.com', now()),
  ('00000000-0000-0000-0000-0000000ae104', 'intel-nofamily@example.com', now());
\set MOM '''00000000-0000-0000-0000-0000000ae101'''
\set DAD '''00000000-0000-0000-0000-0000000ae102'''
\set OTHER '''00000000-0000-0000-0000-0000000ae103'''
\set LONE '''00000000-0000-0000-0000-0000000ae104'''

select pg_temp.as_user('authenticated', :MOM);
select public.club_household_save('Intel Family', '{}',
  '[{"first_name":"Mara","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Tom","kind":"adult","role":"partner"},
    {"first_name":"Andy","kind":"child","role":"child","birth_year":2017,"birth_month":3}]');
create temp table inv as select public.household_invite_create((select id from public.club_family_members where first_name = 'Tom' and household_id = public.household_id_for(auth.uid())), 'intel-dad@example.com') as i;
reset role;
grant select on inv to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_invite_accept((select i ->> 'code' from inv));
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select public.club_household_save('Others', '{}', '[{"first_name":"Ola","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
create temp table ids as select
  (select household_id from public.household_adults where user_id = '00000000-0000-0000-0000-0000000ae101') as hid,
  (select household_id from public.household_adults where user_id = '00000000-0000-0000-0000-0000000ae103') as other,
  (select id from public.club_family_members where first_name = 'Andy' and household_id = (select household_id from public.household_adults where user_id = '00000000-0000-0000-0000-0000000ae101')) as andy,
  (select id from public.club_family_members where first_name = 'Ola' and household_id = (select household_id from public.household_adults where user_id = '00000000-0000-0000-0000-0000000ae103')) as ola;
grant select on ids to authenticated, anon;
\set HID '(select hid from ids)'
\set OTHER_HID '(select other from ids)'
\set ANDY '(select andy from ids)'

-- ---------------------------------------------------------------- tables are closed; functions are the only way in
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails('select * from public.household_signals'), 'signals: no direct read for a family');
select pg_temp.expect(pg_temp.fails('select * from public.household_memory'), 'memory: no direct read for a family');
select pg_temp.expect(pg_temp.fails('select * from public.intel_usage'), 'usage: no direct read for a family');
select pg_temp.expect(pg_temp.fails('select * from public.intel_settings'), 'settings (and the pseudonym salt): no direct read');
select pg_temp.expect(pg_temp.fails($q$select intel_private.memory_apply((select hid from ids), '[]')$q$), 'engine functions: not for a family');
select pg_temp.expect(pg_temp.fails($q$select intel_private.budget_reserve((select hid from ids), 'household', 'abcdefgh', 1, 100, 'test', 'x')$q$), 'budget: not for a family');
reset role;
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($q$select public.household_signal_log('[]')$q$), 'anon: cannot log signals');
select pg_temp.expect(pg_temp.fails($q$select public.household_memory((select hid from ids))$q$), 'anon: cannot read memory');
reset role;

-- ---------------------------------------------------------------- settings and consent defaults
select pg_temp.as_user('authenticated', :MOM);
create temp table s0 as select public.household_intel_settings((select hid from ids)) as s;
select pg_temp.expect((select (s ->> 'learning_enabled')::boolean and not (s ->> 'ai_enabled')::boolean and not (s ->> 'personal_calendars')::boolean
  and (s ->> 'budget_micro_usd')::bigint = 400000 from s0), 'defaults: learning on, AI off, personal calendars off, $0.40 cap');
select pg_temp.expect(pg_temp.fails($q$select public.household_intel_settings((select hid from ids), '{"ai_enabled": true}')$q$, 'consent_required'),
  'AI cannot be turned on without an explicit consent version');
select pg_temp.expect(pg_temp.fails($q$select public.household_intel_settings((select other from ids))$q$, 'no_household'), 'settings: another household is refused');
reset role;

-- ---------------------------------------------------------------- the behavioral log
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(public.household_signal_log(jsonb_build_array(pg_temp.sig('app_open'), pg_temp.sig('app_open'))) = 1,
  'app_open: once per hour band per person');
select pg_temp.expect(public.household_signal_log(jsonb_build_array(pg_temp.sig('meeting_started'), pg_temp.sig('meeting_started'))) = 1,
  'product moments: once per person per day');
select pg_temp.expect(public.household_signal_log(jsonb_build_array(
  pg_temp.sig('task_done', jsonb_build_object('subject_kind', 'agreement', 'subject_ref', 'a1b2c3', 'member_id', (select andy from ids))),
  pg_temp.sig('task_done', '{"subject_kind":"agreement","subject_ref":"has spaces and words"}'),
  pg_temp.sig('not_a_kind'),
  pg_temp.sig('rec_response', '{"subject_kind":"recommendation","subject_ref":"r1","value":"Already Handled!"}'),
  pg_temp.sig('rec_response', '{"subject_kind":"recommendation","subject_ref":"r1","value":"already-handled"}'),
  jsonb_build_object('kind', 'task_done', 'local_day', '2020-01-01', 'local_hour', 3, 'local_dow', 1))) = 2,
  'invalid kinds, free text in refs or values, and far-off days are dropped (never an error)');
select pg_temp.expect(public.household_signal_log(jsonb_build_array(pg_temp.sig('task_done',
  jsonb_build_object('subject_kind', 'agreement', 'subject_ref', 'x9', 'member_id', (select ola from ids))))) = 1, 'another household''s member is accepted as no member');
reset role;
select pg_temp.expect((select member_id is null from public.household_signals where subject_ref = 'x9'), '... and stored without the foreign member');
select pg_temp.expect((select count(*) = 2 from public.household_signals where kind = 'task_done' and household_id = (select hid from ids)), 'learning signals stored for the household');
-- Private (personal-calendar) signals need this adult's consent.
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(public.household_signal_log(jsonb_build_array(pg_temp.sig('event_occurred', '{"subject_kind":"series","subject_ref":"S1","private":true}'))) = 0,
  'a private signal is refused without personal-calendar consent');
select public.household_intel_settings((select hid from ids), '{"personal_calendars": true, "consent_version": 1}');
select pg_temp.expect(public.household_signal_log(jsonb_build_array(pg_temp.sig('event_occurred', '{"subject_kind":"series","subject_ref":"S1","private":true}'))) = 1,
  '... and kept, visible to her only, once she agrees');
reset role;
select pg_temp.expect((select visible_to = '00000000-0000-0000-0000-0000000ae101' from public.household_signals where subject_ref = 'S1'), 'private signal is marked hers');
-- No family yet: product moments only.
select pg_temp.as_user('authenticated', :LONE);
select pg_temp.expect(public.household_signal_log(jsonb_build_array(pg_temp.sig('onboarding_started'), pg_temp.sig('task_done', '{"subject_kind":"agreement","subject_ref":"z"}'))) = 1,
  'before a family exists: onboarding is measured, learning signals are not');
reset role;
-- Learning switched off: product moments still count, learning signals stop.
select pg_temp.as_user('authenticated', :DAD);
select public.household_intel_settings((select hid from ids), '{"learning_enabled": false}');
select pg_temp.expect(public.household_signal_log(jsonb_build_array(pg_temp.sig('app_open'), pg_temp.sig('task_done', '{"subject_kind":"agreement","subject_ref":"q1"}'))) = 1,
  'learning off: the learning signal is dropped, the product moment stays');
select public.household_intel_settings((select hid from ids), '{"learning_enabled": true}');
reset role;

-- ---------------------------------------------------------------- memory: confirmed beats inferred, visibility, isolation
select pg_temp.as_user('authenticated', :MOM);
create temp table c1 as select public.household_memory_confirm((select hid from ids),
  jsonb_build_object('category', 'preference', 'subject_key', 'person:p1:occasion:birthday', 'content', '{"label":"We usually send a birthday text","choice":"text"}'::jsonb)) as m;
select pg_temp.expect((select m ->> 'status' = 'confirmed' and m ->> 'source' = 'family' from c1), 'confirm: a family statement is confirmed memory');
select pg_temp.expect(pg_temp.fails($q$select public.household_memory_confirm((select hid from ids), '{"category":"preference","subject_key":"Johan''s birthday"}')$q$, 'invalid'),
  'confirm: keys must be pseudonymous (no names, no spaces)');
select pg_temp.expect(pg_temp.fails($q$select public.household_memory_confirm((select other from ids), '{"category":"preference","subject_key":"x"}')$q$, 'no_household'),
  'confirm: never into another household');
create temp table c2 as select public.household_memory_confirm((select hid from ids),
  jsonb_build_object('category', 'timing', 'subject_key', 'me:reviews', 'content', '{"label":"I plan on Sunday nights"}'::jsonb, 'private', true)) as m;
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect((select count(*) = 1 from jsonb_array_elements(public.household_memory((select hid from ids)))), 'the other adult sees the household memory, not her private one');
reset role;
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect((select count(*) = 2 from jsonb_array_elements(public.household_memory((select hid from ids)))), 'she sees both');
reset role;
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.fails($q$select public.household_memory((select hid from ids))$q$, 'no_household'), 'isolation: another household cannot read it');
select pg_temp.expect(pg_temp.fails($q$select public.household_memory_forget((select hid from ids), (select (m ->> 'id')::uuid from c1))$q$, 'no_household'),
  'isolation: another household cannot forget it');
select pg_temp.expect(pg_temp.fails($q$select public.household_memory_forget((select other from ids), (select (m ->> 'id')::uuid from c1))$q$, 'not_found'),
  'isolation: its id from another household is not found');
reset role;
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect(pg_temp.fails($q$select public.household_memory_forget((select hid from ids), (select (m ->> 'id')::uuid from c2))$q$, 'not_found'),
  'the other adult cannot forget (or see) her private memory');
reset role;

-- The engine applies inferred memory: it never overwrites a confirmed one.
select pg_temp.expect((select (intel_private.memory_apply((select hid from ids), jsonb_build_array(jsonb_build_object(
  'category', 'preference', 'subject_key', 'person:p1:occasion:birthday', 'content', '{"choice":"gift"}'::jsonb, 'status', 'observed', 'source', 'stats',
  'confidence', 0.9, 'support', 9, 'contradict', 0, 'first_seen', now() - interval '300 days', 'last_seen', now(),
  'evidence', jsonb_build_array(jsonb_build_object('ref', 'e1', 'polarity', 1, 'at', now())))))) ->> 'applied' = '1'), 'engine: evidence recorded on the confirmed memory');
select pg_temp.expect((select status = 'confirmed' and content ->> 'choice' = 'text' from public.household_memory where subject_key = 'person:p1:occasion:birthday'),
  'confirmed beats inferred: content and status unchanged');
-- Inferred memory: create, then contradicting evidence weakens it (the engine sends the recomputed values).
select intel_private.memory_apply((select hid from ids), jsonb_build_array(jsonb_build_object(
  'category', 'routine', 'subject_key', 'agreement:groceries', 'cadence', 'weekly', 'content', '{"dow":2}'::jsonb, 'status', 'observed', 'source', 'stats',
  'confidence', 0.8, 'support', 6, 'contradict', 0, 'first_seen', now() - interval '60 days', 'last_seen', now() - interval '2 days',
  'review_after', now() + interval '21 days', 'evidence', jsonb_build_array(jsonb_build_object('signal_id', null, 'ref', 'w1', 'polarity', 1, 'at', now() - interval '2 days')))));
select intel_private.memory_apply((select hid from ids), jsonb_build_array(jsonb_build_object(
  'category', 'routine', 'subject_key', 'agreement:groceries', 'cadence', 'weekly', 'content', '{"dow":2}'::jsonb, 'status', 'tentative', 'source', 'stats',
  'confidence', 0.45, 'support', 6, 'contradict', 3, 'last_seen', now(),
  'evidence', jsonb_build_array(jsonb_build_object('ref', 'w2', 'polarity', -1, 'at', now())))));
select pg_temp.expect((select status = 'tentative' and contradict = 3 and confidence < 0.5 from public.household_memory where subject_key = 'agreement:groceries'),
  'contradictory evidence weakens an inferred pattern');
select pg_temp.expect((select count(*) = 2 from public.household_memory_evidence e join public.household_memory m on m.id = e.memory_id where m.subject_key = 'agreement:groceries'),
  'its evidence is kept with polarity');
-- Evidence is capped at 40.
select intel_private.memory_apply((select hid from ids), jsonb_build_array(jsonb_build_object(
  'category', 'routine', 'subject_key', 'agreement:groceries', 'cadence', 'weekly', 'content', '{"dow":2}'::jsonb, 'status', 'observed', 'source', 'stats',
  'confidence', 0.7, 'support', 50, 'contradict', 3, 'last_seen', now(),
  'evidence', (select jsonb_agg(jsonb_build_object('ref', 'x' || g, 'polarity', 1, 'at', now() - (g || ' hours')::interval)) from generate_series(1, 50) g))));
select pg_temp.expect((select count(*) = 40 from public.household_memory_evidence e join public.household_memory m on m.id = e.memory_id where m.subject_key = 'agreement:groceries'),
  'evidence capped at the newest 40');

-- Forget: evidence deleted, and it doesn't come back from old evidence.
create temp table gid as select id from public.household_memory where subject_key = 'agreement:groceries';
grant select on gid to authenticated;
select pg_temp.as_user('authenticated', :DAD);
select public.household_memory_forget((select hid from ids), (select id from gid));
reset role;
select pg_temp.expect((select status = 'forgotten' and confidence = 0 from public.household_memory where subject_key = 'agreement:groceries')
  and not exists (select 1 from public.household_memory_evidence e join public.household_memory m on m.id = e.memory_id where m.subject_key = 'agreement:groceries'),
  'forget: retired with its evidence deleted');
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(not exists (select 1 from jsonb_array_elements(public.household_memory((select hid from ids))) x where x ->> 'subject_key' = 'agreement:groceries'),
  'forgotten memory is never listed');
reset role;
select intel_private.memory_apply((select hid from ids), jsonb_build_array(jsonb_build_object(
  'category', 'routine', 'subject_key', 'agreement:groceries', 'cadence', 'weekly', 'content', '{"dow":2}'::jsonb, 'status', 'observed', 'source', 'stats',
  'confidence', 0.9, 'support', 9, 'contradict', 0, 'last_seen', now() - interval '1 day',
  'evidence', jsonb_build_array(jsonb_build_object('ref', 'old1', 'polarity', 1, 'at', now() - interval '20 days'), jsonb_build_object('ref', 'old2', 'polarity', 1, 'at', now() - interval '13 days')))));
select pg_temp.expect((select status = 'forgotten' from public.household_memory where subject_key = 'agreement:groceries'), 'forgotten: old evidence cannot bring it back');
select intel_private.memory_apply((select hid from ids), jsonb_build_array(jsonb_build_object(
  'category', 'routine', 'subject_key', 'agreement:groceries', 'cadence', 'weekly', 'content', '{"dow":4}'::jsonb, 'status', 'tentative', 'source', 'stats',
  'confidence', 0.4, 'support', 2, 'contradict', 0, 'last_seen', now(),
  'evidence', jsonb_build_array(jsonb_build_object('ref', 'new1', 'polarity', 1, 'at', now() + interval '1 second'), jsonb_build_object('ref', 'new2', 'polarity', 1, 'at', now() + interval '2 seconds')))));
select pg_temp.expect((select status = 'tentative' and content ->> 'dow' = '4' from public.household_memory where subject_key = 'agreement:groceries'),
  '... only new evidence after forgetting can (as a fresh, tentative belief)');

-- Correct: the family's words become confirmed.
select pg_temp.as_user('authenticated', :MOM);
create temp table cor as select public.household_memory_correct((select hid from ids), (select id from gid),
  '{"label":"We shop on Thursdays now","dow":4}') as m;
select pg_temp.expect((select m ->> 'status' = 'confirmed' and m -> 'content' ->> 'dow' = '4' from cor), 'correct: becomes confirmed in the family''s words');
reset role;

-- ---------------------------------------------------------------- AI consent and its withdrawal
select pg_temp.expect((select (intel_private.memory_apply((select hid from ids), jsonb_build_array(jsonb_build_object(
  'category', 'event-meaning', 'subject_key', 'series:s9', 'content', '{"kind":"tournament"}'::jsonb, 'status', 'observed', 'source', 'model',
  'confidence', 0.8, 'support', 1, 'contradict', 0, 'last_seen', now())))) ->> 'skipped' = '1'), 'model-sourced memory is refused without AI consent');
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'household', 'request-noconsent', 1, 500, 'interpret-event', 'luna')) ->> 'reason' = 'no_consent'),
  'no AI spend without consent');
select pg_temp.as_user('authenticated', :MOM);
select public.household_intel_settings((select hid from ids), '{"ai_enabled": true, "ai_consent_version": 1}');
reset role;
select intel_private.memory_apply((select hid from ids), jsonb_build_array(jsonb_build_object(
  'category', 'event-meaning', 'subject_key', 'series:s9', 'content', '{"kind":"tournament"}'::jsonb, 'status', 'observed', 'source', 'model',
  'confidence', 0.8, 'support', 1, 'contradict', 0, 'last_seen', now())));
insert into public.intel_interpretations (household_id, fingerprint, result, source, model) values ((select hid from ids), 'fp:series:s9:v1', '{"kind":"tournament"}', 'model', 'luna');
insert into public.intel_interpretations (household_id, fingerprint, result, source) values ((select hid from ids), 'fp:series:s8:v1', '{"kind":"routine"}', 'rules');
create temp table res as select intel_private.budget_reserve((select hid from ids), 'household', 'request-pending', 1, 500, 'interpret-event', 'luna') as r;
select pg_temp.expect((select (r ->> 'ok')::boolean from res), 'with consent: a reservation is allowed');
select pg_temp.as_user('authenticated', :DAD);
select pg_temp.expect((select not (s ->> 'ai_consented_by_me')::boolean from (select public.household_intel_settings((select hid from ids)) s) x), 'consent records who agreed');
select public.household_intel_settings((select hid from ids), '{"ai_enabled": false}');
reset role;
select pg_temp.expect(not exists (select 1 from public.household_memory where household_id = (select hid from ids) and source = 'model')
  and not exists (select 1 from public.intel_interpretations where household_id = (select hid from ids) and source = 'model')
  and exists (select 1 from public.intel_interpretations where household_id = (select hid from ids) and source = 'rules')
  and exists (select 1 from public.household_memory where household_id = (select hid from ids) and status = 'confirmed'),
  'withdrawing AI (either adult) removes what the AI derived; the family''s own and rule-based memory stays');
select pg_temp.expect((select status = 'released' from public.intel_usage where request_key = 'request-pending'), '... and releases pending reservations');
select pg_temp.expect((select ai_withdrawn_at is not null and not ai_enabled from public.intel_settings where household_id = (select hid from ids)), '... and records the withdrawal');

-- Personal calendars: withdrawal removes what came from them, for that adult only.
select intel_private.memory_apply((select hid from ids), jsonb_build_array(jsonb_build_object(
  'category', 'timing', 'subject_key', 'series:s77', 'visible_to', '00000000-0000-0000-0000-0000000ae101', 'content', '{"busy":"tue-pm"}'::jsonb,
  'status', 'observed', 'source', 'stats', 'confidence', 0.7, 'support', 4, 'contradict', 0, 'last_seen', now())));
select pg_temp.expect(exists (select 1 from public.household_memory where subject_key = 'series:s77' and origin = 'personal-calendar'), 'personal-calendar memory, with consent');
select pg_temp.expect((select (intel_private.memory_apply((select hid from ids), jsonb_build_array(jsonb_build_object(
  'category', 'timing', 'subject_key', 'series:s78', 'visible_to', '00000000-0000-0000-0000-0000000ae102', 'content', '{}'::jsonb,
  'status', 'observed', 'source', 'stats', 'confidence', 0.7, 'support', 4, 'contradict', 0, 'last_seen', now())))) ->> 'skipped' = '1'),
  'personal-calendar memory of an adult who has not agreed is refused');
select pg_temp.as_user('authenticated', :MOM);
select public.household_intel_settings((select hid from ids), '{"personal_calendars": false}');
reset role;
select pg_temp.expect(not exists (select 1 from public.household_memory where household_id = (select hid from ids) and visible_to = '00000000-0000-0000-0000-0000000ae101')
  and not exists (select 1 from public.household_signals where household_id = (select hid from ids) and visible_to = '00000000-0000-0000-0000-0000000ae101'),
  'withdrawing personal calendars removes her private memories and signals');
select pg_temp.expect(exists (select 1 from public.household_memory where household_id = (select hid from ids) and status = 'confirmed' and visible_to is null),
  '... the household''s memory stays');

-- Learning switched off: the engine applies nothing.
update public.intel_settings set learning_enabled = false where household_id = (select hid from ids);
select pg_temp.expect((select (intel_private.memory_apply((select hid from ids), '[{"category":"routine","subject_key":"k","status":"observed","source":"stats","confidence":0.5,"support":3,"contradict":0}]')) ->> 'reason' = 'learning_off'),
  'learning off: the engine applies no memory');
update public.intel_settings set learning_enabled = true where household_id = (select hid from ids);

-- ---------------------------------------------------------------- pseudonyms
select pg_temp.expect(intel_private.pseudonym((select hid from ids), 'person', 'Johan') = intel_private.pseudonym((select hid from ids), 'person', '  johan '),
  'pseudonyms: stable across case and spacing');
select pg_temp.expect(intel_private.pseudonym((select hid from ids), 'person', 'Johan') <> intel_private.pseudonym((select hid from ids), 'person', 'Grandma'),
  'pseudonyms: different people, different tokens');
select pg_temp.expect(intel_private.pseudonym((select hid from ids), 'person', 'Johan') ~ '^P[0-9]+$' and intel_private.pseudonym((select hid from ids), 'series', 'soccer@club') ~ '^S[0-9]+$',
  'pseudonyms: kind prefixes');
select pg_temp.expect((select bool_and(octet_length(key_hash) = 32 and encode(key_hash, 'escape') not ilike '%johan%') from public.intel_pseudonyms)
  and not exists (select 1 from information_schema.columns where table_name = 'intel_pseudonyms' and data_type = 'text' and column_name <> 'kind' and column_name <> 'token'),
  'pseudonyms: only a 32-byte keyed hash and the token are stored, no name');
select pg_temp.expect(intel_private.pseudonym((select other from ids), 'person', 'Johan') = 'P1' and intel_private.pseudonym((select hid from ids), 'person', 'Johan') = 'P1',
  'pseudonyms: numbered per household');
select pg_temp.expect((select key_hash from public.intel_pseudonyms where household_id = (select other from ids) and token = 'P1')
      <> (select key_hash from public.intel_pseudonyms where household_id = (select hid from ids) and token = 'P1'),
  'pseudonyms: household-scoped (same name, unlinkable hashes across households)');

-- ---------------------------------------------------------------- budget
-- Household cap ($0.40), retries counted, idempotent, three attempts at most.
update public.intel_settings set ai_enabled = true, ai_consent_version = 1 where household_id = (select hid from ids);
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'household', 'request-a', 1, 150000, 'meeting-brief', 'terra')) ->> 'ok')::boolean, 'reserve 1');
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'household', 'request-a', 1, 150000, 'meeting-brief', 'terra')) ->> 'reason' = 'existing'), 'same attempt again: idempotent, not double-counted');
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'household', 'request-a', 2, 150000, 'meeting-brief', 'terra')) ->> 'ok')::boolean, 'a retry is its own counted attempt');
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'household', 'request-a', 3, 150000, 'meeting-brief', 'terra')) ->> 'reason' = 'household_budget'),
  'the third attempt would pass $0.40: refused');
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'household', 'request-a', 4, 100, 'meeting-brief', 'terra')) ->> 'reason' = 'invalid'), 'no fourth attempt');
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'household', 'request-b', 2, 100, 'meeting-brief', 'terra')) ->> 'reason' = 'invalid'), 'a retry needs its first attempt');
select pg_temp.expect(intel_private.budget_settle((select id from public.intel_usage where request_key = 'request-a' and attempt = 1), 20000, '{"input_tokens":4000,"output_tokens":1200,"outcome":"ok"}'),
  'settle with the actual cost (tokens only, no content)');
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'household', 'request-c', 1, 200000, 'meeting-brief', 'terra')) ->> 'ok')::boolean,
  'after settling at actual cost, the freed budget can be used');
select pg_temp.expect(not exists (select 1 from information_schema.columns where table_name = 'intel_usage' and column_name in ('prompt', 'output', 'input', 'response')),
  'usage keeps no prompt or output');
-- A reservation never settled expires after 10 minutes but keeps counting (the call may have been sent).
update public.intel_usage set created_at = now() - interval '11 minutes' where request_key = 'request-c';
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'household', 'request-d', 1, 200000, 'meeting-brief', 'terra')) ->> 'reason' = 'household_budget'),
  'an expired, unsettled reservation still counts against the household cap');
select pg_temp.expect((select status = 'expired' from public.intel_usage where request_key = 'request-c'), 'it is marked expired');
select pg_temp.expect(intel_private.budget_settle((select id from public.intel_usage where request_key = 'request-c'), null, '{"outcome":"not-sent"}'), 'released: it never left');
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'household', 'request-d', 1, 200000, 'meeting-brief', 'terra')) ->> 'ok')::boolean,
  'only a released reservation frees the budget');
-- Global cap.
update public.intel_budget_scopes set monthly_cap_micro_usd = 600000 where scope = 'global';
select pg_temp.as_user('authenticated', :OTHER);
select public.household_intel_settings((select other from ids), '{"ai_enabled": true, "ai_consent_version": 1}');
reset role;
select pg_temp.expect((select (intel_private.budget_reserve((select other from ids), 'household', 'request-o', 1, 300000, 'meeting-brief', 'terra')) ->> 'reason' = 'scope_budget'),
  'the global cap holds across households');
update public.intel_budget_scopes set monthly_cap_micro_usd = 50000000 where scope = 'global';
-- Synthetic scope is separate and only for synthetic households.
select pg_temp.expect((select (intel_private.budget_reserve((select hid from ids), 'synthetic', 'request-s', 1, 100, 'eval', 'luna')) ->> 'reason' = 'wrong_scope'), 'a real household cannot spend the synthetic budget');
select pg_temp.expect((select (intel_private.budget_reserve(null, 'synthetic', 'request-s', 1, 100, 'eval', 'luna')) ->> 'ok')::boolean, 'synthetic evaluation spends its own budget');
-- The evaluation budget: $5.00 in total (cumulative, never resets), at most $0.05 a call.
select pg_temp.expect((select lifetime_cap_micro_usd = 5000000 and monthly_cap_micro_usd is null and per_call_max_micro_usd = 50000 from public.intel_budget_scopes where scope = 'synthetic'),
  'evaluation budget: $5.00 total, no monthly reset, $0.05 per call');
select pg_temp.expect((select (intel_private.budget_reserve(null, 'synthetic', 'request-big', 1, 60000, 'eval', 'luna')) ->> 'reason' = 'per_call_max'), 'one call cannot reserve more than $0.05');
-- Spending from earlier months still counts against the total.
insert into public.intel_usage (scope, month, request_key, attempt, status, reserved_micro_usd, actual_micro_usd, job, model)
  select 'synthetic', (date_trunc('month', now()) - make_interval(months => m))::date, 'request-old-' || m, 1, 'settled', 50000, 46000, 'eval', 'luna'
    from generate_series(1, 108) m;  -- 108 calls in past months = $4.968
select pg_temp.expect((select (intel_private.budget_reserve(null, 'synthetic', 'request-s2', 1, 40000, 'eval', 'luna')) ->> 'reason' = 'lifetime_budget'),
  'the $5 total holds across months (a new month does not reset it): $4.968 spent earlier + $0.04 is refused');
select pg_temp.expect((select (intel_private.budget_reserve(null, 'synthetic', 'request-s2', 1, 20000, 'eval', 'luna')) ->> 'ok')::boolean,
  'what still fits under the total is allowed');
delete from public.intel_usage where request_key = 'request-s2';
delete from public.intel_usage where request_key like 'request-old-%';
-- A reservation that expired without being settled still counts at its estimate (a sent call may have cost it).
insert into public.intel_usage (scope, month, request_key, attempt, status, reserved_micro_usd, job, model, created_at)
  select 'synthetic', date_trunc('month', now())::date, 'request-lost-' || n, 1, 'reserved', 50000, 'eval', 'luna', now() - interval '20 minutes' from generate_series(1, 99) n;
select pg_temp.expect((select (intel_private.budget_reserve(null, 'synthetic', 'request-s3', 1, 50000, 'eval', 'luna')) ->> 'reason' = 'lifetime_budget'),
  'expired, unsettled reservations still count (99 × $0.05 + the $0.0001 already spent leaves no room for $0.05)');
select pg_temp.expect((select count(*) = 99 from public.intel_usage where request_key like 'request-lost-%' and status = 'expired'), 'they are marked expired, not dropped');
select pg_temp.expect(intel_private.budget_settle((select id from public.intel_usage where request_key = 'request-lost-1'), 1000, '{"outcome":"late"}'),
  'a late report settles an expired reservation at its real cost');
select pg_temp.expect((select (intel_private.budget_reserve(null, 'synthetic', 'request-s4', 1, 40000, 'eval', 'luna')) ->> 'ok')::boolean,
  'and only then is the difference available again');
select pg_temp.expect((select (s ->> 'spent_micro_usd')::bigint = 98 * 50000 + 1000 + 100 + 40000 and (s ->> 'lifetime_cap_micro_usd')::bigint = 5000000
  from (select intel_private.budget_status('synthetic') s) x), 'budget_status reports settled + held against the $5 total');
-- A call that never left (provider not reached) is released and stops counting.
select pg_temp.expect(intel_private.budget_settle((select id from public.intel_usage where request_key = 'request-s4'), null, '{"outcome":"not-sent"}'), 'release');
select pg_temp.expect((select status = 'released' from public.intel_usage where request_key = 'request-s4'), 'released');
delete from public.intel_usage where request_key like 'request-lost-%';
-- Only the service role reaches the budget and the evaluation cache.
select pg_temp.expect((select bool_and(not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute'))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('intel_budget_reserve', 'intel_budget_settle', 'intel_budget_status', 'intel_cache_get', 'intel_cache_put')),
  'budget and cache functions: service role only');
select pg_temp.expect((select not has_table_privilege('authenticated', 'public.intel_inference_cache', 'select')), 'the evaluation cache is not readable by families');
select pg_temp.expect(public.intel_cache_put('ab12cd34ef56ab78', '{"task":"interpret-event","model":"luna","prompt_version":"ie-1","output":{"kind":"other"},"cost_micro_usd":12}'), 'cache put');
select pg_temp.expect((select public.intel_cache_put('ab12cd34ef56ab78', '{"task":"interpret-event","model":"luna","prompt_version":"ie-1","output":{"kind":"party"}}') is null), 'cache entries are immutable (first answer kept)');
select pg_temp.expect((select public.intel_cache_get('ab12cd34ef56ab78') -> 'output' ->> 'kind' = 'other'), 'cache get');
select pg_temp.expect((select (intel_private.budget_reserve(null, 'household', 'request-x', 1, 100, 'eval', 'luna')) ->> 'reason' = 'invalid'), 'household scope needs a household');
-- Serialization: reservations take the scope lock (concurrent callers wait instead of both passing the check).
select pg_temp.expect((select prosrc like '%pg_advisory_xact_lock(hashtextextended(''intel-budget:''%' from pg_proc where proname = 'budget_reserve'),
  'reservations are serialized per scope (advisory transaction lock)');

-- ---------------------------------------------------------------- calendar descriptions (sanitized, untrusted, engine-only)
reset role;
insert into public.calendar_feed_testers (user_id, note) values (:MOM, 'intelligence engine test') on conflict (user_id) do nothing; -- the staged gate, whatever ran before
select pg_temp.as_user('authenticated', :MOM);
create temp table feed as select (public.calendar_feed_add('{"url":"https://school.example.org/a.ics","name":"School"}') ->> 'id')::uuid as id;
select pg_temp.expect(pg_temp.fails('select * from public.calendar_feed_descriptions'), 'descriptions: a family cannot read them (stored for the engine only)');
select pg_temp.expect(pg_temp.fails($q$select public.calendar_feed_descriptions_store((select id from feed), '[]')$q$), 'descriptions: only the importer (service role) stores them');
reset role;
select pg_temp.expect(public.calendar_feed_descriptions_store((select id from feed), jsonb_build_array(
  jsonb_build_object('uid', 'u1', 'description', 'Bring a packed lunch. Details: https://school.example.org/trip?id=9 or mail office@school.example.org'),
  jsonb_build_object('uid', 'u2', 'description', ''),
  jsonb_build_object('uid', 'u3', 'description', repeat('x', 600)))) = 2, 'descriptions: empty ones skipped');
select pg_temp.expect((select description not like '%http%' and description not like '%@%' and description like 'Bring a packed lunch.%' from public.calendar_feed_descriptions where uid = 'u1'),
  'descriptions: links and emails scrubbed server-side too');
select pg_temp.expect((select char_length(description) = 280 from public.calendar_feed_descriptions where uid = 'u3'), 'descriptions: capped at 280 characters');
select public.calendar_feed_descriptions_store((select id from feed), '[{"uid":"u1","description":"Changed"}]');
select pg_temp.expect((select count(*) = 1 from public.calendar_feed_descriptions where feed_id = (select id from feed)), 'descriptions: a refresh replaces them');
delete from public.calendar_feeds where id = (select id from feed);
select pg_temp.expect(not exists (select 1 from public.calendar_feed_descriptions where feed_id = (select id from feed)), 'descriptions: removed with their calendar');

-- ---------------------------------------------------------------- erase and deletion cascades
select pg_temp.as_user('authenticated', :OTHER);
select pg_temp.expect(pg_temp.fails($q$select public.household_intel_erase((select hid from ids))$q$, 'no_household'), 'erase: another household is refused');
reset role;
select intel_private.memory_apply((select other from ids), '[{"category":"routine","subject_key":"k0","status":"observed","source":"stats","confidence":0.5,"support":3,"contradict":0}]');
select pg_temp.as_user('authenticated', :DAD);
create temp table er as select public.household_intel_erase((select hid from ids)) as r;
reset role;
select pg_temp.expect(not exists (select 1 from public.household_memory where household_id = (select hid from ids))
  and not exists (select 1 from public.household_signals where household_id = (select hid from ids))
  and not exists (select 1 from public.intel_interpretations where household_id = (select hid from ids))
  and not exists (select 1 from public.intel_pseudonyms where household_id = (select hid from ids)),
  'erase: every signal, memory, interpretation and pseudonym of the household');
select pg_temp.expect(exists (select 1 from public.club_family_members where household_id = (select hid from ids)) and exists (select 1 from public.intel_settings where household_id = (select hid from ids)),
  'erase: the family and its settings stay');
select pg_temp.expect(exists (select 1 from public.household_memory where household_id = (select other from ids) and subject_key = 'k0'), 'erase never touches another household');
select intel_private.memory_apply((select other from ids), '[{"category":"routine","subject_key":"k1","status":"observed","source":"stats","confidence":0.5,"support":3,"contradict":0}]');
select pg_temp.as_user('authenticated', :OTHER);
select public.household_signal_log(jsonb_build_array(pg_temp.sig('task_done', '{"subject_kind":"agreement","subject_ref":"o1"}')));
reset role;
delete from public.club_households where id = (select other from ids);
select pg_temp.expect(not exists (select 1 from public.household_memory where household_id = (select other from ids))
  and not exists (select 1 from public.household_signals where household_id = (select other from ids))
  and not exists (select 1 from public.intel_settings where household_id = (select other from ids)),
  'deleting a household deletes its signals, memory and settings');
delete from auth.users where id = '00000000-0000-0000-0000-0000000ae104';
select pg_temp.expect(not exists (select 1 from public.household_signals where user_id = '00000000-0000-0000-0000-0000000ae104'), 'deleting an account deletes its signals');

-- ---------------------------------------------------------------- retention
insert into public.household_signals (household_id, user_id, kind, subject_kind, subject_ref, at, local_day, local_hour, local_dow) values
  ((select hid from ids), '00000000-0000-0000-0000-0000000ae101', 'task_done', 'agreement', 'old', now() - interval '200 days', current_date - 200, 9, 1),
  ((select hid from ids), null, 'event_occurred', 'series', 'S5', now() - interval '500 days', current_date - 500, 9, 1),
  ((select hid from ids), '00000000-0000-0000-0000-0000000ae101', 'app_open', null, null, now() - interval '300 days', current_date - 300, 9, 1);
select intel_private.prune();
select pg_temp.expect(not exists (select 1 from public.household_signals where subject_ref = 'old')
  and exists (select 1 from public.household_signals where subject_ref = 'S5')
  and exists (select 1 from public.household_signals where kind = 'app_open' and local_day = current_date - 300),
  'retention: learning signals 180 days; occurrences 800 (annual patterns); product moments 400');

-- ---------------------------------------------------------------- the pilot funnel reads the log
select pg_temp.as_user('authenticated', :MOM);
select pg_temp.expect(pg_temp.fails('select public.pilot_funnel()'), 'funnel: a family cannot read it (owner admins only)');
reset role;
select pg_temp.expect((select prosrc like '%household_signals%' and prosrc not like '%app_events%' from pg_proc where proname = 'pilot_funnel'),
  'the pilot funnel reads the behavioral log (app_events retired)');
select pg_temp.expect(to_regclass('public.app_events') is null, 'no app_events table');
