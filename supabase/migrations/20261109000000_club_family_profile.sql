-- Organized Family Club: the expanded family profile (onboarding steps 2–6, /club/family). What future monthly
-- resources and the Monthly Family Meeting read: the family's typical week, who already takes care of what, what
-- the family wants the kids to own, where they struggle to stay on the same page, and the one thing she wants to
-- stop managing alone. Step 1 (the people) stays in club_households / club_family_members, unchanged.
--
-- Additive only: new nullable/defaulted columns and new tables. No existing row is changed, nothing is deleted,
-- onboarded_at and profile_version keep their meaning (these answers don't bump profile_version, so saved kit
-- documents never see "New suggestions" because of them). Access tests: supabase/tests/club-profile.sql.
--
-- Concepts are kept apart on purpose:
--   activities             what happens and when (club_activities)
--   responsibilities       one table, a status per row (club_responsibilities):
--     existing             what someone already takes care of (owners vs helpers; individual vs shared)
--     desired              what the family wants the kids to take on
--     suggested            a recommendation the system may make later. Never a confirmed job. Not written by the browser.
--     confirmed            a responsibility the family explicitly accepted (later; not written by onboarding)
--   challenges, priority   household-level answers on club_households
--
-- Same rules as club_core: RLS on, grants revoked, customers read only their own rows and write only through the
-- security definer functions below. Admins get no read policy: like children's names, none of this is support data.

begin;

-- ---------------------------------------------------------------- household-level answers

alter table public.club_households
  -- Where the family struggles to stay on the same page (ids from src/data/club/family-profile.ts).
  add column challenges text[] not null default '{}'
    check (cardinality(challenges) <= 8 and array_to_string(challenges, ',') ~ '^([a-z]+(-[a-z]+)*(,|$))*$'),
  add column challenge_note text check (char_length(challenge_note) <= 120),
  -- The one thing she'd love to stop managing alone: the family's initial priority.
  add column priority text check (priority ~ '^[a-z]+(-[a-z]+)*$' and char_length(priority) <= 40),
  add column priority_note text check (char_length(priority_note) <= 120),
  -- Profile steps she has answered or skipped ('week', 'responsibilities', 'growth', 'challenges', 'priority'), so
  -- an interrupted setup resumes at the first open step and never asks again.
  add column setup_done text[] not null default '{}'
    check (setup_done <@ array['week', 'responsibilities', 'growth', 'challenges', 'priority']),
  add column setup_completed_at timestamptz;

-- ---------------------------------------------------------------- the typical week

create table public.club_activities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.club_households (id) on delete cascade,
  category text not null check (category in ('school', 'work', 'sports', 'lessons', 'community', 'clubs', 'appointments', 'other')),
  -- Optional: "Soccer practice", "Piano with Ms. Lee".
  name text check (char_length(btrim(name)) between 1 and 40),
  -- Optional: who takes part (club_family_members ids in this household; checked on save).
  member_ids uuid[] not null default '{}' check (cardinality(member_ids) <= 12),
  -- Optional: days of the week, 0 = Sunday … 6 = Saturday.
  days smallint[] not null default '{}' check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  -- Optional: start time if she knows it.
  starts_at time,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index club_activities_household on public.club_activities (household_id);

-- ---------------------------------------------------------------- responsibilities

create table public.club_responsibilities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.club_households (id) on delete cascade,
  status text not null check (status in ('existing', 'desired', 'suggested', 'confirmed')),
  category text not null check (category in ('meals', 'laundry', 'cleaning', 'transportation', 'belongings',
                                             'school-prep', 'homework', 'pet-care', 'routines', 'other')),
  -- A specific choice within the category (desired: 'pack-school-bag', …; ids from src/data/club/family-profile.ts).
  item text check (item ~ '^[a-z]+(-[a-z]+)*$' and char_length(item) <= 40),
  -- Her own words, for 'other' or a custom answer.
  label text check (char_length(btrim(label)) between 1 and 60),
  -- Owners take care of it without being asked; helpers pitch in when asked. Never the same person in both.
  owner_ids uuid[] not null default '{}' check (cardinality(owner_ids) <= 12),
  helper_ids uuid[] not null default '{}' check (cardinality(helper_ids) <= 12),
  -- From the owners: one owner = individual, two or more = shared, none = not assigned yet.
  scope text check (scope in ('individual', 'shared')),
  confirmed_at timestamptz,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (owner_ids && helper_ids)),
  check ((scope is null and cardinality(owner_ids) = 0)
      or (scope = 'individual' and cardinality(owner_ids) = 1)
      or (scope = 'shared' and cardinality(owner_ids) >= 2)),
  check ((status = 'confirmed') = (confirmed_at is not null))
);
create index club_responsibilities_household on public.club_responsibilities (household_id, status);

-- ---------------------------------------------------------------- helpers

-- Her household id, or 'no_household' (the family step comes first).
create function public.club_my_household() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select id into hid from public.club_households where owner_user_id = auth.uid();
  if hid is null then raise exception 'no_household'; end if;
  return hid;
end $$;
revoke execute on function public.club_my_household() from public, anon, authenticated;

-- Every id is a member of this household (archived members count: an old answer keeps its id).
create function public.club_members_belong(p_household uuid, p_ids uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from unnest(coalesce(p_ids, '{}')) x
     where not exists (select 1 from public.club_family_members m where m.id = x and m.household_id = p_household));
$$;
revoke execute on function public.club_members_belong(uuid, uuid[]) from public, anon, authenticated;

-- A JSON list of ids as uuid[] (null → empty). Bad input raises invalid_text_representation → 'invalid'.
create function public.club_uuid_list(p jsonb) returns uuid[]
language sql immutable set search_path = '' as $$
  select coalesce((select array_agg(distinct (x #>> '{}')::uuid) from jsonb_array_elements(coalesce(p, '[]')) x), '{}');
$$;
revoke execute on function public.club_uuid_list(jsonb) from public, anon, authenticated;

create function public.club_setup_mark(p_household uuid, p_step text) returns void
language sql security definer set search_path = '' as $$
  update public.club_households
     set setup_done = case when p_step = any (setup_done) then setup_done else setup_done || p_step end,
         setup_completed_at = case when setup_completed_at is null
                                    and (case when p_step = any (setup_done) then setup_done else setup_done || p_step end)
                                        @> array['week', 'responsibilities', 'growth', 'challenges', 'priority']
                                   then now() else setup_completed_at end,
         updated_at = now()
   where id = p_household;
$$;
revoke execute on function public.club_setup_mark(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- what the browser may call

-- The profile beyond the people: null before the family step.
create function public.club_family_profile() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.club_households%rowtype;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into h from public.club_households where owner_user_id = uid;
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

-- Step 2: her typical week, the whole list at once. Activities left out are removed (nothing points at them).
-- An empty list is a valid answer ("skip for now") and still marks the step done.
create function public.club_activities_save(p_activities jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.club_my_household();
  a jsonb;
  aid uuid;
  ids uuid[];
  keep uuid[] := '{}';
  i int := 0;
begin
  if p_activities is null or jsonb_typeof(p_activities) <> 'array' or jsonb_array_length(p_activities) > 30 then
    raise exception 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household:' || auth.uid()::text, 0));
  for a in select * from jsonb_array_elements(p_activities) loop
    i := i + 1;
    aid := nullif(a ->> 'id', '')::uuid;
    if aid is not null and not exists (select 1 from public.club_activities where id = aid and household_id = hid) then
      raise exception 'invalid';
    end if;
    ids := public.club_uuid_list(a -> 'member_ids');
    if not public.club_members_belong(hid, ids) then raise exception 'invalid'; end if;
    insert into public.club_activities as t (id, household_id, category, name, member_ids, days, starts_at, sort)
    values (coalesce(aid, gen_random_uuid()), hid, a ->> 'category', nullif(btrim(a ->> 'name'), ''), ids,
            coalesce((select array_agg(distinct (d #>> '{}')::smallint order by (d #>> '{}')::smallint)
                        from jsonb_array_elements(coalesce(a -> 'days', '[]')) d), '{}'),
            nullif(a ->> 'starts_at', '')::time, i)
    on conflict (id) do update
      set category = excluded.category, name = excluded.name, member_ids = excluded.member_ids, days = excluded.days,
          starts_at = excluded.starts_at, sort = excluded.sort, updated_at = now()
    returning t.id into aid;
    keep := keep || aid;
  end loop;
  delete from public.club_activities where household_id = hid and not (id = any (keep));
  perform public.club_setup_mark(hid, 'week');
  return public.club_family_profile();
exception
  when check_violation or invalid_text_representation or not_null_violation or numeric_value_out_of_range
       or invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid';
end $$;
revoke execute on function public.club_activities_save(jsonb) from public, anon;
grant execute on function public.club_activities_save(jsonb) to authenticated;

-- Steps 3 and 4: existing responsibilities ('existing') or what the family wants the kids to take on ('desired'),
-- the whole list for that status at once. The browser can't write 'suggested' or 'confirmed'.
create function public.club_responsibilities_save(p_status text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.club_my_household();
  r jsonb;
  rid uuid;
  owners uuid[];
  helpers uuid[];
  keep uuid[] := '{}';
  i int := 0;
begin
  if p_status not in ('existing', 'desired') or p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('club-household:' || auth.uid()::text, 0));
  for r in select * from jsonb_array_elements(p_items) loop
    i := i + 1;
    rid := nullif(r ->> 'id', '')::uuid;
    if rid is not null and not exists (select 1 from public.club_responsibilities where id = rid and household_id = hid and status = p_status) then
      raise exception 'invalid';
    end if;
    owners := public.club_uuid_list(r -> 'owner_ids');
    helpers := public.club_uuid_list(r -> 'helper_ids');
    if not public.club_members_belong(hid, owners || helpers) then raise exception 'invalid'; end if;
    insert into public.club_responsibilities as t (id, household_id, status, category, item, label, owner_ids, helper_ids, scope, sort)
    values (coalesce(rid, gen_random_uuid()), hid, p_status, r ->> 'category', nullif(r ->> 'item', ''),
            nullif(btrim(r ->> 'label'), ''), owners, helpers,
            case cardinality(owners) when 0 then null when 1 then 'individual' else 'shared' end, i)
    on conflict (id) do update
      set category = excluded.category, item = excluded.item, label = excluded.label, owner_ids = excluded.owner_ids,
          helper_ids = excluded.helper_ids, scope = excluded.scope, sort = excluded.sort, updated_at = now()
    returning t.id into rid;
    keep := keep || rid;
  end loop;
  delete from public.club_responsibilities where household_id = hid and status = p_status and not (id = any (keep));
  perform public.club_setup_mark(hid, case p_status when 'existing' then 'responsibilities' else 'growth' end);
  return public.club_family_profile();
exception
  when check_violation or invalid_text_representation or not_null_violation or numeric_value_out_of_range
       or invalid_parameter_value then
    raise exception 'invalid';
end $$;
revoke execute on function public.club_responsibilities_save(text, jsonb) from public, anon;
grant execute on function public.club_responsibilities_save(text, jsonb) to authenticated;

-- Steps 5 and 6. p_step says which one she just answered (or skipped); both columns are written either way.
create function public.club_focus_save(p_step text, p_challenges text[], p_challenge_note text, p_priority text, p_priority_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.club_my_household();
begin
  if p_step not in ('challenges', 'priority') then raise exception 'invalid'; end if;
  update public.club_households
     set challenges = coalesce((select array_agg(distinct x) from unnest(p_challenges) x), '{}'),
         challenge_note = nullif(btrim(p_challenge_note), ''),
         priority = nullif(p_priority, ''),
         priority_note = nullif(btrim(p_priority_note), ''),
         updated_at = now()
   where id = hid;
  perform public.club_setup_mark(hid, p_step);
  return public.club_family_profile();
exception
  when check_violation or invalid_text_representation then raise exception 'invalid';
end $$;
revoke execute on function public.club_focus_save(text, text[], text, text, text) from public, anon;
grant execute on function public.club_focus_save(text, text[], text, text, text) to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.club_activities enable row level security;
alter table public.club_responsibilities enable row level security;
revoke all on public.club_activities, public.club_responsibilities from public, anon, authenticated;
grant all on public.club_activities, public.club_responsibilities to service_role;
grant select on public.club_activities, public.club_responsibilities to authenticated;
create policy "Members read their activities" on public.club_activities
  for select to authenticated using (household_id in (select id from public.club_households where owner_user_id = (select auth.uid())));
create policy "Members read their responsibilities" on public.club_responsibilities
  for select to authenticated using (household_id in (select id from public.club_households where owner_user_id = (select auth.uid())));

commit;
