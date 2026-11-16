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

-- A copy of a household replaced on joining another, for the person who replaced it (owner-approved 2026-11-16).
--   Secured: RLS, no direct writes by anyone; written only by household_invite_accept_leaving.
--   Access-controlled: she reads only her own; restoring is support's (service role), never self-service.
--   Automatically purged: household_archives_purge(), scheduled daily below, deletes copies past purge_after (90 days).
--   An account-deletion request wins: the copy goes with the sign-in at once (user_id on delete cascade).
--   Disclosed: the privacy policy's "Keeping and deleting your data" (src/pages/privacy.astro).
create table public.household_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('joined_another')),
  family text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  purge_after timestamptz not null default now() + interval '90 days',
  -- Set when support put it back (household_archive_restore).
  restored_at timestamptz
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

-- Daily: remove copies older than 90 days. Returns how many went.
create function public.household_archives_purge() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.household_archives where purge_after <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.household_archives_purge() from public, anon, authenticated;
grant execute on function public.household_archives_purge() to service_role;
-- Scheduled where pg_cron is installed (production; a plain test database has no scheduler and skips this).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('omc-household-archives-purge', '17 4 * * *', 'select public.household_archives_purge()');
  end if;
end $$;

-- Support puts a copy back: the family as she set it up (people with their original ids and colors, typical week,
-- responsibilities and agreements, and any calendar plans that didn't travel with her). Only while she is in no
-- household (she left, or was removed from, the family she joined); never over an existing one. Service role only.
create function public.household_archive_restore(p_archive uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  a public.household_archives%rowtype;
  hid uuid;
  holder uuid;
begin
  select * into a from public.household_archives where id = p_archive for update;
  if not found then raise exception 'not_found'; end if;
  if a.purge_after <= now() then raise exception 'archive_expired'; end if;
  if a.restored_at is not null then raise exception 'already_restored'; end if;
  if exists (select 1 from public.household_adults where user_id = a.user_id)
     or exists (select 1 from public.club_households where owner_user_id = a.user_id) then
    raise exception 'already_in_household';
  end if;
  insert into public.club_households (owner_user_id, display_name, preferences, onboarded_at)
  values (a.user_id, a.snapshot -> 'household' ->> 'display_name', coalesce(a.snapshot -> 'household' -> 'preferences', '{}'), now())
  returning id into hid;
  insert into public.club_family_members
  select * from jsonb_populate_recordset(null::public.club_family_members,
    (select coalesce(jsonb_agg(m || jsonb_build_object('household_id', hid)), '[]') from jsonb_array_elements(a.snapshot -> 'members') m));
  insert into public.club_activities
  select * from jsonb_populate_recordset(null::public.club_activities,
    (select coalesce(jsonb_agg(x || jsonb_build_object('household_id', hid)), '[]') from jsonb_array_elements(a.snapshot -> 'activities') x));
  insert into public.club_responsibilities
  select * from jsonb_populate_recordset(null::public.club_responsibilities,
    (select coalesce(jsonb_agg(x || jsonb_build_object('household_id', hid, 'updated_by', null)), '[]') from jsonb_array_elements(a.snapshot -> 'responsibilities') x));
  -- Plans that travelled to the other family are theirs now; only the ones that no longer exist come back.
  insert into public.calendar_events
  select * from jsonb_populate_recordset(null::public.calendar_events,
    (select coalesce(jsonb_agg(x || jsonb_build_object('household_id', hid)), '[]') from jsonb_array_elements(a.snapshot -> 'calendar_events') x
      where not exists (select 1 from public.calendar_events e where e.id = (x ->> 'id')::uuid)));
  -- She is her family's account holder again.
  select f.id into holder from public.club_family_members f where f.household_id = hid and f.is_account_holder and f.kind = 'adult' and f.archived_at is null;
  update public.household_adults set member_id = holder where household_id = hid and user_id = a.user_id and role = 'owner';
  update public.household_archives set restored_at = now() where id = a.id;
  return hid;
end $$;
revoke execute on function public.household_archive_restore(uuid) from public, anon, authenticated;
grant execute on function public.household_archive_restore(uuid) to service_role;

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
