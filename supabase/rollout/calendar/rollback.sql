-- Rolls back 20261205_calendar_feeds in one transaction (docs/calendar/ROLLOUT.md → Rollback). Rehearsed as part of
-- scripts/rehearse-household-rollback.sh (the same statements head supabase/rollout/household/rollback.sql).
--
-- NEVER run without the owner's go. It REMOVES every calendar subscription, its encrypted link (Vault) and its imported events (the source calendars
-- are untouched; families would have to add their links again). It touches nothing else: the family calendar,
-- households, members, Club and billing rows stay exactly as they are.
-- Unschedule the refresh first (step 1), or the job keeps calling a function that then fails harmlessly every run.
begin;
do $$ begin if exists (select 1 from pg_extension where extname = 'pg_cron') then perform cron.unschedule('omc-calendar-feeds-refresh'); end if; exception when others then null; end $$;
-- The encrypted links first (Vault), then everything the migration created.
do $$ begin if to_regclass('vault.secrets') is not null then delete from vault.secrets where name like 'calendar\_feed:%'; end if; end $$;
drop trigger if exists calendar_feed_forget_link on public.calendar_feeds;
drop function if exists public.calendar_feed_forget_link();
drop function if exists public.calendar_feed_retry(uuid);
drop function if exists public.calendar_feed_store(uuid, jsonb);
drop function if exists public.calendar_feed_claim(int, uuid, uuid);
drop function if exists public.calendar_feed_events(timestamptz, timestamptz, text);
drop function if exists public.calendar_feeds();
drop function if exists public.calendar_feed_remove(uuid);
drop function if exists public.calendar_feed_update(uuid, jsonb);
drop function if exists public.calendar_feed_add(jsonb);
drop function if exists public.calendar_feeds_visible(uuid);
drop function if exists public.calendar_feed_json(public.calendar_feeds, uuid);
drop function if exists public.calendar_feeds_enabled(uuid);
drop table if exists public.calendar_feed_events;
drop table if exists public.calendar_feeds;
drop table if exists public.calendar_feed_testers;
drop table if exists public.calendar_feed_rollout;
do $$ begin if to_regclass('supabase_migrations.schema_migrations') is not null then delete from supabase_migrations.schema_migrations where version = '20261205000000'; end if; end $$;
commit;
