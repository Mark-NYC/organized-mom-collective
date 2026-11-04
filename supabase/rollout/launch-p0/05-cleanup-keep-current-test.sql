-- Launch P0: clear Stripe TEST-MODE Club data EXCEPT the account the owner is testing with right now.
-- Same rules as 04-cleanup-test-data.sql; afterwards run 04 itself once the owner's test is finished
-- (her current test claim still hashes her real address and would refuse her own household a free month).
-- Run in the Supabase SQL Editor (or with the owner's live confirmation). One transaction; aborts on any live data.

begin;

create temp table keep_user on commit drop as
  select id from auth.users where lower(email) = 'contact+club-test-11042112b@organizedmomcollective.com';

do $$
begin
  if exists (select 1 from public.club_subscriptions where livemode) then raise exception 'live subscriptions exist: stop'; end if;
  if exists (select 1 from public.club_fulfillment_orders where status in ('approved', 'printed', 'mailed')
               and user_id not in (select id from keep_user)) then
    raise exception 'an order outside the kept test account is approved, printed or mailed: stop';
  end if;
end $$;

-- Preview.
select 'claims to delete' as what, count(*) from public.club_intro_claims c
  join public.club_subscriptions s on s.id = c.subscription_id
 where not s.livemode and s.user_id not in (select id from keep_user)
union all select 'orders to cancel', count(*) from public.club_fulfillment_orders o
 where o.status in ('pending', 'on_hold') and o.user_id not in (select id from keep_user)
   and o.user_id in (select user_id from public.club_subscriptions where not livemode);

delete from public.club_intro_claims c using public.club_subscriptions s
 where s.id = c.subscription_id and not s.livemode and s.user_id not in (select id from keep_user);

update public.club_fulfillment_orders
   set status = 'canceled', note = left(coalesce(note || ' · ', '') || 'Stripe test mode: canceled before launch', 300), updated_at = now()
 where status in ('pending', 'on_hold') and user_id not in (select id from keep_user)
   and user_id in (select user_id from public.club_subscriptions where not livemode);

-- After: only the kept account's claim and orders remain open.
select 'claims left' as what, count(*) from public.club_intro_claims
union all select 'orders not canceled', count(*) from public.club_fulfillment_orders where status not in ('canceled', 'skipped');

commit;
