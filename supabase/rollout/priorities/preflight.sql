-- 20261212_household_priorities: READ-ONLY checks, run on production right before applying. Every row must say ok = t.
select 'households (20261124), the family calendar (20261125) and calendar subscriptions (20261205) are applied' as check_,
       to_regprocedure('public.household_id_for(uuid)') is not null and to_regclass('public.calendar_events') is not null
   and to_regclass('public.calendar_feed_events') is not null as ok
union all
select 'not applied yet', to_regclass('public.household_priorities') is null
order by 1;
