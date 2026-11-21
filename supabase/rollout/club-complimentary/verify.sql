-- 20261208_club_complimentary_access: READ-ONLY checks after applying. Every row must say ok = t.
select 'grant columns and the three reasons' as check_,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'club_access_grants' and column_name in ('granted_by', 'revoked_by', 'updated_at')) = 3
   and exists (select 1 from pg_constraint where conname = 'club_access_grants_reason_check' and pg_get_constraintdef(oid) like '%complimentary%') as ok
union all
select 'admin functions: signed-in callers may call, anonymous may not (each checks is_admin(''owner'') inside)',
       has_function_privilege('authenticated', 'public.club_admin_access_grant(uuid,timestamptz,text)', 'execute')
   and not has_function_privilege('anon', 'public.club_admin_access_grant(uuid,timestamptz,text)', 'execute')
   and not has_function_privilege('anon', 'public.club_admin_access_search(text)', 'execute')
union all
select 'internal helpers not callable by anyone signed in',
       not has_function_privilege('authenticated', 'public.club_access_summary(uuid)', 'execute')
   and not has_function_privilege('authenticated', 'public.club_access_grant_target(uuid)', 'execute')
union all
select 'families still cannot write grants directly',
       not has_table_privilege('authenticated', 'public.club_access_grants', 'insert,update,delete')
union all
select 'club_me partner view now reports the grant', position('''grant'', r -> ''grant'',' in pg_get_functiondef('public.club_me()'::regprocedure)) > 0
order by 1;
