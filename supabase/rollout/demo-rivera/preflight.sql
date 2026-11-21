-- 20261209_demo_rivera: READ-ONLY checks, run on production right before applying. Every row must say ok = t.
select 'development records (20261207) applied' as check_, to_regclass('public.household_development') is not null as ok
union all
select 'complimentary access (20261208) applied', to_regprocedure('public.club_admin_access_grant(uuid,timestamptz,text)') is not null
union all
select 'cleaning progress, calendar, agreements, invitations in place',
       to_regprocedure('public.cleaning_marks_push(jsonb)') is not null and to_regprocedure('public.calendar_event_save(jsonb,integer)') is not null
   and to_regprocedure('public.household_agreement_save(jsonb,integer)') is not null and to_regprocedure('public.household_invite_accept(text)') is not null
union all
select 'not applied yet', to_regclass('public.demo_households') is null
union all
select 'no existing demo-looking accounts are already in families (example.com)',
       not exists (select 1 from auth.users u join public.household_adults a on a.user_id = u.id where u.email ilike '%@example.com')
order by 1;
