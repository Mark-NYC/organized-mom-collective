-- Removes connected calendars entirely (docs/ios/CALENDAR_INTEGRATION.md → Rollback). Family-owned events
-- (calendar_events) are untouched. First: select cron.unschedule('calendar-sync-due'); and undeploy calendar-connect.
-- Connected Google accounts keep showing "Organized Family" under their Google third-party access until each user
-- removes it there (or revoke tokens with the function before running this).
begin;
drop table if exists public.calendar_imported_events, public.calendar_sources, public.calendar_connection_secrets,
  public.calendar_oauth_states, public.calendar_connections cascade;
drop function if exists public.calendar_source_visible(uuid, uuid), public.calendar_sources_list(), public.calendar_source_update(uuid, boolean, boolean, jsonb),
  public.calendar_imported_feed(date, date), public.calendar_connection_upsert(uuid, text, text, text), public.calendar_secret_put(uuid, text),
  public.calendar_secret_get(uuid), public.calendar_sources_put(uuid, jsonb, boolean), public.calendar_sync_claim(uuid, int),
  public.calendar_sync_apply(uuid, timestamptz, timestamptz, jsonb, text, text, interval), public.calendar_sync_unchanged(uuid, interval),
  public.calendar_sync_failed(uuid, text, text), public.calendar_oauth_begin(uuid, text, text, text), public.calendar_oauth_take(text),
  public.calendar_connection_remove(uuid, uuid), public.calendar_connection_for(uuid);
commit;
