-- One household, one family profile, two adults (docs/ios/HOUSEHOLD_ARCHITECTURE.md).
--
-- NOT APPLIED. Built and tested on a throwaway database (scripts/test-household-sql.sh); applying it to the live
-- project needs the owner's approval.
--
-- Extends the Club household instead of adding a second family system:
--   household_adults   the accounts that share a household: the owner (backfilled from club_households.owner_user_id)
--                      and an invited partner, each linked to their own row in club_family_members.
--   household_invites  one-time partner invitations (hashed codes, matching verified email, 7-day expiry).
-- Family data functions (club_household, club_household_save, club_family_profile, club_my_household and everything
-- built on it: activities, responsibilities, focus) resolve the household through household_adults, so both adults
-- read and edit the same family. Billing, entitlements, fulfillment and printing approvals stay keyed to the owner
-- (owner_user_id) and are not touched.
--
-- Data: inserts one owner row per existing household. No existing row is changed. Member colors are never
-- overwritten: club_household_save now merges saved colors instead of replacing them.
begin;

-- ---------------------------------------------------------------- the adults who share a household

create table public.household_adults (
  household_id uuid not null references public.club_households (id) on delete cascade,
  -- One household per account, as before (club_households.owner_user_id is unique).
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  -- This adult's own row in the family (stable id), so the family profile has one record per person.
  member_id uuid references public.club_family_members (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create unique index household_adults_one_owner on public.household_adults (household_id) where role = 'owner';
create unique index household_adults_member on public.household_adults (member_id) where member_id is not null;

-- Backfill: every existing household's owner, linked to its account-holder adult when there is exactly one.
insert into public.household_adults (household_id, user_id, role, member_id, joined_at)
select h.id, h.owner_user_id, 'owner',
       case when (select count(*) from public.club_family_members m
                   where m.household_id = h.id and m.is_account_holder and m.kind = 'adult' and m.archived_at is null) = 1
            then (select m.id from public.club_family_members m
                   where m.household_id = h.id and m.is_account_holder and m.kind = 'adult' and m.archived_at is null)
       end,
       h.created_at
  from public.club_households h
on conflict do nothing;

-- New households get their owner row automatically (club_household_save's insert path is unchanged).
create function public.household_owner_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.household_adults (household_id, user_id, role) values (new.id, new.owner_user_id, 'owner')
  on conflict do nothing;
  return new;
end $$;
revoke execute on function public.household_owner_row() from public, anon, authenticated;
create trigger club_households_owner_row after insert on public.club_households
  for each row execute function public.household_owner_row();

-- The one resolver: the household an account belongs to (owner or partner), or null.
create function public.household_id_for(p_uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select household_id from public.household_adults where user_id = p_uid
$$;
revoke execute on function public.household_id_for(uuid) from public, anon;
grant execute on function public.household_id_for(uuid) to authenticated; -- used inside RLS policies

-- ---------------------------------------------------------------- family data resolves through the adults

create or replace function public.club_my_household() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  hid := public.household_id_for(auth.uid());
  if hid is null then raise exception 'no_household'; end if;
  return hid;
end $$;
revoke execute on function public.club_my_household() from public, anon, authenticated;

create or replace function public.club_household() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.club_households%rowtype;
  me public.household_adults%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into me from public.household_adults where user_id = uid;
  if not found then return null; end if;
  select * into h from public.club_households where id = me.household_id;
  return jsonb_build_object(
    'id', h.id, 'display_name', h.display_name, 'preferences', h.preferences, 'profile_version', h.profile_version,
    'onboarded', h.onboarded_at is not null,
    'my_role', me.role, 'my_member_id', me.member_id,
    'adults', coalesce((
      select jsonb_agg(jsonb_build_object('role', a.role, 'member_id', a.member_id, 'me', a.user_id = uid) order by a.role desc, a.joined_at)
        from public.household_adults a where a.household_id = h.id), '[]'),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'first_name', m.first_name, 'kind', m.kind, 'role', m.role,
                                          'is_account_holder', m.is_account_holder,
                                          'birth_year', m.birth_year, 'birth_month', m.birth_month,
                                          'archived', m.archived_at is not null) order by m.sort, m.created_at)
        from public.club_family_members m
       where m.household_id = h.id and (m.archived_at is null or m.archived_at > now() - interval '1 year')), '[]'));
end $$;
revoke execute on function public.club_household() from public, anon;
grant execute on function public.club_household() to authenticated;

-- The whole-family save, shared by club_household_save (existing pages) and household_save (version-checked).
-- Same validation as 20261120000000_club_household_colors.sql. Changes: the household is found through
-- household_adults (owner or partner); saved colors are merged, never dropped (a client that omits a member's color
-- keeps it; colors of people no longer in the household are pruned); an adult linked to an account can't be archived.
create function public.household_save_core(p_expected_version int, p_display_name text, p_preferences jsonb, p_members jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  old_prefs jsonb;
  prefs jsonb;
  m jsonb;
  keep uuid[] := '{}';
  mid uuid;
  i int := 0;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_members is null or jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) not between 1 and 12 then
    raise exception 'invalid';
  end if;
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_preferences) k
                 where k not in ('palette', 'week_starts', 'faith_content', 'pets', 'school', 'weekday_dinner', 'priorities', 'icon_style', 'colors')) then
    raise exception 'invalid';
  end if;
  if p_preferences ? 'icon_style' and coalesce(p_preferences ->> 'icon_style', '') not in ('hand-drawn', 'soft-color') then
    raise exception 'invalid';
  end if;
  if not public.club_preferences_colors_ok(p_preferences) then
    raise exception 'invalid';
  end if;
  if p_preferences ? 'priorities' and (
       jsonb_typeof(p_preferences -> 'priorities') <> 'array'
       or jsonb_array_length(p_preferences -> 'priorities') > 8
       or exists (select 1 from jsonb_array_elements(p_preferences -> 'priorities') x
                   where jsonb_typeof(x) <> 'string' or x #>> '{}' !~ '^[a-z]+(-[a-z]+)*$' or char_length(x #>> '{}') > 40)) then
    raise exception 'invalid';
  end if;
  if exists (select 1 from jsonb_array_elements(p_members) x where btrim(coalesce(x ->> 'first_name', '')) = '') then
    raise exception 'invalid';
  end if;

  hid := public.household_id_for(uid);
  if hid is null then
    -- First save: this account starts a household and owns it (the trigger adds the owner row).
    perform pg_advisory_xact_lock(hashtextextended('club-household:' || uid::text, 0));
    hid := public.household_id_for(uid);
  end if;
  if hid is null then
    insert into public.club_households (owner_user_id, display_name, preferences, onboarded_at)
    values (uid, nullif(btrim(p_display_name), ''), p_preferences, now())
    returning id into hid;
    old_prefs := '{}';
  else
    perform pg_advisory_xact_lock(hashtextextended('club-household-id:' || hid::text, 0));
    select preferences into old_prefs from public.club_households where id = hid;
    if p_expected_version is not null and p_expected_version <> (select profile_version from public.club_households where id = hid) then
      raise exception 'stale_profile';
    end if;
    update public.club_households
       set display_name = nullif(btrim(p_display_name), ''), preferences = p_preferences,
           profile_version = profile_version + 1, updated_at = now(), onboarded_at = coalesce(onboarded_at, now())
     where id = hid;
  end if;

  for m in select * from jsonb_array_elements(p_members) loop
    i := i + 1;
    mid := nullif(m ->> 'id', '')::uuid;
    if mid is not null and not exists (select 1 from public.club_family_members where id = mid and household_id = hid) then
      raise exception 'invalid';
    end if;
    insert into public.club_family_members as f (id, household_id, first_name, kind, role, birth_year, birth_month, is_account_holder, sort)
    values (coalesce(mid, gen_random_uuid()), hid, btrim(m ->> 'first_name'), m ->> 'kind', m ->> 'role',
            (m ->> 'birth_year')::smallint, (m ->> 'birth_month')::smallint,
            coalesce((m ->> 'is_account_holder')::boolean, false) and m ->> 'kind' = 'adult', i)
    on conflict (id) do update
      set first_name = excluded.first_name, kind = excluded.kind, role = excluded.role,
          is_account_holder = excluded.is_account_holder,
          birth_year = excluded.birth_year, birth_month = excluded.birth_month, sort = excluded.sort,
          archived_at = null, updated_at = now()
    returning f.id into mid;
    keep := keep || mid;
  end loop;
  -- An adult who has their own account stays in the family (remove the partner first) and stays an adult.
  -- (Partners only: the owner's link just follows the account-holder row, below.)
  if exists (select 1 from public.household_adults a
              where a.household_id = hid and a.role = 'partner' and a.member_id is not null
                and (not (a.member_id = any (keep))
                     or exists (select 1 from public.club_family_members f where f.id = a.member_id and f.kind <> 'adult'))) then
    raise exception 'linked_member';
  end if;
  update public.club_family_members set archived_at = now(), updated_at = now()
   where household_id = hid and archived_at is null and not (id = any (keep));
  if (select count(*) from public.club_family_members where household_id = hid and archived_at is null and is_account_holder) > 1 then
    raise exception 'invalid';
  end if;
  -- The owner is the household's account-holder adult. Keep the link in step with that row: a household created after
  -- this migration has no members when its owner row is made, and the family page can change who holds the account.
  -- Null when there isn't exactly one, or when that row is a partner's.
  update public.household_adults a
     set member_id = (select f.id from public.club_family_members f
                       where f.household_id = hid and f.archived_at is null and f.is_account_holder and f.kind = 'adult'
                         and (select count(*) from public.club_family_members g
                               where g.household_id = hid and g.archived_at is null and g.is_account_holder and g.kind = 'adult') = 1
                         and not exists (select 1 from public.household_adults p where p.role = 'partner' and p.member_id = f.id))
   where a.household_id = hid and a.role = 'owner';

  -- Colors: what was saved, overlaid with what this save sends; only for people still in the household.
  prefs := (select preferences from public.club_households where id = hid);
  if old_prefs ? 'colors' or prefs ? 'colors' then
    prefs := jsonb_set(prefs, '{colors}', coalesce((
      select jsonb_object_agg(e.key, e.value)
        from jsonb_each(coalesce(old_prefs -> 'colors', '{}') || coalesce(prefs -> 'colors', '{}')) e
       where exists (select 1 from public.club_family_members f where f.household_id = hid and f.id::text = e.key)), '{}'));
    if not public.club_preferences_colors_ok(prefs) then raise exception 'invalid'; end if;
    update public.club_households set preferences = prefs where id = hid;
  end if;
  return public.club_household();
exception
  when check_violation or invalid_text_representation or not_null_violation or numeric_value_out_of_range
       or invalid_parameter_value then
    raise exception 'invalid';
end $$;
revoke execute on function public.household_save_core(int, text, jsonb, jsonb) from public, anon, authenticated;

-- Existing pages (/club/family, onboarding): same signature and behavior, now shared by both adults.
create or replace function public.club_household_save(p_display_name text, p_preferences jsonb, p_members jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select public.household_save_core(null, p_display_name, p_preferences, p_members)
$$;
revoke execute on function public.club_household_save(text, jsonb, jsonb) from public, anon;
grant execute on function public.club_household_save(text, jsonb, jsonb) to authenticated;

-- The app's save: refused with 'stale_profile' when the other adult changed the family since this copy was loaded.
create function public.household_save(p_expected_version int, p_display_name text, p_preferences jsonb, p_members jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select public.household_save_core(p_expected_version, p_display_name, p_preferences, p_members)
$$;
revoke execute on function public.household_save(int, text, jsonb, jsonb) from public, anon;
grant execute on function public.household_save(int, text, jsonb, jsonb) to authenticated;

create or replace function public.club_family_profile() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.club_households%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into h from public.club_households where id = public.household_id_for(uid);
  if not found then return null; end if;
  return jsonb_build_object(
    'setup_done', to_jsonb(h.setup_done),
    'setup_completed', h.setup_completed_at is not null,
    'challenges', to_jsonb(h.challenges), 'challenge_note', h.challenge_note,
    'priority', h.priority, 'priority_note', h.priority_note,
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'category', a.category, 'name', a.name, 'member_ids', to_jsonb(a.member_ids),
                                          'days', to_jsonb(a.days), 'starts_at', to_char(a.starts_at, 'HH24:MI')) order by a.sort, a.created_at)
        from public.club_activities a where a.household_id = h.id), '[]'),
    'responsibilities', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'category', r.category, 'item', r.item, 'label', r.label,
                                          'owner_ids', to_jsonb(r.owner_ids), 'helper_ids', to_jsonb(r.helper_ids), 'scope', r.scope,
                                          'confirmed_at', r.confirmed_at) order by r.status, r.sort, r.created_at)
        from public.club_responsibilities r where r.household_id = h.id), '[]'));
end $$;
revoke execute on function public.club_family_profile() from public, anon;
grant execute on function public.club_family_profile() to authenticated;

-- Two adults can save the typical week or the responsibilities at the same time: both functions replace a whole
-- list, so they must serialize per household, not per account (they locked on auth.uid()). Only that line changes;
-- the bodies are otherwise exactly as defined in 20261109000000_club_family_profile.sql.
do $$
declare
  fn text;
  d text;
  patched text;
begin
  foreach fn in array array['public.club_activities_save(jsonb)', 'public.club_responsibilities_save(text, jsonb)'] loop
    d := pg_get_functiondef(fn::regprocedure);
    patched := replace(d, $r$hashtextextended('club-household:' || auth.uid()::text, 0)$r$,
                          $r$hashtextextended('club-household-id:' || hid::text, 0)$r$);
    if patched = d then raise exception 'household lock: % no longer has the expected per-account lock', fn; end if;
    execute patched;
  end loop;
end $$;

-- Read policies: either adult reads the shared household, family, activities and responsibilities.
drop policy "Members read their household" on public.club_households;
create policy "Adults read their household" on public.club_households
  for select to authenticated using (id = (select public.household_id_for(auth.uid())));
drop policy "Members read their family" on public.club_family_members;
create policy "Adults read their family" on public.club_family_members
  for select to authenticated using (household_id = (select public.household_id_for(auth.uid())));
drop policy "Members read their activities" on public.club_activities;
create policy "Adults read their activities" on public.club_activities
  for select to authenticated using (household_id = (select public.household_id_for(auth.uid())));
drop policy "Members read their responsibilities" on public.club_responsibilities;
create policy "Adults read their responsibilities" on public.club_responsibilities
  for select to authenticated using (household_id = (select public.household_id_for(auth.uid())));

-- ---------------------------------------------------------------- partner invitations

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.club_households (id) on delete cascade,
  -- The adult in the family this account will be (an existing row: one family profile).
  member_id uuid not null references public.club_family_members (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- SHA-256 of the one-time code; the code itself is shown once to the inviter and never stored.
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
create index household_invites_household on public.household_invites (household_id);

create function public.household_invite_hash(p_code text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest('household-invite:' || lower(btrim(coalesce(p_code, ''))), 'sha256'), 'hex')
$$;
revoke execute on function public.household_invite_hash(text) from public, anon, authenticated;

-- The owner invites one adult already in the family. Returns the code once.
create function public.household_invite_create(p_member_id uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  me public.household_adults%rowtype;
  target public.club_family_members%rowtype;
  code text := encode(extensions.gen_random_bytes(16), 'hex');
  email text := lower(btrim(coalesce(p_email, '')));
  inv public.household_invites%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into me from public.household_adults where user_id = uid;
  if not found then raise exception 'no_household'; end if;
  if me.role <> 'owner' then raise exception 'owner_only'; end if;
  select * into target from public.club_family_members where id = p_member_id and household_id = me.household_id;
  if not found or target.kind <> 'adult' or target.archived_at is not null
     or exists (select 1 from public.household_adults a where a.member_id = target.id)
     or target.id = me.member_id then
    raise exception 'invite_member_invalid';
  end if;
  if email = (select lower(u.email) from auth.users u where u.id = uid) then raise exception 'invite_member_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('household-invites:' || me.household_id::text, 0));
  -- One open invite per adult: a new one replaces the old.
  update public.household_invites set revoked_at = now()
   where household_id = me.household_id and member_id = target.id and accepted_at is null and revoked_at is null;
  if (select count(*) from public.household_invites
       where household_id = me.household_id and accepted_at is null and revoked_at is null and expires_at > now()) >= 5 then
    raise exception 'too_many_invites';
  end if;
  -- Two grown-ups per household (owner decision 2026-11-15): one owner, one partner.
  if (select count(*) from public.household_adults where household_id = me.household_id) >= 2 then
    raise exception 'household_full';
  end if;
  insert into public.household_invites (household_id, member_id, email, code_hash, created_by)
  values (me.household_id, target.id, email, public.household_invite_hash(code), uid)
  returning * into inv;
  return jsonb_build_object('id', inv.id, 'code', code, 'email', inv.email, 'member_id', inv.member_id, 'expires_at', inv.expires_at);
exception
  when check_violation then raise exception 'invalid';
end $$;
revoke execute on function public.household_invite_create(uuid, text) from public, anon;
grant execute on function public.household_invite_create(uuid, text) to authenticated;

-- The household's invites (no codes), for either adult.
create function public.household_invites() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  hid uuid := public.household_id_for(auth.uid());
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if hid is null then return '[]'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'member_id', i.member_id, 'email', i.email, 'created_at', i.created_at,
                                        'expires_at', i.expires_at, 'accepted_at', i.accepted_at, 'revoked_at', i.revoked_at,
                                        'open', i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
                     order by i.created_at desc)
      from public.household_invites i
     where i.household_id = hid and i.created_at > now() - interval '90 days'), '[]');
end $$;
revoke execute on function public.household_invites() from public, anon;
grant execute on function public.household_invites() to authenticated;

create function public.household_invite_revoke(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.household_adults%rowtype;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into me from public.household_adults where user_id = auth.uid();
  if not found or me.role <> 'owner' then raise exception 'owner_only'; end if;
  update public.household_invites set revoked_at = now()
   where id = p_id and household_id = me.household_id and accepted_at is null and revoked_at is null;
end $$;
revoke execute on function public.household_invite_revoke(uuid) from public, anon;
grant execute on function public.household_invite_revoke(uuid) to authenticated;

-- The partner, signed in with the invited email (verified), joins the household as that family member.
create function public.household_invite_accept(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  my_email text;
  inv public.household_invites%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select lower(u.email) into my_email from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  select * into inv from public.household_invites where code_hash = public.household_invite_hash(p_code) for update;
  if not found or inv.revoked_at is not null or inv.accepted_at is not null then raise exception 'invite_invalid'; end if;
  if inv.expires_at <= now() then raise exception 'invite_expired'; end if;
  if my_email is null or my_email <> inv.email then raise exception 'invite_wrong_email'; end if;
  if exists (select 1 from public.household_adults where user_id = uid) then raise exception 'already_in_household'; end if;
  if not exists (select 1 from public.club_family_members f
                  where f.id = inv.member_id and f.household_id = inv.household_id and f.kind = 'adult' and f.archived_at is null)
     or exists (select 1 from public.household_adults a where a.member_id = inv.member_id) then
    raise exception 'invite_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('household-adults:' || inv.household_id::text, 0));
  if (select count(*) from public.household_adults where household_id = inv.household_id) >= 2 then raise exception 'household_full'; end if;
  insert into public.household_adults (household_id, user_id, role, member_id) values (inv.household_id, uid, 'partner', inv.member_id);
  update public.household_invites set accepted_at = now(), accepted_by = uid where id = inv.id;
  return public.club_household();
end $$;
revoke execute on function public.household_invite_accept(text) from public, anon;
grant execute on function public.household_invite_accept(text) to authenticated;

-- The owner removes the partner's access. Family data stays (the partner's family row stays too).
create function public.household_partner_remove() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.household_adults%rowtype;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into me from public.household_adults where user_id = auth.uid();
  if not found or me.role <> 'owner' then raise exception 'owner_only'; end if;
  delete from public.household_adults where household_id = me.household_id and role = 'partner';
end $$;
revoke execute on function public.household_partner_remove() from public, anon;
grant execute on function public.household_partner_remove() to authenticated;

-- The partner leaves. The owner can't leave her own household (she deletes her account instead).
create function public.household_leave() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.household_adults%rowtype;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into me from public.household_adults where user_id = auth.uid();
  if not found then return; end if;
  if me.role = 'owner' then raise exception 'owner_cannot_leave'; end if;
  delete from public.household_adults where user_id = auth.uid() and role = 'partner';
end $$;
revoke execute on function public.household_leave() from public, anon;
grant execute on function public.household_leave() to authenticated;

-- ---------------------------------------------------------------- RLS on the new tables

alter table public.household_adults enable row level security;
alter table public.household_invites enable row level security;
revoke all on public.household_adults, public.household_invites from public, anon, authenticated;
grant all on public.household_adults, public.household_invites to service_role;
grant select on public.household_adults to authenticated;
create policy "Adults read their household's adults" on public.household_adults
  for select to authenticated using (household_id = (select public.household_id_for(auth.uid())));
-- household_invites: no direct access (code hashes stay server-side); household_invites() lists them.

-- ---------------------------------------------------------------- an owner deleting her account

-- Deleting the owner's sign-in used to delete the household with it (club_households.owner_user_id cascades): the
-- other grown-up would lose the family, its calendar and agreements. Now, when the household has a partner, the
-- partner becomes the owner first, whatever deletes the sign-in (account_delete, the dashboard, an admin script), and
-- the family stays. What was the leaving owner's alone still goes with her account: her billing, entitlements,
-- mailing address and orders (they reference her user id), so the household continues on the free plan.
-- account_delete already refuses while she has a paid membership ('active_membership').
-- The future voluntary transfer (owner hands over without leaving) reuses household_owner_handover; not exposed yet.
create function public.household_owner_handover(p_owner uuid, p_to uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid;
  to_member uuid;
begin
  select household_id into hid from public.household_adults where user_id = p_owner and role = 'owner';
  if hid is null or not exists (select 1 from public.household_adults where user_id = p_to and household_id = hid and role = 'partner') then
    raise exception 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('household-adults:' || hid::text, 0));
  select member_id into to_member from public.household_adults where user_id = p_to;
  delete from public.household_adults where user_id = p_owner;
  update public.household_adults set role = 'owner' where user_id = p_to;
  update public.club_households set owner_user_id = p_to, updated_at = now() where id = hid;
  -- The account-holder row follows the account (it's what links the owner to her family row).
  if to_member is not null then
    update public.club_family_members set is_account_holder = (id = to_member), updated_at = now()
     where household_id = hid and (is_account_holder or id = to_member);
  end if;
end $$;
revoke execute on function public.household_owner_handover(uuid, uuid) from public, anon, authenticated;

create function public.household_owner_leaving() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  partner uuid;
begin
  select p.user_id into partner from public.household_adults o
    join public.household_adults p on p.household_id = o.household_id and p.role = 'partner'
   where o.user_id = old.id and o.role = 'owner';
  if partner is not null then perform public.household_owner_handover(old.id, partner); end if;
  return old;
end $$;
revoke execute on function public.household_owner_leaving() from public, anon, authenticated;
create trigger household_owner_leaving before delete on auth.users
  for each row execute function public.household_owner_leaving();

commit;
