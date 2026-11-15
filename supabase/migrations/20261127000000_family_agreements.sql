-- Family agreements: "We agreed" in the Family Meeting's Everyone's Part (docs/ios/FAMILY_MEETING_SUPPORT.md).
--
-- NOT applied to production. Test with scripts/test-household-sql.sh (supabase/tests/family-agreements.sql).
-- Depends on 20261124000000_household_shared.sql (household_adults, household_id_for).
--
-- An agreement is a 'confirmed' row in the existing club_responsibilities (the table always allowed it; nothing could
-- write it). It belongs to the household and names family members by their stable ids. Nothing else changes:
--   - 'existing' and 'desired' rows (the family profile, onboarding) are never touched here, and
--     club_responsibilities_save never touches 'confirmed' rows (it replaces only the status it was given).
--   - Suggestions are never stored. A row exists only because a grown-up in the household tapped "We agreed".
--   - Both grown-ups of the household can agree, edit, reassign or remove; nobody else can read or write.

alter table public.club_responsibilities
  -- The words the family agreed to, as the meeting showed them ("Check and pack my things for soccer before bed.").
  add column agreed_text text check (char_length(btrim(agreed_text)) between 1 and 160),
  add column agreed_finished text check (char_length(btrim(agreed_finished)) between 1 and 160),
  add column agreed_when text check (char_length(btrim(agreed_when)) between 1 and 80),
  -- The kit month whose meeting it came from, 'YYYY-MM', and the suggestion's id there (an example id or the month
  -- resource's item id), so the meeting shows it as agreed instead of suggesting it again.
  add column agreed_month text check (agreed_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  add column agreed_source text check (char_length(agreed_source) between 1 and 80 and agreed_source ~ '^[A-Za-z0-9:_.-]+$'),
  add column updated_by uuid references auth.users (id) on delete set null,
  -- Only agreements carry the meeting's words.
  add constraint club_responsibilities_agreed_only_confirmed
    check (status = 'confirmed' or (agreed_text is null and agreed_finished is null and agreed_when is null
                                    and agreed_month is null and agreed_source is null));

-- The profile read, as in 20261124000000_household_shared.sql, plus the agreement's fields.
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
                                          'confirmed_at', r.confirmed_at, 'agreed_text', r.agreed_text,
                                          'agreed_finished', r.agreed_finished, 'agreed_when', r.agreed_when,
                                          'agreed_month', r.agreed_month, 'agreed_source', r.agreed_source)
                       order by r.status, r.sort, r.created_at)
        from public.club_responsibilities r where r.household_id = h.id), '[]'));
end $$;
revoke execute on function public.club_family_profile() from public, anon;
grant execute on function public.club_family_profile() to authenticated;

-- Agree (no id), or edit / reassign an agreement (its id). p:
--   { id?, category, text, finished?, when?, month?, source?, owner_ids: [member ids, at least one] }
-- Owners must be current (not archived) members of this household. Agreeing to the same suggestion for the same
-- person twice (a double tap, a retry after a lost response) returns the existing agreement, never a duplicate.
create function public.household_agreement_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  rid uuid := nullif(p ->> 'id', '')::uuid;
  owners uuid[];
  n int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  hid := public.household_id_for(uid);
  if hid is null then raise exception 'no_household'; end if;
  if p is null or jsonb_typeof(p) <> 'object'
     or exists (select 1 from jsonb_object_keys(p) k
                 where k not in ('id', 'category', 'text', 'finished', 'when', 'month', 'source', 'owner_ids')) then
    raise exception 'invalid';
  end if;
  owners := public.club_uuid_list(p -> 'owner_ids');
  if cardinality(owners) = 0 or cardinality(owners) > 12 then raise exception 'invalid'; end if;
  if exists (select 1 from unnest(owners) x
              where not exists (select 1 from public.club_family_members m
                                 where m.id = x and m.household_id = hid and m.archived_at is null)) then
    raise exception 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household-id:' || hid::text, 0));

  if rid is not null then
    if not exists (select 1 from public.club_responsibilities where id = rid and household_id = hid and status = 'confirmed') then
      raise exception 'not_found';
    end if;
    update public.club_responsibilities
       set category = p ->> 'category', agreed_text = btrim(p ->> 'text'),
           agreed_finished = nullif(btrim(p ->> 'finished'), ''), agreed_when = nullif(btrim(p ->> 'when'), ''),
           owner_ids = owners, helper_ids = array(select x from unnest(helper_ids) x where not (x = any (owners))),
           scope = case when cardinality(owners) = 1 then 'individual' else 'shared' end,
           updated_by = uid, updated_at = now()
     where id = rid;
    return public.club_family_profile();
  end if;

  -- Already agreed: the same suggestion for the same people this month.
  if p ->> 'source' is not null and exists (
       select 1 from public.club_responsibilities
        where household_id = hid and status = 'confirmed' and agreed_source = p ->> 'source'
          and agreed_month is not distinct from nullif(p ->> 'month', '') and owner_ids @> owners and owner_ids <@ owners) then
    return public.club_family_profile();
  end if;
  select count(*) into n from public.club_responsibilities where household_id = hid and status = 'confirmed';
  if n >= 60 then raise exception 'too_many'; end if;
  insert into public.club_responsibilities (household_id, status, category, owner_ids, helper_ids, scope, confirmed_at,
                                           agreed_text, agreed_finished, agreed_when, agreed_month, agreed_source, updated_by, sort)
  values (hid, 'confirmed', p ->> 'category', owners, '{}',
          case when cardinality(owners) = 1 then 'individual' else 'shared' end, now(),
          btrim(p ->> 'text'), nullif(btrim(p ->> 'finished'), ''), nullif(btrim(p ->> 'when'), ''),
          nullif(p ->> 'month', ''), nullif(p ->> 'source', ''), uid, n);
  return public.club_family_profile();
exception
  when check_violation or invalid_text_representation or not_null_violation then raise exception 'invalid';
end $$;
revoke execute on function public.household_agreement_save(jsonb) from public, anon;
grant execute on function public.household_agreement_save(jsonb) to authenticated;

-- Remove an agreement ("we changed our minds"). Only confirmed rows of this household; existing and desired are the
-- family profile's, edited there.
create function public.household_agreement_remove(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.household_id_for(auth.uid());
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if hid is null then raise exception 'no_household'; end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household-id:' || hid::text, 0));
  delete from public.club_responsibilities where id = p_id and household_id = hid and status = 'confirmed';
  if not found then raise exception 'not_found'; end if;
  return public.club_family_profile();
end $$;
revoke execute on function public.household_agreement_remove(uuid) from public, anon;
grant execute on function public.household_agreement_remove(uuid) to authenticated;
