-- 20261211_calendar_event_tasks: READ-ONLY checks, run on production right before applying. Every row must say ok = t.
select 'calendar subscriptions (20261205) and Google (20261206) are applied' as check_,
       to_regprocedure('public.calendar_feeds_visible(uuid)') is not null and to_regprocedure('public.calendar_feed_store(uuid,jsonb)') is not null
   and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendar_feed_testers' and column_name = 'google') as ok
union all
select 'household helpers (20261124) exist', to_regprocedure('public.household_id_for(uuid)') is not null
union all
select 'not applied yet', to_regclass('public.calendar_event_tasks') is null
   and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendar_feed_testers' and column_name = 'event_tasks')
order by 1;
