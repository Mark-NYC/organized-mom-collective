-- Rollback for 20261204_agreement_follow_through ONLY (the same section is at the top of
-- supabase/rollout/household/rollback.sql). Removes the check-in answers families gave (progress, checked_on, barrier)
-- and the two functions; every agreement itself stays exactly as it is. NEVER run without the owner's go.
begin;
drop function if exists public.household_agreement_check_in(uuid, text, text, int);
drop function if exists public.household_follow_through();
drop function if exists public.household_follow_through_json(public.club_responsibilities);
alter table public.club_responsibilities
  drop constraint if exists club_responsibilities_barrier_only_struggling,
  drop constraint if exists club_responsibilities_follow_through_only_confirmed,
  drop column if exists barrier,
  drop column if exists checked_on,
  drop column if exists progress;
commit;
