-- Rolls back 20261206_calendar_google in one transaction (docs/calendar/GOOGLE_CALENDAR.md → Rollback). Rehearsed by
-- scripts/rehearse-calendar-google-rollout.sh (schema must equal the state right after 20261205).
--
-- NEVER run without the owner's go. It REMOVES every connected Google account, its encrypted refresh token, the
-- Google calendars chosen from it and their imported events. Revoke at Google is NOT possible from SQL: the tokens
-- simply stop being used (families can remove the app at myaccount.google.com/permissions). iCal links, the family
-- calendar, households, Club and billing are untouched.
begin;
-- The encrypted Google tokens first (Vault), then the Google calendars (their imported events go with them).
do $$ begin if to_regclass('vault.secrets') is not null then delete from vault.secrets where name like 'calendar\_google:%'; end if; end $$;
do $$ begin if to_regclass('public.calendar_google_accounts') is not null then delete from public.calendar_feeds where kind = 'google'; end if; end $$;
drop trigger if exists calendar_google_forget_token on public.calendar_google_accounts;
drop function if exists public.calendar_google_forget_token();
drop function if exists public.calendar_google_forget(uuid, uuid);
drop function if exists public.calendar_google_account_status(uuid, text, text);
drop function if exists public.calendar_google_account_token(uuid, uuid);
drop function if exists public.calendar_google_account_save(uuid, text, text, text, text);
drop function if exists public.calendar_google_state_take(text);
drop function if exists public.calendar_google_state_save(text, uuid, text, text, text);
drop function if exists public.calendar_google_select(uuid, jsonb);
drop function if exists public.calendar_google_accounts();
drop index if exists public.calendar_feeds_google_calendar;
alter table if exists public.calendar_feeds drop constraint if exists calendar_feeds_google_ref, drop column if exists google_calendar_id, drop column if exists google_account_id;
drop table if exists public.calendar_google_oauth_states;
drop table if exists public.calendar_google_accounts;
drop function if exists public.calendar_google_enabled(uuid);
alter table if exists public.calendar_feed_testers drop column if exists google;
alter table if exists public.calendar_feed_rollout drop column if exists google_everyone;

-- The two 20261205 functions this migration replaced, exactly as 20261205 created them.
create or replace function public.calendar_feed_json(f public.calendar_feeds, p_uid uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', f.id, 'kind', f.kind, 'name', f.name, 'visibility', f.visibility, 'member_id', f.member_id,
    'mine', f.owner_user_id = p_uid, 'url_host', case when f.owner_user_id = p_uid then f.url_host end, 'timezone', f.timezone,
    'status', f.status, 'last_error', case when f.owner_user_id = p_uid then f.last_error end, 'event_count', f.event_count,
    'last_success_at', f.last_success_at, 'events_at', f.events_at, 'updated_at', f.updated_at)
$$;
revoke execute on function public.calendar_feed_json(public.calendar_feeds, uuid) from public, anon, authenticated;

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
     where f.kind = 'ical' and f.status <> 'disconnected'
       and exists (select 1 from public.household_adults a where a.household_id = f.household_id and a.user_id = f.owner_user_id)
       and public.calendar_feeds_enabled(f.owner_user_id)
       and (case when p_feed is not null then f.id = p_feed and f.owner_user_id = p_owner
                 else (f.last_attempt_at is null
                       or f.last_attempt_at <= now() - least(interval '3 hours' * power(2, least(f.failures, 3)), interval '24 hours')) end)
     order by f.last_attempt_at nulls first
     limit greatest(1, least(p_limit, 100))
     for update skip locked
  ), marked as (
    update public.calendar_feeds f set last_attempt_at = now() from due where f.id = due.id
    returning f.id, f.url_secret_id, f.etag, f.last_modified, f.timezone, f.content_hash
  )
  -- The only place a link is decrypted: for the refresher (service role), never logged or returned to the app.
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'url', ds.decrypted_secret, 'etag', m.etag, 'last_modified', m.last_modified,
           'timezone', m.timezone, 'content_hash', m.content_hash)), '[]') into out
    from marked m join vault.decrypted_secrets ds on ds.id = m.url_secret_id;
  return out;
end $$;
revoke execute on function public.calendar_feed_claim(int, uuid, uuid) from public, anon, authenticated;
grant execute on function public.calendar_feed_claim(int, uuid, uuid) to service_role;
do $$ begin if to_regclass('supabase_migrations.schema_migrations') is not null then delete from supabase_migrations.schema_migrations where version = '20261206000000'; end if; end $$;
commit;
