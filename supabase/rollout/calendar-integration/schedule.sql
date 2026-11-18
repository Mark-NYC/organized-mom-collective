-- NOT APPLIED. The scheduled sync for connected calendars (docs/ios/CALENDAR_INTEGRATION.md → Rollout, step 5).
-- Run once, by hand, in the SQL editor, AFTER the migration is applied, the calendar-connect function is deployed and
-- the CALENDAR_CRON_SECRET secret is set. Needs pg_cron and pg_net (Supabase → Database → Extensions).
--
-- Replace <project-ref> and <CALENDAR_CRON_SECRET> below. The secret goes into Supabase Vault, not into this file or
-- the cron table in plain text.
select vault.create_secret('<CALENDAR_CRON_SECRET>', 'calendar_cron_secret', 'calendar-connect sync_due bearer');

-- Every 15 minutes: the function syncs what's due (Google every 30 minutes, links every 2 hours, failures backing off).
select cron.schedule('calendar-sync-due', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/calendar-connect',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
    body := '{"action":"sync_due"}'::jsonb,
    timeout_milliseconds := 120000)
$$);

-- To stop it: select cron.unschedule('calendar-sync-due');
