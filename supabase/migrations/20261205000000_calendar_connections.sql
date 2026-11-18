-- Connected calendars: Google Calendar (read-only) and subscribed .ics feeds, shown beside the family calendar
-- (docs/ios/CALENDAR_INTEGRATION.md). Free, like the family calendar; nothing here touches the Club, billing or mail.
--
-- NOT APPLIED. Needs 20261124000000_household_shared.sql and 20261125000000_family_calendar.sql. Built and tested on a
-- throwaway database (scripts/test-household-sql.sh → supabase/tests/calendar-connections.sql); applying it needs the
-- owner's approval.
--
-- Who sees what:
--   - A connection (a Google account or one feed) belongs to ONE adult. Only she sees it, its status and its settings.
--   - Each calendar in it is private until she shares it. Shared calendars are seen by the other adult of HER CURRENT
--     household: worked out on every read from household_adults, so leaving a household stops sharing at once.
--   - Events marked private where they came from show the household "Busy" only (title, place and notes hidden).
--   - What lets the server read her calendars (Google refresh token, the feed link: often secret) is AES-GCM ciphertext
--     made by the Edge Function, in a table only the service role can read. No signed-in user ever receives it.
--
-- Imported events are a read-only copy: they are never written back, and they live apart from calendar_events, so a
-- sync can never change or delete a family-owned event. A sync replaces only its own calendar's copy within the window
-- it fetched, and refuses to drop most of a calendar at once (a feed that briefly comes back empty) until a second
-- sync agrees.
begin;

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'ical')),
  -- Google: the account's email. Feed: the link's host ("calendar.lincoln.k12.us"). Never the link itself.
  label text not null check (char_length(label) between 1 and 254),
  status text not null default 'active' check (status in ('active', 'reauth', 'error')),
  last_error text check (char_length(last_error) <= 200),
  -- A feed: hash of host + path + query, so the same adult can't add the same feed twice.
  fingerprint text check (fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index calendar_connections_google on public.calendar_connections (user_id, label) where provider = 'google';
create unique index calendar_connections_feed on public.calendar_connections (user_id, fingerprint) where provider = 'ical';
create index calendar_connections_user on public.calendar_connections (user_id);

-- Ciphertext only (supabase/functions/_shared/calendar/secrets.ts). No grants to anon or authenticated, no policies.
create table public.calendar_connection_secrets (
  connection_id uuid primary key references public.calendar_connections (id) on delete cascade,
  sealed text not null check (char_length(sealed) between 10 and 8000),
  updated_at timestamptz not null default now()
);

create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  external_id text not null check (char_length(external_id) between 1 and 500),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  color text check (color ~ '^#[0-9a-f]{6}$'),
  timezone text check (char_length(timezone) <= 64),
  -- Shown at all (Google: she picks; a feed she added: yes).
  selected boolean not null default false,
  -- Shared with the household (default: only her).
  shared boolean not null default false,
  -- Whose calendar it is, for the family colors ("Sofia's soccer"): stable club_family_members ids.
  member_ids uuid[] not null default '{}' check (cardinality(member_ids) <= 12),
  last_synced_at timestamptz,
  next_sync_at timestamptz not null default now(),
  sync_error text check (char_length(sync_error) <= 200),
  failures int not null default 0,
  -- How many syncs in a row wanted to drop most of this calendar (see calendar_sync_apply).
  drop_strikes int not null default 0,
  -- Feed conditional GET (ETag / Last-Modified).
  etag text check (char_length(etag) <= 300),
  last_modified text check (char_length(last_modified) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id)
);
create index calendar_sources_user on public.calendar_sources (user_id);
create index calendar_sources_due on public.calendar_sources (next_sync_at) where selected;

create table public.calendar_imported_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.calendar_sources (id) on delete cascade,
  instance_key text not null check (char_length(instance_key) between 1 and 600),
  uid text not null check (char_length(uid) between 1 and 500),
  title text not null check (char_length(title) between 1 and 200),
  location text check (char_length(location) <= 200),
  notes text check (char_length(notes) <= 1000),
  all_day boolean not null,
  start_date date,
  end_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text check (char_length(timezone) <= 64),
  url text check (char_length(url) <= 1000 and url ~ '^https://'),
  recurring boolean not null default false,
  private boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (source_id, instance_key),
  check (case when all_day then start_date is not null and end_date >= start_date and starts_at is null
              else starts_at is not null and (ends_at is null or ends_at >= starts_at) and start_date is null end)
);
-- Window reads: timed by instant, all-day by date.
create index calendar_imported_timed on public.calendar_imported_events (source_id, starts_at) where not all_day;
create index calendar_imported_allday on public.calendar_imported_events (source_id, start_date) where all_day;

-- One-time OAuth handshakes (10 minutes): state → who started it, the PKCE verifier, where to send her back.
create table public.calendar_oauth_states (
  state text primary key check (char_length(state) between 20 and 200),
  user_id uuid not null references auth.users (id) on delete cascade,
  verifier text not null check (char_length(verifier) between 43 and 128),
  return_to text not null check (return_to in ('web', 'app')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- who can see a calendar

-- Is calendar p_source visible to p_uid? Her own (any), or shared by an adult of her current household.
create function public.calendar_source_visible(p_source uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calendar_sources s
     where s.id = p_source and s.selected
       and (s.user_id = p_uid
            or (s.shared and public.household_id_for(p_uid) is not null
                and public.household_id_for(s.user_id) = public.household_id_for(p_uid))))
$$;
revoke execute on function public.calendar_source_visible(uuid, uuid) from public, anon;
grant execute on function public.calendar_source_visible(uuid, uuid) to authenticated; -- used inside RLS policies

alter table public.calendar_connections enable row level security;
alter table public.calendar_connection_secrets enable row level security;
alter table public.calendar_sources enable row level security;
alter table public.calendar_imported_events enable row level security;
alter table public.calendar_oauth_states enable row level security;
revoke all on public.calendar_connections, public.calendar_connection_secrets, public.calendar_sources,
              public.calendar_imported_events, public.calendar_oauth_states from public, anon, authenticated;
grant all on public.calendar_connections, public.calendar_connection_secrets, public.calendar_sources,
             public.calendar_imported_events, public.calendar_oauth_states to service_role;
-- Reads go through the functions below; these direct-read grants are safe because of the policies (no secrets table).
grant select on public.calendar_connections, public.calendar_sources, public.calendar_imported_events to authenticated;
create policy "Her own connections" on public.calendar_connections for select to authenticated using (user_id = (select auth.uid()));
create policy "Calendars she may see" on public.calendar_sources for select to authenticated
  using (public.calendar_source_visible(id, (select auth.uid())));
create policy "Events of calendars she may see" on public.calendar_imported_events for select to authenticated
  using (public.calendar_source_visible(source_id, (select auth.uid())) and (not private or exists (
    select 1 from public.calendar_sources s where s.id = source_id and s.user_id = (select auth.uid()))));

-- ---------------------------------------------------------------- signed-in adults (the website and the app)

-- Her connections and their calendars (with status), and the calendars the other adult shares (no settings, no status
-- detail beyond whether they're up to date).
create function public.calendar_sources_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.household_id_for(uid);
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  return jsonb_build_object(
    'mine', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'provider', c.provider, 'label', c.label, 'status', c.status, 'last_error', c.last_error,
        'calendars', coalesce((select jsonb_agg(jsonb_build_object(
            'id', s.id, 'name', s.name, 'color', s.color, 'selected', s.selected, 'shared', s.shared,
            'member_ids', to_jsonb(s.member_ids), 'last_synced_at', s.last_synced_at, 'sync_error', s.sync_error)
            order by s.name) from public.calendar_sources s where s.connection_id = c.id), '[]'))
        order by c.created_at)
        from public.calendar_connections c where c.user_id = uid), '[]'),
    'shared_with_me', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'provider', c.provider, 'member_ids', to_jsonb(s.member_ids),
        'last_synced_at', s.last_synced_at, 'stale', c.status <> 'active') order by s.name)
        from public.calendar_sources s join public.calendar_connections c on c.id = s.connection_id
       where hid is not null and s.user_id <> uid and s.selected and s.shared
         and public.household_id_for(s.user_id) = hid), '[]'));
end $$;
revoke execute on function public.calendar_sources_list() from public, anon;
grant execute on function public.calendar_sources_list() to authenticated;

-- Show/hide a calendar, share it with the household or keep it to herself, and whose calendar it is. Hers only.
-- Hiding a calendar removes its copied events at once (they come back with the next sync if she shows it again).
create function public.calendar_source_update(p_id uuid, p_selected boolean, p_shared boolean, p_member_ids jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.household_id_for(uid);
  s public.calendar_sources%rowtype;
  members uuid[];
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into s from public.calendar_sources where id = p_id and user_id = uid for update;
  if not found then raise exception 'not_found'; end if;
  members := case when p_member_ids is null then s.member_ids else public.club_uuid_list(p_member_ids) end;
  if cardinality(members) > 0 and (hid is null or not public.club_members_belong(hid, members)) then raise exception 'invalid'; end if;
  update public.calendar_sources set
    selected = coalesce(p_selected, selected), shared = coalesce(p_shared, shared), member_ids = members,
    next_sync_at = case when coalesce(p_selected, selected) and not selected then now() else next_sync_at end,
    updated_at = now()
  where id = p_id returning * into s;
  if not s.selected then delete from public.calendar_imported_events where source_id = s.id; end if;
  return jsonb_build_object('id', s.id, 'selected', s.selected, 'shared', s.shared, 'member_ids', to_jsonb(s.member_ids));
end $$;
revoke execute on function public.calendar_source_update(uuid, boolean, boolean, jsonb) from public, anon;
grant execute on function public.calendar_source_update(uuid, boolean, boolean, jsonb) to authenticated;

-- Imported events she may see between two dates. Private ones from the other adult's calendars come as "Busy".
create function public.calendar_imported_feed(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'invalid'; end if;
  return jsonb_build_object('now', now(), 'events', coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', e.id, 'source_id', e.source_id, 'uid', e.uid,
        'title', case when e.private and s.user_id <> me then 'Busy' else e.title end,
        'location', case when e.private and s.user_id <> me then null else e.location end,
        'notes', case when e.private and s.user_id <> me then null else e.notes end,
        'url', case when s.user_id = me then e.url end,
        'all_day', e.all_day, 'start_date', e.start_date, 'end_date', e.end_date, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
        'timezone', e.timezone, 'recurring', e.recurring, 'mine', s.user_id = me)
      order by coalesce(e.starts_at, e.start_date::timestamptz))
      from public.calendar_imported_events e
      join public.calendar_sources s on s.id = e.source_id
     where public.calendar_source_visible(s.id, me)
       and (case when e.all_day then e.end_date >= p_from and e.start_date <= p_to
                 else e.starts_at < (p_to + 2)::timestamptz and coalesce(e.ends_at, e.starts_at) >= (p_from - 1)::timestamptz end)), '[]'));
end $$;
revoke execute on function public.calendar_imported_feed(date, date) from public, anon;
grant execute on function public.calendar_imported_feed(date, date) to authenticated;

-- ---------------------------------------------------------------- the Edge Function (service role only)

-- A new Google connection, or the same Google account reconnected (secret replaced, status back to active).
create function public.calendar_connection_upsert(p_user uuid, p_provider text, p_label text, p_fingerprint text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.calendar_connections%rowtype;
  existing boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended('calendar-connect:' || p_user::text, 0));
  if p_provider = 'google' then
    select * into c from public.calendar_connections where user_id = p_user and provider = 'google' and label = lower(p_label);
  else
    select * into c from public.calendar_connections where user_id = p_user and provider = 'ical' and fingerprint = p_fingerprint;
    if found then raise exception 'duplicate'; end if;
  end if;
  if found then
    existing := true;
    update public.calendar_connections set status = 'active', last_error = null, updated_at = now() where id = c.id returning * into c;
    update public.calendar_sources set failures = 0, sync_error = null, next_sync_at = now() where connection_id = c.id;
  else
    if (select count(*) from public.calendar_connections where user_id = p_user) >= 12 then raise exception 'too_many'; end if;
    insert into public.calendar_connections (user_id, provider, label, fingerprint)
    values (p_user, p_provider, case when p_provider = 'google' then lower(p_label) else p_label end, p_fingerprint) returning * into c;
  end if;
  return jsonb_build_object('id', c.id, 'existing', existing);
end $$;

create function public.calendar_secret_put(p_connection uuid, p_sealed text) returns void
language sql security definer set search_path = '' as $$
  insert into public.calendar_connection_secrets (connection_id, sealed) values (p_connection, p_sealed)
  on conflict (connection_id) do update set sealed = excluded.sealed, updated_at = now()
$$;

create function public.calendar_secret_get(p_connection uuid) returns text
language sql stable security definer set search_path = '' as $$
  select sealed from public.calendar_connection_secrets where connection_id = p_connection
$$;

-- The calendars in a connection, from Google's list (or the one feed). New ones arrive hidden and private unless
-- p_select_new; names follow the provider; calendars gone from the list are removed with their copied events.
create function public.calendar_sources_put(p_connection uuid, p_sources jsonb, p_select_new boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.calendar_connections%rowtype;
  ids text[];
begin
  select * into c from public.calendar_connections where id = p_connection;
  if not found then raise exception 'not_found'; end if;
  if jsonb_typeof(p_sources) <> 'array' or jsonb_array_length(p_sources) > 100 then raise exception 'invalid'; end if;
  select coalesce(array_agg(x ->> 'external_id'), '{}') into ids from jsonb_array_elements(p_sources) x;
  delete from public.calendar_sources where connection_id = c.id and external_id <> all (ids);
  insert into public.calendar_sources (connection_id, user_id, external_id, name, color, timezone, selected)
  select c.id, c.user_id, x ->> 'external_id', left(btrim(x ->> 'name'), 120), lower(x ->> 'color'), x ->> 'timezone',
         p_select_new and coalesce((x ->> 'primary')::boolean, true)
    from jsonb_array_elements(p_sources) x
  on conflict (connection_id, external_id) do update set name = excluded.name, color = excluded.color, timezone = excluded.timezone, updated_at = now();
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'external_id', s.external_id, 'selected', s.selected))
                     from public.calendar_sources s where s.connection_id = c.id), '[]');
end $$;

-- Calendars due a sync (or one adult's, for "Refresh now"). Claims them for 10 minutes so two runs don't double up.
create function public.calendar_sync_claim(p_user uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into ids from (
    select s.id from public.calendar_sources s join public.calendar_connections c on c.id = s.connection_id
     where s.selected and c.status <> 'reauth'
       and (case when p_user is null then s.next_sync_at <= now()
                 else s.user_id = p_user and coalesce(s.last_synced_at, '-infinity') < now() - interval '2 minutes' end)
     order by s.next_sync_at limit least(greatest(coalesce(p_limit, 25), 1), 200)
     for update of s skip locked) due;
  update public.calendar_sources set next_sync_at = now() + interval '10 minutes' where id = any (ids);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'connection_id', s.connection_id, 'provider', c.provider, 'external_id', s.external_id,
                                        'timezone', s.timezone, 'etag', s.etag, 'last_modified', s.last_modified))
      from public.calendar_sources s join public.calendar_connections c on c.id = s.connection_id where s.id = any (ids)), '[]');
end $$;

-- Store one calendar's events for a window [p_from, p_to). Upserts by instance; removes this calendar's events in the
-- window that are gone, except when that would drop more than half of 10+ events: then nothing is removed and the next
-- sync must agree first (drop_strikes). Never touches calendar_events or another calendar.
create function public.calendar_sync_apply(p_source uuid, p_from timestamptz, p_to timestamptz, p_events jsonb, p_etag text, p_last_modified text, p_next interval) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.calendar_sources%rowtype;
  keys text[];
  existing int;
  gone int;
  upserted int;
  removed int := 0;
  held boolean := false;
  d_from date := (p_from at time zone 'UTC')::date - 1;
  d_to date := (p_to at time zone 'UTC')::date + 1;
begin
  select * into s from public.calendar_sources where id = p_source for update;
  if not found or not s.selected then return jsonb_build_object('skipped', true); end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 3000 then raise exception 'invalid'; end if;
  select coalesce(array_agg(distinct x ->> 'instance_key'), '{}') into keys from jsonb_array_elements(p_events) x;

  insert into public.calendar_imported_events as e (source_id, instance_key, uid, title, location, notes, all_day, start_date, end_date,
                                                     starts_at, ends_at, timezone, url, recurring, private)
  select distinct on (x ->> 'instance_key') s.id, x ->> 'instance_key', x ->> 'uid', left(x ->> 'title', 200), left(x ->> 'location', 200), left(x ->> 'notes', 1000),
         (x ->> 'all_day')::boolean, (x ->> 'start_date')::date, (x ->> 'end_date')::date, (x ->> 'starts_at')::timestamptz, (x ->> 'ends_at')::timestamptz,
         left(x ->> 'timezone', 64), case when x ->> 'url' ~ '^https://' then left(x ->> 'url', 1000) end,
         coalesce((x ->> 'recurring')::boolean, false), coalesce((x ->> 'private')::boolean, false)
    from jsonb_array_elements(p_events) x
  on conflict (source_id, instance_key) do update set
    uid = excluded.uid, title = excluded.title, location = excluded.location, notes = excluded.notes, all_day = excluded.all_day,
    start_date = excluded.start_date, end_date = excluded.end_date, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
    timezone = excluded.timezone, url = excluded.url, recurring = excluded.recurring, private = excluded.private,
    updated_at = case when (e.title, e.location, e.notes, e.all_day, e.start_date, e.end_date, e.starts_at, e.ends_at, e.private)
                        is distinct from (excluded.title, excluded.location, excluded.notes, excluded.all_day, excluded.start_date, excluded.end_date,
                                          excluded.starts_at, excluded.ends_at, excluded.private) then now() else e.updated_at end;
  get diagnostics upserted = row_count;

  -- In the window: timed events starting in it, all-day events overlapping it.
  select count(*), count(*) filter (where e.instance_key <> all (keys)) into existing, gone
    from public.calendar_imported_events e
   where e.source_id = s.id
     and (case when e.all_day then e.end_date >= d_from and e.start_date <= d_to else e.starts_at >= p_from and e.starts_at < p_to end);
  if gone > 0 and existing >= 10 and gone * 2 > existing and s.drop_strikes < 1 then
    held := true;
  elsif gone > 0 then
    delete from public.calendar_imported_events e
     where e.source_id = s.id and e.instance_key <> all (keys)
       and (case when e.all_day then e.end_date >= d_from and e.start_date <= d_to else e.starts_at >= p_from and e.starts_at < p_to end);
    get diagnostics removed = row_count;
  end if;
  -- Long past: nobody plans with it.
  delete from public.calendar_imported_events e where e.source_id = s.id and coalesce(e.end_date::timestamptz, e.ends_at, e.starts_at) < now() - interval '60 days';

  update public.calendar_sources set
    last_synced_at = now(), sync_error = case when held then 'held_large_removal' end, failures = 0,
    drop_strikes = case when held then drop_strikes + 1 else 0 end,
    etag = left(p_etag, 300), last_modified = left(p_last_modified, 100),
    next_sync_at = now() + coalesce(p_next, interval '1 hour'), updated_at = now()
  where id = s.id;
  return jsonb_build_object('upserted', upserted, 'removed', removed, 'held', held);
end $$;

-- Nothing changed (a feed's 304 Not Modified): just schedule the next look.
create function public.calendar_sync_unchanged(p_source uuid, p_next interval) returns void
language sql security definer set search_path = '' as $$
  update public.calendar_sources set last_synced_at = now(), sync_error = null, failures = 0, next_sync_at = now() + coalesce(p_next, interval '1 hour')
   where id = p_source
$$;

-- A sync failed. 'retry': back off (15 min, 30, 1 h … up to 12 h), events kept. 'reauth': the whole connection needs
-- her to reconnect (Google said the grant is gone); events kept and shown as possibly out of date. 'gone': this calendar
-- no longer exists or the feed is gone for good: after 3 tries in a row it is marked, events kept until she removes it.
create function public.calendar_sync_failed(p_source uuid, p_kind text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.calendar_sources%rowtype;
begin
  select * into s from public.calendar_sources where id = p_source for update;
  if not found then return; end if;
  if p_kind = 'reauth' then
    update public.calendar_connections set status = 'reauth', last_error = left(p_error, 200), updated_at = now() where id = s.connection_id;
  elsif p_kind = 'gone' and s.failures >= 2 then
    update public.calendar_connections set status = 'error', last_error = left(p_error, 200), updated_at = now() where id = s.connection_id;
  end if;
  update public.calendar_sources set failures = failures + 1, sync_error = left(p_error, 200),
    next_sync_at = now() + least(interval '15 minutes' * power(2, least(failures, 6)), interval '12 hours'), updated_at = now()
  where id = s.id;
end $$;

-- OAuth handshake: remember (10 minutes), then take once.
create function public.calendar_oauth_begin(p_user uuid, p_state text, p_verifier text, p_return_to text) returns void
language sql security definer set search_path = '' as $$
  delete from public.calendar_oauth_states where created_at < now() - interval '10 minutes';
  insert into public.calendar_oauth_states (state, user_id, verifier, return_to) values (p_state, p_user, p_verifier, p_return_to);
$$;

create function public.calendar_oauth_take(p_state text) returns jsonb
language sql security definer set search_path = '' as $$
  delete from public.calendar_oauth_states where state = p_state and created_at > now() - interval '10 minutes'
  returning jsonb_build_object('user_id', user_id, 'verifier', verifier, 'return_to', return_to)
$$;

-- Remove a connection: her own only; its calendars, copied events and secret go with it.
create function public.calendar_connection_remove(p_user uuid, p_connection uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.calendar_connections%rowtype;
begin
  delete from public.calendar_connections where id = p_connection and user_id = p_user returning * into c;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('id', c.id, 'provider', c.provider);
end $$;

-- What the function needs to read a connection: the provider and its sealed secret.
create function public.calendar_connection_for(p_connection uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'user_id', c.user_id, 'provider', c.provider, 'label', c.label, 'status', c.status,
                            'sealed', (select sealed from public.calendar_connection_secrets where connection_id = c.id))
    from public.calendar_connections c where c.id = p_connection
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'calendar_connection_upsert(uuid, text, text, text)', 'calendar_secret_put(uuid, text)', 'calendar_secret_get(uuid)',
    'calendar_sources_put(uuid, jsonb, boolean)', 'calendar_sync_claim(uuid, int)',
    'calendar_sync_apply(uuid, timestamptz, timestamptz, jsonb, text, text, interval)', 'calendar_sync_unchanged(uuid, interval)',
    'calendar_sync_failed(uuid, text, text)', 'calendar_oauth_begin(uuid, text, text, text)', 'calendar_oauth_take(text)',
    'calendar_connection_remove(uuid, uuid)', 'calendar_connection_for(uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

commit;
