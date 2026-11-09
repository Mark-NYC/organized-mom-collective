-- Tests for the Welcome Family Rhythm's saved plan (supabase/migrations/20261121000000_club_welcome_plans.sql). Run by
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
  ('00000000-0000-0000-0000-0000000e0a01', 'welcome-a@example.com', now()),
  ('00000000-0000-0000-0000-0000000e0a02', 'welcome-b@example.com', now()),
  ('00000000-0000-0000-0000-0000000e0a03', 'welcome-nohh@example.com', now()),
  ('00000000-0000-0000-0000-0000000e0a04', 'welcome-lapsed@example.com', now());

\set A '''00000000-0000-0000-0000-0000000e0a01'''
\set B '''00000000-0000-0000-0000-0000000e0a02'''
\set N '''00000000-0000-0000-0000-0000000e0a03'''
\set L '''00000000-0000-0000-0000-0000000e0a04'''

insert into public.club_access_grants (user_id, reason, note) values (:A, 'preview', 'welcome plan tests'), (:B, 'beta', 'welcome plan tests'), (:N, 'beta', 'welcome plan tests');

-- Households for A, B and the lapsed member L (who has no access now). N has access but no household.
select pg_temp.as_user('authenticated', :A);
select public.club_household_save('Team A', '{}', '[{"first_name":"Mia","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Ava","kind":"child","role":"child","birth_year":2018,"birth_month":4}]');
select pg_temp.as_user('authenticated', :B);
select public.club_household_save('Team B', '{}', '[{"first_name":"Kim","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
insert into public.club_access_grants (user_id, reason, note) values (:L, 'beta', 'lapsed later');
select pg_temp.as_user('authenticated', :L);
select public.club_household_save('Team L', '{}', '[{"first_name":"Lu","kind":"adult","role":"parent","is_account_holder":true}]');
reset role;
update public.club_access_grants set revoked_at = now() where user_id = :L;

-- ---------------------------------------------------------------- access

select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_get()$$), 'anon can''t read a welcome plan');
select pg_temp.expect(pg_temp.fails($$select * from public.club_welcome_plans$$), 'anon can''t read the table');
reset role;

select pg_temp.as_user('authenticated', :A);
select pg_temp.expect(pg_temp.fails($$select * from public.club_welcome_plans$$), 'members can''t read the table directly');
select pg_temp.expect(pg_temp.fails($$insert into public.club_welcome_plans (household_id) select id from public.club_households$$), 'members can''t write the table directly');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_access(auth.uid())$$), 'the access helper is internal');
select pg_temp.expect(public.club_welcome_plan_get() ->> 'can' = 'edit', 'a member with access can edit');
select pg_temp.expect((public.club_welcome_plan_get() ->> 'revision')::int = 0 and public.club_welcome_plan_get() -> 'state' = '{}', 'nothing saved yet: revision 0, empty state');
reset role;

select pg_temp.as_user('authenticated', :N);
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_get()$$, 'not_found'), 'no household: nothing to open');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_save('{}', 0)$$, 'read_only'), 'no household: nothing to save');
reset role;

select pg_temp.as_user('authenticated', :L);
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_get()$$, 'not_found'), 'access ended and nothing ever held: closed');
reset role;

-- ---------------------------------------------------------------- saving

\set S1 '''{"omc:club:welcome-family-rhythm:v1":{"s":"s","v":"{\\"v\\":3,\\"context\\":\\"welcome\\",\\"month\\":\\"2026-11\\"}"}}'''
\set S2 '''{"omc:club:welcome-family-rhythm:v1":{"s":"s","v":"{\\"v\\":3,\\"context\\":\\"welcome\\",\\"month\\":\\"2026-11\\",\\"plan\\":{}}"}}'''

select pg_temp.as_user('authenticated', :A);
select pg_temp.expect(public.club_welcome_plan_save(:S1::jsonb, 0) = 1, 'first save: revision 1');
select pg_temp.expect(pg_temp.fails(format($$select public.club_welcome_plan_save(%L::jsonb, 0)$$, :S1), 'conflict'), 'a second first-save (another tab) is a conflict');
select pg_temp.expect(public.club_welcome_plan_save(:S1::jsonb, 1) = 1, 'the same state again is a no-op');
select pg_temp.expect(public.club_welcome_plan_save(:S2::jsonb, 1) = 2, 'a change: revision 2');
select pg_temp.expect(pg_temp.fails(format($$select public.club_welcome_plan_save(%L::jsonb, 1)$$, :S1), 'conflict'), 'a stale revision is a conflict, nothing overwritten');
select pg_temp.expect(public.club_welcome_plan_get() -> 'state' = :S2::jsonb, 'the newer plan is kept');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_save('[]', 2)$$, 'invalid'), 'state must be an object');
select pg_temp.expect(pg_temp.fails(format($$select public.club_welcome_plan_save(jsonb_build_object('x', repeat('a', 70000)), 2)$$), 'invalid'), 'state is size-limited');
reset role;

-- B's plan is B's.
select pg_temp.as_user('authenticated', :B);
select pg_temp.expect((public.club_welcome_plan_get() ->> 'revision')::int = 0, 'another household sees nothing of A''s');
select pg_temp.expect(public.club_welcome_plan_save(:S1::jsonb, 0) = 1, 'and saves its own');
reset role;
select pg_temp.expect((select count(*) from public.club_welcome_plans) = 2, 'one row per household (A and B)');

-- ---------------------------------------------------------------- approval

select pg_temp.as_user('authenticated', :A);
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_approve(1, 'fp')$$, 'conflict'), 'approving a stale revision is refused');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_approve(2, '')$$, 'invalid'), 'an approval needs what prints');
select public.club_welcome_plan_approve(2, 'fp-2');
select pg_temp.expect(public.club_welcome_plan_get() ->> 'approved_fingerprint' = 'fp-2', 'approved against what prints');
select pg_temp.expect(public.club_welcome_plan_get() ->> 'approved_at' is not null, 'approval recorded');
select pg_temp.expect(public.club_welcome_plan_save(:S2::jsonb, 2) = 2, 'reopening (same state) is a no-op');
select pg_temp.expect(public.club_welcome_plan_get() ->> 'approved_at' is not null, 'and keeps her approval');
select pg_temp.expect(public.club_welcome_plan_save(:S1::jsonb, 2) = 3, 'a change saves');
select pg_temp.expect(public.club_welcome_plan_get() ->> 'approved_at' is null and public.club_welcome_plan_get() ->> 'approved_fingerprint' is null, 'and clears the approval');
select public.club_welcome_plan_approve(3, 'fp-3');
select public.club_welcome_plan_unapprove(3);
select pg_temp.expect(public.club_welcome_plan_get() ->> 'approved_at' is null, 'undo takes the approval back');
reset role;

-- Approving the prepared plan before she changed anything saves it.
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000e0a05', 'welcome-c@example.com', now());
insert into public.club_access_grants (user_id, reason) values ('00000000-0000-0000-0000-0000000e0a05', 'beta');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-0000000e0a05');
select public.club_household_save('Team C', '{}', '[{"first_name":"Cy","kind":"adult","role":"parent","is_account_holder":true}]');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_approve(0, 'fp')$$, 'invalid'), 'approving with nothing saved needs the plan she saw');
select public.club_welcome_plan_approve(0, 'fp-0', :S1::jsonb);
select pg_temp.expect((public.club_welcome_plan_get() ->> 'revision')::int = 1, 'approving the prepared plan saves it, revision 1');
select pg_temp.expect(public.club_welcome_plan_get() ->> 'approved_fingerprint' = 'fp-0', 'and approves it');
reset role;

-- ---------------------------------------------------------------- read only after access ends

update public.club_access_grants set revoked_at = now() where user_id = :B;
-- B held a welcome order (as every paying member does): read only.
insert into public.club_fulfillment_orders (user_id, household_id, resource_month, fulfillment_type)
  select :B, h.id, '2026-11-01', 'welcome_vision' from public.club_households h where h.owner_user_id = :B;
select pg_temp.as_user('authenticated', :B);
select pg_temp.expect(public.club_welcome_plan_get() ->> 'can' = 'read', 'access ended, a Welcome Kit held: read only');
select pg_temp.expect(public.club_welcome_plan_get() -> 'state' = :S1::jsonb, 'her plan is still there to print');
select pg_temp.expect(pg_temp.fails(format($$select public.club_welcome_plan_save(%L::jsonb, 1)$$, :S2), 'read_only'), 'and can''t be changed');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_approve(1, 'fp')$$, 'read_only'), 'or approved');
reset role;

-- ---------------------------------------------------------------- nothing else changed

select pg_temp.expect((select count(*) from public.club_fulfillment_orders where user_id::text like '00000000-0000-0000-0000-0000000e0a%') = 1, 'saving and approving create no orders (only the one this test inserted)');
select pg_temp.expect(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'club_welcome_plan%' and has_function_privilege('anon', p.oid, 'execute')), 'anon can execute no welcome plan function');
