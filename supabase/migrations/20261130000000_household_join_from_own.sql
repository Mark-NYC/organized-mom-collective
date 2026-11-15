-- Joining the other grown-up's family from an account that already has one (docs/ios/MIGRATION_PLAN.md → 10).
--
-- NOT APPLIED. Depends on 20261124000000_household_shared.sql. Additive: two new functions, nothing existing changes.
--
-- The dead end this closes: Our Week sends a signed-in account with no family straight to "Set up your family". A
-- partner who installs the app before opening the invitation does exactly that, and becomes the owner of a second,
-- separate household. From then on household_invite_accept refuses ('already_in_household'), household_leave
-- refuses ('owner_cannot_leave'), and the only way to the family they were invited to is deleting their account.
-- Two adults, two households, nothing shared: the opposite of the product.
--
--   household_invite_preview(code)         read-only: what accepting this invitation means for the caller.
--   household_invite_accept_leaving(code)  accept it, leaving the caller's current household first:
--       a partner elsewhere  → their access there ends (that family is untouched);
--       an owner on her own  → her own household is deleted (the app shows what's in it and asks first), unless
--                              someone shares it ('own_household_shared') or it has Club membership records
--                              ('own_household_membership': billing and received months hang off it; support
--                              moves those by hand, never a silent delete).
-- Nothing is merged: people, calendars and agreements of the two households have different ids and meanings.
-- The plain household_invite_accept is unchanged and still refuses an account that's already in a household.
begin;

-- Why this account can't simply drop the household it owns (null: it can).
create function public.household_own_blocker(p_uid uuid, p_household uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.household_adults a where a.household_id = p_household and a.user_id <> p_uid)
      then 'own_household_shared'
    when exists (select 1 from public.club_subscriptions s where s.user_id = p_uid or s.household_id = p_household)
      or exists (select 1 from public.club_entitlements e where e.user_id = p_uid or e.household_id = p_household)
      or exists (select 1 from public.club_access_grants g where g.user_id = p_uid)
      or exists (select 1 from public.club_fulfillment_orders o where o.user_id = p_uid or o.household_id = p_household)
      then 'own_household_membership'
  end
$$;
revoke execute on function public.household_own_blocker(uuid, uuid) from public, anon, authenticated;

-- The invitation behind a code, checked for the caller exactly as household_invite_accept checks it (same errors),
-- except for the caller's own household. Internal.
create function public.household_invite_for_me(p_code text) returns public.household_invites
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  my_email text;
  inv public.household_invites%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select lower(u.email) into my_email from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  select * into inv from public.household_invites where code_hash = public.household_invite_hash(p_code);
  if not found or inv.revoked_at is not null or inv.accepted_at is not null then raise exception 'invite_invalid'; end if;
  if inv.expires_at <= now() then raise exception 'invite_expired'; end if;
  if my_email is null or my_email <> inv.email then raise exception 'invite_wrong_email'; end if;
  if not exists (select 1 from public.club_family_members f
                  where f.id = inv.member_id and f.household_id = inv.household_id and f.kind = 'adult' and f.archived_at is null)
     or exists (select 1 from public.household_adults a where a.member_id = inv.member_id) then
    raise exception 'invite_invalid';
  end if;
  if (select count(*) from public.household_adults a where a.household_id = inv.household_id and a.user_id <> uid) >= 2 then
    raise exception 'household_full';
  end if;
  return inv;
end $$;
revoke execute on function public.household_invite_for_me(text) from public, anon, authenticated;

-- What accepting would do. Only for the invited, verified email with a valid code, so the names are theirs to see.
--   status 'ready'      nothing to leave: accept.
--          'leave_own'  accepting ends what `mine` describes (role, people, events, agreements); ask first.
--          'blocked'    `reason` says why (own_household_shared | own_household_membership).
--          'joined'     already in this family.
create function public.household_invite_preview(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  inv public.household_invites%rowtype := public.household_invite_for_me(p_code);
  me public.household_adults%rowtype;
  r jsonb;
  blocker text;
begin
  r := jsonb_build_object(
    'invited_as', (select f.first_name from public.club_family_members f where f.id = inv.member_id),
    'family', (select h.display_name from public.club_households h where h.id = inv.household_id));
  select * into me from public.household_adults where user_id = uid;
  if not found then return r || jsonb_build_object('status', 'ready'); end if;
  if me.household_id = inv.household_id then return r || jsonb_build_object('status', 'joined'); end if;
  r := r || jsonb_build_object('mine', jsonb_build_object(
    'role', me.role,
    'family', (select h.display_name from public.club_households h where h.id = me.household_id),
    'people', (select coalesce(jsonb_agg(f.first_name order by f.sort, f.created_at), '[]') from public.club_family_members f
                where f.household_id = me.household_id and f.archived_at is null),
    'events', (select count(*) from public.calendar_events e where e.household_id = me.household_id and e.deleted_at is null),
    'agreements', (select count(*) from public.club_responsibilities x where x.household_id = me.household_id and x.status = 'confirmed')));
  if me.role = 'owner' then blocker := public.household_own_blocker(uid, me.household_id); end if;
  if blocker is not null then return r || jsonb_build_object('status', 'blocked', 'reason', blocker); end if;
  return r || jsonb_build_object('status', 'leave_own');
end $$;
revoke execute on function public.household_invite_preview(text) from public, anon;
grant execute on function public.household_invite_preview(text) to authenticated;

-- Accept, leaving the caller's current household first. One transaction: if the acceptance fails for any reason,
-- nothing was left or deleted.
create function public.household_invite_accept_leaving(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  inv public.household_invites%rowtype := public.household_invite_for_me(p_code);
  me public.household_adults%rowtype;
  blocker text;
begin
  select * into me from public.household_adults where user_id = uid;
  if found and me.household_id = inv.household_id then return public.club_household(); end if; -- already in this family
  if found then
    -- Serialize with anything changing who's in the household being left (an invitation accepted into it right now).
    perform pg_advisory_xact_lock(hashtextextended('household-adults:' || me.household_id::text, 0));
    select * into me from public.household_adults where user_id = uid;
  end if;
  if found and me.role = 'partner' then
    delete from public.household_adults where user_id = uid and role = 'partner';
  elsif found then
    blocker := public.household_own_blocker(uid, me.household_id);
    if blocker is not null then raise exception '%', blocker; end if;
    delete from public.club_households where id = me.household_id and owner_user_id = uid;
  end if;
  return public.household_invite_accept(p_code);
end $$;
revoke execute on function public.household_invite_accept_leaving(text) from public, anon;
grant execute on function public.household_invite_accept_leaving(text) to authenticated;

commit;
