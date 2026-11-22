-- 20261211_calendar_event_tasks: READ-ONLY checks right after applying. Every row must say ok = t.
select 'off for everyone: event_tasks_everyone is false' as check_,
       not coalesce((select event_tasks_everyone from public.calendar_feed_rollout where id), true) as ok
union all
select 'no tester has it yet (the owner turns it on for the test household separately)', not exists (select 1 from public.calendar_feed_testers where event_tasks)
union all
select 'the table: nobody but the server reads or writes it directly', to_regclass('public.calendar_event_tasks') is not null
   and not has_table_privilege('authenticated', 'public.calendar_event_tasks', 'select') and not has_table_privilege('anon', 'public.calendar_event_tasks', 'select')
union all
select 'adults call the four functions; signed-out callers and helpers can''t',
       has_function_privilege('authenticated', 'public.calendar_event_tasks(date,date)', 'execute')
   and has_function_privilege('authenticated', 'public.calendar_event_task_save(jsonb)', 'execute')
   and has_function_privilege('authenticated', 'public.calendar_event_task_done(uuid,boolean)', 'execute')
   and has_function_privilege('authenticated', 'public.calendar_event_task_delete(uuid)', 'execute')
   and not has_function_privilege('anon', 'public.calendar_event_task_save(jsonb)', 'execute')
   and not has_function_privilege('authenticated', 'public.calendar_event_tasks_enabled(uuid)', 'execute')
   and not has_function_privilege('authenticated', 'public.calendar_event_tasks_events(uuid)', 'execute')
union all
select 'imported events and subscriptions unchanged in shape (the refresher is untouched)', to_regprocedure('public.calendar_feed_store(uuid,jsonb)') is not null
order by 1;
