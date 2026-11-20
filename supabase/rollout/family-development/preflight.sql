-- 20261207_family_development_records: READ-ONLY checks, run on production right before applying (and on a
-- rehearsal replay). Every row must say ok = t. Prints names and counts only, never family data.
-- docs/product/FAMILY_DEVELOPMENT_ENGINE.md → Rollout.
select 'household_id_for (20261124) exists' as check_,
       exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'household_id_for') as ok
union all
select 'household_billing_user (20261128) exists', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'household_billing_user')
union all
select 'club_has_access (20261023) exists', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'club_has_access')
union all
select 'club_family_members.archived_at exists', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_family_members' and column_name = 'archived_at')
union all
select 'new tables not there yet', to_regclass('public.household_development') is null and to_regclass('public.household_development_events') is null
union all
select 'new functions not there yet', not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('household_development', 'household_development_decide', 'household_development_json'))
union all
select 'migration not recorded yet', case when to_regclass('supabase_migrations.schema_migrations') is null then true
  else ((xpath('/row/n/text()', query_to_xml('select count(*) as n from supabase_migrations.schema_migrations where name like ''%family_development%''', false, true, '')))[1])::text::int = 0 end
order by 1;

-- Snapshot to compare after applying (must be identical): household row counts and the functions the new ones call.
select 'rows: club_households' as obj, count(*)::text as value from public.club_households
union all select 'rows: club_family_members', count(*)::text from public.club_family_members
union all select 'rows: club_responsibilities', count(*)::text from public.club_responsibilities
union all
select p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('household_id_for', 'household_billing_user', 'club_has_access', 'club_me', 'household_agreement_save', 'club_family_profile')
order by 1;
