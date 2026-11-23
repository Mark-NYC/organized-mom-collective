-- 20261212_household_priorities: READ-ONLY checks right after applying. Every row must say ok = t.
select 'the table: nobody but the server reads or writes it directly' as check_,
       to_regclass('public.household_priorities') is not null and not has_table_privilege('authenticated', 'public.household_priorities', 'select')
   and not has_table_privilege('anon', 'public.household_priorities', 'select') as ok
union all
select 'adults call list/save/remove; signed-out callers and helpers can''t',
       has_function_privilege('authenticated', 'public.household_priorities(date,date)', 'execute')
   and has_function_privilege('authenticated', 'public.household_priority_save(jsonb)', 'execute')
   and has_function_privilege('authenticated', 'public.household_priority_remove(uuid)', 'execute')
   and not has_function_privilege('anon', 'public.household_priority_save(jsonb)', 'execute')
   and not has_function_privilege('authenticated', 'public.household_shared_occurrence(uuid,text,text)', 'execute')
union all
select 'empty to start (nothing is a priority until a family chooses it)', (select count(*) from public.household_priorities) = 0
order by 1;
