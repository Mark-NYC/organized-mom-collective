-- Organized Family Club: family member colors (src/data/club/family-colors.ts). club_household_save accepts one more
-- preferences key, 'colors': an object of member id → marker color id. Additive; no data changes. Until this is applied,
-- the site saves families without it (src/lib/club/store.ts) and colors stay auto-assigned.
begin;

create or replace function public.club_preferences_colors_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select not (p ? 'colors') or (
    jsonb_typeof(p -> 'colors') = 'object'
    and (select count(*) from jsonb_object_keys(p -> 'colors')) <= 20
    and not exists (select 1 from jsonb_each_text(p -> 'colors') e
      where e.key !~ '^[0-9a-f-]{36}$' or e.value not in ('blue', 'green', 'purple', 'pink', 'orange', 'teal', 'red', 'brown')))
$$;

create or replace function public.club_household_save(p_display_name text, p_preferences jsonb, p_members jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
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
  -- 20261113: her family's illustration style (src/lib/club/illustration-style.ts), one of two values.
  if p_preferences ? 'icon_style' and coalesce(p_preferences ->> 'icon_style', '') not in ('hand-drawn', 'soft-color') then
    raise exception 'invalid';
  end if;
  -- 20261120: family member colors (src/data/club/family-colors.ts), member id → marker color id.
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
  perform pg_advisory_xact_lock(hashtextextended('club-household:' || uid::text, 0));
  insert into public.club_households (owner_user_id, display_name, preferences, onboarded_at)
  values (uid, nullif(btrim(p_display_name), ''), p_preferences, now())
  on conflict (owner_user_id) do update
    set display_name = excluded.display_name, preferences = excluded.preferences,
        profile_version = club_households.profile_version + 1, updated_at = now(),
        onboarded_at = coalesce(club_households.onboarded_at, now())
  returning id into hid;
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
  update public.club_family_members set archived_at = now(), updated_at = now()
   where household_id = hid and archived_at is null and not (id = any (keep));
  if (select count(*) from public.club_family_members where household_id = hid and archived_at is null and is_account_holder) > 1 then
    raise exception 'invalid';
  end if;
  return public.club_household();
exception
  when check_violation or invalid_text_representation or not_null_violation or numeric_value_out_of_range
       or invalid_parameter_value then
    raise exception 'invalid';
end $$;
revoke execute on function public.club_household_save(text, jsonb, jsonb) from public, anon;
grant execute on function public.club_household_save(text, jsonb, jsonb) to authenticated;
-- Only called from inside club_household_save (security definer, as its owner).
revoke execute on function public.club_preferences_colors_ok(jsonb) from public, anon, authenticated;

commit;
