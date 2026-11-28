-- 20261210_app_feedback: READ-ONLY checks right after applying. Every row must say ok = t.
select 'signed-in users can send feedback; anon cannot' as check_, has_function_privilege('authenticated', 'public.app_feedback(text,text,text,text,integer)', 'execute')
   and not has_function_privilege('anon', 'public.app_feedback(text,text,text,text,integer)', 'execute') as ok
union all
select 'no app_events table (retired: the behavioral log is household_signals, 20261216)', to_regclass('public.app_events') is null
union all
select 'feedback list callable (it checks the owner itself); the cohort helper is server-only',
       has_function_privilege('authenticated', 'public.pilot_feedback(date)', 'execute')
   and not has_function_privilege('authenticated', 'public.pilot_cohort(date)', 'execute')
order by 1;
