-- Billing protections for a two-adult household (owner decisions 2026-11-16; docs/ios/OWNERSHIP_AND_BILLING_POLICY.md).
--
-- NOT APPLIED. Depends on 20261121–23, 20261124, 20261128 and 20261129. Changes how existing billing functions find
-- "the member's household", so it is its own session in docs/ios/MIGRATION_DEPLOYMENT_PLAN.md and needs the owner's go.
--
-- 1. A paid membership held by EITHER adult is the household's.
--    Until now everything resolved the household through its owner (club_households.owner_user_id). If the other adult
--    paid, the Stripe webhook created a second, empty household for them: their months attached to it, the family they
--    share saw nothing, and their mailing would have printed for a household with no family.
--    Now: club_household_of(user) is the household that person belongs to (as owner or partner), and
--    household_billing_user(user) is the adult of that household whose membership opens it: whoever has Club access,
--    the owner when both or neither do. Billing itself never moves: the subscription, Stripe customer, mailing address
--    and print approvals stay with the adult who pays.
-- 2. The household keeps the months it already received. When the adult who held them deletes their account, leaves
--    or is removed, the released digital months are re-granted to the other adult (plan 'admin', with a note), so the
--    family can still read and print them. No billing record, mailing or future month is transferred.
-- 3. An orphaned-subscription safety net that never cancels by itself: club_orphaned_subscriptions() lists live
--    subscriptions with no account behind them (and households paying twice); club_orphans_flag() marks them daily;
--    an admin must verify each one (club_admin_orphan_verify) before anything may cancel it in Stripe.
-- Not here (deferred until after launch): voluntary ownership transfer.
--
-- Functions are patched from their live definitions (exact text, or the migration stops), never retyped.
begin;

-- ---------------------------------------------------------------- resolvers

-- The household a person belongs to: as one of its adults, else the one they own (before they have any adults row).
create function public.club_household_of(p_uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(public.household_id_for(p_uid), (select h.id from public.club_households h where h.owner_user_id = p_uid))
$$;
revoke execute on function public.club_household_of(uuid) from public, anon, authenticated;

-- Whose membership this person uses: the adult of their household with Club access (the owner when both or neither
-- have it; then anyone holding months); themself when they have no household.
create or replace function public.household_billing_user(p_uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select a.user_id from public.household_adults a
     where a.household_id = public.household_id_for(p_uid)
     order by public.club_has_access(a.user_id) desc,
              exists (select 1 from public.club_entitlements e where e.user_id = a.user_id and e.revoked_at is null) desc,
              (a.role = 'owner') desc
     limit 1), p_uid);
$$;
revoke execute on function public.household_billing_user(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- every billing function finds the household the same way

do $$
declare
  fn text;
  d text;
  patched text;
  r text[];
  -- [old, new]: the household "owned by" someone becomes the household they belong to.
  swaps constant text[][] := array[
    ['h.owner_user_id = uid', 'h.id = public.club_household_of(uid)'],
    ['owner_user_id = uid', 'id = public.club_household_of(uid)'],
    ['h.owner_user_id = p_user', 'h.id = public.club_household_of(p_user)'],
    ['owner_user_id = p_user', 'id = public.club_household_of(p_user)'],
    ['owner_user_id = sub.user_id', 'id = public.club_household_of(sub.user_id)'],
    ['h.owner_user_id = auth.uid()', 'h.id = public.club_household_of(auth.uid())'],
    ['owner_user_id = auth.uid()', 'id = public.club_household_of(auth.uid())']];
begin
  foreach fn in array array[
    'public.club_admin_entitlement_service(uuid, uuid, date, text, text, text)', 'public.club_customer_email(uuid, text)',
    'public.club_document_get(text)', 'public.club_document_save(text, text, jsonb, text, integer, integer, integer)',
    'public.club_fulfillment_approve(text)', 'public.club_intro_grant(text, text)', 'public.club_invoice_apply(jsonb, jsonb)',
    'public.club_me_for(uuid)', 'public.club_meeting_guide_mark()', 'public.club_meeting_guide_seen()',
    'public.club_resource_get(text)', 'public.club_resource_save(text, jsonb, integer)',
    'public.club_welcome_item_of(uuid)', 'public.club_welcome_plan_access(uuid)',
    'public.club_welcome_plan_approve(integer, text, jsonb)', 'public.club_welcome_plan_get()',
    'public.club_welcome_plan_save(jsonb, integer)', 'public.club_welcome_plan_unapprove(integer)'
  ] loop
    d := pg_get_functiondef(fn::regprocedure);
    patched := d;
    foreach r slice 1 in array swaps loop patched := replace(patched, r[1], r[2]); end loop;
    if patched = d then raise exception 'household billing: % no longer resolves a household by its owner', fn; end if;
    if position('owner_user_id' in patched) > 0 then raise exception 'household billing: % still reads owner_user_id after patching', fn; end if;
    execute patched;
  end loop;

  -- The admin's member list and the email audience report each household under the adult who pays.
  foreach fn in array array['public.club_admin_members(text, date)', 'public.club_email_audience(text, date)'] loop
    d := pg_get_functiondef(fn::regprocedure);
    patched := replace(d, 'h.owner_user_id', 'public.household_billing_user(h.owner_user_id)');
    if patched = d then raise exception 'household billing: % has no h.owner_user_id', fn; end if;
    execute patched;
  end loop;
end $$;

-- A first payment no longer makes a second household for someone who already shares one.
do $$
declare
  d text := pg_get_functiondef('public.club_member_link(uuid, text, text, boolean)'::regprocedure);
  old_ text := E'  insert into public.club_households (owner_user_id, billing_email) values (p_user, lower(btrim(p_email)))\n  on conflict (owner_user_id) do update set billing_email = coalesce(club_households.billing_email, excluded.billing_email)\n  returning id into hid;';
  patched text;
begin
  patched := replace(d, old_, E'  hid := public.household_id_for(p_user);\n  if hid is null then\n  ' || old_ || E'\n  end if;');
  if patched = d then raise exception 'club_member_link: household insert not found; not patched'; end if;
  execute patched;
end $$;

-- What gets printed and mailed, and where, is decided by the adult who pays: not by the other adult, whichever of the
-- two set the family up.
do $$
declare
  fn text;
  d text;
  patched text;
  guard constant text := E'if uid is null then raise exception ''not_signed_in''; end if;\n  if public.household_billing_user(uid) <> uid then raise exception ''owner_only''; end if;';
begin
  foreach fn in array array['public.club_fulfillment_approve(text)', 'public.club_welcome_plan_approve(integer, text, jsonb)', 'public.club_welcome_plan_unapprove(integer)'] loop
    d := pg_get_functiondef(fn::regprocedure);
    patched := replace(d, 'if uid is null then raise exception ''not_signed_in''; end if;', guard);
    if patched = d then raise exception 'household billing: % has no sign-in check to extend', fn; end if;
    execute patched;
  end loop;
  d := pg_get_functiondef('public.club_address_save(jsonb)'::regprocedure);
  patched := replace(d, 'if exists (select 1 from public.household_adults where user_id = uid and role = ''partner'') then raise exception ''owner_only''; end if;',
                        'if public.household_billing_user(uid) <> uid then raise exception ''owner_only''; end if;');
  if patched = d then raise exception 'club_address_save: partner check not found; not patched'; end if;
  execute patched;
end $$;

-- club_me: the adult who pays sees the full membership view; the other adult sees what the household can open, with
-- their real role, and nothing about billing.
do $$
declare
  d text := pg_get_functiondef('public.club_me()'::regprocedure);
  patched text;
begin
  patched := replace(d, '''household_role'', ''partner'',', '''household_role'', (select a.role from public.household_adults a where a.user_id = me), ''payer'', false,');
  if patched = d then raise exception 'club_me: unexpected definition, not patched'; end if;
  execute patched;
end $$;

-- ---------------------------------------------------------------- the household keeps the months it received

-- Re-grant the leaving adult's released digital months to the other adult of the same household. Returns how many.
create function public.household_keep_received_months(p_leaving uuid, p_household uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  other uuid;
  n int;
begin
  select a.user_id into other from public.household_adults a
   where a.household_id = p_household and a.user_id <> p_leaving order by (a.role = 'owner') desc limit 1;
  if other is null then return 0; end if;
  insert into public.club_entitlements (user_id, household_id, resource_month, kit_id, kind, membership_year, plan, source, note)
  select other, p_household, e.resource_month, e.kit_id, 'digital', e.membership_year, 'admin', 'admin',
         'Kept for the household: received while the other grown-up was the member.'
    from public.club_entitlements e
   where e.user_id = p_leaving and e.household_id = p_household and e.revoked_at is null and e.kind = 'digital'
     and e.resource_month <= date_trunc('month', now())::date
  on conflict (user_id, resource_month, kind) where revoked_at is null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.household_keep_received_months(uuid, uuid) from public, anon, authenticated;

-- Deleting a sign-in (any path): before the household changes hands and the leaving adult's rows cascade away.
-- Fires after account_chargeable_guard and before household_owner_leaving (triggers fire in name order).
create function public.household_keep_months_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  select household_id into hid from public.household_adults where user_id = old.id;
  if hid is not null then perform public.household_keep_received_months(old.id, hid); end if;
  return old;
end $$;
revoke execute on function public.household_keep_months_on_delete() from public, anon, authenticated;
create trigger household_keep_months before delete on auth.users
  for each row execute function public.household_keep_months_on_delete();

-- Leaving or being removed: the same, then the access ends as before (bodies otherwise as in 20261124).
create or replace function public.household_partner_remove() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.household_adults%rowtype;
  partner uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into me from public.household_adults where user_id = auth.uid();
  if not found or me.role <> 'owner' then raise exception 'owner_only'; end if;
  select user_id into partner from public.household_adults where household_id = me.household_id and role = 'partner';
  if partner is not null then perform public.household_keep_received_months(partner, me.household_id); end if;
  delete from public.household_adults where household_id = me.household_id and role = 'partner';
end $$;

create or replace function public.household_leave() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.household_adults%rowtype;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into me from public.household_adults where user_id = auth.uid();
  if not found then return; end if;
  if me.role = 'owner' then raise exception 'owner_cannot_leave'; end if;
  perform public.household_keep_received_months(auth.uid(), me.household_id);
  delete from public.household_adults where user_id = auth.uid() and role = 'partner';
end $$;

-- ---------------------------------------------------------------- orphaned subscriptions: found and flagged, never cancelled here

-- Live subscriptions nobody can manage (the account is gone), and households where both adults are paying.
create function public.club_orphans() returns table (subscription_id uuid, stripe_subscription_id text, status text, problem text, verified boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.stripe_subscription_id, s.status, 'no_account', 'orphan_cancel_verified' = any (s.flags)
    from public.club_subscriptions s
   where s.status in ('trialing', 'active', 'past_due', 'unpaid', 'incomplete', 'paused')
     and (s.user_id is null or not exists (select 1 from auth.users u where u.id = s.user_id))
  union all
  select s.id, s.stripe_subscription_id, s.status, 'household_pays_twice', false
    from public.club_subscriptions s
    join public.household_adults a on a.user_id = s.user_id
   where s.status in ('trialing', 'active', 'past_due')
     and exists (select 1 from public.household_adults b join public.club_subscriptions s2 on s2.user_id = b.user_id
                  where b.household_id = a.household_id and b.user_id <> a.user_id and s2.status in ('trialing', 'active', 'past_due'))
$$;
revoke execute on function public.club_orphans() from public, anon, authenticated;

-- The admin's list.
create function public.club_orphaned_subscriptions() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'not_admin'; end if;
  return coalesce((select jsonb_agg(to_jsonb(o)) from public.club_orphans() o), '[]');
end $$;
revoke execute on function public.club_orphaned_subscriptions() from public, anon;
grant execute on function public.club_orphaned_subscriptions() to authenticated;

-- Daily: mark them on the subscription row (the admin's subscription list shows flags). Returns how many are flagged.
create function public.club_orphans_flag() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.club_subscriptions s set flags = array_remove(s.flags, 'orphaned')
   where 'orphaned' = any (s.flags) and not exists (select 1 from public.club_orphans() o where o.subscription_id = s.id and o.problem = 'no_account');
  update public.club_subscriptions s set flags = array_append(s.flags, 'orphaned')
   where not ('orphaned' = any (s.flags)) and exists (select 1 from public.club_orphans() o where o.subscription_id = s.id and o.problem = 'no_account');
  select count(*) into n from public.club_subscriptions where 'orphaned' = any (flags);
  return n;
end $$;
revoke execute on function public.club_orphans_flag() from public, anon, authenticated;
grant execute on function public.club_orphans_flag() to service_role;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('omc-club-orphans-flag', '23 4 * * *', 'select public.club_orphans_flag()');
  end if;
end $$;

-- A person looked at it and says: yes, cancel this one. Nothing in the database or the webhook cancels a live
-- subscription without this mark; with it, the cancellation is still an explicit step (Stripe dashboard today).
create function public.club_admin_orphan_verify(p_subscription uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin('owner') then raise exception 'not_admin'; end if;
  if p_note is null or char_length(btrim(p_note)) < 5 then raise exception 'invalid'; end if;
  if not exists (select 1 from public.club_orphans() o where o.subscription_id = p_subscription and o.problem = 'no_account') then raise exception 'not_orphaned'; end if;
  update public.club_subscriptions set flags = array_append(flags, 'orphan_cancel_verified')
   where id = p_subscription and not ('orphan_cancel_verified' = any (flags));
  perform public.admin_log('club_orphan_verify', p_subscription::text, jsonb_build_object('note', left(btrim(p_note), 300)));
end $$;
revoke execute on function public.club_admin_orphan_verify(uuid, text) from public, anon;
grant execute on function public.club_admin_orphan_verify(uuid, text) to authenticated;

commit;
