-- Launch P0, step 5: clear Stripe TEST-MODE Club data so it can't block or confuse real families.
-- Run only with the owner's go-ahead, after cancelling the test subscriptions in the Stripe TEST dashboard.
-- Touches only rows tied to test-mode subscriptions (club_subscriptions.livemode = false). One transaction.
--
--   * Free-month claims of test subscriptions are deleted: they hash the email, mailing address and card used, and
--     any match refuses a real family's free month (the owner's own address is one of them).
--   * Their unprinted Welcome Kit / monthly orders are canceled with a note, so none can reach the print queue.
--   * Accounts, households, families, addresses, saved plans, entitlements and the email log are kept.
-- Refuses to run if any live subscription exists or any order was already approved, printed or mailed.

begin;

do $$
begin
  if exists (select 1 from public.club_subscriptions where livemode) then raise exception 'live subscriptions exist: stop'; end if;
  if exists (select 1 from public.club_fulfillment_orders where status in ('approved', 'printed', 'mailed')) then
    raise exception 'an order is already approved, printed or mailed: stop';
  end if;
end $$;

-- Preview.
select 'claims to delete' as what, count(*) from public.club_intro_claims c
  join public.club_subscriptions s on s.id = c.subscription_id where not s.livemode
union all select 'orders to cancel', count(*) from public.club_fulfillment_orders o
  where o.status in ('pending', 'on_hold') and o.user_id in (select user_id from public.club_subscriptions where not livemode);

delete from public.club_intro_claims c using public.club_subscriptions s where s.id = c.subscription_id and not s.livemode;

update public.club_fulfillment_orders
   set status = 'canceled', note = left(coalesce(note || ' · ', '') || 'Stripe test mode: canceled before launch', 300), updated_at = now()
 where status in ('pending', 'on_hold') and user_id in (select user_id from public.club_subscriptions where not livemode);

-- After.
select 'claims left' as what, count(*) from public.club_intro_claims
union all select 'orders not canceled', count(*) from public.club_fulfillment_orders where status not in ('canceled', 'skipped');

commit;
