-- 20261208_club_complimentary_access: READ-ONLY checks, run on production right before applying (and on a rehearsal
-- replay). Every row must say ok = t. Prints names and counts only, never personal data.
select 'admin core (20261020): is_admin, admin_log, admin_audit_log' as check_,
       exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'is_admin')
   and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'admin_log')
   and to_regclass('public.admin_audit_log') is not null as ok
union all
select 'club_access_grants with its reason check (preview, beta)',
       to_regclass('public.club_access_grants') is not null
   and exists (select 1 from pg_constraint where conrelid = 'public.club_access_grants'::regclass and contype = 'c'
                and pg_get_constraintdef(oid) like '%reason%' and pg_get_constraintdef(oid) like '%beta%')
union all
select 'household_id_for (20261124) and household_billing_user (20261128)',
       exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'household_id_for')
   and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'household_billing_user')
union all
select 'club_me partner view has the line this patches', position('''grant'', null,' in pg_get_functiondef('public.club_me()'::regprocedure)) > 0
union all
select 'new columns not there yet', not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_access_grants' and column_name in ('granted_by', 'revoked_by', 'updated_at'))
union all
select 'new functions not there yet', not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname like 'club_admin_access_%')
union all
select 'migration not recorded yet', case when to_regclass('supabase_migrations.schema_migrations') is null then true
  else ((xpath('/row/n/text()', query_to_xml('select count(*) as n from supabase_migrations.schema_migrations where name like ''%club_complimentary%''', false, true, '')))[1])::text::int = 0 end
order by 1;

-- Snapshot to compare after applying (must be identical): grants and paid memberships, and the access functions.
select 'grants: ' || reason || case when revoked_at is null and (expires_at is null or expires_at > now()) then ' live' else ' ended' end as obj, count(*)::text as value
  from public.club_access_grants group by 1
union all select 'subscriptions: ' || status, count(*)::text from public.club_subscriptions group by status
union all select 'households', count(*)::text from public.club_households
union all
select p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)) from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('club_has_access', 'club_has_paid_access', 'club_can_open', 'household_billing_user', 'club_resource_get', 'club_admin_members')
order by 1;
