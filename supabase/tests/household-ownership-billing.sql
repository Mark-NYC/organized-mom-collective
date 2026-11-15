-- Owner deletion and ownership with a Family Meeting Club subscription (owner request 2026-11-15), with the deletion
-- guard (20261129_account_delete_billing_guard, proposed, not applied): no sign-in that can still be charged can be
-- deleted by any path; after canceling, the owner can leave and the partner keeps the family on the free plan; billing is
-- never transferred. Before 20261129 the "guard:" checks failed (the gaps in docs/ios/OWNERSHIP_AND_BILLING_POLICY.md).
-- Throwaway local database only.
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
/** A household with an owner, a partner (by invitation) and a Club subscription in the given status. */
create function pg_temp.family(p_n int, p_status text) returns void language plpgsql as $$
declare
  o uuid := ('00000000-0000-0000-0000-00000b' || lpad(p_n::text, 3, '0') || '001')::uuid;
  pa uuid := ('00000000-0000-0000-0000-00000b' || lpad(p_n::text, 3, '0') || '002')::uuid;
  inv jsonb;
begin
  insert into auth.users (id, email, email_confirmed_at) values (o, 'bill-owner' || p_n || '@example.com', now()), (pa, 'bill-partner' || p_n || '@example.com', now());
  perform set_config('request.jwt.claims', jsonb_build_object('sub', o)::text, true);
  perform public.club_household_save('Bill ' || p_n, '{}', '[{"first_name":"Owner","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Partner","kind":"adult","role":"partner"},{"first_name":"Kid","kind":"child","role":"child","birth_year":2018,"birth_month":1}]');
  inv := public.household_invite_create((select id from public.club_family_members f join public.household_adults a on a.household_id = f.household_id where a.user_id = o and f.first_name = 'Partner'), 'bill-partner' || p_n || '@example.com');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', pa)::text, true);
  perform public.household_invite_accept(inv ->> 'code');
  insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, current_period_end, started_at, livemode)
  values ('sub_billtest' || p_n, 'cus_billtest' || p_n, o, p_status, 'price_test', now() + interval '20 days', now() - interval '10 days', false);
end $$;
\set O1 '''00000000-0000-0000-0000-00000b001001'''
\set P1 '''00000000-0000-0000-0000-00000b001002'''

-- ---------------------------------------------------------------- 1. self-service deletion with an active membership: refused
select pg_temp.family(1, 'active');
select pg_temp.as_user('authenticated', :O1);
select pg_temp.expect(pg_temp.fails($$select public.account_delete()$$, 'active_membership'), 'owner with an active membership can''t delete her account');
reset role;
select pg_temp.expect((select count(*) from auth.users where id = :O1) = 1 and (select owner_user_id from public.club_households h join public.household_adults a on a.household_id = h.id where a.user_id = :P1) = :O1,
  'nothing changed: owner, household and partner as before');
select pg_temp.expect((select user_id from public.club_subscriptions where stripe_subscription_id = 'sub_billtest1') = :O1, 'the subscription still has its owner');
-- The partner can't touch billing: no function reaches the owner's subscription, and the table is closed.
select pg_temp.as_user('authenticated', :P1);
select pg_temp.expect((select count(*) from public.club_subscriptions) = 0, 'partner reads no subscription rows (RLS)');
select pg_temp.expect(pg_temp.fails($$update public.club_subscriptions set cancel_at_period_end = true where true$$), 'partner can''t change the subscription');
select pg_temp.expect(pg_temp.fails($$select public.household_owner_handover('00000000-0000-0000-0000-00000b001001', '00000000-0000-0000-0000-00000b001002')$$), 'partner can''t take ownership (handover isn''t exposed)');
reset role;

-- ---------------------------------------------------------------- 2. self-service deletion in every other chargeable state: refused
select pg_temp.family(2, 'unpaid');
select pg_temp.family(3, 'incomplete');
select pg_temp.family(6, 'paused');
select pg_temp.family(7, 'past_due');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000b002001');
select pg_temp.expect(pg_temp.fails($$select public.account_delete()$$, 'active_membership'), 'guard: an "unpaid" subscription blocks deletion');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000b003001');
select pg_temp.expect(pg_temp.fails($$select public.account_delete()$$, 'active_membership'), 'guard: an "incomplete" (first payment pending) subscription blocks deletion');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000b006001');
select pg_temp.expect(pg_temp.fails($$select public.account_delete()$$, 'active_membership'), 'guard: a "paused" subscription (can resume) blocks deletion');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000b007001');
select pg_temp.expect(pg_temp.fails($$select public.account_delete()$$, 'active_membership'), 'guard: "past_due" blocks deletion');
reset role;
select pg_temp.expect((select count(*) from public.club_subscriptions where stripe_subscription_id in ('sub_billtest2','sub_billtest3','sub_billtest6','sub_billtest7') and user_id is not null) = 4,
  'every refused subscription keeps its owner');
select pg_temp.expect((select count(*) from public.household_adults a join auth.users u on u.id = a.user_id where u.email like 'bill-owner_@example.com' and a.role = 'owner' and u.email in ('bill-owner2@example.com','bill-owner3@example.com','bill-owner6@example.com','bill-owner7@example.com')) = 4,
  'and each still owns her household (no half-done handover)');

-- ---------------------------------------------------------------- 3. deletion outside account_delete (dashboard, script): refused too
select pg_temp.family(4, 'active');
select pg_temp.expect(pg_temp.fails($$delete from auth.users where id = '00000000-0000-0000-0000-00000b004001'$$, 'active_membership'),
  'guard: deleting the sign-in directly is refused while the subscription is active');
select pg_temp.expect((select user_id from public.club_subscriptions where stripe_subscription_id = 'sub_billtest4') = '00000000-0000-0000-0000-00000b004001'
  and (select role from public.household_adults where user_id = '00000000-0000-0000-0000-00000b004001') = 'owner'
  and (select role from public.household_adults where user_id = '00000000-0000-0000-0000-00000b004002') = 'partner',
  'nothing moved: subscription, owner and partner as before');
-- The partner can always leave (they pay for nothing); the owner's membership and the family stay.
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000b004002');
select public.account_delete();
reset role;
select pg_temp.expect((select count(*) from auth.users where id = '00000000-0000-0000-0000-00000b004002') = 0
  and (select status from public.club_subscriptions where stripe_subscription_id = 'sub_billtest4') = 'active'
  and (select count(*) from public.club_family_members f join public.household_adults a on a.household_id = f.household_id where a.user_id = '00000000-0000-0000-0000-00000b004001') = 3,
  'the partner deletes their own account: the owner''s membership and all three family members stay');

-- Cancel, then delete: once Stripe reports the subscription canceled, the owner can leave; the partner keeps the family.
update public.club_subscriptions set status = 'canceled' where stripe_subscription_id = 'sub_billtest2';
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000b002001');
select public.account_delete();
reset role;
select pg_temp.expect((select role from public.household_adults where user_id = '00000000-0000-0000-0000-00000b002002') = 'owner',
  'after canceling, the owner leaves and the partner owns the household');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000b002002');
select pg_temp.expect((public.club_me() ->> 'access')::boolean is false, 'the new owner has no Club access and no billing to manage (nothing was transferred)');
select pg_temp.expect((select count(*) from public.club_subscriptions) = 0, 'and can''t see the old subscription');
reset role;
update public.club_subscriptions set status = 'incomplete_expired' where stripe_subscription_id = 'sub_billtest3';
delete from auth.users where id = '00000000-0000-0000-0000-00000b003001';
select pg_temp.expect((select role from public.household_adults where user_id = '00000000-0000-0000-0000-00000b003002') = 'owner',
  'an expired first payment (incomplete_expired) no longer blocks deletion');

-- ---------------------------------------------------------------- 4. canceled: the owner can leave
select pg_temp.family(5, 'canceled');
select pg_temp.as_user('authenticated', '00000000-0000-0000-0000-00000b005001');
select public.account_delete();
reset role;
select pg_temp.expect((select role from public.household_adults where user_id = '00000000-0000-0000-0000-00000b005002') = 'owner', 'canceled membership: the owner can leave, the partner keeps the family on the free plan');
select pg_temp.expect((select count(*) from public.club_subscriptions where stripe_subscription_id = 'sub_billtest5' and user_id is null) = 1, 'the old subscription stays only as a billing record');
