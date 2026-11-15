-- No sign-in that can still be charged can be deleted, by any path (proposed policy, docs/ios/OWNERSHIP_AND_BILLING_POLICY.md,
-- points 1-2). NOT APPLIED to production: needs the owner's approval of the policy.
--
-- Today account_delete refuses only while the Club gives paid access (trialing, active, past due). An unpaid, incomplete
-- or paused subscription doesn't block it, and deleting the sign-in anywhere else (dashboard, script) isn't checked at all:
-- the subscription row loses its owner (user_id on delete set null) while Stripe can still charge the card, and nobody
-- can manage it from the app or the website. Recorded in supabase/tests/household-ownership-billing.sql.
--
-- Fix, in the database itself so every path is covered:
--   * account_chargeable(uid): a Club subscription of hers in a status Stripe can still charge or resume.
--   * a BEFORE DELETE trigger on auth.users refusing while it's true ('active_membership'). It fires before
--     household_owner_leaving (triggers fire in name order) and a refusal rolls back the whole delete, so the household
--     handover never half-happens.
--   * account_delete checks it first, so the app/website get the same clear refusal before anything is touched.
-- Billing never moves: no Stripe customer, subscription or payment method is transferred to the other adult. After the
-- owner cancels (Stripe reports canceled / incomplete_expired), deletion works as before and the partner keeps the family
-- on the free plan (20261124).
-- Depends on 20261124 (household_owner_leaving), patched by name only.
begin;

create or replace function public.account_chargeable(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_subscriptions s
    where s.user_id = p_uid
      and s.status in ('trialing', 'active', 'past_due', 'unpaid', 'incomplete', 'paused')
  );
$$;
revoke execute on function public.account_chargeable(uuid) from public, anon, authenticated;

create or replace function public.account_chargeable_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.account_chargeable(old.id) then
    raise exception 'active_membership'
      using hint = 'Cancel the Family Meeting Club membership in Stripe (or the billing portal) before deleting this account.';
  end if;
  return old;
end $$;
revoke execute on function public.account_chargeable_guard() from public, anon, authenticated;

drop trigger if exists account_chargeable_guard on auth.users;
create trigger account_chargeable_guard before delete on auth.users
  for each row execute function public.account_chargeable_guard();

-- account_delete: refuse up front for every chargeable status (the trigger would also stop it, later).
do $$
declare
  src text := pg_get_functiondef('public.account_delete()'::regprocedure);
  old_check text := 'if public.club_has_paid_access(uid) then raise exception ''active_membership''; end if;';
begin
  if position(old_check in src) = 0 then raise exception 'account_delete: membership check not found; not patching'; end if;
  execute replace(src, old_check,
    'if public.club_has_paid_access(uid) or public.account_chargeable(uid) then raise exception ''active_membership''; end if;');
end $$;

commit;
