-- 20261204_agreement_follow_through: READ-ONLY checks right after applying. Every row must say ok = t.
-- Then run the snapshot half of preflight.sql again: it must equal the one taken before applying.
select 'three nullable columns on club_responsibilities' as check_,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'club_responsibilities'
         and column_name in ('progress', 'checked_on', 'barrier') and is_nullable = 'YES') = 3 as ok
union all
select 'both constraints', (select count(*) from pg_constraint where conname in ('club_responsibilities_follow_through_only_confirmed', 'club_responsibilities_barrier_only_struggling')) = 2
union all
select 'check-in and read functions exist', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('household_agreement_check_in', 'household_follow_through', 'household_follow_through_json')) = 3
union all
select 'signed-in only: authenticated may call, anon may not',
       has_function_privilege('authenticated', 'public.household_agreement_check_in(uuid,text,text,int)', 'execute')
       and has_function_privilege('authenticated', 'public.household_follow_through()', 'execute')
       and not has_function_privilege('anon', 'public.household_agreement_check_in(uuid,text,text,int)', 'execute')
       and not has_function_privilege('anon', 'public.household_follow_through()', 'execute')
       and not has_function_privilege('authenticated', 'public.household_follow_through_json(public.club_responsibilities)', 'execute')
union all
select 'no row was changed by the migration', not exists (select 1 from public.club_responsibilities where progress is not null or checked_on is not null or barrier is not null)
order by 1;
