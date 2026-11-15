-- Sunday Setup: the household's weekly review (docs/ios/SUNDAY_SETUP.md). Free, no Club membership.
--
-- NOT APPLIED. Needs 20261124000000_household_shared.sql (and the calendar, 20261125000000). Tested on a throwaway
-- database (supabase/tests/sunday-setup.sql); applying it needs the owner's approval.
--
-- One plan per household per week. Everything else Sunday Setup shows is read from where it already lives (the
-- calendar, the family profile's responsibilities, the cleaning companion's zones, the Club's month), so nothing is
-- entered twice. The plan holds only what's new each week:
--   dinners  {"2026-11-16": {"meal": "Tacos", "cook": <member id>}, …}
--   chores   {"2026-11-16": <member id>, …}   who helps with that day's cleaning zone
--   notes    a line for the family ("Grandma visits Saturday")
-- Both adults edit it; a save from a stale copy is refused ('conflict'), like the calendar.
begin;

create table public.sunday_setups (
  household_id uuid not null references public.club_households (id) on delete cascade,
  -- The first day of the week this plan is for (a Sunday or Monday, the household's choice).
  week_start date not null,
  dinners jsonb not null default '{}' check (jsonb_typeof(dinners) = 'object' and octet_length(dinners::text) <= 4000),
  chores jsonb not null default '{}' check (jsonb_typeof(chores) = 'object' and octet_length(chores::text) <= 2000),
  notes text check (char_length(notes) <= 500),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  revision int not null default 1,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (household_id, week_start)
);

alter table public.sunday_setups enable row level security;
revoke all on public.sunday_setups from public, anon, authenticated;
grant all on public.sunday_setups to service_role;
grant select on public.sunday_setups to authenticated;
create policy "Adults read their Sunday Setup" on public.sunday_setups
  for select to authenticated using (household_id = (select public.household_id_for(auth.uid())));

create function public.sunday_setup_json(s public.sunday_setups) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('week_start', s.week_start, 'dinners', s.dinners, 'chores', s.chores, 'notes', s.notes,
                            'completed', s.completed_at is not null, 'revision', s.revision, 'updated_at', s.updated_at)
$$;
revoke execute on function public.sunday_setup_json(public.sunday_setups) from public, anon, authenticated;

create function public.sunday_setup_get(p_week_start date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.sunday_setups%rowtype;
begin
  select * into s from public.sunday_setups where household_id = public.club_my_household() and week_start = p_week_start;
  if not found then return null; end if;
  return public.sunday_setup_json(s);
end $$;
revoke execute on function public.sunday_setup_get(date) from public, anon;
grant execute on function public.sunday_setup_get(date) to authenticated;

-- Save this week's plan. p_base_revision: the revision it started from (null for the first save of the week).
create function public.sunday_setup_save(p_week_start date, p_dinners jsonb, p_chores jsonb, p_notes text, p_completed boolean, p_base_revision int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.club_my_household();
  cur public.sunday_setups%rowtype;
  saved public.sunday_setups%rowtype;
  people uuid[];
begin
  if p_week_start is null or p_week_start < current_date - 60 or p_week_start > current_date + 120 then raise exception 'invalid'; end if;
  if jsonb_typeof(coalesce(p_dinners, '{}')) <> 'object' or jsonb_typeof(coalesce(p_chores, '{}')) <> 'object' then raise exception 'invalid'; end if;
  -- Keys are dates in this week; dinners are {meal, cook}; people are this household's.
  if exists (select 1 from jsonb_object_keys(coalesce(p_dinners, '{}')) k where k !~ '^\d{4}-\d{2}-\d{2}$' or k::date not between p_week_start and p_week_start + 6)
     or exists (select 1 from jsonb_object_keys(coalesce(p_chores, '{}')) k where k !~ '^\d{4}-\d{2}-\d{2}$' or k::date not between p_week_start and p_week_start + 6)
     or exists (select 1 from jsonb_each(coalesce(p_dinners, '{}')) d where jsonb_typeof(d.value) <> 'object'
                  or exists (select 1 from jsonb_object_keys(d.value) k where k not in ('meal', 'cook'))
                  or char_length(coalesce(d.value ->> 'meal', '')) > 60) then
    raise exception 'invalid';
  end if;
  people := coalesce((select array_agg((d.value ->> 'cook')::uuid) from jsonb_each(coalesce(p_dinners, '{}')) d where nullif(d.value ->> 'cook', '') is not null), '{}')
         || coalesce((select array_agg(c.value::uuid) from jsonb_each_text(coalesce(p_chores, '{}')) c where nullif(c.value, '') is not null), '{}');
  if not public.club_members_belong(hid, people) then raise exception 'invalid'; end if;

  perform pg_advisory_xact_lock(hashtextextended('sunday-setup:' || hid::text || p_week_start::text, 0));
  select * into cur from public.sunday_setups where household_id = hid and week_start = p_week_start;
  if found then
    if p_base_revision is distinct from cur.revision then raise exception 'conflict'; end if;
    update public.sunday_setups set dinners = coalesce(p_dinners, '{}'), chores = coalesce(p_chores, '{}'), notes = nullif(btrim(p_notes), ''),
           completed_at = case when p_completed then coalesce(cur.completed_at, now()) end,
           completed_by = case when p_completed then coalesce(cur.completed_by, uid) end,
           revision = cur.revision + 1, updated_by = uid, updated_at = now()
     where household_id = hid and week_start = p_week_start returning * into saved;
  else
    if p_base_revision is not null then raise exception 'conflict'; end if;
    insert into public.sunday_setups (household_id, week_start, dinners, chores, notes, completed_at, completed_by, updated_by)
    values (hid, p_week_start, coalesce(p_dinners, '{}'), coalesce(p_chores, '{}'), nullif(btrim(p_notes), ''),
            case when p_completed then now() end, case when p_completed then uid end, uid)
    returning * into saved;
  end if;
  return public.sunday_setup_json(saved);
exception
  when check_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid';
end $$;
revoke execute on function public.sunday_setup_save(date, jsonb, jsonb, text, boolean, int) from public, anon;
grant execute on function public.sunday_setup_save(date, jsonb, jsonb, text, boolean, int) to authenticated;

commit;
