-- 20261206_calendar_google: READ-ONLY checks right after applying. Every row must say ok = t; then re-run the snapshot
-- half of preflight.sql and compare (identical). docs/calendar/GOOGLE_CALENDAR.md
select 'Google tables exist, RLS on' as check_,
       (select bool_and(relrowsecurity) from pg_class where oid in ('public.calendar_google_accounts'::regclass, 'public.calendar_google_oauth_states'::regclass)) as ok
union all
select 'no app access to Google tables',
       not has_table_privilege('authenticated', 'public.calendar_google_accounts', 'select') and not has_table_privilege('anon', 'public.calendar_google_accounts', 'select')
       and not has_table_privilege('authenticated', 'public.calendar_google_oauth_states', 'select') and not has_table_privilege('anon', 'public.calendar_google_oauth_states', 'select')
union all
select 'adult functions: authenticated only',
       bool_and(has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute'))
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('calendar_google_accounts', 'calendar_google_select')
union all
select 'OAuth, token and refresher functions: service role only',
       bool_and(not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute'))
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('calendar_google_state_save', 'calendar_google_state_take', 'calendar_google_account_save', 'calendar_google_account_token',
                     'calendar_google_account_status', 'calendar_google_forget', 'calendar_feed_claim')
union all
select 'helpers not callable by app roles',
       bool_and(not has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute'))
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('calendar_google_enabled', 'calendar_google_forget_token', 'calendar_feed_json')
union all
select 'every security definer function pins search_path',
       bool_and(p.proconfig @> array['search_path=""'])
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'calendar_google%' and p.prosecdef
union all
select 'no token column: tokens live only in Vault', not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendar_google_accounts' and column_name ~ 'token')
union all
select 'Vault token deletion trigger in place', exists (select 1 from pg_trigger where tgname = 'calendar_google_forget_token')
union all
select 'Google switched off for everyone; no Google testers yet',
       (select not google_everyone from public.calendar_feed_rollout where id) and not exists (select 1 from public.calendar_feed_testers where google)
union all
select 'nothing connected yet', (select count(*) from public.calendar_google_accounts) = 0 and (select count(*) from public.calendar_google_oauth_states) = 0
order by 1;
