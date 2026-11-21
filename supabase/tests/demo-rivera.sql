-- The Rivera demo (supabase/migrations/20261209000000_demo_rivera.sql, docs/demo/RIVERA_DEMO.md).
-- Run by scripts/test-household-sql.sh on a throwaway local database (needs 20261207 and 20261208). Never run on the
-- real project. Checks: owner only; demo accounts only; what the seed builds (every feature, through the real
-- functions); both adults; Club through the complimentary grant; a reset restores it exactly, is idempotent, touches
-- no other household and writes no billing, fulfillment, email or calendar-sync rows.
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
-- Everything the demo household is, without ids or timestamps: two seeds of it must be equal.
create function pg_temp.demo_shape() returns text language sql as $$
  with h as (select household_id from public.demo_households where key = 'rivera')
  select md5(string_agg(t, '|' order by t)) from (
    select 'member:' || m.first_name || ':' || m.kind || ':' || m.role || ':' || coalesce(m.birth_year, 0) || ':' || coalesce(hh.preferences -> 'colors' ->> m.id::text, '') as t
      from public.club_family_members m join public.club_households hh on hh.id = m.household_id where m.household_id = (select household_id from h)
    union all select 'adult:' || u.email || ':' || a.role from public.household_adults a join auth.users u on u.id = a.user_id where a.household_id = (select household_id from h)
    union all select 'profile:' || priority || ':' || array_to_string(challenges, ',') || ':' || (setup_completed_at is not null) from public.club_households where id = (select household_id from h)
    union all select 'activity:' || category || ':' || coalesce(name, '') || ':' || array_to_string(days, ',') from public.club_activities where household_id = (select household_id from h)
    union all select 'resp:' || case when status = 'confirmed' then id::text else '' end || ':' || status || ':' || category || ':' || coalesce(agreed_text, item, '') || ':' || coalesce(agreed_when, '') || ':' || (deleted_at is null) from public.club_responsibilities where household_id = (select household_id from h)
    union all select 'event:' || id::text || ':' || title || ':' || coalesce(recurrence::text, '') || ':' || (deleted_at is null) from public.calendar_events where household_id = (select household_id from h)
    union all select 'dev:' || id::text || ':' || skill_id || ':' || coalesce(stage, '') || ':' || status || ':' || coalesce(cue, '') || ':' || coalesce(finish_line, '') from public.household_development where household_id = (select household_id from h)
    union all select 'devevent:' || record_id::text || ':' || decision || ':' || coalesce(to_stage, '') || ':' || to_status from public.household_development_events where household_id = (select household_id from h)
    union all select 'mark:' || list || ':' || period || ':' || item || ':' || done from public.household_cleaning_marks where household_id = (select household_id from h)
  ) x
$$;
-- Every row that could leave the building or cost money (rows anywhere, not only Rivera's).
create function pg_temp.outbound() returns text language sql as $$
  select (select count(*) from public.club_subscriptions) || '/' || (select count(*) from public.club_invoices) || '/' ||
         (select count(*) from public.club_entitlements) || '/' || (select count(*) from public.club_fulfillment_orders) || '/' ||
         (select count(*) from public.club_email_log) || '/' || (select count(*) from public.tool_email_contacts) || '/' ||
         (select count(*) from public.calendar_feeds) || '/' || (select count(*) from public.calendar_google_accounts) || '/' ||
         (select count(*) from public.shop_orders)
$$;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000de001', 'demo-owner@organizedmom.test', now()),
  ('00000000-0000-0000-0000-0000000de002', 'demo-helper@organizedmom.test', now()),
  ('00000000-0000-0000-0000-0000000de0a1', 'rivera-ana@example.com', now()),
  ('00000000-0000-0000-0000-0000000de0a2', 'rivera-luis@example.com', now()),
  ('00000000-0000-0000-0000-0000000de0f1', 'real-parent@gmail.com', now()),
  ('00000000-0000-0000-0000-0000000de0f2', 'payer@example.com', now()),
  ('00000000-0000-0000-0000-0000000de0f3', 'taken@example.com', now());
\set ADMIN '''00000000-0000-0000-0000-0000000de001'''
\set HELPER '''00000000-0000-0000-0000-0000000de002'''
\set ANA '''00000000-0000-0000-0000-0000000de0a1'''
\set LUIS '''00000000-0000-0000-0000-0000000de0a2'''
\set REAL '''00000000-0000-0000-0000-0000000de0f1'''
insert into public.admin_users (user_id, role) values (:ADMIN, 'owner'), (:HELPER, 'helper');
-- A real family (not a demo) that must never change, and a demo-looking account that has a family of its own.
select pg_temp.as_user(:REAL);
select public.household_save(null, 'The Parks', '{}', '[{"first_name":"Jen","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Kim","kind":"child","role":"child","birth_year":2018,"birth_month":2}]');
select public.household_agreement_save(jsonb_build_object('id', gen_random_uuid(), 'category', 'cleaning', 'text', 'Parks chore', 'owner_ids', jsonb_build_array((select id from public.club_family_members where first_name = 'Kim'))), null);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000de0f3');
select public.household_save(null, 'Someone Else', '{}', '[{"first_name":"Tia","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, current_period_start, current_period_end, started_at, livemode)
values ('sub_DemoGuard1', 'cus_DemoGuard1', '00000000-0000-0000-0000-0000000de0f2', 'active', 'price_1', now(), now() + interval '30 days', now(), false);
create temp table parks as select md5(string_agg(t, '|' order by t)) as shape from (
  select r.id::text || r.agreed_text || r.updated_at as t from public.club_responsibilities r where r.agreed_text = 'Parks chore'
  union all select m.id::text || m.first_name || m.updated_at from public.club_family_members m join public.club_households h on h.id = m.household_id where h.display_name in ('The Parks', 'Someone Else')
  union all select h.id::text || h.updated_at || h.preferences::text from public.club_households h where h.display_name in ('The Parks', 'Someone Else')) x;
grant select on parks to authenticated, anon;
create temp table before_outbound as select pg_temp.outbound() as v, (select count(*) from public.club_households) as households;
grant select on before_outbound to authenticated, anon;

-- ---------------------------------------------------------------- who may run it
select pg_temp.as_user(:ANA);
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_reset(''rivera-ana@example.com'', ''rivera-luis@example.com'')', 'forbidden'), 'a family cannot install or reset the demo');
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_status()', 'forbidden'), 'a family cannot see the demo status');
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_seed(gen_random_uuid(), gen_random_uuid())'), 'the seed itself is not callable');
reset role;
select pg_temp.as_user(:HELPER);
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_reset(''rivera-ana@example.com'', ''rivera-luis@example.com'')', 'forbidden'), 'a helper admin cannot reset the demo');
reset role;
select pg_temp.as_user(null);
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_status()'), 'anonymous callers are refused');
reset role;

-- ---------------------------------------------------------------- only clean demo accounts
select pg_temp.as_user(:ADMIN);
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_reset()', 'not_installed'), 'a reset before install says it is not installed');
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_reset(''real-parent@gmail.com'', ''rivera-luis@example.com'')', 'owner_not_a_demo_email'), 'a real email is refused');
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_reset(''payer@example.com'', ''rivera-luis@example.com'')', 'owner_has_subscription'), 'an account with a subscription is refused');
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_reset(''rivera-ana@example.com'', ''taken@example.com'')', 'partner_has_other_household'), 'an account with its own family is refused');
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_reset(''rivera-ana@example.com'', ''nobody@example.com'')', 'no_account'), 'a missing account is refused');
reset role;
select pg_temp.expect((select count(*) from public.club_households) = (select households from before_outbound) and (select count(*) from public.demo_households) = 0, 'refused installs changed nothing');
select pg_temp.as_user(:ADMIN);

-- ---------------------------------------------------------------- install
select pg_temp.expect((public.demo_rivera_reset('rivera-ana@example.com', 'rivera-luis@example.com') ->> 'club')::boolean, 'the owner installs Rivera; it has the Club');
select pg_temp.expect(pg_temp.fails('select public.demo_rivera_reset(''rivera-ana@example.com'', ''rivera-luis@example.com'')', 'already_installed'), 'installing twice is refused (use Reset)');
reset role;
create temp table seeded as select pg_temp.demo_shape() as shape, (select household_id from public.demo_households) as hid;
grant select on seeded to authenticated, anon;

-- The family
select pg_temp.expect((select string_agg(first_name, ',' order by first_name) from public.club_family_members where household_id = (select hid from seeded)) = 'Ana,Elena,Luis,Mateo,Sofia', 'the established Rivera family (Ana, Luis, Sofia, Mateo, Elena)');
select pg_temp.expect((select count(distinct v) = 5 from public.club_households h, jsonb_each_text(h.preferences -> 'colors') c(k, v) where h.id = (select hid from seeded)), 'five distinct saved colors');
select pg_temp.expect((select setup_completed_at is not null and priority = 'mornings' and 'routines' = any (challenges) from public.club_households where id = (select hid from seeded)), 'the family profile is complete (week, responsibilities, growth, challenges, priority)');
select pg_temp.expect((select count(*) from public.club_activities where household_id = (select hid from seeded)) = 5, 'the typical week: school, preschool, soccer, swim, work');
select pg_temp.expect((select string_agg(a.role, ',' order by a.role) from public.household_adults a where a.household_id = (select hid from seeded)) = 'owner,partner', 'Ana owns it, Luis joined through the invitation');
select pg_temp.expect((select count(*) from public.household_invites where household_id = (select hid from seeded) and accepted_at is not null) = 1, 'the invitation was accepted');
-- Calendar, agreements, cleaning
select pg_temp.expect((select count(*) filter (where recurrence is not null) = 9 and count(*) = 18 from public.calendar_events where household_id = (select hid from seeded) and deleted_at is null), 'calendar: 9 weekly plans and 9 one-offs');
select pg_temp.expect((select count(*) from public.calendar_events where household_id = (select hid from seeded) and starts_on > (now() at time zone 'America/Chicago')::date) >= 8, 'upcoming plans around today');
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = (select hid from seeded) and status = 'confirmed' and deleted_at is null and agreed_when in ('After breakfast', 'Before leaving for school', 'When we get home', 'After dinner', 'Before bedtime')) >= 8, 'agreements on every cue: after breakfast, before school, arriving home, after dinner, bedtime');
select pg_temp.expect((select count(*) from public.club_responsibilities where household_id = (select hid from seeded) and status = 'confirmed' and deleted_at is null and agreed_finished is null) = 0, 'every agreement has a finish line');
select pg_temp.expect((select count(*) from public.household_cleaning_marks where household_id = (select hid from seeded) and period = to_char((now() at time zone 'America/Chicago')::date, 'YYYY-MM-DD') and list = 'daily') = 2, 'cleaning today: 2 of the 5 Daily Reset tasks done');
select pg_temp.expect((select count(distinct period) from public.household_cleaning_marks where household_id = (select hid from seeded) and list = 'daily') = 14, 'two weeks of cleaning history');
-- Development (MAWL)
select pg_temp.expect((select string_agg(distinct stage, ',' order by stage) from public.household_development where household_id = (select hid from seeded) and status in ('active', 'launched')) = 'assist,launch,model,watch', 'all four stages: Model, Assist, Watch, Launch');
select pg_temp.expect((select status = 'launched' from public.household_development where id = public.demo_id('dev:sofia-bag')), 'Sofia''s backpack was handed over (Launch)');
select pg_temp.expect((select string_agg(decision, ',' order by id) from public.household_development_events where record_id = public.demo_id('dev:sofia-dishes')) = 'start,advance,step-back,modify,advance', 'a step back when more help was needed, then a new cue');
select pg_temp.expect((select cue from public.household_development where id = public.demo_id('dev:sofia-dishes')) = 'After dinner', 'the different cue the family chose');
select pg_temp.expect((select status = 'paused' and agreement_id is not null from public.household_development where id = public.demo_id('dev:elena-hamper'))
  and (select deleted_at is not null from public.club_responsibilities where id = public.demo_id('agreement:dev-elena-hamper')), 'a paused skill, its agreement removed (tombstone)');
select pg_temp.expect((select finish_line like '%backpack on its hook' from public.household_development where id = public.demo_id('dev:mateo-unpack')), 'an edited routine (finish line)');
select pg_temp.expect((select bool_and(r.deleted_at is null and r.owner_ids = array[h.member_id]) from public.household_development h join public.club_responsibilities r on r.id = h.agreement_id where h.household_id = (select hid from seeded) and h.status in ('active', 'launched')), 'every live skill has its agreement, owned by the child');
select pg_temp.expect((select min(decided_at) < now() - interval '30 days' and max(decided_at) < now() - interval '2 days' from public.household_development_events where household_id = (select hid from seeded)), 'five weeks of decisions');
select pg_temp.expect((select count(*) from public.household_development_events where household_id = (select hid from seeded) and decided_by = :LUIS) >= 3, 'both adults made decisions');
select pg_temp.expect((select bool_and(updated_at > now() - interval '1 minute') from public.club_responsibilities where household_id = (select hid from seeded)), 'sync cursors are not back-dated (phones pick up the seed)');

-- Both adults, through the app's own functions
select pg_temp.as_user(:LUIS);
select pg_temp.expect((public.club_me() ->> 'access')::boolean and public.club_me() ->> 'grant' = 'complimentary', 'Luis has the Club through the household''s complimentary grant');
select pg_temp.expect(jsonb_array_length(public.household_development()) = 6, 'Luis sees the family''s development records');
select pg_temp.expect(jsonb_array_length(public.calendar_changes(null) -> 'events') = 18, 'Luis sees the family calendar');
select pg_temp.expect(pg_temp.fails('select public.club_address_save(''{}''::jsonb)'), 'Luis (second adult) cannot do owner-only things');
reset role;
select pg_temp.as_user(:ANA);
select pg_temp.expect((public.club_me() ->> 'access')::boolean and public.club_me() ->> 'grant' = 'complimentary', 'Ana has the Club (complimentary)');
select pg_temp.expect((public.club_household() -> 'members') is not null and (select count(*) from jsonb_array_elements(public.club_household() -> 'members')) = 5, 'Ana''s household shows five people');
reset role;
select pg_temp.expect((select shape from parks) = (select md5(string_agg(t, '|' order by t)) from (
  select r.id::text || r.agreed_text || r.updated_at as t from public.club_responsibilities r where r.agreed_text = 'Parks chore'
  union all select m.id::text || m.first_name || m.updated_at from public.club_family_members m join public.club_households h on h.id = m.household_id where h.display_name in ('The Parks', 'Someone Else')
  union all select h.id::text || h.updated_at || h.preferences::text from public.club_households h where h.display_name in ('The Parks', 'Someone Else')) x), 'other households are untouched by the install');
select pg_temp.expect(pg_temp.outbound() = (select v from before_outbound), 'no subscription, invoice, entitlement, fulfillment, email, feed, Google or shop row was written');

-- ---------------------------------------------------------------- explore, then reset
select pg_temp.as_user(:LUIS);
select public.household_development_decide(jsonb_build_object('id', md5('omc-rivera-demo:dev:mateo-dishes')::uuid, 'decision', 'advance', 'library_version', 1), (select revision from public.household_development where id = md5('omc-rivera-demo:dev:mateo-dishes')::uuid));
select public.calendar_event_delete(md5('omc-rivera-demo:event:dentist')::uuid, (select revision from public.calendar_events where id = md5('omc-rivera-demo:event:dentist')::uuid));
select public.cleaning_marks_push(jsonb_build_array(jsonb_build_object('list', 'daily', 'period', to_char((now() at time zone 'America/Chicago')::date, 'YYYY-MM-DD'), 'item', 'spills', 'done', true, 'at', now())));
select public.household_agreement_save(jsonb_build_object('id', gen_random_uuid(), 'category', 'meals', 'text', 'Something Luis tried', 'owner_ids', jsonb_build_array((select owner_member_id from public.calendar_events where id = md5('omc-rivera-demo:event:school')::uuid))), null);
reset role;
select pg_temp.expect(pg_temp.demo_shape() <> (select shape from seeded), 'exploring changed the demo');
select pg_temp.as_user(:ADMIN);
select pg_temp.expect((public.demo_rivera_reset() ->> 'household_present')::boolean, 'the owner resets Rivera');
reset role;
select pg_temp.expect(pg_temp.demo_shape() = (select shape from seeded), 'the reset restores exactly the seeded demo');
select pg_temp.as_user(:ADMIN);
select public.demo_rivera_reset();
reset role;
select pg_temp.expect(pg_temp.demo_shape() = (select shape from seeded), 'resetting again gives the same demo (idempotent)');
select pg_temp.expect((select count(*) from public.club_households) = (select households from before_outbound) + 1 and (select count(*) from public.club_family_members m join public.demo_households d on d.household_id = m.household_id) = 5, 'no duplicate households or people');
select pg_temp.expect((select count(*) from public.club_access_grants where user_id = :ANA) = 1, 'one grant, kept across resets');
select pg_temp.expect((select count(*) from auth.users where email like 'rivera-%@example.com') = 2, 'the demo accounts (and their sign-in) are kept');
select pg_temp.expect((select string_agg(action, ',' order by at, id) from public.admin_audit_log where action like 'demo.rivera.%') = 'demo.rivera.install,demo.rivera.reset,demo.rivera.reset', 'install and each reset are in the audit log');
select pg_temp.expect((select shape from parks) = (select md5(string_agg(t, '|' order by t)) from (
  select r.id::text || r.agreed_text || r.updated_at as t from public.club_responsibilities r where r.agreed_text = 'Parks chore'
  union all select m.id::text || m.first_name || m.updated_at from public.club_family_members m join public.club_households h on h.id = m.household_id where h.display_name in ('The Parks', 'Someone Else')
  union all select h.id::text || h.updated_at || h.preferences::text from public.club_households h where h.display_name in ('The Parks', 'Someone Else')) x), 'other households are untouched by resets');
select pg_temp.expect(pg_temp.outbound() = (select v from before_outbound), 'still no billing, fulfillment, email or calendar-sync rows after resets');

-- The registry and helpers are not readable or callable by families
select pg_temp.as_user(:ANA);
select pg_temp.expect(pg_temp.fails('select * from public.demo_households'), 'families cannot read the demo registry');
select pg_temp.expect(pg_temp.fails('select public.demo_act_as(gen_random_uuid())'), 'nobody can call the impersonation helper');
reset role;
select pg_temp.expect(not has_function_privilege('authenticated', 'public.demo_decide(uuid,jsonb,numeric)', 'execute') and not has_function_privilege('authenticated', 'public.demo_age_decision(uuid,numeric)', 'execute'), 'internal seed helpers are server-only');
