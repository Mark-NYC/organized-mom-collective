-- Connect Google Calendar (docs/calendar/GOOGLE_CALENDAR.md): an additional, read-only way to add calendars,
-- beside iCal links (20261205), which stay exactly as they are.
--
-- NOT APPLIED. Needs 20261205 (calendar_feeds). Tested on a throwaway database (supabase/tests/calendar-google.sql).
-- Applying needs the owner's approval.
--
-- Model (reuses everything 20261205 built):
-- - An adult connects a Google account with Google's OAuth consent screen (the calendar-google Edge Function). Its
--   refresh token is stored ENCRYPTED in Supabase Vault; this database keeps only the Vault id, the Google account's
--   stable id (`sub`, so reconnecting the same account updates it instead of adding a second) and its email (shown
--   to its owner). Access tokens are never stored: the functions get a fresh one when they need it.
-- - Each Google calendar she chooses becomes an ordinary calendar_feeds row (kind 'google'): the same privacy
--   (private by default, or shared with the household), the same "whose calendar" color, the same imported-event
--   storage, refresher, store rules and app views as iCal links.
-- - Staged rollout of its own, on top of the calendar one: Google is offered only to households with a Google
--   tester (calendar_feed_testers.google) until calendar_feed_rollout.google_everyone is turned on.
begin;

-- ---------------------------------------------------------------- rollout (separate switch for Google)
alter table public.calendar_feed_testers add column google boolean not null default false;
alter table public.calendar_feed_rollout add column google_everyone boolean not null default false;

-- Google is on for this adult: calendar subscriptions are on for them AND (Google is on for everyone, or a Google
-- tester is in their household).
create function public.calendar_google_enabled(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.calendar_feeds_enabled(p_uid) and (
    coalesce((select google_everyone from public.calendar_feed_rollout where id), false)
    or exists (select 1 from public.calendar_feed_testers t where t.user_id = p_uid and t.google)
    or exists (select 1 from public.calendar_feed_testers t join public.household_adults a on a.user_id = t.user_id
                where t.google and a.household_id = public.household_id_for(p_uid)))
$$;
revoke execute on function public.calendar_google_enabled(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- connected Google accounts
create table public.calendar_google_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.club_households (id) on delete cascade,
  -- Google's stable account id (the id_token's `sub`): one row per adult per Google account.
  google_sub text not null check (char_length(google_sub) between 1 and 255),
  email text check (char_length(email) <= 320),
  -- The refresh token, encrypted in Vault (vault.secrets). Never in this table, never returned to the app.
  refresh_secret_id uuid not null,
  scopes text check (char_length(scopes) <= 1000),
  -- 'reconnect': Google stopped accepting the token (revoked, expired, password/admin policy). Her calendars keep
  -- their last good events (the store rules) and the app asks her to reconnect.
  status text not null default 'ok' check (status in ('ok', 'reconnect')),
  last_error text check (char_length(last_error) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, google_sub)
);
create index calendar_google_accounts_household on public.calendar_google_accounts (household_id);

-- One-time OAuth states (CSRF protection and account binding): created by the signed-in adult's "Connect", consumed
-- once by Google's redirect, valid 10 minutes. Only a SHA-256 of the state is stored. The PKCE verifier never
-- leaves the server.
create table public.calendar_google_oauth_states (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_verifier text not null check (char_length(code_verifier) between 43 and 128),
  return_to text not null check (return_to in ('web', 'app')),
  return_origin text not null check (char_length(return_origin) <= 200),
  created_at timestamptz not null default now()
);

alter table public.calendar_google_accounts enable row level security;
alter table public.calendar_google_oauth_states enable row level security;
revoke all on public.calendar_google_accounts, public.calendar_google_oauth_states from public, anon, authenticated;
grant all on public.calendar_google_accounts, public.calendar_google_oauth_states to service_role;

-- A Google calendar she imports is a subscription like any other.
alter table public.calendar_feeds
  add column google_account_id uuid references public.calendar_google_accounts (id) on delete cascade,
  add column google_calendar_id text check (char_length(google_calendar_id) <= 1024),
  add constraint calendar_feeds_google_ref check (kind <> 'google' or (google_account_id is not null and google_calendar_id is not null));
create unique index calendar_feeds_google_calendar on public.calendar_feeds (google_account_id, google_calendar_id) where google_account_id is not null;

-- However an account goes (Disconnect, the adult's account deleted, the household deleted), its token goes too.
create function public.calendar_google_forget_token() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.refresh_secret_id;
  return old;
end $$;
revoke execute on function public.calendar_google_forget_token() from public, anon, authenticated;
create trigger calendar_google_forget_token after delete on public.calendar_google_accounts
  for each row execute function public.calendar_google_forget_token();

-- A subscription as its reader sees it (now also which Google account it comes from, for its owner only).
create or replace function public.calendar_feed_json(f public.calendar_feeds, p_uid uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', f.id, 'kind', f.kind, 'name', f.name, 'visibility', f.visibility, 'member_id', f.member_id,
    'mine', f.owner_user_id = p_uid, 'url_host', case when f.owner_user_id = p_uid then f.url_host end, 'timezone', f.timezone,
    'status', f.status, 'last_error', case when f.owner_user_id = p_uid then f.last_error end, 'event_count', f.event_count,
    'last_success_at', f.last_success_at, 'events_at', f.events_at, 'updated_at', f.updated_at,
    'google_account_id', case when f.owner_user_id = p_uid then f.google_account_id end,
    'google_calendar_id', case when f.owner_user_id = p_uid then f.google_calendar_id end)
$$;
revoke execute on function public.calendar_feed_json(public.calendar_feeds, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- the adult (app)
-- Her connected Google accounts: email, status, how many calendars she imports from each (0 = still to choose).
create function public.calendar_google_accounts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not public.calendar_google_enabled(uid) then raise exception 'not_enabled'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'email', a.email, 'status', a.status, 'last_error', a.last_error,
      'calendars', (select count(*) from public.calendar_feeds f where f.google_account_id = a.id), 'created_at', a.created_at) order by a.created_at)
    from public.calendar_google_accounts a where a.owner_user_id = uid), '[]');
end $$;
revoke execute on function public.calendar_google_accounts() from public, anon;
grant execute on function public.calendar_google_accounts() to authenticated;

-- Choose which of an account's calendars to import. p_calendars: [{ id, name, member_id?, visibility?, timezone? }]
-- (at most 25). Calendars already imported keep their settings unless given; calendars left out stop being imported
-- (their events go). New ones are private unless she chose "Our household".
create function public.calendar_google_select(p_account uuid, p_calendars jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  acc public.calendar_google_accounts%rowtype;
  c jsonb;
  mid uuid;
  keep text[] := '{}';
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not public.calendar_google_enabled(uid) then raise exception 'not_enabled'; end if;
  hid := public.household_id_for(uid);
  if hid is null then raise exception 'no_household'; end if;
  select * into acc from public.calendar_google_accounts where id = p_account and owner_user_id = uid for update;
  if not found then raise exception 'not_found'; end if;
  if jsonb_typeof(p_calendars) <> 'array' or jsonb_array_length(p_calendars) > 25 then raise exception 'invalid'; end if;
  if acc.household_id <> hid then update public.calendar_google_accounts set household_id = hid, updated_at = now() where id = acc.id; end if;
  if (select count(*) from public.calendar_feeds where owner_user_id = uid and household_id = hid and google_account_id is distinct from acc.id)
     + jsonb_array_length(p_calendars) > 40 then raise exception 'too_many'; end if;
  for c in select * from jsonb_array_elements(p_calendars) loop
    if coalesce(c ->> 'id', '') = '' or char_length(c ->> 'id') > 1024 then raise exception 'invalid'; end if;
    mid := nullif(c ->> 'member_id', '')::uuid;
    if mid is not null and not exists (select 1 from public.club_family_members m where m.id = mid and m.household_id = hid and m.archived_at is null) then
      raise exception 'invalid';
    end if;
    keep := keep || (c ->> 'id');
    insert into public.calendar_feeds (household_id, owner_user_id, kind, name, visibility, member_id, timezone, google_account_id, google_calendar_id)
    values (hid, uid, 'google', left(btrim(coalesce(nullif(c ->> 'name', ''), 'Google Calendar')), 80),
            coalesce(nullif(c ->> 'visibility', ''), 'private'), mid, coalesce(nullif(c ->> 'timezone', ''), 'America/New_York'), acc.id, c ->> 'id')
    on conflict (google_account_id, google_calendar_id) where google_account_id is not null do update set
      household_id = excluded.household_id,
      name = case when c ? 'name' then excluded.name else public.calendar_feeds.name end,
      visibility = case when c ? 'visibility' then excluded.visibility else public.calendar_feeds.visibility end,
      member_id = case when c ? 'member_id' then excluded.member_id else public.calendar_feeds.member_id end,
      updated_at = now();
  end loop;
  delete from public.calendar_feeds where google_account_id = acc.id and not (google_calendar_id = any (keep));
  return coalesce((select jsonb_agg(public.calendar_feed_json(f, uid) order by f.created_at) from public.calendar_feeds f where f.google_account_id = acc.id), '[]');
exception
  when check_violation or invalid_text_representation then raise exception 'invalid';
end $$;
revoke execute on function public.calendar_google_select(uuid, jsonb) from public, anon;
grant execute on function public.calendar_google_select(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------- the calendar-google function (service role)
-- "Connect": remember a one-time state for this adult (refused unless Google is on for them).
create function public.calendar_google_state_save(p_state_hash text, p_user uuid, p_verifier text, p_return_to text, p_origin text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.calendar_google_enabled(p_user) then raise exception 'not_enabled'; end if;
  if public.household_id_for(p_user) is null then raise exception 'no_household'; end if;
  delete from public.calendar_google_oauth_states where created_at < now() - interval '10 minutes';
  if (select count(*) from public.calendar_google_oauth_states where user_id = p_user) >= 5 then raise exception 'too_many'; end if;
  insert into public.calendar_google_oauth_states (state_hash, user_id, code_verifier, return_to, return_origin)
  values (p_state_hash, p_user, p_verifier, p_return_to, p_origin);
  return true;
end $$;
revoke execute on function public.calendar_google_state_save(text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.calendar_google_state_save(text, uuid, text, text, text) to service_role;

-- Google's redirect: take the state ONCE (deleted whether or not it's still valid). Null when unknown, used or expired.
create function public.calendar_google_state_take(p_state_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.calendar_google_oauth_states%rowtype;
begin
  delete from public.calendar_google_oauth_states where state_hash = p_state_hash returning * into s;
  if not found or s.created_at < now() - interval '10 minutes' then return null; end if;
  return jsonb_build_object('user_id', s.user_id, 'code_verifier', s.code_verifier, 'return_to', s.return_to, 'return_origin', s.return_origin);
end $$;
revoke execute on function public.calendar_google_state_take(text) from public, anon, authenticated;
grant execute on function public.calendar_google_state_take(text) to service_role;

-- Save a connected account (new, or the same Google account again: its token is replaced, status back to ok).
create function public.calendar_google_account_save(p_user uuid, p_sub text, p_email text, p_refresh_token text, p_scopes text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.household_id_for(p_user);
  acc public.calendar_google_accounts%rowtype;
  aid uuid := gen_random_uuid();
begin
  if hid is null then raise exception 'no_household'; end if;
  if not public.calendar_google_enabled(p_user) then raise exception 'not_enabled'; end if;
  if coalesce(p_refresh_token, '') = '' then raise exception 'invalid'; end if;
  select * into acc from public.calendar_google_accounts where owner_user_id = p_user and google_sub = p_sub for update;
  if found then
    perform vault.update_secret(acc.refresh_secret_id, p_refresh_token);
    update public.calendar_google_accounts set email = left(p_email, 320), scopes = left(p_scopes, 1000), status = 'ok', last_error = null,
           household_id = hid, updated_at = now() where id = acc.id;
    -- Reconnected: her calendars from this account are fetched again at once.
    update public.calendar_feeds set status = case when status = 'disconnected' then 'pending' else status end, failures = 0, last_attempt_at = null
     where google_account_id = acc.id;
    return acc.id;
  end if;
  if (select count(*) from public.calendar_google_accounts where owner_user_id = p_user) >= 5 then raise exception 'too_many'; end if;
  insert into public.calendar_google_accounts (id, owner_user_id, household_id, google_sub, email, refresh_secret_id, scopes)
  values (aid, p_user, hid, p_sub, left(p_email, 320),
          vault.create_secret(p_refresh_token, 'calendar_google:' || aid, 'Google Calendar refresh token (read-only): docs/calendar/GOOGLE_CALENDAR.md'),
          left(p_scopes, 1000));
  return aid;
end $$;
revoke execute on function public.calendar_google_account_save(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.calendar_google_account_save(uuid, text, text, text, text) to service_role;

-- The decrypted refresh token of an account, for its owner's request only (list calendars, disconnect).
create function public.calendar_google_account_token(p_account uuid, p_owner uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'refresh_token', ds.decrypted_secret, 'status', a.status,
           'imported', coalesce((select jsonb_agg(jsonb_build_object('google_calendar_id', f.google_calendar_id, 'feed_id', f.id, 'visibility', f.visibility,
             'member_id', f.member_id, 'name', f.name)) from public.calendar_feeds f where f.google_account_id = a.id), '[]'))
    from public.calendar_google_accounts a join vault.decrypted_secrets ds on ds.id = a.refresh_secret_id
   where a.id = p_account and a.owner_user_id = p_owner and public.calendar_google_enabled(p_owner)
$$;
revoke execute on function public.calendar_google_account_token(uuid, uuid) from public, anon, authenticated;
grant execute on function public.calendar_google_account_token(uuid, uuid) to service_role;

-- Google stopped accepting the token: ask her to reconnect (calendars keep their events, per the store rules).
create function public.calendar_google_account_status(p_account uuid, p_status text, p_error text) returns void
language sql security definer set search_path = '' as $$
  update public.calendar_google_accounts set status = p_status, last_error = left(p_error, 200), updated_at = now() where id = p_account
$$;
revoke execute on function public.calendar_google_account_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.calendar_google_account_status(uuid, text, text) to service_role;

-- Disconnect (after the function revoked the token at Google): the account, its token (trigger), its calendars and
-- their imported events go. The family's own events and her iCal links are untouched.
create function public.calendar_google_forget(p_account uuid, p_owner uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.calendar_google_accounts where id = p_account and owner_user_id = p_owner;
  return found;
end $$;
revoke execute on function public.calendar_google_forget(uuid, uuid) from public, anon, authenticated;
grant execute on function public.calendar_google_forget(uuid, uuid) to service_role;

-- ---------------------------------------------------------------- the refresher now also claims Google calendars
-- Same due rules as iCal (3 hours, backoff on failures, double-tap guard, owner still in the household, switched on).
-- A Google calendar is claimed only while its account is 'ok' and Google is on for its owner; it comes with its
-- account's decrypted refresh token, for the refresher only.
create or replace function public.calendar_feed_claim(p_limit int default 20, p_feed uuid default null, p_owner uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare out jsonb;
begin
  if p_feed is not null then
    select jsonb_build_array(jsonb_build_object('id', f.id, 'recent', true, 'event_count', f.event_count)) into out
      from public.calendar_feeds f
     where f.id = p_feed and f.owner_user_id = p_owner and f.status <> 'disconnected' and f.last_attempt_at > now() - interval '30 seconds';
    if out is not null then return out; end if;
  end if;
  with due as (
    select f.id from public.calendar_feeds f
      left join public.calendar_google_accounts a on a.id = f.google_account_id
     where f.status <> 'disconnected'
       and (f.kind = 'ical' or (f.kind = 'google' and a.status = 'ok' and public.calendar_google_enabled(f.owner_user_id)))
       and exists (select 1 from public.household_adults ha where ha.household_id = f.household_id and ha.user_id = f.owner_user_id)
       and public.calendar_feeds_enabled(f.owner_user_id)
       and (case when p_feed is not null then f.id = p_feed and f.owner_user_id = p_owner
                 else (f.last_attempt_at is null
                       or f.last_attempt_at <= now() - least(interval '3 hours' * power(2, least(f.failures, 3)), interval '24 hours')) end)
     order by f.last_attempt_at nulls first
     limit greatest(1, least(p_limit, 100))
     for update of f skip locked
  ), marked as (
    update public.calendar_feeds f set last_attempt_at = now() from due where f.id = due.id
    returning f.id, f.kind, f.url_secret_id, f.google_account_id, f.google_calendar_id, f.etag, f.last_modified, f.timezone, f.content_hash
  )
  -- The only places links and tokens are decrypted: for the refresher (service role), never logged or returned to the app.
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'etag', m.etag, 'last_modified', m.last_modified,
           'timezone', m.timezone, 'content_hash', m.content_hash)
         || case when m.kind = 'google'
              then jsonb_build_object('google_account_id', m.google_account_id, 'google_calendar_id', m.google_calendar_id, 'refresh_token', gs.decrypted_secret)
              else jsonb_build_object('url', us.decrypted_secret) end), '[]') into out
    from marked m
    left join vault.decrypted_secrets us on us.id = m.url_secret_id
    left join public.calendar_google_accounts a on a.id = m.google_account_id
    left join vault.decrypted_secrets gs on gs.id = a.refresh_secret_id;
  return out;
end $$;
revoke execute on function public.calendar_feed_claim(int, uuid, uuid) from public, anon, authenticated;
grant execute on function public.calendar_feed_claim(int, uuid, uuid) to service_role;

commit;
