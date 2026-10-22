-- Access smoke test for docs/club/draft-schema.sql (draft, not part of npm run test:admin-sql).
-- On a throwaway local database: supabase/tests/supabase-stub.sql, every migration, the draft schema, then this.
-- Becomes supabase/tests/club-access.sql in Phase 1. Never run on the real project.
\set ON_ERROR_STOP 1
create function pg_temp.expect(ok boolean, msg text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAIL: %', msg; end if; raise notice 'ok - %', msg; end $$;
create function pg_temp.fails(q text, err text default null) returns boolean language plpgsql as $$
begin execute q; return false;
exception when insufficient_privilege then return err is null; when raise_exception then return err is null or sqlerrm = err; end $$;
create function pg_temp.as_user(p_role text, p_sub text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', case when p_sub is null then '{}' else jsonb_build_object('sub', p_sub)::text end, false);
execute format('set role %I', p_role); end $$;
grant execute on function pg_temp.expect(boolean, text), pg_temp.fails(text, text), pg_temp.as_user(text, text) to public;

insert into auth.users values ('00000000-0000-0000-0000-00000000000a','a@x.com',now()),('00000000-0000-0000-0000-00000000000b','b@x.com',now());
insert into public.club_kits (id, slug, month, title, status, release_at, mailer_cutoff_at) values
 ('00000000-0000-0000-0000-0000000000f1', '2026-11-family-ownership', '2026-11-01', 'Our Family, Our Team', 'scheduled', now() - interval '1 day', now() + interval '5 days');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((public.club_household_save('Team A', '{"palette":"blue-green"}', '[{"first_name":"Mia","kind":"adult","role":"parent"},{"first_name":"Ava","kind":"child","role":"child","birth_year":2019,"birth_month":4}]') -> 'members') is not null, 'A saves her family');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{"evil":1}', '[{"first_name":"X","kind":"adult","role":"parent"}]')$$, 'invalid'), 'unknown preference key refused');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{}', '[{"first_name":"Kid","kind":"child","role":"child"}]')$$, 'invalid'), 'child without birth year refused');
select pg_temp.expect(pg_temp.fails($$select public.club_household_save(null, '{}', '[{"first_name":"A","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"B","kind":"adult","role":"partner","is_account_holder":true}]')$$, 'invalid'), 'only one account holder');
select pg_temp.expect(pg_temp.fails($$insert into public.club_households (owner_user_id) values ('00000000-0000-0000-0000-00000000000a')$$), 'no direct writes');
select pg_temp.expect(pg_temp.fails($$select * from public.club_subscriptions$$) or not exists (select 1 from public.club_subscriptions), 'no subscription rows visible');
select pg_temp.expect((public.club_me() ->> 'access')::boolean = false, 'no access before paying');
select pg_temp.expect(pg_temp.fails($$select public.club_document_get('2026-11-family-ownership')$$, 'not_found'), 'kit closed without membership');
select pg_temp.expect(pg_temp.fails($$select public.club_document_save('2026-11-family-ownership','ownership-chart','{}','warm-neutrals',1,1,0)$$, 'read_only'), 'no saving without membership');
reset role;
insert into public.club_subscriptions (id, stripe_subscription_id, stripe_customer_id, user_id, status, price_id, current_period_start, current_period_end, started_at, livemode)
values ('00000000-0000-0000-0000-0000000000e1', 'sub_A1', 'cus_A1', '00000000-0000-0000-0000-00000000000a', 'active', 'price_1', now() - interval '2 days', now() + interval '28 days', now(), false);
do $$ begin
  insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, started_at, livemode) values ('sub_A2','cus_A1','00000000-0000-0000-0000-00000000000a','active','price_1',now(),false);
  raise exception 'FAIL: second live subscription allowed';
exception when unique_violation then raise notice 'ok - second live subscription refused';
end $$;
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect(public.club_document_get('2026-11-family-ownership') ->> 'can' = 'edit', 'member can edit');
select pg_temp.expect(public.club_document_save('2026-11-family-ownership','ownership-chart','{"hidden":["t1"]}','warm-neutrals',1,1,0) = 1, 'first save');
select pg_temp.expect(public.club_document_save('2026-11-family-ownership','ownership-chart','{"hidden":["t2"]}','warm-neutrals',1,1,1) = 2, 'second save with current revision');
select pg_temp.expect(pg_temp.fails($$select public.club_document_save('2026-11-family-ownership','ownership-chart','{}','warm-neutrals',1,1,1)$$, 'conflict'), 'stale revision refused (second device)');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000b');
select pg_temp.expect(not exists (select 1 from public.club_households), 'B sees no other household');
select pg_temp.expect(not exists (select 1 from public.club_family_members), 'B sees no other children');
select pg_temp.expect(public.club_household() is null, 'B has no household');
select pg_temp.as_user('anon', null);
select pg_temp.expect(pg_temp.fails($$select public.club_me()$$), 'anon cannot call club_me');
reset role;
-- lapsed: canceled with nothing earned → closed; with the join grant → read only
update public.club_subscriptions set status = 'canceled', ended_at = now();
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect(pg_temp.fails($$select public.club_document_get('2026-11-family-ownership')$$, 'not_found'), 'lapsed member without the kit earned: closed');
reset role;
insert into public.club_kit_entitlements (user_id, kit_id, subscription_id, source) values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000e1','join');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect(public.club_document_get('2026-11-family-ownership') ->> 'can' = 'read', 'lapsed member keeps earned kit read-only');
select pg_temp.expect(pg_temp.fails($$select public.club_document_save('2026-11-family-ownership','ownership-chart','{}','warm-neutrals',1,1,2)$$, 'read_only'), 'lapsed member cannot edit');
reset role;
-- mailing eligibility: paid invoice covering cutoff + address
update public.club_subscriptions set status = 'active', ended_at = null;
insert into public.club_mailing_addresses (user_id, name, line1, city, state, postal_code) values ('00000000-0000-0000-0000-00000000000a','Mia A','1 Main St','Town','NY','10001');
insert into public.club_invoices values ('in_1','00000000-0000-0000-0000-0000000000e1','open','subscription_create',500,0,0,now() - interval '2 days', now() + interval '28 days', null, false, now());
select pg_temp.expect(public.club_mailing_eligible('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f1') is null, 'unpaid invoice: no mailer even with digital access');
update public.club_invoices set status = 'paid', amount_paid_cents = 500, paid_at = now();
select pg_temp.expect(public.club_mailing_eligible('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f1') = 'in_1', 'paid invoice covering cutoff: mailer');
update public.club_invoices set amount_refunded_cents = 500;
select pg_temp.expect(public.club_mailing_eligible('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f1') is null, 'refunded invoice: no mailer');
-- earned by invoice: a lapsed member who paid for the release month keeps the kit read-only
delete from public.club_kit_entitlements;
update public.club_kits set release_at = now() - interval '1 day';
update public.club_invoices set amount_refunded_cents = 0, period_start = now() - interval '3 days';
update public.club_subscriptions set status = 'canceled';
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect(public.club_document_get('2026-11-family-ownership') ->> 'can' = 'read', 'paid for the release month: earned, read-only');
reset role;
update public.club_invoices set amount_refunded_cents = 500;
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect(pg_temp.fails($$select public.club_document_get('2026-11-family-ownership')$$, 'not_found'), 'refunded release month: no longer earned');
reset role;
-- a draft or future kit never opens, even for an active member
update public.club_subscriptions set status = 'active';
update public.club_kits set release_at = now() + interval '1 day';
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect(pg_temp.fails($$select public.club_document_get('2026-11-family-ownership')$$, 'not_found'), 'kit before its release time: closed');
reset role;
