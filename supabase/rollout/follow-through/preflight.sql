-- 20261204_agreement_follow_through: READ-ONLY checks, run on production right before applying (and on the rehearsal
-- replay). Every row must say ok = t. Prints names and counts only, never family data.
-- docs/product/FOLLOW_THROUGH_ROLLOUT.md
select 'agreements migration (20261127) is in place' as check_,
       to_regclass('public.club_responsibilities') is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_responsibilities' and column_name = 'agreed_text')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_responsibilities' and column_name = 'revision')
       and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'household_agreement_save') as ok
union all
select 'household_id_for (20261124) exists', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'household_id_for')
union all
select 'new columns not there yet', not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_responsibilities' and column_name in ('progress', 'checked_on', 'barrier'))
union all
select 'new functions not there yet', not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('household_agreement_check_in', 'household_follow_through', 'household_follow_through_json'))
union all
select 'new constraints not there yet', not exists (select 1 from pg_constraint where conname in ('club_responsibilities_follow_through_only_confirmed', 'club_responsibilities_barrier_only_struggling'))
union all
select 'migration not recorded yet', case when to_regclass('supabase_migrations.schema_migrations') is null then true
  else ((xpath('/row/n/text()', query_to_xml('select count(*) as n from supabase_migrations.schema_migrations where name like ''%agreement_follow_through%''', false, true, '')))[1])::text::int = 0 end
order by 1;

-- Snapshot to compare after applying (must be identical): row counts and the existing agreement functions.
select 'rows: ' || status as obj, count(*)::text as value from public.club_responsibilities group by status
union all
select 'rows: deleted agreements', count(*)::text from public.club_responsibilities where deleted_at is not null
union all
select p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('household_agreement_json', 'household_agreement_save', 'household_agreement_remove', 'household_agreements', 'club_family_profile')
order by 1;
