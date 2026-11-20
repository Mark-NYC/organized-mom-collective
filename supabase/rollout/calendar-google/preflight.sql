-- 20261206_calendar_google: READ-ONLY checks, run on production right before applying. Every row must say ok = t.
-- Prints names and counts only, never family data or secrets. docs/calendar/GOOGLE_CALENDAR.md
select '20261205 calendar subscriptions are in place' as check_,
       to_regclass('public.calendar_feeds') is not null and to_regclass('public.calendar_feed_testers') is not null
       and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'calendar_feeds_enabled') as ok
union all
select 'Vault: the migration owner can store, update, read and delete secrets',
       to_regclass('vault.secrets') is not null
       and has_function_privilege('postgres', 'vault.create_secret(text,text,text,uuid)', 'execute')
       and has_function_privilege('postgres', 'vault.update_secret(uuid,text,text,text,uuid)', 'execute')
       and has_table_privilege('postgres', 'vault.decrypted_secrets', 'select') and has_table_privilege('postgres', 'vault.secrets', 'delete')
union all
select 'app roles cannot reach Vault', not has_table_privilege('authenticated', 'vault.decrypted_secrets', 'select') and not has_table_privilege('anon', 'vault.decrypted_secrets', 'select')
union all
select 'pgcrypto digest available', exists (select 1 from pg_proc where pronamespace = 'extensions'::regnamespace and proname = 'digest')
union all
select 'no Google tables, columns or functions yet', to_regclass('public.calendar_google_accounts') is null and to_regclass('public.calendar_google_oauth_states') is null
       and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendar_feeds' and column_name in ('google_account_id', 'google_calendar_id'))
       and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendar_feed_testers' and column_name = 'google')
       and not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname like 'calendar_google%')
union all
select 'no Google tokens in Vault yet', not exists (select 1 from vault.secrets where name like 'calendar\_google:%')
union all
select 'no Google calendars yet', not exists (select 1 from public.calendar_feeds where kind = 'google')
union all
select 'migration not recorded yet', case when to_regclass('supabase_migrations.schema_migrations') is null then true
  else ((xpath('/row/n/text()', query_to_xml('select count(*) as n from supabase_migrations.schema_migrations where name like ''%calendar_google%''', false, true, '')))[1])::text::int = 0 end
order by 1;

-- Snapshot to compare after applying (must be identical): rows and functions this migration must not touch.
select 'rows: calendar_events' as obj, count(*)::text as value from public.calendar_events
union all select 'rows: households', count(*)::text from public.club_households
union all select 'rows: family members', count(*)::text from public.club_family_members
union all select 'rows: calendar_feeds (iCal)', count(*)::text from public.calendar_feeds
union all select 'rows: calendar_feed_events', count(*)::text from public.calendar_feed_events
union all select 'rows: calendar_feed_testers', count(*)::text from public.calendar_feed_testers
union all select 'rows: vault secrets (other features)', count(*)::text from vault.secrets where name not like 'calendar\_google:%'
union all select 'rollout: everyone', (select everyone::text from public.calendar_feed_rollout where id)
union all
select p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('calendar_event_save', 'calendar_event_delete', 'calendar_changes', 'household_id_for', 'calendar_feeds_enabled', 'calendar_feed_add',
                     'calendar_feed_update', 'calendar_feed_remove', 'calendar_feeds', 'calendar_feed_events', 'calendar_feed_store', 'calendar_feed_retry')
order by 1;
