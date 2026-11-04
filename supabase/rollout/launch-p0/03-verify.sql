-- Launch P0, step 3 (read-only, after both migrations): every row ok = true.
select 'history has club_welcome_kit_approvals and club_household_icon_style' as check,
       (select count(*) from supabase_migrations.schema_migrations where name in ('club_welcome_kit_approvals', 'club_household_icon_style')) = 2 as ok
union all select 'queue has kit_submitted_at and kit_ship_by',
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'club_fulfillment_queue' and column_name in ('kit_submitted_at', 'kit_ship_by')) = 2
union all select 'three-day automatic confirmation retired',
       not exists (select 1 from public.club_fulfillment_queue where kit_auto_approve_at is not null)
union all select 'guide review functions for members only',
       has_function_privilege('authenticated', 'public.club_meeting_guide_mark()', 'execute') and not has_function_privilege('anon', 'public.club_meeting_guide_mark()', 'execute')
union all select 'owner notification lookup is service-only',
       not has_function_privilege('authenticated', 'public.club_kit_submitted(uuid)', 'execute')
union all select 'family form: icon_style accepted',
       position('''icon_style''' in pg_get_functiondef('public.club_household_save'::regproc)) > 0
union all select 'two business days skip the weekend',
       public.club_business_days_after('2026-11-06 15:00-05', 2) = '2026-11-10';
