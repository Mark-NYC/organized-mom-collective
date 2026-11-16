-- Rolls back ONLY 20261203 (billing for either adult). NEVER run without the owner's go.
-- Order, in one session: this file, then restore-billing-functions.sql (captured with capture-billing.sql BEFORE
-- applying), then: drop function if exists public.club_household_of(uuid);
-- Rehearsed by scripts/rehearse-household-rollback.sh (the fingerprint must equal the one taken before applying).
--
-- What it means for families: a partner who pays goes back to not opening the membership for the household (the
-- pre-20261203 behavior). Nothing is deleted: subscriptions, customers, months (including months already kept for a
-- household) and addresses all stay. If a partner paid while 20261203 was live, tell the owner before rolling back.
begin;
drop trigger if exists household_keep_months on auth.users;
drop function if exists public.household_keep_months_on_delete();
drop function if exists public.household_keep_received_months(uuid, uuid);
drop function if exists public.club_admin_orphan_verify(uuid, text);
drop function if exists public.club_orphans_flag();
drop function if exists public.club_orphaned_subscriptions();
drop function if exists public.club_orphans();
do $$ begin if exists (select 1 from pg_extension where extname = 'pg_cron') then perform cron.unschedule('omc-club-orphans-flag'); end if; exception when others then null; end $$;
update public.club_subscriptions set flags = array_remove(array_remove(flags, 'orphaned'), 'orphan_cancel_verified')
 where flags && array['orphaned', 'orphan_cancel_verified'];
commit;
