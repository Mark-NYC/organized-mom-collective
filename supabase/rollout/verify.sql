-- Read-only. After applying 20261108 and 20261109: every line must say ok = true.
with checks(check_name, ok) as (values
  ('welcome kit: club_admin_set_welcome_kit exists',
    to_regprocedure('public.club_admin_set_welcome_kit(uuid,text,text)') is not null),
  ('welcome kit: queue has in_welcome_kit / kit_partner_id',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_fulfillment_queue' and column_name = 'in_welcome_kit')
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_fulfillment_queue' and column_name = 'kit_partner_id')),
  ('welcome kit: queue view is security_invoker',
    exists (select 1 from pg_class where oid = 'public.club_fulfillment_queue'::regclass and 'security_invoker=true' = any (reloptions))),
  ('welcome kit: kit_reminder email kind allowed',
    exists (select 1 from pg_constraint where conname = 'club_email_log_kind_check' and pg_get_constraintdef(oid) like '%kit_reminder%')),
  ('profile: four member functions exist',
    to_regprocedure('public.club_family_profile()') is not null and to_regprocedure('public.club_activities_save(jsonb)') is not null
    and to_regprocedure('public.club_responsibilities_save(text,jsonb)') is not null
    and to_regprocedure('public.club_focus_save(text,text[],text,text,text)') is not null),
  ('profile: members can call them, anon cannot',
    has_function_privilege('authenticated', 'public.club_family_profile()', 'execute')
    and has_function_privilege('authenticated', 'public.club_focus_save(text,text[],text,text,text)', 'execute')
    and not has_function_privilege('anon', 'public.club_family_profile()', 'execute')
    and not has_function_privilege('anon', 'public.club_activities_save(jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.club_admin_set_welcome_kit(uuid,text,text)', 'execute')),
  ('profile: helpers are internal',
    not has_function_privilege('authenticated', 'public.club_my_household()', 'execute')
    and not has_function_privilege('authenticated', 'public.club_setup_mark(uuid,text)', 'execute')),
  ('profile: RLS on the new tables',
    (select bool_and(relrowsecurity) from pg_class where oid in ('public.club_activities'::regclass, 'public.club_responsibilities'::regclass))),
  ('profile: anon has no table rights, members read only',
    not has_table_privilege('anon', 'public.club_activities', 'select') and not has_table_privilege('authenticated', 'public.club_activities', 'insert')
    and not has_table_privilege('authenticated', 'public.club_responsibilities', 'update')),
  ('profile: new household columns default safely',
    not exists (select 1 from public.club_households where setup_done is null or challenges is null)),
  ('security definer functions keep an empty search_path',
    not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and prosecdef
                  and proname in ('club_family_profile', 'club_activities_save', 'club_responsibilities_save', 'club_focus_save',
                                  'club_admin_set_welcome_kit', 'club_resource_save', 'club_intro_grant', 'club_invoice_apply')
                  and not coalesce(proconfig, '{}') @> array['search_path=""']))
)
select check_name, ok from checks
union all
-- Information, not a check: how the queue groups orders now (founding members' welcome print + January = one kit).
select 'queue: ' || fulfillment_type || ' / ' || status || ' / ' || readiness || ' / ' || coalesce(batch, '-') || ' × ' || count(*), null
  from public.club_fulfillment_queue group by fulfillment_type, status, readiness, batch;
