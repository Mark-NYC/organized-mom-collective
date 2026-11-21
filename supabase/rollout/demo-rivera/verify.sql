-- 20261209_demo_rivera: READ-ONLY checks right after applying. Every row must say ok = t.
select 'registry exists, no family can read it' as check_,
       to_regclass('public.demo_households') is not null and not has_table_privilege('authenticated', 'public.demo_households', 'select') as ok
union all
select 'owner functions callable by signed-in users (each checks the owner itself)',
       has_function_privilege('authenticated', 'public.demo_rivera_reset(text,text)', 'execute') and has_function_privilege('authenticated', 'public.demo_rivera_status()', 'execute')
union all
select 'seed and helpers are server-only',
       not has_function_privilege('authenticated', 'public.demo_rivera_seed(uuid,uuid)', 'execute') and not has_function_privilege('authenticated', 'public.demo_act_as(uuid)', 'execute')
   and not has_function_privilege('anon', 'public.demo_rivera_reset(text,text)', 'execute')
union all
select 'nothing installed yet (the owner installs from the dashboard)', not exists (select 1 from public.demo_households)
order by 1;
