-- The family calendar (docs/ios/FAMILY_CALENDAR.md). Free: any household, no Club membership needed.
--
-- NOT APPLIED. Needs 20261124000000_household_shared.sql. Built and tested on a throwaway database
-- (scripts/test-household-sql.sh → supabase/tests/family-calendar.sql); applying it needs the owner's approval.
--
-- Events belong to the shared household (club_households) and name people by their stable family-member ids, so
-- colors come from the one family profile. Both adults read and write; children have no accounts.
--
-- Wall-clock time: a family calendar is local ("practice at 5:30 on Tuesdays"), so an event is a local date + optional
-- local start/end time + the household's time zone, never a UTC instant. Recurrence is a small structured rule
-- (weekly on some days, daily, monthly by date, yearly; every N; until a date) with skipped dates, expanded in the
-- app (src/lib/calendar/recurrence.ts).
--
-- Offline-first sync (src/lib/calendar/sync.ts): ids are made on the phone, so a retried save never duplicates;
-- every save carries the revision it was based on and a stale one is refused ('conflict') instead of overwriting the
-- other adult; deletes are tombstones so the other phone learns about them; calendar_changes(since) returns
-- everything changed after a server time.
begin;

-- A repeat rule the app can expand: freq daily|weekly|monthly|yearly, interval 1–52, by_day (weekly only, 0 = Sunday),
-- until (a date). Nothing else.
create function public.calendar_recurrence_ok(r jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(r) = 'object'
     and not exists (select 1 from jsonb_object_keys(r) k where k not in ('freq', 'interval', 'by_day', 'until'))
     and r ->> 'freq' in ('daily', 'weekly', 'monthly', 'yearly')
     and (not r ? 'interval' or (jsonb_typeof(r -> 'interval') = 'number' and (r ->> 'interval') ~ '^[0-9]+$' and (r ->> 'interval')::int between 1 and 52))
     and (not r ? 'by_day' or (r ->> 'freq' = 'weekly' and jsonb_typeof(r -> 'by_day') = 'array' and jsonb_array_length(r -> 'by_day') between 1 and 7
          and not exists (select 1 from jsonb_array_elements(r -> 'by_day') d where jsonb_typeof(d) <> 'number' or d::text !~ '^[0-6]$')))
     and (not r ? 'until' or (jsonb_typeof(r -> 'until') = 'string' and (r ->> 'until') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
$$;

create table public.calendar_events (
  id uuid primary key,
  household_id uuid not null references public.club_households (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  notes text check (char_length(notes) <= 1000),
  location text check (char_length(location) <= 120),
  -- Local date of the (first) occurrence; local times, or both null for an all-day event.
  starts_on date not null,
  start_time time,
  end_time time,
  ends_on date, -- multi-day all-day events (a trip); null = same day
  timezone text not null default 'America/New_York' check (char_length(timezone) between 3 and 64),
  -- {"freq":"weekly","interval":1,"by_day":[2,4],"until":"2027-06-12"} | {"freq":"daily"|"monthly"|"yearly", …} | null
  recurrence jsonb check (recurrence is null or public.calendar_recurrence_ok(recurrence)),
  -- Dates (local) of occurrences she skipped ("no practice on the 18th").
  skip_dates date[] not null default '{}' check (cardinality(skip_dates) <= 200),
  -- Who it's for, and who's responsible (drives, brings, takes them): stable club_family_members ids.
  member_ids uuid[] not null default '{}' check (cardinality(member_ids) <= 12),
  owner_member_id uuid,
  -- Where it came from: typed in, imported from the family profile's typical week, (future) Google or the Inbox.
  source text not null default 'manual' check (source in ('manual', 'activity')),
  source_ref uuid,
  revision int not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (start_time is not null or end_time is null),
  check (end_time is null or start_time is null or end_time > start_time),
  check (ends_on is null or ends_on >= starts_on),
  check (recurrence is null or ends_on is null)
);
create index calendar_events_household_changed on public.calendar_events (household_id, updated_at);
-- One imported event per typical-week activity (importing twice is a no-op).
create unique index calendar_events_activity on public.calendar_events (household_id, source_ref) where source = 'activity' and deleted_at is null;

alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from public, anon, authenticated;
grant all on public.calendar_events to service_role;
grant select on public.calendar_events to authenticated;
create policy "Adults read their calendar" on public.calendar_events
  for select to authenticated using (household_id = (select public.household_id_for(auth.uid())));

-- ---------------------------------------------------------------- reading and writing

create function public.calendar_event_json(e public.calendar_events) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'title', e.title, 'notes', e.notes, 'location', e.location,
    'starts_on', e.starts_on, 'start_time', to_char(e.start_time, 'HH24:MI'), 'end_time', to_char(e.end_time, 'HH24:MI'),
    'ends_on', e.ends_on, 'timezone', e.timezone, 'recurrence', e.recurrence, 'skip_dates', to_jsonb(e.skip_dates),
    'member_ids', to_jsonb(e.member_ids), 'owner_member_id', e.owner_member_id, 'source', e.source, 'source_ref', e.source_ref,
    'revision', e.revision, 'updated_at', e.updated_at, 'deleted', e.deleted_at is not null)
$$;
revoke execute on function public.calendar_event_json(public.calendar_events) from public, anon, authenticated;

-- Create or change one event. p_base_revision: the revision this edit started from (null for a new event). A stale one
-- raises 'conflict': the other adult changed or deleted it first; the app pulls their version instead of overwriting.
create function public.calendar_event_save(p_event jsonb, p_base_revision int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.club_my_household();
  eid uuid := (p_event ->> 'id')::uuid;
  cur public.calendar_events%rowtype;
  members uuid[] := public.club_uuid_list(p_event -> 'member_ids');
  owner uuid := nullif(p_event ->> 'owner_member_id', '')::uuid;
  saved public.calendar_events%rowtype;
begin
  if eid is null or jsonb_typeof(p_event) <> 'object' then raise exception 'invalid'; end if;
  if not public.club_members_belong(hid, members || case when owner is null then '{}'::uuid[] else array[owner] end) then raise exception 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('calendar-event:' || eid::text, 0));
  select * into cur from public.calendar_events where id = eid;
  if found then
    if cur.household_id <> hid then raise exception 'invalid'; end if;
    if cur.deleted_at is not null or p_base_revision is distinct from cur.revision then raise exception 'conflict'; end if;
    update public.calendar_events set
      title = btrim(p_event ->> 'title'), notes = nullif(btrim(p_event ->> 'notes'), ''), location = nullif(btrim(p_event ->> 'location'), ''),
      starts_on = (p_event ->> 'starts_on')::date, start_time = nullif(p_event ->> 'start_time', '')::time,
      end_time = nullif(p_event ->> 'end_time', '')::time, ends_on = nullif(p_event ->> 'ends_on', '')::date,
      timezone = coalesce(nullif(p_event ->> 'timezone', ''), cur.timezone),
      recurrence = case when jsonb_typeof(p_event -> 'recurrence') = 'object' then p_event -> 'recurrence' end,
      skip_dates = coalesce((select array_agg(distinct x::date) from jsonb_array_elements_text(coalesce(p_event -> 'skip_dates', '[]')) x), '{}'),
      member_ids = members, owner_member_id = owner,
      revision = cur.revision + 1, updated_by = uid, updated_at = now()
    where id = eid returning * into saved;
  else
    if p_base_revision is not null then raise exception 'conflict'; end if; -- edited something that no longer exists
    insert into public.calendar_events (id, household_id, title, notes, location, starts_on, start_time, end_time, ends_on,
                                        timezone, recurrence, skip_dates, member_ids, owner_member_id, source, created_by, updated_by)
    values (eid, hid, btrim(p_event ->> 'title'), nullif(btrim(p_event ->> 'notes'), ''), nullif(btrim(p_event ->> 'location'), ''),
            (p_event ->> 'starts_on')::date, nullif(p_event ->> 'start_time', '')::time, nullif(p_event ->> 'end_time', '')::time,
            nullif(p_event ->> 'ends_on', '')::date, coalesce(nullif(p_event ->> 'timezone', ''), 'America/New_York'),
            case when jsonb_typeof(p_event -> 'recurrence') = 'object' then p_event -> 'recurrence' end,
            coalesce((select array_agg(distinct x::date) from jsonb_array_elements_text(coalesce(p_event -> 'skip_dates', '[]')) x), '{}'),
            members, owner, 'manual', uid, uid)
    returning * into saved;
  end if;
  return public.calendar_event_json(saved);
exception
  when check_violation or invalid_text_representation or not_null_violation or invalid_datetime_format
       or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'invalid';
end $$;
revoke execute on function public.calendar_event_save(jsonb, int) from public, anon;
grant execute on function public.calendar_event_save(jsonb, int) to authenticated;

-- Delete (a tombstone, so the other adult's phone hears about it). Deleting something already gone is a no-op.
create function public.calendar_event_delete(p_id uuid, p_base_revision int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.club_my_household();
  cur public.calendar_events%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('calendar-event:' || p_id::text, 0));
  select * into cur from public.calendar_events where id = p_id and household_id = hid;
  if not found then return null; end if;
  if cur.deleted_at is not null then return public.calendar_event_json(cur); end if;
  if p_base_revision is distinct from cur.revision then raise exception 'conflict'; end if;
  update public.calendar_events set deleted_at = now(), revision = revision + 1, updated_by = auth.uid(), updated_at = now()
   where id = p_id returning * into cur;
  return public.calendar_event_json(cur);
end $$;
revoke execute on function public.calendar_event_delete(uuid, int) from public, anon;
grant execute on function public.calendar_event_delete(uuid, int) to authenticated;

-- Everything changed after p_since (null: every live event), deletes included, plus the server's clock for next time.
create function public.calendar_changes(p_since timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  hid uuid := public.household_id_for(auth.uid());
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if hid is null then return jsonb_build_object('now', now(), 'events', '[]'::jsonb); end if;
  return jsonb_build_object('now', now(), 'events', coalesce((
    select jsonb_agg(public.calendar_event_json(e) order by e.updated_at)
      from public.calendar_events e
     where e.household_id = hid
       and (case when p_since is null then e.deleted_at is null else e.updated_at > p_since end)), '[]'));
end $$;
revoke execute on function public.calendar_changes(timestamptz) from public, anon;
grant execute on function public.calendar_changes(timestamptz) to authenticated;

-- The family profile's typical week (club_activities: "soccer Tue/Thu 5:30, Sofia") becomes weekly events, so nobody
-- types it twice. Each activity once (re-running adds only new ones). Returns how many were added.
create function public.calendar_import_activities(p_starts_on date, p_timezone text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.club_my_household();
  n int;
begin
  insert into public.calendar_events (id, household_id, title, starts_on, start_time, timezone, recurrence, member_ids, source, source_ref, created_by, updated_by)
  select gen_random_uuid(), hid,
         coalesce(a.name, initcap(replace(a.category, '-', ' '))),
         coalesce(p_starts_on, current_date), a.starts_at, coalesce(nullif(p_timezone, ''), 'America/New_York'),
         jsonb_build_object('freq', 'weekly', 'interval', 1, 'by_day', to_jsonb(a.days)),
         a.member_ids, 'activity', a.id, auth.uid(), auth.uid()
    from public.club_activities a
   where a.household_id = hid and cardinality(a.days) > 0
     and not exists (select 1 from public.calendar_events e where e.household_id = hid and e.source = 'activity' and e.source_ref = a.id and e.deleted_at is null)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.calendar_import_activities(date, text) from public, anon;
grant execute on function public.calendar_import_activities(date, text) to authenticated;

commit;
