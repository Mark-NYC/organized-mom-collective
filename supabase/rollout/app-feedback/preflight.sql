-- 20261210_app_feedback: READ-ONLY checks, run on production right before applying. Every row must say ok = t.
select 'household_id_for (20261124) and is_admin (20261020) exist' as check_,
       to_regprocedure('public.household_id_for(uuid)') is not null and to_regprocedure('public.is_admin(text)') is not null as ok
union all
select 'support_requests (20261019) with the companion topic', exists (select 1 from pg_constraint where conrelid = 'public.support_requests'::regclass and pg_get_constraintdef(oid) like '%companion%')
union all
select 'not applied yet', to_regprocedure('public.app_feedback(text,text,text,text,integer)') is null
order by 1;
