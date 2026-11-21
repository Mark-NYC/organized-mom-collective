-- 20261210_app_events: READ-ONLY checks right after applying. Every row must say ok = t.
select 'events table: nobody but the server reads or writes it directly' as check_,
       to_regclass('public.app_events') is not null and not has_table_privilege('authenticated', 'public.app_events', 'select')
   and not has_table_privilege('authenticated', 'public.app_events', 'insert') as ok
union all
select 'signed-in users can record an event and send feedback', has_function_privilege('authenticated', 'public.app_event(text,text)', 'execute')
   and has_function_privilege('authenticated', 'public.app_feedback(text,text,text,text,integer)', 'execute')
   and not has_function_privilege('anon', 'public.app_event(text,text)', 'execute')
union all
select 'funnel and feedback list callable (each checks the owner itself); the cohort helper is server-only',
       has_function_privilege('authenticated', 'public.pilot_funnel(date)', 'execute') and has_function_privilege('authenticated', 'public.pilot_feedback(date)', 'execute')
   and not has_function_privilege('authenticated', 'public.pilot_cohort(date)', 'execute')
order by 1;
