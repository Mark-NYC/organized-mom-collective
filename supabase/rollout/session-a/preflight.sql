-- READ-ONLY. Before Session A (20261121, 20261122, 20261123): docs/ios/SESSION_A_REVIEW.md.
-- Section 1: everything the session replaces is still exactly what the repo's migrations through 20261113 define
--            (md5 of the live definition). `false` = production drifted: stop, the session would overwrite the drift.
-- Section 2: nothing the session creates is already there. `false` = a partial earlier attempt: stop.
-- Section 3: numbers to note before and compare after (the session changes no existing row).
with exp(kind, name, h) as (values
 ('constraint','club_fulfillment_orders_fulfillment_type_check','5ef1cfefdab061d092bc020302345706'),
 ('constraint','club_fulfillment_orders_personalization_check','2bd5601ffe68bd47462fb757a8548503'),
 ('function','club_admin_fulfillment_bundle(uuid)','0358545e6b34bbef90730c03dd6b3ec9'),
 ('function','club_admin_member_months(uuid)','88f8c31ab924c3d36077ba411f674673'),
 ('function','club_admin_members(text,date)','a3c673ff831e50680406be65438844cb'),
 ('function','club_admin_set_welcome_kit(uuid,text,text)','841afa08e807ace3aa114b105291ea89'),
 ('function','club_admin_welcome_queue()','fd9cfaf444df30862c552679612fbbad'),
 ('function','club_email_audience(text,date)','cc6c405f8738c54c6ada7550c86e2cdf'),
 ('function','club_kit_submitted(uuid)','f1ec4a36d460cb13dd11c20cef9a5f98'),
 ('function','club_me()','d60165d553a832ba9c608090102c5dd6'),
 ('view','club_fulfillment_queue','bee42365ce4ea8fb7421c8378aef7359')),
live as (
 select 'function' kind, p.oid::regprocedure::text name, md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
 union all select 'view', 'club_fulfillment_queue', md5(pg_get_viewdef('public.club_fulfillment_queue'::regclass))
 union all select 'constraint', conname, md5(pg_get_constraintdef(oid)) from pg_constraint where connamespace = 'public'::regnamespace)
select '1 same as repo' as section, e.kind || ' ' || e.name as item, coalesce((l.h = e.h)::text, 'MISSING') as value from exp e left join live l on l.kind = e.kind and l.name = e.name
union all select '2 not there yet', x, (to_regclass('public.' || x) is null)::text from unnest(array['club_welcome_plans']) x
union all select '2 not there yet', x, (to_regprocedure('public.' || x) is null)::text from unnest(array['club_rhythm_valid(jsonb)', 'club_welcome_item_choose()', 'club_welcome_item_of(uuid)', 'club_welcome_overlap_check()', 'club_welcome_plan_access(uuid)', 'club_welcome_plan_approve(integer,text,jsonb)', 'club_welcome_plan_get()', 'club_welcome_plan_save(jsonb,integer)', 'club_welcome_plan_unapprove(integer)', 'club_welcome_rhythm_order_clear(uuid)', 'club_welcome_rhythm_order_set(uuid)']) x
union all select '2 not there yet', 'column ' || c, (not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = split_part(c, '.', 1) and column_name = split_part(c, '.', 2)))::text from unnest(array['club_households.welcome_kit_monthly_only', 'club_kits.establishes_daily_rhythm', 'club_settings.welcome_item']) c
union all select '3 data', 'postgres', current_setting('server_version')
union all select '3 data', 'migrations applied / last', (select count(*)::text || ' / ' || max(version) from supabase_migrations.schema_migrations)
union all select '3 data', 'households / family members', (select count(*) from public.club_households)::text || ' / ' || (select count(*) from public.club_family_members)::text
union all select '3 data', 'fulfillment orders by type and status', coalesce((select string_agg(t, ', ' order by t) from (select fulfillment_type || ':' || status || '=' || count(*) t from public.club_fulfillment_orders group by fulfillment_type, status) q), 'none')
union all select '3 data', 'subscriptions by status', coalesce((select string_agg(t, ', ' order by t) from (select status || '=' || count(*) t from public.club_subscriptions group by status) q), 'none')
union all select '3 data', 'live entitlements', (select count(*)::text from public.club_entitlements where revoked_at is null)
union all select '3 data', 'May and August kits exist (they get the daily-rhythm flag)', (select count(*)::text from public.club_kits where slug in ('2027-05-finish-the-school-year', '2027-08-school-year'))
union all select '3 data', 'club_settings rows', (select count(*)::text from public.club_settings)
union all select '3 data', 'cron jobs', (select count(*)::text from cron.job)
order by 1, 2;
