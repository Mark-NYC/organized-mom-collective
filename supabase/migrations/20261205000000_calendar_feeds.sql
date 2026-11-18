-- Calendar subscriptions: iCal feeds now, Google Calendar next (docs/calendar/CALENDAR_INTEGRATION.md).
--
-- NOT APPLIED. Needs 20261124 (household_adults, household_id_for) and 20261125 (the family calendar). Tested on a
-- throwaway database (supabase/tests/calendar-feeds.sql). Applying needs the owner's approval.
--
-- Read-only imports, beside the family's own events (calendar_events, untouched): an adult subscribes to a school,
-- sports or work calendar; the calendar-feeds Edge Function fetches it on a schedule, expands it into instances
-- (supabase/functions/_shared/calendar/ics.ts) and stores them here. Nothing here ever writes to the source calendar.
--
-- Privacy, per adult: each subscription belongs to the adult who added it and is PRIVATE by default (only they see it).
-- They can share it with the household (both adults see it, and it appears in the weekly Family Meeting). The feed's
-- URL can contain a private token, so only its owner can ever read it, shared or not. When an adult leaves the
-- household, their subscriptions stop showing to it at once; deleting the account deletes them.
begin;

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.club_households (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'ical' check (kind in ('ical', 'google')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- iCal only. Owner-only (may carry a private token).
  url text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),
  visibility text not null default 'private' check (visibility in ('private', 'household')),
  -- Whose calendar it is in the family (their permanent color); null = the whole family.
  member_id uuid references public.club_family_members (id) on delete set null,
  -- The zone floating times in the feed are read in (the adult's, when they added it).
  timezone text not null default 'America/New_York' check (char_length(timezone) between 3 and 64),
  status text not null default 'pending' check (status in ('pending', 'ok', 'error', 'disconnected')),
  last_error text check (char_length(last_error) <= 200),
  failures int not null default 0,
  etag text check (char_length(etag) <= 200),
  last_modified text check (char_length(last_modified) <= 100),
  event_count int not null default 0,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'ical' or url is not null)
);
create unique index calendar_feeds_owner_url on public.calendar_feeds (owner_user_id, lower(url)) where url is not null;
create index calendar_feeds_household on public.calendar_feeds (household_id);

create table public.calendar_feed_events (
  feed_id uuid not null references public.calendar_feeds (id) on delete cascade,
  household_id uuid not null references public.club_households (id) on delete cascade,
  uid text not null check (char_length(uid) between 1 and 255),
  -- The occurrence's original start (UTC ISO, or a date for all-day): with uid, stable across refreshes.
  instance_key text not null check (char_length(instance_key) between 10 and 40),
  title text not null check (char_length(title) between 1 and 120),
  location text check (char_length(location) <= 160),
  all_day boolean not null,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  status text not null default 'confirmed' check (status in ('confirmed', 'tentative')),
  primary key (feed_id, uid, instance_key),
  check ((all_day and start_date is not null and end_date is not null and end_date >= start_date)
      or (not all_day and starts_at is not null and ends_at is not null and ends_at >= starts_at))
);
create index calendar_feed_events_timed on public.calendar_feed_events (household_id, starts_at) where not all_day;
create index calendar_feed_events_days on public.calendar_feed_events (household_id, start_date) where all_day;

-- Only through the functions below.
alter table public.calendar_feeds enable row level security;
alter table public.calendar_feed_events enable row level security;
revoke all on public.calendar_feeds, public.calendar_feed_events from public, anon, authenticated;
grant all on public.calendar_feeds, public.calendar_feed_events to service_role;

-- A subscription as its reader sees it. The URL only for its owner.
create function public.calendar_feed_json(f public.calendar_feeds, p_uid uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', f.id, 'kind', f.kind, 'name', f.name, 'visibility', f.visibility, 'member_id', f.member_id,
    'mine', f.owner_user_id = p_uid, 'url', case when f.owner_user_id = p_uid then f.url end, 'timezone', f.timezone,
    'status', f.status, 'last_error', case when f.owner_user_id = p_uid then f.last_error end, 'event_count', f.event_count,
    'last_success_at', f.last_success_at, 'updated_at', f.updated_at)
$$;
revoke execute on function public.calendar_feed_json(public.calendar_feeds, uuid) from public, anon, authenticated;

-- Feeds this adult may see: their own, and the household's shared ones whose owner is still in the household.
create function public.calendar_feeds_visible(p_uid uuid) returns setof public.calendar_feeds
language sql stable security definer set search_path = '' as $$
  select f.* from public.calendar_feeds f
   where f.household_id = public.household_id_for(p_uid)
     and exists (select 1 from public.household_adults a where a.household_id = f.household_id and a.user_id = f.owner_user_id)
     and (f.owner_user_id = p_uid or f.visibility = 'household')
$$;
revoke execute on function public.calendar_feeds_visible(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- the adult's own subscriptions
-- Subscribe. p: { url, name, visibility?, member_id?, timezone? }. webcal:// becomes https://. The same URL twice
-- returns the existing subscription. At most 20 per adult.
create function public.calendar_feed_add(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  u text;
  f public.calendar_feeds%rowtype;
  mid uuid;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  hid := public.household_id_for(uid);
  if hid is null then raise exception 'no_household'; end if;
  u := btrim(coalesce(p ->> 'url', ''));
  u := regexp_replace(u, '^webcals?://', 'https://', 'i');
  if u !~* '^https?://[^/\s]+' or char_length(u) > 2000 then raise exception 'invalid_url'; end if;
  if u ~* '^https?://(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)' then raise exception 'invalid_url'; end if;
  select * into f from public.calendar_feeds where owner_user_id = uid and lower(url) = lower(u);
  if found then return public.calendar_feed_json(f, uid); end if;
  if (select count(*) from public.calendar_feeds where owner_user_id = uid) >= 20 then raise exception 'too_many'; end if;
  mid := nullif(p ->> 'member_id', '')::uuid;
  if mid is not null and not exists (select 1 from public.club_family_members m where m.id = mid and m.household_id = hid and m.archived_at is null) then
    raise exception 'invalid';
  end if;
  insert into public.calendar_feeds (household_id, owner_user_id, kind, name, url, visibility, member_id, timezone)
  values (hid, uid, 'ical', btrim(coalesce(nullif(p ->> 'name', ''), 'Calendar')), u,
          coalesce(nullif(p ->> 'visibility', ''), 'private'), mid, coalesce(nullif(p ->> 'timezone', ''), 'America/New_York'))
  returning * into f;
  return public.calendar_feed_json(f, uid);
exception
  when check_violation or invalid_text_representation then raise exception 'invalid';
end $$;
revoke execute on function public.calendar_feed_add(jsonb) from public, anon;
grant execute on function public.calendar_feed_add(jsonb) to authenticated;

-- Rename, share or make private, or set whose calendar it is. Only its owner. p: { name?, visibility?, member_id? }
-- (member_id: null clears it to "the whole family").
create function public.calendar_feed_update(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  f public.calendar_feeds%rowtype;
  mid uuid;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into f from public.calendar_feeds where id = p_id and owner_user_id = uid;
  if not found then raise exception 'not_found'; end if;
  if p ? 'member_id' then
    mid := nullif(p ->> 'member_id', '')::uuid;
    if mid is not null and not exists (select 1 from public.club_family_members m where m.id = mid and m.household_id = f.household_id and m.archived_at is null) then
      raise exception 'invalid';
    end if;
  end if;
  update public.calendar_feeds set
    name = case when p ? 'name' then btrim(p ->> 'name') else name end,
    visibility = coalesce(nullif(p ->> 'visibility', ''), visibility),
    member_id = case when p ? 'member_id' then mid else member_id end,
    updated_at = now()
   where id = p_id returning * into f;
  return public.calendar_feed_json(f, uid);
exception
  when check_violation or invalid_text_representation then raise exception 'invalid';
end $$;
revoke execute on function public.calendar_feed_update(uuid, jsonb) from public, anon;
grant execute on function public.calendar_feed_update(uuid, jsonb) to authenticated;

-- Unsubscribe: the subscription and its imported events go. Only its owner. The source calendar is never touched.
create function public.calendar_feed_remove(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from public.calendar_feeds where id = p_id and owner_user_id = auth.uid();
  return found;
end $$;
revoke execute on function public.calendar_feed_remove(uuid) from public, anon;
grant execute on function public.calendar_feed_remove(uuid) to authenticated;

-- Every subscription this adult can see.
create function public.calendar_feeds() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  return coalesce((select jsonb_agg(public.calendar_feed_json(f, uid) order by f.owner_user_id <> uid, f.created_at)
                     from public.calendar_feeds_visible(uid) f), '[]');
end $$;
revoke execute on function public.calendar_feeds() from public, anon;
grant execute on function public.calendar_feeds() to authenticated;

-- Imported events between two instants. p_scope 'mine': everything this adult can see (their private feeds too);
-- 'household': only feeds shared with the household (the weekly Family Meeting). The same occurrence imported by
-- both adults (one school calendar, two subscriptions) comes back once.
create function public.calendar_feed_events(p_from timestamptz, p_to timestamptz, p_scope text default 'mine') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  if p_scope not in ('mine', 'household') or p_to < p_from or p_to - p_from > interval '400 days' then raise exception 'invalid'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.k) from (
      select distinct on (e.uid, e.instance_key)
             jsonb_build_object('feed_id', e.feed_id, 'uid', e.uid, 'instance_key', e.instance_key, 'title', e.title,
               'location', e.location, 'all_day', e.all_day, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
               'start_date', e.start_date, 'end_date', e.end_date, 'status', e.status) as j,
             coalesce(e.starts_at::text, e.start_date::text) as k
        from public.calendar_feed_events e
        join public.calendar_feeds_visible(v_uid) f on f.id = e.feed_id
       where (p_scope = 'mine' or f.visibility = 'household')
         and ((not e.all_day and e.ends_at >= p_from and e.starts_at <= p_to)
           or (e.all_day and e.end_date >= (p_from at time zone 'UTC')::date - 1 and e.start_date <= (p_to at time zone 'UTC')::date + 1))
       order by e.uid, e.instance_key, (f.visibility = 'household') desc, (f.owner_user_id = v_uid) desc, f.created_at
    ) x), '[]');
end $$;
revoke execute on function public.calendar_feed_events(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.calendar_feed_events(timestamptz, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------- the refresher (Edge Function, service role only)
-- Feeds due for a refresh: never fetched, or 3 hours since the last attempt (backing off after failures, up to a day),
-- or one named feed now ("Refresh" by its owner, checked by the function). Marks the attempt so two runs don't overlap.
create function public.calendar_feed_claim(p_limit int default 20, p_feed uuid default null, p_owner uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare out jsonb;
begin
  with due as (
    select f.id from public.calendar_feeds f
     where f.kind = 'ical' and f.status <> 'disconnected'
       and (case when p_feed is not null then f.id = p_feed and f.owner_user_id = p_owner
                 else (f.last_attempt_at is null
                       or f.last_attempt_at <= now() - least(interval '3 hours' * power(2, least(f.failures, 3)), interval '24 hours')) end)
     order by f.last_attempt_at nulls first
     limit greatest(1, least(p_limit, 100))
     for update skip locked
  ), marked as (
    update public.calendar_feeds f set last_attempt_at = now() from due where f.id = due.id
    returning f.id, f.url, f.etag, f.last_modified, f.timezone
  )
  select coalesce(jsonb_agg(to_jsonb(marked)), '[]') into out from marked;
  return out;
end $$;
revoke execute on function public.calendar_feed_claim(int, uuid, uuid) from public, anon, authenticated;
grant execute on function public.calendar_feed_claim(int, uuid, uuid) to service_role;

-- Store one fetch. p: { result: 'ok' | 'not_modified' | 'error' | 'gone', error?, etag?, last_modified?, events? }.
-- 'ok' replaces the feed's events in one step (a refresh never shows half a calendar); 'error' keeps the last good
-- events and counts the failure; 'gone' (the link no longer works: 401/403/404/410) disconnects it and clears its events.
create function public.calendar_feed_store(p_feed uuid, p jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  f public.calendar_feeds%rowtype;
  n int := 0;
begin
  select * into f from public.calendar_feeds where id = p_feed for update;
  if not found then return 0; end if;
  if p ->> 'result' = 'ok' then
    delete from public.calendar_feed_events where feed_id = p_feed;
    insert into public.calendar_feed_events (feed_id, household_id, uid, instance_key, title, location, all_day, starts_at, ends_at, start_date, end_date, status)
    select p_feed, f.household_id, left(e ->> 'uid', 255), e ->> 'instance_key', left(e ->> 'title', 120), left(e ->> 'location', 160),
           (e ->> 'all_day')::boolean, (e ->> 'starts_at')::timestamptz, (e ->> 'ends_at')::timestamptz,
           (e ->> 'start_date')::date, (e ->> 'end_date')::date, coalesce(e ->> 'status', 'confirmed')
      from (select e from jsonb_array_elements(coalesce(p -> 'events', '[]')) e limit 5000) x
    on conflict do nothing;
    get diagnostics n = row_count;
    update public.calendar_feeds set status = 'ok', last_error = null, failures = 0, event_count = n, last_success_at = now(),
           etag = left(p ->> 'etag', 200), last_modified = left(p ->> 'last_modified', 100), updated_at = now()
     where id = p_feed;
  elsif p ->> 'result' = 'not_modified' then
    update public.calendar_feeds set status = 'ok', last_error = null, failures = 0, last_success_at = now(), updated_at = now() where id = p_feed;
    n := f.event_count;
  elsif p ->> 'result' = 'gone' then
    -- Its link no longer works: its old events would go stale silently, so they leave the calendar until it's fixed.
    delete from public.calendar_feed_events where feed_id = p_feed;
    update public.calendar_feeds set status = 'disconnected', last_error = left(coalesce(p ->> 'error', 'This calendar is no longer available.'), 200),
           failures = failures + 1, event_count = 0, etag = null, last_modified = null, updated_at = now() where id = p_feed;
  else
    update public.calendar_feeds set status = 'error', last_error = left(coalesce(p ->> 'error', 'Couldn’t refresh this calendar.'), 200),
           failures = failures + 1, updated_at = now() where id = p_feed;
  end if;
  return n;
end $$;
revoke execute on function public.calendar_feed_store(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.calendar_feed_store(uuid, jsonb) to service_role;

-- A disconnected subscription the owner reconnects (fixed URL elsewhere, or the calendar is back): fetch again.
create function public.calendar_feed_retry(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare f public.calendar_feeds%rowtype;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  update public.calendar_feeds set status = 'pending', failures = 0, last_attempt_at = null, updated_at = now()
   where id = p_id and owner_user_id = auth.uid() returning * into f;
  if not found then raise exception 'not_found'; end if;
  return public.calendar_feed_json(f, auth.uid());
end $$;
revoke execute on function public.calendar_feed_retry(uuid) from public, anon;
grant execute on function public.calendar_feed_retry(uuid) to authenticated;

commit;
