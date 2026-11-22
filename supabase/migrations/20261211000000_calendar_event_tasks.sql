-- Responsibilities on imported calendar events (docs/calendar/EVENT_RESPONSIBILITIES.md).
--
-- NOT APPLIED. Needs 20261205 (calendar subscriptions) and 20261206 (Google). Tested on a throwaway database
-- (supabase/tests/calendar-event-tasks.sql). Applying needs the owner's approval.
--
-- Google Calendar (or a school's iCal feed) says what's happening; the family says who does what. An adult opens an
-- imported event and adds "Pack soccer bag · Mateo", "Drive · Luis"; anyone marks it done; both adults' phones see it.
--
-- Ownership of the data:
--   - The source calendar stays the source of truth for the event (title, time, place, repeats, cancellation).
--     Nothing here writes to it, and calendar_feed_events is untouched: the refresher still replaces it wholesale.
--   - Organized Family owns the responsibilities, kept HERE, apart from the imported events, so a refresh, a failed
--     refresh or removing and re-adding a calendar never touches them.
--
-- Which event a responsibility belongs to: (household, the event's UID, its occurrence key), the same identity the
-- calendar already uses to show an occurrence once when both adults import the same calendar (calendar_feed_events).
--   - UID + occurrence key are stable across refreshes and edits of that occurrence (a moved or renamed practice keeps
--     its key: RECURRENCE-ID / Google's originalStartTime), so each occurrence of a repeating event has its own
--     responsibilities, and reconnecting a calendar finds them again instead of duplicating.
--   - A ONE-OFF event that is rescheduled gets a new key (its key is its start). It is followed only when it's safe:
--     the responsibility was made on a one-off event, the UID now has exactly one occurrence in the household's
--     calendars, and it moved no more than 45 days. Anything else is left where it was, never attached to a guess.
--   - Cancelled, deleted or no-longer-fetched events: their responsibilities are kept, never deleted by a refresh. The
--     app shows unfinished ones as "no longer on the calendar" for a few days, with Remove.
--
-- Privacy follows the calendar: a responsibility shows to an adult who can see its event (their own calendar, or one
-- shared with the household), or who made it. The event title and date are copied only as a fallback label for when
-- the event is gone.
--
-- Who: only the household's adults (household_adults) read and write, through the functions below. Children have no
-- accounts; they are named as assignees by their family-member id (their color). A member removed from the family
-- leaves their responsibilities unassigned.
--
-- Staged rollout, server-enforced: on only where calendar subscriptions are on AND the household has a tester with
-- calendar_feed_testers.event_tasks, until calendar_feed_rollout.event_tasks_everyone is turned on.
begin;

alter table public.calendar_feed_testers add column event_tasks boolean not null default false;
alter table public.calendar_feed_rollout add column event_tasks_everyone boolean not null default false;

create function public.calendar_event_tasks_enabled(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.calendar_feeds_enabled(p_uid) and (
    coalesce((select event_tasks_everyone from public.calendar_feed_rollout where id), false)
    or exists (select 1 from public.calendar_feed_testers t where t.user_id = p_uid and t.event_tasks)
    or exists (select 1 from public.calendar_feed_testers t join public.household_adults a on a.user_id = t.user_id
                where t.event_tasks and a.household_id = public.household_id_for(p_uid)))
$$;
revoke execute on function public.calendar_event_tasks_enabled(uuid) from public, anon, authenticated;

create table public.calendar_event_tasks (
  -- Made on the phone, so a retried save never duplicates.
  id uuid primary key,
  household_id uuid not null references public.club_households (id) on delete cascade,
  event_uid text not null check (char_length(event_uid) between 1 and 255),
  instance_key text not null check (char_length(instance_key) between 10 and 40),
  -- Which calendar it was added from (for the label only; identity is the UID + occurrence).
  feed_id uuid references public.calendar_feeds (id) on delete set null,
  -- The event was a one-off (one occurrence) when this was added: only then is a reschedule followed.
  single boolean not null default false,
  -- Fallback label if the event leaves the calendar, refreshed while it's there.
  event_title text not null check (char_length(event_title) between 1 and 120),
  event_on date not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  member_id uuid references public.club_family_members (id) on delete set null,
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_event_tasks_event on public.calendar_event_tasks (household_id, event_uid, instance_key);
create index calendar_event_tasks_day on public.calendar_event_tasks (household_id, event_on);
create index calendar_event_tasks_member on public.calendar_event_tasks (member_id) where member_id is not null;

-- Only through the functions below.
alter table public.calendar_event_tasks enable row level security;
revoke all on public.calendar_event_tasks from public, anon, authenticated;
grant all on public.calendar_event_tasks to service_role;

-- The household's imported occurrences this adult may see (each once, however many adults imported it).
create function public.calendar_event_tasks_events(p_uid uuid) returns table (feed_id uuid, uid text, instance_key text, title text, event_on date, timezone text)
language sql stable security definer set search_path = '' as $$
  select distinct on (e.uid, e.instance_key) e.feed_id, e.uid, e.instance_key, e.title,
         coalesce(e.start_date, (e.starts_at at time zone f.timezone)::date), f.timezone
    from public.calendar_feed_events e
    join public.calendar_feeds_visible(p_uid) f on f.id = e.feed_id
   order by e.uid, e.instance_key, (f.visibility = 'household') desc, (f.owner_user_id = p_uid) desc, f.created_at
$$;
revoke execute on function public.calendar_event_tasks_events(uuid) from public, anon, authenticated;

create function public.calendar_event_task_json(t public.calendar_event_tasks) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'event_uid', t.event_uid, 'instance_key', t.instance_key, 'feed_id', t.feed_id,
    'single', t.single, 'event_title', t.event_title, 'event_on', t.event_on, 'title', t.title,
    -- A member who has left the family no longer shows as responsible.
    'member_id', (select m.id from public.club_family_members m where m.id = t.member_id and m.archived_at is null),
    'done', t.done_at is not null, 'done_at', t.done_at, 'updated_at', t.updated_at)
$$;
revoke execute on function public.calendar_event_task_json(public.calendar_event_tasks) from public, anon, authenticated;

-- This adult may see / change it: in their household, and they can see its event (any occurrence of it) or made it.
create function public.calendar_event_task_for(p_uid uuid, p_id uuid) returns public.calendar_event_tasks
language sql stable security definer set search_path = '' as $$
  select t.* from public.calendar_event_tasks t
   where t.id = p_id and t.household_id = public.household_id_for(p_uid)
     and (t.created_by = p_uid or exists (select 1 from public.calendar_event_tasks_events(p_uid) v where v.uid = t.event_uid))
$$;
revoke execute on function public.calendar_event_task_for(uuid, uuid) from public, anon, authenticated;

create function public.calendar_event_tasks_guard(p_uid uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare hid uuid;
begin
  if p_uid is null then raise exception 'not_signed_in'; end if;
  if not public.calendar_event_tasks_enabled(p_uid) then raise exception 'not_enabled'; end if;
  hid := public.household_id_for(p_uid);
  if hid is null then raise exception 'no_household'; end if;
  return hid;
end $$;
revoke execute on function public.calendar_event_tasks_guard(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- reading
-- Responsibilities for events between two local dates, for the household's adults. First brings their labels up to
-- date and follows safely rescheduled one-off events (see the header); never deletes anything.
create function public.calendar_event_tasks(p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.calendar_event_tasks_guard(auth.uid());
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'invalid'; end if;
  -- One-off events that moved: exactly one occurrence of that UID across the household's calendars, within 45 days.
  with cur as (
    select e.uid, min(e.instance_key) as instance_key, count(distinct e.instance_key) as n,
           min(coalesce(e.start_date, (e.starts_at at time zone f.timezone)::date)) as event_on, min(e.title) as title
      from public.calendar_feed_events e join public.calendar_feeds f on f.id = e.feed_id
     where e.household_id = hid
       and e.uid in (select t.event_uid from public.calendar_event_tasks t where t.household_id = hid and t.single)
     group by e.uid
  )
  update public.calendar_event_tasks t
     set instance_key = cur.instance_key, event_on = cur.event_on, event_title = left(cur.title, 120), updated_at = now()
    from cur
   where t.household_id = hid and t.single and t.event_uid = cur.uid and cur.n = 1 and t.instance_key <> cur.instance_key
     and abs(cur.event_on - t.event_on) <= 45
     and not exists (select 1 from public.calendar_feed_events e where e.household_id = hid and e.uid = t.event_uid and e.instance_key = t.instance_key);
  -- Labels follow the event while it's on the calendar (renamed, moved within its occurrence).
  update public.calendar_event_tasks t
     set event_title = left(v.title, 120), event_on = v.event_on
    from (select distinct on (e.uid, e.instance_key) e.uid, e.instance_key, e.title,
                 coalesce(e.start_date, (e.starts_at at time zone f.timezone)::date) as event_on
            from public.calendar_feed_events e join public.calendar_feeds f on f.id = e.feed_id
           where e.household_id = hid order by e.uid, e.instance_key, f.created_at) v
   where t.household_id = hid and t.event_uid = v.uid and t.instance_key = v.instance_key
     and (t.event_title is distinct from left(v.title, 120) or t.event_on is distinct from v.event_on);
  return coalesce((
    with vis as (select distinct v.uid from public.calendar_event_tasks_events(uid) v)
    select jsonb_agg(public.calendar_event_task_json(t) order by t.event_on, t.created_at)
      from public.calendar_event_tasks t
     where t.household_id = hid and t.event_on between p_from and p_to
       and (t.created_by = uid or t.event_uid in (select vis.uid from vis))), '[]');
end $$;
revoke execute on function public.calendar_event_tasks(date, date) from public, anon;
grant execute on function public.calendar_event_tasks(date, date) to authenticated;

-- ---------------------------------------------------------------- writing
-- Add or change one. p: { id, event_uid, instance_key, title, member_id? }. A new one needs an imported occurrence this
-- adult can see; a retried save with the same id is the same responsibility. At most 20 per occurrence.
create function public.calendar_event_task_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.calendar_event_tasks_guard(auth.uid());
  tid uuid := nullif(p ->> 'id', '')::uuid;
  mid uuid := nullif(p ->> 'member_id', '')::uuid;
  t public.calendar_event_tasks%rowtype;
  ev record;
begin
  if tid is null or jsonb_typeof(p) <> 'object' then raise exception 'invalid'; end if;
  if mid is not null and not exists (select 1 from public.club_family_members m where m.id = mid and m.household_id = hid and m.archived_at is null) then
    raise exception 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('calendar-event-task:' || tid::text, 0));
  select * into t from public.calendar_event_tasks where id = tid;
  if found then
    if t.household_id <> hid then raise exception 'invalid'; end if;
    select * into t from public.calendar_event_task_for(uid, tid);
    if t.id is null then raise exception 'not_found'; end if;
    update public.calendar_event_tasks set title = btrim(coalesce(p ->> 'title', title)),
           member_id = case when p ? 'member_id' then mid else member_id end, updated_by = uid, updated_at = now()
     where id = tid returning * into t;
    return public.calendar_event_task_json(t);
  end if;
  select v.* into ev from public.calendar_event_tasks_events(uid) v where v.uid = p ->> 'event_uid' and v.instance_key = p ->> 'instance_key';
  if not found then raise exception 'not_found'; end if;
  if (select count(*) from public.calendar_event_tasks x where x.household_id = hid and x.event_uid = ev.uid and x.instance_key = ev.instance_key) >= 20 then
    raise exception 'too_many';
  end if;
  insert into public.calendar_event_tasks (id, household_id, event_uid, instance_key, feed_id, single, event_title, event_on, title, member_id, created_by, updated_by)
  values (tid, hid, ev.uid, ev.instance_key, ev.feed_id,
          (select count(distinct e.instance_key) from public.calendar_feed_events e where e.household_id = hid and e.uid = ev.uid) = 1,
          left(ev.title, 120), ev.event_on, btrim(p ->> 'title'), mid, uid, uid)
  returning * into t;
  return public.calendar_event_task_json(t);
exception
  when check_violation or invalid_text_representation or not_null_violation then raise exception 'invalid';
end $$;
revoke execute on function public.calendar_event_task_save(jsonb) from public, anon;
grant execute on function public.calendar_event_task_save(jsonb) to authenticated;

-- Done, or not done after all. Setting what's already set is a no-op (two phones tapping at once agree).
create function public.calendar_event_task_done(p_id uuid, p_done boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.calendar_event_tasks_guard(auth.uid());
  t public.calendar_event_tasks%rowtype;
begin
  select * into t from public.calendar_event_task_for(uid, p_id);
  if t.id is null then raise exception 'not_found'; end if;
  if (t.done_at is not null) is distinct from coalesce(p_done, false) then
    update public.calendar_event_tasks set done_at = case when p_done then now() end, done_by = case when p_done then uid end,
           updated_by = uid, updated_at = now()
     where id = p_id and household_id = hid returning * into t;
  end if;
  return public.calendar_event_task_json(t);
end $$;
revoke execute on function public.calendar_event_task_done(uuid, boolean) from public, anon;
grant execute on function public.calendar_event_task_done(uuid, boolean) to authenticated;

-- Remove one. Removing something already gone is a no-op.
create function public.calendar_event_task_delete(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.calendar_event_tasks_guard(auth.uid());
  t public.calendar_event_tasks%rowtype;
begin
  select * into t from public.calendar_event_task_for(uid, p_id);
  if t.id is null then return false; end if;
  delete from public.calendar_event_tasks where id = p_id and household_id = hid;
  return true;
end $$;
revoke execute on function public.calendar_event_task_delete(uuid) from public, anon;
grant execute on function public.calendar_event_task_delete(uuid) to authenticated;

commit;
