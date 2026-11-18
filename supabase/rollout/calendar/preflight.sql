-- 20261205_calendar_feeds: READ-ONLY checks, run on production right before applying. Every row must say ok = t.
-- Prints names and counts only, never family data. docs/calendar/ROLLOUT.md
select 'household migrations (20261124) are in place' as check_,
       exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'household_id_for')
       and to_regclass('public.household_adults') is not null as ok
union all
select 'family calendar (20261125) is in place', to_regclass('public.calendar_events') is not null
union all
select 'club_family_members.archived_at exists', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_family_members' and column_name = 'archived_at')
union all
select 'gen_random_uuid available', exists (select 1 from pg_proc where proname = 'gen_random_uuid')
union all
select 'new tables not there yet', to_regclass('public.calendar_feeds') is null and to_regclass('public.calendar_feed_events') is null
union all
select 'no function name collides', not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname like 'calendar_feed%')
union all
select 'migration not recorded yet', case when to_regclass('supabase_migrations.schema_migrations') is null then true
  else ((xpath('/row/n/text()', query_to_xml('select count(*) as n from supabase_migrations.schema_migrations where name like ''%calendar_feeds%''', false, true, '')))[1])::text::int = 0 end
order by 1;

-- Snapshot to compare after applying (must be identical): the family calendar and household rows and functions this
-- migration must not touch.
select 'rows: calendar_events' as obj, count(*)::text as value from public.calendar_events
union all select 'rows: calendar_events deleted', count(*)::text from public.calendar_events where deleted_at is not null
union all select 'rows: households', count(*)::text from public.club_households
union all select 'rows: household_adults', count(*)::text from public.household_adults
union all select 'rows: family members', count(*)::text from public.club_family_members
union all select 'max calendar_events.updated_at', coalesce(max(updated_at)::text, '-') from public.calendar_events
union all
select p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('calendar_event_save', 'calendar_event_delete', 'calendar_changes', 'calendar_import_activities', 'household_id_for', 'household_leave')
order by 1;
