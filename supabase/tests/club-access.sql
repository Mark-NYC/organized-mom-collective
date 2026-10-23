-- Access tests for the Organized Family Club (supabase/migrations/20261023000000_club_core.sql). Run by
-- scripts/test-admin-sql.sh on a throwaway local database after supabase-stub.sql and every migration.
-- Never run on the real project.
\set ON_ERROR_STOP 1
\set QUIET 1

create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- True when the statement is refused: no privilege, a policy, or the function's own exception text.
create function pg_temp.fails(q text, err text default null) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception
  when insufficient_privilege then return err is null;
  when raise_exception then return err is null or sqlerrm = err;
end $$;

-- Rows a statement changed (0 when RLS hides everything from it).
create function pg_temp.changed(q text) returns int language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
exception
  when insufficient_privilege then return 0;
end $$;

create function pg_temp.as_user(p_role text, p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_sub is null then '{}' else jsonb_build_object('sub', p_sub)::text end, false);
  execute format('set role %I', p_role);
end $$;

-- Two families (A, B), one account with nothing, and the owner admin.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000c1ba01', 'club-a@example.com', now()),
  ('00000000-0000-0000-0000-000000c1ba02', 'club-b@example.com', now()),
  ('00000000-0000-0000-0000-000000c1ba03', 'club-c@example.com', now()),
  ('00000000-0000-0000-0000-000000c1ba04', 'club-owner@example.com', now());
insert into public.admin_users (user_id, role) values ('00000000-0000-0000-0000-000000c1ba04', 'owner') on conflict do nothing;

\set A '''00000000-0000-0000-0000-000000c1ba01'''
\set B '''00000000-0000-0000-0000-000000c1ba02'''
\set C '''00000000-0000-0000-0000-000000c1ba03'''
\set OWNER '''00000000-0000-0000-0000-000000c1ba04'''
\set KIT '''2026-11-family-ownership'''

-- ---------------------------------------------------------------- the seeded kit

select pg_temp.expect((select status from public.club_kits where slug = :KIT) = 'draft', 'November is seeded as a draft');

-- ---------------------------------------------------------------- households

select pg_temp.as_user('authenticated', :A);
select pg_temp.expect((public.club_household_save('Team A', '{"palette":"blue-green","pets":true,"priorities":["mornings","kids-independence"]}',
  '[{"first_name":"Mia","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Lee","kind":"adult","role":"partner"},{"first_name":"Ava","kind":"child","role":"child","birth_year":2019,"birth_month":4}]') -> 'members') is not null,
  'A saves her family');
select pg_temp.expect(public.club_household() ->> 'id' is not null, 'her household comes back with its id (the engine needs it)');
select pg_temp.expect(jsonb_array_length(public.club_household() -> 'members') = 3, 'three people');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{"evil":1}', '[{"first_name":"X","kind":"adult","role":"parent"}]')$$, 'invalid'), 'unknown preference key refused');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{"priorities":"mornings"}', '[{"first_name":"X","kind":"adult","role":"parent"}]')$$, 'invalid'), 'priorities must be a list');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{"priorities":["<script>"]}', '[{"first_name":"X","kind":"adult","role":"parent"}]')$$, 'invalid'), 'priority ids are checked');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{}', '[{"first_name":"Kid","kind":"child","role":"child"}]')$$, 'invalid'), 'child without birth year refused');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{}', '[{"first_name":"  ","kind":"adult","role":"parent"}]')$$, 'invalid'), 'blank name refused');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{}', '[{"first_name":"A","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"B","kind":"adult","role":"partner","is_account_holder":true}]')$$, 'invalid'), 'only one account holder');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{}', '[]')$$, 'invalid'), 'at least one person');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{}', (select jsonb_agg(jsonb_build_object('first_name', 'P' || g, 'kind', 'adult', 'role', 'other')) from generate_series(1, 13) g))$$, 'invalid'), 'at most twelve people');

-- Removing someone archives them (documents keep pointing at the id).
create temp table a_ids as select (m ->> 'id')::uuid as id, m ->> 'first_name' as name from jsonb_array_elements(public.club_household() -> 'members') m;
select pg_temp.expect((select count(*) from a_ids) = 3, 'ids remembered');
select public.club_household_save('Team A', '{}', (select jsonb_agg(jsonb_build_object('id', id, 'first_name', name, 'kind', 'adult', 'role', case when name = 'Mia' then 'parent' else 'partner' end)) from a_ids where name <> 'Ava'));
select pg_temp.expect((select count(*) from jsonb_array_elements(public.club_household() -> 'members') m where (m ->> 'archived')::boolean) = 1, 'a removed child is archived, not deleted');
select pg_temp.expect((public.club_household() ->> 'profile_version')::int = 2, 'every save bumps the profile version');

reset role;
select pg_temp.as_user('authenticated', :B);
select public.club_household_save('Team B', '{}', '[{"first_name":"Jo","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Kit","kind":"child","role":"child","birth_year":2017}]');

-- ---------------------------------------------------------------- B tries A's household

select pg_temp.expect(not exists (select 1 from public.club_households where owner_user_id = :A), 'B can''t read A''s household');
select pg_temp.expect(not exists (select 1 from public.club_family_members m join a_ids using (id)), 'B can''t read A''s children');
select pg_temp.expect((select count(*) from public.club_family_members) = 2, 'B reads only her own two people');
select pg_temp.expect(pg_temp.changed(format($$update public.club_family_members set first_name = 'Hacked' where id = %L$$, (select id from a_ids where name = 'Ava'))) = 0, 'B can''t rename A''s child');
select pg_temp.expect(pg_temp.changed(format($$delete from public.club_family_members where id = %L$$, (select id from a_ids where name = 'Ava'))) = 0, 'B can''t delete A''s child');
select pg_temp.expect(pg_temp.fails(format($$insert into public.club_family_members (household_id, first_name, kind, role) values ((select id from public.club_households limit 1), 'X', 'adult', 'other')$$)), 'B can''t insert family members directly');
select pg_temp.expect(pg_temp.changed($$update public.club_households set display_name = 'Hacked'$$) = 0, 'no direct household updates, even her own');
select pg_temp.expect(pg_temp.fails(format($$select public.club_household_save('B', '{}', jsonb_build_array(jsonb_build_object('id', %L, 'first_name', 'Stolen', 'kind', 'child', 'role', 'child', 'birth_year', 2019)))$$, (select id from a_ids where name = 'Ava')), 'invalid'),
  'B can''t pull A''s child into her household by id');
reset role;
select pg_temp.expect((select first_name from public.club_family_members where id = (select id from a_ids where name = 'Ava')) = 'Ava', 'A''s child is untouched');
select pg_temp.expect((select display_name from public.club_households where owner_user_id = :A) = 'Team A', 'A''s household is untouched');

-- ---------------------------------------------------------------- access and documents

select pg_temp.as_user('authenticated', :A);
select pg_temp.expect((public.club_me() ->> 'access')::boolean = false, 'no access without a membership or grant');
select pg_temp.expect(pg_temp.fails($$select public.club_document_get('2026-11-family-ownership')$$, 'not_found'), 'a draft kit is closed');
select pg_temp.expect(pg_temp.fails($$insert into public.club_access_grants (user_id, reason) values ('00000000-0000-0000-0000-000000c1ba01', 'preview')$$), 'she can''t grant herself access');
select pg_temp.expect(pg_temp.fails($$select public.club_has_access('00000000-0000-0000-0000-000000c1ba01')$$), 'access checks are server-only');
reset role;

update public.club_kits set status = 'scheduled', release_at = now() - interval '1 day' where slug = :KIT;
insert into public.club_access_grants (user_id, reason, note) values (:A, 'preview', 'access tests'), (:B, 'beta', 'access tests');

select pg_temp.as_user('authenticated', :A);
select pg_temp.expect((public.club_me() ->> 'access')::boolean and public.club_me() ->> 'grant' = 'preview', 'a preview grant gives access');
select pg_temp.expect(public.club_document_get(:KIT) ->> 'can' = 'edit', 'and edit rights to a released kit');
select pg_temp.expect(public.club_document_save(:KIT, 'ownership-chart', '{"hidden":["t1"]}', 'warm-neutrals', 1, 2, 0) = 1, 'A saves her chart');
select pg_temp.expect(public.club_document_save(:KIT, 'ownership-chart', '{"hidden":["t2"]}', 'warm-neutrals', 1, 2, 1) = 2, 'and again, with the current revision');
select pg_temp.expect(pg_temp.fails($$select public.club_document_save('2026-11-family-ownership', 'ownership-chart', '{}', 'warm-neutrals', 1, 2, 1)$$, 'conflict'), 'a stale save (second device) is refused');
select pg_temp.expect(pg_temp.fails($$select public.club_document_save('2026-11-family-ownership', 'Bad Doc!', '{}', 'warm-neutrals', 1, 2, 0)$$, 'invalid'), 'document names are checked');
select pg_temp.expect(pg_temp.fails($$select public.club_document_save('2026-11-family-ownership', 'other', '{}', 'neon', 1, 2, 0)$$, 'invalid'), 'only the three palettes');
select pg_temp.expect(pg_temp.fails(format($$select public.club_document_save('2026-11-family-ownership', 'big', jsonb_build_object('x', repeat('a', 40000)), 'warm-neutrals', 1, 2, 0)$$), 'invalid'), 'edits are capped at 32 KB');
reset role;

select pg_temp.as_user('authenticated', :B);
select pg_temp.expect((public.club_document_get(:KIT) -> 'documents') = '{}'::jsonb, 'B sees none of A''s documents through the kit');
select pg_temp.expect(pg_temp.fails($$select * from public.club_documents$$), 'B can''t read the documents table');
select pg_temp.expect(pg_temp.changed($$update public.club_documents set edits = '{}'$$) = 0, 'B can''t overwrite A''s chart');
select pg_temp.expect(pg_temp.changed($$delete from public.club_documents$$) = 0, 'B can''t delete A''s chart');
select pg_temp.expect(public.club_document_save(:KIT, 'ownership-chart', '{"mine":true}', 'rose-lavender', 1, 1, 0) = 1, 'B''s save lands in her own household (revision 1, not A''s 2)');
reset role;
select pg_temp.expect((select edits from public.club_documents d join public.club_households h on h.id = d.household_id where h.owner_user_id = :A and d.doc = 'ownership-chart') = '{"hidden":["t2"]}'::jsonb, 'A''s chart is exactly as she saved it');

select pg_temp.as_user('authenticated', :C);
select pg_temp.expect(pg_temp.fails($$select public.club_document_save('2026-11-family-ownership', 'ownership-chart', '{}', 'warm-neutrals', 1, 1, 0)$$, 'read_only'), 'no access: no saving');
select pg_temp.expect(pg_temp.fails($$select public.club_document_get('2026-11-family-ownership')$$, 'not_found'), 'no access: kit closed');
select pg_temp.expect(public.club_household() is null, 'no household yet');
reset role;

-- An expired or revoked grant ends access; earned-by-invoice is Phase 2.
update public.club_access_grants set expires_at = now() - interval '1 minute' where user_id = :B;
select pg_temp.as_user('authenticated', :B);
select pg_temp.expect((public.club_me() ->> 'access')::boolean = false, 'an expired grant ends access');
select pg_temp.expect(pg_temp.fails($$select public.club_document_get('2026-11-family-ownership')$$, 'not_found'), 'and closes the kit');
reset role;

select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($$select public.club_me()$$), 'anon can''t call club_me');
select pg_temp.expect(pg_temp.fails($$select public.club_household()$$), 'anon can''t read households');
select pg_temp.expect(pg_temp.fails($$select * from public.club_family_members$$), 'anon can''t read family members');
reset role;

-- ---------------------------------------------------------------- admin

select pg_temp.as_user('authenticated', :OWNER);
select pg_temp.expect((select count(*) from public.club_households) = 2, 'the owner admin reads households (support)');
select pg_temp.expect((select count(*) from public.club_family_members) = 0, 'but never children''s names');
select pg_temp.expect((select count(*) from public.club_access_grants) = 2, 'and reads grants');
select pg_temp.expect(pg_temp.changed($$update public.club_access_grants set revoked_at = now()$$) = 0, 'changes go through functions, not the browser');
reset role;

-- ---------------------------------------------------------------- billing mirror (Phase 2 writes it)

insert into public.club_subscriptions (id, stripe_subscription_id, stripe_customer_id, user_id, status, price_id, current_period_start, current_period_end, started_at, livemode)
values ('00000000-0000-0000-0000-000000c1ba05', 'sub_A1', 'cus_A1', :A, 'active', 'price_1', now() - interval '2 days', now() + interval '28 days', now(), false);
do $$ begin
  insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, started_at, livemode)
  values ('sub_A2', 'cus_A1', '00000000-0000-0000-0000-000000c1ba01', 'active', 'price_1', now(), false);
  raise exception 'FAIL: second live subscription allowed';
exception when unique_violation then raise notice 'ok - one live subscription per account';
end $$;
select pg_temp.as_user('authenticated', :A);
select pg_temp.expect(pg_temp.fails($$select * from public.club_subscriptions$$) or not exists (select 1 from public.club_subscriptions), 'she reads no billing rows directly');
select pg_temp.expect(pg_temp.fails($$select public.account_delete()$$, 'active_membership'), 'account deletion waits while a paid membership is live');
reset role;

-- Lapsed with the join grant: earned kit stays read-only.
update public.club_access_grants set revoked_at = now() where user_id = :A;
update public.club_subscriptions set status = 'canceled', ended_at = now() where user_id = :A;
select pg_temp.as_user('authenticated', :A);
select pg_temp.expect(pg_temp.fails($$select public.club_document_get('2026-11-family-ownership')$$, 'not_found'), 'lapsed, nothing earned: closed');
reset role;
insert into public.club_kit_entitlements (user_id, kit_id, subscription_id, source)
values (:A, (select id from public.club_kits where slug = :KIT), '00000000-0000-0000-0000-000000c1ba05', 'join');
select pg_temp.as_user('authenticated', :A);
select pg_temp.expect(public.club_document_get(:KIT) ->> 'can' = 'read', 'lapsed with the join grant: read-only');
select pg_temp.expect(pg_temp.fails($$select public.club_document_save('2026-11-family-ownership', 'ownership-chart', '{}', 'warm-neutrals', 1, 2, 2)$$, 'read_only'), 'and can''t edit');
reset role;

-- Mailing eligibility is separate from digital access.
update public.club_subscriptions set status = 'active', ended_at = null where user_id = :A;
insert into public.club_mailing_addresses (user_id, name, line1, city, state, postal_code) values (:A, 'Mia A', '1 Main St', 'Town', 'NY', '10001');
insert into public.club_invoices values ('in_1', '00000000-0000-0000-0000-000000c1ba05', 'open', 'subscription_create', 500, 0, 0, now() - interval '2 days', now() + interval '28 days', null, false, now());
update public.club_kits set mailer_cutoff_at = now() + interval '5 days' where slug = :KIT;
select pg_temp.expect(public.club_mailing_eligible('00000000-0000-0000-0000-000000c1ba05', (select id from public.club_kits where slug = :KIT)) is null, 'unpaid invoice: no mailer, even with digital access');
update public.club_invoices set status = 'paid', amount_paid_cents = 500, paid_at = now();
select pg_temp.expect(public.club_mailing_eligible('00000000-0000-0000-0000-000000c1ba05', (select id from public.club_kits where slug = :KIT)) = 'in_1', 'paid invoice covering the cutoff: mailer');
update public.club_invoices set amount_refunded_cents = 500;
select pg_temp.expect(public.club_mailing_eligible('00000000-0000-0000-0000-000000c1ba05', (select id from public.club_kits where slug = :KIT)) is null, 'refunded invoice: no mailer');

-- ---------------------------------------------------------------- accounts integration

select pg_temp.as_user('authenticated', :C);
select pg_temp.expect(pg_temp.fails($$select public.account_put('omc:club:sample', '{"x":1}')$$, 'invalid'), 'Club data never goes into account_saves');
select pg_temp.expect(pg_temp.fails($$select public.account_put('omc:club-sample:a', '{"x":1}')$$, 'invalid'), 'nor sample previews');
select pg_temp.expect(public.account_put('omc:chore-chart:v1', '{"x":1}') is not null, 'ordinary tool saves still work');
reset role;

-- Deleting an account takes the household, family, documents and grant with it.
select pg_temp.as_user('authenticated', :B);
select public.account_delete();
reset role;
select pg_temp.expect(not exists (select 1 from public.club_households where owner_user_id = :B), 'deleting B''s account deletes her household');
select pg_temp.expect((select count(*) from public.club_family_members m join public.club_households h on h.id = m.household_id where h.owner_user_id = :B) = 0, 'and her family');
select pg_temp.expect(not exists (select 1 from public.club_access_grants where user_id = :B), 'and her grant');
select pg_temp.expect(exists (select 1 from public.club_households where owner_user_id = :A), 'A is untouched');

-- Signed-out visitors can call none of the Club's or the account's functions.
select pg_temp.expect(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like 'club\_%' or p.proname like 'account\_%') and has_function_privilege('anon', p.oid, 'execute')),
  'anon can execute no club_ or account_ function');

-- The August and October kits are seeded as drafts, so nobody can open them yet.
select pg_temp.expect((select status from public.club_kits where slug = '2027-08-school-year') = 'draft', 'August is seeded as a draft');
select pg_temp.expect((select status from public.club_kits where slug = '2027-10-home-works-together') = 'draft', 'October is seeded as a draft');
