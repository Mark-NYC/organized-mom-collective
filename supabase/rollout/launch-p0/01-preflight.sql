-- Launch P0, step 1 (read-only): what production has before 20261110 and 20261113. Every row should say ok = true.
select 'history ends at club_family_profile' as check,
       (select max(version) from supabase_migrations.schema_migrations where name like 'club_%') = '20261109000000' as ok
union all select '20261110 not applied yet (no ship-by column)',
       not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_fulfillment_queue' and column_name = 'kit_ship_by')
union all select '20261110 not applied yet (no guide column)',
       not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_households' and column_name = 'meeting_guide_seen_at')
union all select 'club_household_save is the 20261023 version (md5 checked Nov 4 2026)',
       (select md5(regexp_replace(prosrc, '\s+', ' ', 'g')) from pg_proc where proname = 'club_household_save' and pronamespace = 'public'::regnamespace) = 'ca9cf215e44579bb5f7cd01f9dc235a1'
union all select 'Stripe is in test mode, no live subscription',
       (select checkout_mode from public.club_settings) = 'test' and not exists (select 1 from public.club_subscriptions where livemode)
union all select 'nothing approved for print or mailed yet',
       not exists (select 1 from public.club_fulfillment_orders where status in ('approved', 'printed', 'mailed'));
