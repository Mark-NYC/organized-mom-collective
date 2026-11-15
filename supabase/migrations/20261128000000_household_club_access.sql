-- Family Meeting Club for the whole household (owner decision 2026-11-15; docs/ios/MIGRATION_PLAN.md → 8).
--
-- NOT applied to production. Depends on 20261121–23 (club_me's current definition, the Family Rhythm functions) and
-- 20261124 (household_adults, household_id_for).
--
-- Both grown-ups of a household use the household's Club entitlement: open, edit and print the months the household
-- holds, and its Family Rhythm. Only the paying owner manages billing, the subscription, the mailing address, account
-- ownership, and what gets printed and mailed (approvals of the monthly print, the Welcome Kit and its Family Meeting
-- guide review, the Vision print).
--
-- How: entitlements stay rows for the paying account (nothing about billing moves). One resolver,
-- household_billing_user(uid), answers "whose membership does this person use": the household owner for either adult,
-- the person themself otherwise. The member-content functions use it; every owner-only function is left exactly as
-- it is (it keeps resolving auth.uid() as the owner, so a partner gets 'not_found' / 'no_household' as before).
-- Functions are patched from their live definitions (one exact text match each, or the migration stops), never
-- retyped, so nothing in 20261121–23 is lost.

create function public.household_billing_user(p_uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select h.owner_user_id from public.household_adults a join public.club_households h on h.id = a.household_id
      where a.user_id = p_uid),
    p_uid);
$$;
revoke execute on function public.household_billing_user(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- content: both adults, the household's entitlement

do $$
declare
  fn text;
  d text;
  patched text;
begin
  foreach fn in array array[
    'public.club_resource_get(text)',
    'public.club_resource_save(text, jsonb, integer)',
    'public.club_document_get(text)',
    'public.club_document_save(text, text, jsonb, text, integer, integer, integer)',
    'public.club_welcome_plan_get()',
    'public.club_welcome_plan_save(jsonb, integer)'
  ] loop
    d := pg_get_functiondef(fn::regprocedure);
    patched := replace(d, 'uid uuid := auth.uid();', 'uid uuid := public.household_billing_user(auth.uid());');
    if patched = d then raise exception 'household club access: % no longer declares uid := auth.uid()', fn; end if;
    execute patched;
  end loop;
end $$;

-- ---------------------------------------------------------------- club_me: the owner's view unchanged; a partner's without billing

-- club_me as it is today, for a given account (generated from the live definition).
do $$
declare
  d text := pg_get_functiondef('public.club_me()'::regprocedure);
  patched text;
begin
  patched := replace(replace(d, 'FUNCTION public.club_me()', 'FUNCTION public.club_me_for(p_uid uuid)'),
                     'uid uuid := auth.uid();', 'uid uuid := p_uid;');
  if patched = d or position('club_me_for(p_uid uuid)' in patched) = 0 or position('uid uuid := p_uid;' in patched) = 0 then
    raise exception 'club_me: unexpected definition, not patched';
  end if;
  execute patched;
end $$;
revoke execute on function public.club_me_for(uuid) from public, anon, authenticated;

create or replace function public.club_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  payer uuid;
  r jsonb;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  payer := public.household_billing_user(me);
  r := public.club_me_for(payer);
  if payer = me then return r; end if; -- the owner, or someone with no household: exactly as before
  -- The other adult: what the household can open, nothing about billing, the address, the welcome items or mailings.
  return jsonb_build_object(
    'household_role', 'partner',
    'access', r -> 'access', 'member', r -> 'member', 'onboarded', r -> 'onboarded', 'revoked', r -> 'revoked',
    'current_month', r -> 'current_month', 'membership_year', r -> 'membership_year',
    'kits', r -> 'kits',
    'months', coalesce((select jsonb_agg(m - 'mailing' - 'plan' - 'free') from jsonb_array_elements(r -> 'months') m), '[]'),
    'intro', null, 'grant', null, 'plan', null, 'status', null, 'payment_problem', false, 'renews', null, 'ends', null,
    'ended_at', null, 'has_address', null, 'enrolled_at', null, 'first_paid_month', null, 'welcome', null, 'next', null);
end $$;
revoke execute on function public.club_me() from public, anon;
grant execute on function public.club_me() to authenticated;

-- ---------------------------------------------------------------- owner only: the mailing address

-- Mailings go to the paying owner's address. A partner can't create or change one (it would never be used, and the
-- owner alone manages where the household's mail goes).
do $$
declare
  d text := pg_get_functiondef('public.club_address_save(jsonb)'::regprocedure);
  marker text := E'if uid is null then raise exception ''not_signed_in''; end if;\n  if p is null';
  patched text;
begin
  patched := replace(d, marker, E'if uid is null then raise exception ''not_signed_in''; end if;\n  if exists (select 1 from public.household_adults where user_id = uid and role = ''partner'') then raise exception ''owner_only''; end if;\n  if p is null');
  if patched = d then raise exception 'club_address_save: unexpected definition, not patched'; end if;
  execute patched;
end $$;
