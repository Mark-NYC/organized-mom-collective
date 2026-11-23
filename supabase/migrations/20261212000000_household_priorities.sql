-- This week's family priorities (docs/ios/FAMILY_PLAN.md): the few things the family deliberately chose in its
-- Family Meeting ("Friday's trip", "the school presentation", "working together on the morning rush").
--
-- NOT APPLIED. Needs 20261124 (households), 20261125 (the family calendar) and 20261205 (calendar subscriptions).
-- Tested on a throwaway database (supabase/tests/household-priorities.sql). Applying needs the owner's approval.
--
-- Why a table: nothing existing can hold a deliberate choice. The family profile has ONE focus; calendar events have
-- no "this matters to us" mark (and imported events are rewritten on every refresh); agreements are standing parts
-- owned by a person. A priority is none of those, so it gets the smallest record of its own, and nothing else changes.
--
--   - A priority is chosen, never automatic: no calendar event becomes one unless an adult highlights it.
--   - An event priority is a LINK, not a copy: the family's own event (id + occurrence date) or an imported occurrence
--     (UID + occurrence key, the identity calendar_event_tasks uses). The app shows the event as it is now; when it's
--     moved or cancelled the priority says so instead of going stale. The title is kept only as a fallback label.
--   - Privacy: an imported event can be highlighted only from a calendar SHARED with the household (never from an
--     adult's private calendar), and it shows only while that is still true (or to the adult who chose it).
--   - Both adults are equal: either can highlight, add, rename or remove; both see the same list. One adult is enough.
--   - Per week (week_of = the Monday of the meeting's week, local), at most 5 (the app shows 3). Free: no Club needed.
begin;

create table public.household_priorities (
  -- Made on the phone, so a retried save never duplicates.
  id uuid primary key,
  household_id uuid not null references public.club_households (id) on delete cascade,
  week_of date not null check (extract(isodow from week_of) = 1),
  kind text not null check (kind in ('event', 'note')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  -- Event priorities: where the event lives. 'family' = calendar_events.id (event_uid) on a date (instance_key);
  -- 'imported' = calendar_feed_events (uid, instance_key).
  source text check (source in ('family', 'imported')),
  event_uid text check (char_length(event_uid) between 1 and 255),
  instance_key text check (char_length(instance_key) between 10 and 40),
  event_on date,
  sort smallint not null default 0 check (sort between 0 and 99),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'note' and source is null and event_uid is null and instance_key is null and event_on is null)
      or (kind = 'event' and source is not null and event_uid is not null and instance_key is not null and event_on is not null))
);
create index household_priorities_week on public.household_priorities (household_id, week_of);
-- Highlighting the same occurrence twice in a week is the same priority.
create unique index household_priorities_event on public.household_priorities (household_id, week_of, source, event_uid, instance_key) where kind = 'event';

-- Only through the functions below.
alter table public.household_priorities enable row level security;
revoke all on public.household_priorities from public, anon, authenticated;
grant all on public.household_priorities to service_role;

create function public.household_priority_json(p public.household_priorities, p_uid uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'week_of', p.week_of, 'kind', p.kind, 'title', p.title, 'source', p.source,
    'event_uid', p.event_uid, 'instance_key', p.instance_key, 'event_on', p.event_on, 'sort', p.sort,
    'mine', p.created_by = p_uid, 'updated_at', p.updated_at)
$$;
revoke execute on function public.household_priority_json(public.household_priorities, uuid) from public, anon, authenticated;

-- An imported occurrence this household shares: on a calendar shared with the household whose owner is still in it.
create function public.household_shared_occurrence(p_household uuid, p_uid text, p_key text) returns table (title text, event_on date)
language sql stable security definer set search_path = '' as $$
  select e.title, coalesce(e.start_date, (e.starts_at at time zone f.timezone)::date)
    from public.calendar_feed_events e join public.calendar_feeds f on f.id = e.feed_id
   where e.household_id = p_household and e.uid = p_uid and (p_key is null or e.instance_key = p_key)
     and f.visibility = 'household'
     and exists (select 1 from public.household_adults a where a.household_id = f.household_id and a.user_id = f.owner_user_id)
   order by f.created_at limit 1
$$;
revoke execute on function public.household_shared_occurrence(uuid, text, text) from public, anon, authenticated;

create function public.household_priorities_guard(p_uid uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare hid uuid;
begin
  if p_uid is null then raise exception 'not_signed_in'; end if;
  hid := public.household_id_for(p_uid);
  if hid is null then raise exception 'no_household'; end if;
  return hid;
end $$;
revoke execute on function public.household_priorities_guard(uuid) from public, anon, authenticated;

-- The household's priorities for weeks starting between two dates. An imported event's priority shows only while
-- its calendar is still shared with the household (or to the adult who chose it).
create function public.household_priorities(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.household_priorities_guard(auth.uid());
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 120 then raise exception 'invalid'; end if;
  return coalesce((
    select jsonb_agg(public.household_priority_json(p, uid) order by p.week_of desc, p.sort, p.created_at)
      from public.household_priorities p
     where p.household_id = hid and p.week_of between p_from and p_to
       and (p.source is distinct from 'imported' or p.created_by = uid
            or exists (select 1 from public.household_shared_occurrence(hid, p.event_uid, null)))), '[]');
end $$;
revoke execute on function public.household_priorities(date, date) from public, anon;
grant execute on function public.household_priorities(date, date) to authenticated;

-- Highlight an event or add a note, or rename a note / reorder. p: { id, week_of, kind, title?, source?, event_uid?,
-- instance_key?, sort? }. The event's title comes from the event itself. At most 5 per week.
create function public.household_priority_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.household_priorities_guard(auth.uid());
  pid uuid := nullif(p ->> 'id', '')::uuid;
  wk date := nullif(p ->> 'week_of', '')::date;
  r public.household_priorities%rowtype;
  t text;
  d date;
  ev public.calendar_events%rowtype;
begin
  if pid is null or wk is null or jsonb_typeof(p) <> 'object' then raise exception 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('household-priority:' || hid::text, 0));
  select * into r from public.household_priorities where id = pid;
  if found then
    if r.household_id <> hid then raise exception 'invalid'; end if;
    update public.household_priorities
       set title = case when r.kind = 'note' and p ? 'title' then btrim(p ->> 'title') else title end,
           sort = coalesce((p ->> 'sort')::smallint, sort), updated_by = uid, updated_at = now()
     where id = pid returning * into r;
    return public.household_priority_json(r, uid);
  end if;
  if (select count(*) from public.household_priorities x where x.household_id = hid and x.week_of = wk) >= 5 then raise exception 'too_many'; end if;
  if p ->> 'kind' = 'note' then
    insert into public.household_priorities (id, household_id, week_of, kind, title, sort, created_by, updated_by)
    values (pid, hid, wk, 'note', btrim(p ->> 'title'), coalesce((p ->> 'sort')::smallint, 0), uid, uid) returning * into r;
    return public.household_priority_json(r, uid);
  end if;
  if p ->> 'kind' <> 'event' then raise exception 'invalid'; end if;
  if p ->> 'source' = 'family' then
    -- The family's own event, on one of its dates (repeats are expanded on the phone; the date is checked for shape).
    if (p ->> 'instance_key') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid'; end if;
    select * into ev from public.calendar_events where id = nullif(p ->> 'event_uid', '')::uuid and household_id = hid and deleted_at is null;
    if not found then raise exception 'not_found'; end if;
    t := ev.title; d := (p ->> 'instance_key')::date;
  elsif p ->> 'source' = 'imported' then
    select o.title, o.event_on into t, d from public.household_shared_occurrence(hid, p ->> 'event_uid', p ->> 'instance_key') o;
    if t is null then raise exception 'not_found'; end if; -- not on a calendar shared with the household
  else
    raise exception 'invalid';
  end if;
  select * into r from public.household_priorities x
   where x.household_id = hid and x.week_of = wk and x.kind = 'event' and x.source = p ->> 'source' and x.event_uid = p ->> 'event_uid' and x.instance_key = p ->> 'instance_key';
  if found then return public.household_priority_json(r, uid); end if; -- already highlighted (the other adult, say)
  insert into public.household_priorities (id, household_id, week_of, kind, title, source, event_uid, instance_key, event_on, sort, created_by, updated_by)
  values (pid, hid, wk, 'event', left(t, 120), p ->> 'source', p ->> 'event_uid', p ->> 'instance_key', d, coalesce((p ->> 'sort')::smallint, 0), uid, uid)
  returning * into r;
  return public.household_priority_json(r, uid);
exception
  when check_violation or invalid_text_representation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid';
end $$;
revoke execute on function public.household_priority_save(jsonb) from public, anon;
grant execute on function public.household_priority_save(jsonb) to authenticated;

-- Remove one (either adult). Removing something already gone is a no-op.
create function public.household_priority_remove(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare hid uuid := public.household_priorities_guard(auth.uid());
begin
  delete from public.household_priorities where id = p_id and household_id = hid;
  return found;
end $$;
revoke execute on function public.household_priority_remove(uuid) from public, anon;
grant execute on function public.household_priority_remove(uuid) to authenticated;

commit;
