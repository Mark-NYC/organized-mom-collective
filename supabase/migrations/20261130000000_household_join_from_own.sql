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
--       an owner on her own  → her own household is replaced (owner decision 2026-11-15), with three protections:
--                              1. the app shows what's in it and asks first, and the call must name the household it
--                                 showed (p_leaving), so nothing but the family on screen can ever be replaced;
--                              2. her calendar plans come with her (p_keep_events, on by default): they move into
--                                 the family she joins, without the people on them (the two families' people have
--                                 different ids);
--                              3. everything else (people, colors, typical week, agreements, the plans too) is
--                                 kept as a copy in household_archives for 90 days, readable by her.
--                              Never when someone shares it ('own_household_shared') or it has Club membership
--                              records ('own_household_membership': billing and received months hang off it;
--                              support moves those by hand).
-- People and agreements are not merged: the two households' ids and meanings differ.
-- The plain household_invite_accept is unchanged and still refuses an account that's already in a household.
begin;

-- A copy of a household replaced on joining another, for the person who replaced it. Written only by
-- household_invite_accept_leaving; she can read her own. Kept 90 days (purge_after): removing older rows is a
-- scheduled job or a manual sweep, decided with the privacy policy.
create table public.household_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('joined_another')),
  family text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  purge_after timestamptz not null default now() + interval '90 days'
);
create index household_archives_user on public.household_archives (user_id, created_at desc);
alter table public.household_archives enable row level security;
revoke all on public.household_archives from public, anon, authenticated;
grant all on public.household_archives to service_role;
grant select on public.household_archives to authenticated;
create policy "People read their own archived family" on public.household_archives
  for select to authenticated using (user_id = (select auth.uid()));

-- Everything a family made, as one document.
create function public.household_snapshot(p_household uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'household', (select jsonb_build_object('display_name', h.display_name, 'preferences', h.preferences, 'created_at', h.created_at)
                    from public.club_households h where h.id = p_household),
    'members', coalesce((select jsonb_agg(to_jsonb(f) - 'household_id' order by f.sort, f.created_at)
                           from public.club_family_members f where f.household_id = p_household), '[]'),
    'activities', coalesce((select jsonb_agg(to_jsonb(a) - 'household_id' order by a.sort, a.created_at)
                              from public.club_activities a where a.household_id = p_household), '[]'),
    'responsibilities', coalesce((select jsonb_agg(to_jsonb(r) - 'household_id' order by r.created_at)
                                    from public.club_responsibilities r where r.household_id = p_household), '[]'),
    'calendar_events', coalesce((select jsonb_agg(to_jsonb(e) - 'household_id' - 'created_by' - 'updated_by' order by e.starts_on, e.start_time)
                                   from public.calendar_events e where e.household_id = p_household and e.deleted_at is null), '[]'))
$$;
revoke execute on function public.household_snapshot(uuid) from public, anon, authenticated;

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
    'id', me.household_id, 'role', me.role,
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

-- Accept, leaving the caller's current household first. p_leaving must be the household the preview showed
-- ('leaving_mismatch' otherwise): a stale screen or a blind call can never replace a different family. One
-- transaction: if the acceptance fails for any reason, nothing was left, moved, archived or deleted.
create function public.household_invite_accept_leaving(p_code text, p_leaving uuid, p_keep_events boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  inv public.household_invites%rowtype := public.household_invite_for_me(p_code);
  me public.household_adults%rowtype;
  blocker text;
  moved int := 0;
  r jsonb;
begin
  select * into me from public.household_adults where user_id = uid;
  if found and me.household_id = inv.household_id then return public.club_household(); end if; -- already in this family
  if not found then return public.household_invite_accept(p_code); end if;
  if p_leaving is distinct from me.household_id then raise exception 'leaving_mismatch'; end if;
  -- Serialize with anything changing who's in the household being left (an invitation accepted into it right now).
  perform pg_advisory_xact_lock(hashtextextended('household-adults:' || me.household_id::text, 0));
  select * into me from public.household_adults where user_id = uid;
  if not found or p_leaving is distinct from me.household_id then raise exception 'leaving_mismatch'; end if;

  if me.role = 'partner' then
    delete from public.household_adults where user_id = uid and role = 'partner';
    return public.household_invite_accept(p_code);
  end if;

  blocker := public.household_own_blocker(uid, me.household_id);
  if blocker is not null then raise exception '%', blocker; end if;
  -- The safety copy first, complete (the plans too, with the people who were on them).
  insert into public.household_archives (user_id, reason, family, snapshot)
  select uid, 'joined_another', h.display_name, public.household_snapshot(h.id) from public.club_households h where h.id = me.household_id;
  -- Her plans come with her, as new changes the other grown-up's phone picks up. The people on them stay behind.
  if p_keep_events then
    update public.calendar_events
       set household_id = inv.household_id, member_ids = '{}', owner_member_id = null, source = 'manual', source_ref = null,
           revision = revision + 1, updated_by = uid, updated_at = now()
     where household_id = me.household_id and deleted_at is null;
    get diagnostics moved = row_count;
  end if;
  delete from public.club_households where id = me.household_id and owner_user_id = uid;
  r := public.household_invite_accept(p_code);
  return r || jsonb_build_object('brought_events', moved);
end $$;
revoke execute on function public.household_invite_accept_leaving(text, uuid, boolean) from public, anon;
grant execute on function public.household_invite_accept_leaving(text, uuid, boolean) to authenticated;

commit;
