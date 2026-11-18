-- 20261205_calendar_feeds: READ-ONLY checks right after applying. Every row must say ok = t; then re-run the snapshot
-- half of preflight.sql and compare (identical). docs/calendar/ROLLOUT.md
select 'tables exist, RLS on' as check_,
       (select bool_and(relrowsecurity) from pg_class where oid in ('public.calendar_feeds'::regclass, 'public.calendar_feed_events'::regclass)) as ok
union all
select 'no direct table access for app roles',
       not has_table_privilege('authenticated', 'public.calendar_feeds', 'select') and not has_table_privilege('anon', 'public.calendar_feeds', 'select')
       and not has_table_privilege('authenticated', 'public.calendar_feed_events', 'select') and not has_table_privilege('anon', 'public.calendar_feed_events', 'select')
union all
select 'adult functions: authenticated only',
       bool_and(has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute'))
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('calendar_feed_add', 'calendar_feed_update', 'calendar_feed_remove', 'calendar_feeds', 'calendar_feed_events', 'calendar_feed_retry')
union all
select 'refresher functions: service role only',
       bool_and(not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute'))
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('calendar_feed_claim', 'calendar_feed_store')
union all
select 'helpers not callable by app roles',
       bool_and(not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute'))
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('calendar_feed_json', 'calendar_feeds_visible')
union all
select 'every security definer function pins search_path',
       bool_and(p.proconfig @> array['search_path=""'])
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'calendar_feed%' and p.prosecdef
union all
select 'no subscriptions yet (fresh)', (select count(*) from public.calendar_feeds) = 0
order by 1;
