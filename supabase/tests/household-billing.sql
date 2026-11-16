-- A membership held by either adult, months the household keeps, orphaned subscriptions
-- (supabase/migrations/20261203000000_household_billing_either_adult.sql). Throwaway local database only.
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
-- A two-adult household: the owner sets it up, the partner joins by invitation. Returns the household.
create function pg_temp.family(p_owner uuid, p_partner uuid, p_partner_email text, p_name text) returns uuid language plpgsql as $$
declare inv jsonb; hid uuid;
begin
  perform pg_temp.as_user('authenticated', p_owner::text);
  perform public.club_household_save(p_name, '{}',
    '[{"first_name":"Ann","kind":"adult","role":"parent","is_account_holder":true},{"first_name":"Ben","kind":"adult","role":"partner"}]');
  select household_id into hid from public.household_adults where user_id = p_owner;
  inv := public.household_invite_create((select id from public.club_family_members where household_id = hid and first_name = 'Ben'), p_partner_email);
  perform pg_temp.as_user('authenticated', p_partner::text);
  perform public.household_invite_accept(inv ->> 'code');
  reset role;
  return hid;
end $$;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000b1001', 'hb-owner-a@example.com', now()),
  ('00000000-0000-0000-0000-0000000b1002', 'hb-partner-a@example.com', now()),
  ('00000000-0000-0000-0000-0000000b1003', 'hb-owner-b@example.com', now()),
  ('00000000-0000-0000-0000-0000000b1004', 'hb-partner-b@example.com', now()),
  ('00000000-0000-0000-0000-0000000b1005', 'hb-owner-c@example.com', now()),
  ('00000000-0000-0000-0000-0000000b1006', 'hb-partner-c@example.com', now()),
  ('00000000-0000-0000-0000-0000000b1007', 'hb-admin@example.com', now()),
  ('00000000-0000-0000-0000-0000000b1008', 'hb-gone@example.com', now());
\set OA '''00000000-0000-0000-0000-0000000b1001'''
\set PA '''00000000-0000-0000-0000-0000000b1002'''
\set OB '''00000000-0000-0000-0000-0000000b1003'''
\set PB '''00000000-0000-0000-0000-0000000b1004'''
\set OC '''00000000-0000-0000-0000-0000000b1005'''
\set PC '''00000000-0000-0000-0000-0000000b1006'''
\set ADMIN '''00000000-0000-0000-0000-0000000b1007'''
\set GONE '''00000000-0000-0000-0000-0000000b1008'''
insert into public.admin_users (user_id, role) values (:ADMIN, 'owner') on conflict do nothing;
-- "This month" is a delivered month; February 2027 stands for one that hasn't come yet (moved a year out if it has).
select date_trunc('month', now())::date as this_month, (date_trunc('month', now()) + interval '5 months')::date as later_month \gset
\set SLUG '''2027-02-better-together'''
update public.club_kits set status = 'scheduled', release_at = least(release_at, now()), month = :'this_month' where slug = :SLUG
  and not exists (select 1 from public.club_kits where month = :'this_month' and slug <> :SLUG);
update public.club_kits set status = 'scheduled', release_at = least(release_at, now()) where month = :'this_month';
select slug as kit from public.club_kits where month = :'this_month' \gset

select pg_temp.family(:OA, :PA, 'hb-partner-a@example.com', 'The As') as hid_a \gset
select pg_temp.family(:OB, :PB, 'hb-partner-b@example.com', 'The Bs') as hid_b \gset
select pg_temp.family(:OC, :PC, 'hb-partner-c@example.com', 'The Cs') as hid_c \gset

-- ================================================================ the partner pays
select public.club_member_link(:PA, 'hb-partner-a@example.com', 'cus_hbPartnerA', false) as link \gset
select pg_temp.expect((:'link'::jsonb ->> 'household_id')::uuid = :'hid_a', 'partner pays: the payment is linked to the household they share');
select pg_temp.expect(not exists (select 1 from public.club_households where owner_user_id = :PA), 'partner pays: no second household is made for them');
select pg_temp.expect((select household_id from public.club_customers where stripe_customer_id = 'cus_hbPartnerA') = :'hid_a', 'partner pays: the Stripe customer belongs to the shared household');
insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, started_at, livemode, household_id, plan)
  values ('sub_hbPartnerA', 'cus_hbPartnerA', :PA, 'active', 'price_test', now(), false, :'hid_a', 'monthly');
insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note) values
  (:PA, :'hid_a', :'this_month', 'digital', 1, 'admin', 'admin', 'household billing test'),
  (:PA, :'hid_a', :'later_month', 'digital', 1, 'admin', 'admin', 'household billing test: not delivered yet');
select pg_temp.expect(public.household_billing_user(:OA) = :PA and public.household_billing_user(:PA) = :PA, 'the household''s membership is the partner''s, for both adults');
select pg_temp.expect(public.club_household_of(:PA) = :'hid_a' and public.club_household_of(:OA) = :'hid_a', 'both adults resolve to the one household');

-- The owner, who doesn't pay: everything the household can open, nothing about billing.
select pg_temp.as_user('authenticated', :OA);
create temp table ome as select public.club_me() as m;
select pg_temp.expect((select (m ->> 'access')::boolean from ome), 'non-paying owner: Club access through the partner''s membership');
select pg_temp.expect((select m ->> 'household_role' = 'owner' and (m ->> 'payer')::boolean is false from ome), 'non-paying owner: still the owner, told she isn''t the payer');
select pg_temp.expect((select m -> 'plan' = 'null'::jsonb and m -> 'renews' = 'null'::jsonb and m -> 'has_address' = 'null'::jsonb from ome), 'non-paying owner: no plan, renewal or address');
select pg_temp.expect((public.club_resource_get(:'kit') ->> 'can') = 'edit', 'non-paying owner opens the month');
select pg_temp.expect(public.club_resource_save(:'kit', '{"omc:club:x":"{\"by\":\"owner\"}"}', 0) = 1, 'non-paying owner edits the household''s copy');
select pg_temp.expect(pg_temp.fails($$select public.club_address_save('{"name":"H","line1":"1 A St","city":"X","state":"NY","postal_code":"10001"}')$$, 'owner_only'), 'non-paying owner can''t set the mailing address');
select pg_temp.expect(pg_temp.fails(format('select public.club_fulfillment_approve(%L)', :'kit'), 'owner_only'), 'non-paying owner can''t approve the print');
select pg_temp.expect(pg_temp.fails($$select public.club_welcome_plan_approve(1, 'x', '{}')$$, 'owner_only'), 'non-paying owner can''t approve the Family Rhythm print');
-- The partner, who pays: the full member view, on the same household copy.
select pg_temp.as_user('authenticated', :PA);
create temp table pme as select public.club_me() as m;
select pg_temp.expect((select (m ->> 'access')::boolean and m ->> 'plan' is not null and m ->> 'status' = 'active' from pme), 'paying partner: the full membership view');
select pg_temp.expect((public.club_resource_get(:'kit') -> 'state' ->> 'omc:club:x') is not null, 'paying partner sees the owner''s edit: one household copy');
select pg_temp.expect(not pg_temp.fails($$select public.club_address_save('{"name":"H","line1":"1 A St","city":"X","state":"NY","postal_code":"10001"}')$$), 'paying partner sets the mailing address');
reset role;
select pg_temp.expect((select count(*) from public.club_resource_versions where household_id = :'hid_a') = 1, 'the month is stored once, for the shared household');

-- ================================================================ the household keeps what it received
-- (a) the paying partner leaves
select pg_temp.as_user('authenticated', :PA);
select public.household_leave();
reset role;
select pg_temp.expect(exists (select 1 from public.club_entitlements where user_id = :OA and household_id = :'hid_a' and resource_month = :'this_month'
                                and kind = 'digital' and revoked_at is null and plan = 'admin' and note like 'Kept for the household%'),
  'partner leaves: the delivered month stays with the household');
select pg_temp.expect(not exists (select 1 from public.club_entitlements where user_id = :OA and resource_month = :'later_month'), 'partner leaves: a month not delivered yet is not handed over');
select pg_temp.expect((select user_id from public.club_subscriptions where stripe_subscription_id = 'sub_hbPartnerA') = :PA
  and (select user_id from public.club_customers where stripe_customer_id = 'cus_hbPartnerA') = :PA, 'partner leaves: the subscription and customer stay theirs');
select pg_temp.expect(not public.club_has_access(:OA), 'partner leaves: the owner has no membership of her own');
select pg_temp.as_user('authenticated', :OA);
select pg_temp.expect((public.club_resource_get(:'kit') -> 'state' ->> 'omc:club:x') is not null, 'partner leaves: the owner still opens the month, with the family''s work');
reset role;

-- (b) the owner removes a partner who held the months
insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note)
  values (:PB, :'hid_b', :'this_month', 'digital', 1, 'admin', 'admin', 'household billing test');
select pg_temp.as_user('authenticated', :OB);
select public.household_partner_remove();
reset role;
select pg_temp.expect(exists (select 1 from public.club_entitlements where user_id = :OB and household_id = :'hid_b' and resource_month = :'this_month' and revoked_at is null),
  'partner removed: the delivered month stays with the household');
select pg_temp.expect(not exists (select 1 from public.household_adults where user_id = :PB), 'partner removed: they are out of the household');

-- (c) the owner who held the months deletes her account
insert into public.club_entitlements (user_id, household_id, resource_month, kind, membership_year, plan, source, note)
  values (:OC, :'hid_c', :'this_month', 'digital', 1, 'admin', 'admin', 'household billing test');
delete from auth.users where id = :OC;
select pg_temp.expect((select role from public.household_adults where user_id = :PC) = 'owner' and (select owner_user_id from public.club_households where id = :'hid_c') = :PC,
  'owner deletes her account: the other adult now owns the household');
select pg_temp.expect(exists (select 1 from public.club_entitlements where user_id = :PC and household_id = :'hid_c' and resource_month = :'this_month' and revoked_at is null),
  'owner deletes her account: the delivered month stays with the household');
select pg_temp.as_user('authenticated', :PC);
select pg_temp.expect((public.club_resource_get(:'kit') ->> 'can') = 'read', 'owner deletes her account: the other adult still opens the month (read-only without a membership)');
reset role;
-- Keeping is idempotent and never duplicates.
select pg_temp.expect(public.household_keep_received_months(:PB, :'hid_b') = 0, 'keeping twice adds nothing');
-- A live subscription still blocks deletion (20261129): nothing here loosens that.
select pg_temp.expect(pg_temp.fails(format('delete from auth.users where id = %L', :PA)), 'an account with a live subscription still can''t be deleted');

-- ================================================================ orphaned subscriptions
select pg_temp.expect(not exists (select 1 from public.club_orphans()), 'no orphans to start with');
insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, started_at, livemode)
  values ('sub_hbOrphan', 'cus_hbOrphan', null, 'active', 'price_test', now(), false),
         ('sub_hbEnded', 'cus_hbEnded', null, 'canceled', 'price_test', now(), false);
select id as orphan from public.club_subscriptions where stripe_subscription_id = 'sub_hbOrphan' \gset
select id as live from public.club_subscriptions where stripe_subscription_id = 'sub_hbPartnerA' \gset
select pg_temp.expect((select count(*) = 1 and bool_and(problem = 'no_account' and stripe_subscription_id = 'sub_hbOrphan' and not verified) from public.club_orphans()),
  'a live subscription with no account is listed; an ended one is not');
select pg_temp.expect(public.club_orphans_flag() = 1, 'the daily job counts one orphan');
select pg_temp.expect((select 'orphaned' = any (flags) from public.club_subscriptions where id = :'orphan'), 'the daily job flags it');
select pg_temp.expect((select status = 'active' and canceled_at is null and ended_at is null from public.club_subscriptions where id = :'orphan'), 'flagging cancels nothing');
select public.club_orphans_flag();
select pg_temp.expect((select array_length(flags, 1) = 1 from public.club_subscriptions where id = :'orphan'), 'flagging twice flags once');
-- Only an owner-admin can list or verify; verification needs a real orphan and a reason.
select pg_temp.as_user('authenticated', :OA);
select pg_temp.expect(pg_temp.fails('select public.club_orphaned_subscriptions()', 'not_admin'), 'a member can''t list orphans');
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_orphan_verify(%L, %L)', :'orphan', 'looked at it'), 'not_admin'), 'a member can''t verify one');
select pg_temp.expect(pg_temp.fails('select public.club_orphans_flag()'), 'a member can''t run the flagging job');
select pg_temp.as_user('authenticated', :ADMIN);
select pg_temp.expect(jsonb_array_length(public.club_orphaned_subscriptions()) = 1, 'the admin sees the orphan');
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_orphan_verify(%L, %L)', :'orphan', 'ok'), 'invalid'), 'verifying needs a written reason');
select pg_temp.expect(pg_temp.fails(format('select public.club_admin_orphan_verify(%L, %L)', :'live', 'checked in Stripe'), 'not_orphaned'), 'a subscription with an account behind it can''t be marked for cancelling');
select public.club_admin_orphan_verify(:'orphan', 'Checked in Stripe: account deleted, no reply to two emails.');
select public.club_admin_orphan_verify(:'orphan', 'Checked again, same.');
reset role;
select pg_temp.expect((select flags @> array['orphaned', 'orphan_cancel_verified'] and array_length(flags, 1) = 2 from public.club_subscriptions where id = :'orphan'), 'verified once, by a person');
select pg_temp.expect((select verified from public.club_orphans() where subscription_id = :'orphan'), 'the list shows it as verified');
select pg_temp.expect((select status = 'active' and canceled_at is null from public.club_subscriptions where id = :'orphan'), 'verifying cancels nothing either: cancelling stays an explicit step');
select pg_temp.expect((select count(*) from public.admin_audit_log where action = 'club_orphan_verify') = 2, 'each verification is in the admin log');
-- Once Stripe reports it ended, the flag clears.
update public.club_subscriptions set status = 'canceled', ended_at = now() where id = :'orphan';
select pg_temp.expect(public.club_orphans_flag() = 0 and not exists (select 1 from public.club_orphans()), 'an ended subscription is no longer an orphan');
-- A household where both adults pay is listed (for a refund conversation), never flagged for cancelling.
insert into public.household_adults (household_id, user_id, role) values (:'hid_a', :PA, 'partner');
insert into public.club_subscriptions (stripe_subscription_id, stripe_customer_id, user_id, status, price_id, started_at, livemode, household_id)
  values ('sub_hbOwnerA', 'cus_hbOwnerA', :OA, 'active', 'price_test', now(), false, :'hid_a');
select pg_temp.expect((select count(*) = 2 and bool_and(problem = 'household_pays_twice') from public.club_orphans()), 'both adults paying: both subscriptions listed');
select pg_temp.expect(public.club_orphans_flag() = 0, 'both adults paying: nothing flagged as orphaned');
select pg_temp.expect(public.household_billing_user(:PA) = :OA, 'both adults paying: the household uses the owner''s membership');
