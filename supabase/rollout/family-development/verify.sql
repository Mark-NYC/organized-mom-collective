-- 20261207_family_development_records: READ-ONLY checks after applying. Every row must say ok = t.
select 'tables exist with RLS on' as check_,
       coalesce((select bool_and(relrowsecurity) from pg_class where oid in ('public.household_development'::regclass, 'public.household_development_events'::regclass)), false) as ok
union all
select 'families can only select (no direct writes)',
       not has_table_privilege('authenticated', 'public.household_development', 'insert,update,delete')
   and not has_table_privilege('authenticated', 'public.household_development_events', 'insert,update,delete')
   and has_table_privilege('authenticated', 'public.household_development', 'select')
union all
select 'anon has nothing', not has_table_privilege('anon', 'public.household_development', 'select')
   and not has_function_privilege('anon', 'public.household_development_decide(jsonb, integer)', 'execute')
union all
select 'functions callable by signed-in adults', has_function_privilege('authenticated', 'public.household_development()', 'execute')
   and has_function_privilege('authenticated', 'public.household_development_decide(jsonb, integer)', 'execute')
   and not has_function_privilege('authenticated', 'public.household_development_json(public.household_development)', 'execute')
   and not has_function_privilege('authenticated', 'public.household_development_ensure_agreement(public.household_development, uuid, uuid)', 'execute')
union all
select 'starts empty', (select count(*) from public.household_development) = 0 and (select count(*) from public.household_development_events) = 0
order by 1;
