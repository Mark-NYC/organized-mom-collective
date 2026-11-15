-- READ-ONLY. After each step of docs/ios/MIGRATION_DEPLOYMENT_PLAN.md. Rows for steps not applied yet say
-- applied = false; every row with applied = true must say ok = true.
with s as (select
  to_regclass('public.household_adults') is not null as m24, to_regclass('public.calendar_events') is not null as m25,
  to_regprocedure('public.household_colors_complete(uuid)') is not null as m26,
  to_regprocedure('public.household_agreement_save(jsonb,integer)') is not null as m27,
  to_regprocedure('public.household_billing_user(uuid)') is not null as m28,
  to_regprocedure('public.account_chargeable(uuid)') is not null as m29,
  to_regclass('public.household_archives') is not null as m30, to_regclass('public.household_cleaning_marks') is not null as m1201),
checks(step, check_name, applied, ok) as (
  select '24', 'every household has exactly one owner row, and it is its owner_user_id', m24,
         m24 and (select count(*) from public.club_households) = (select count(*) from public.household_adults where role = 'owner')
         and not exists (select 1 from public.club_households h where not exists (select 1 from public.household_adults a where a.household_id = h.id and a.user_id = h.owner_user_id and a.role = 'owner')) from s
  union all select '24', 'no household has more than two adults', m24,
         m24 and not exists (select 1 from public.household_adults group by household_id having count(*) > 2) from s
  union all select '24', 'RLS on the new tables; anon has nothing; members read only', m24,
         m24 and (select bool_and(relrowsecurity) from pg_class where oid in ('public.household_adults'::regclass, 'public.household_invites'::regclass))
         and not has_table_privilege('anon', 'public.household_adults', 'select') and not has_table_privilege('authenticated', 'public.household_adults', 'insert')
         and not has_table_privilege('authenticated', 'public.household_invites', 'select') from s
  union all select '24', 'member functions callable by members only; internals by nobody', m24,
         m24 and has_function_privilege('authenticated', 'public.household_invite_accept(text)', 'execute')
         and not has_function_privilege('anon', 'public.household_invite_accept(text)', 'execute')
         and not has_function_privilege('anon', 'public.club_household()', 'execute')
         and not has_function_privilege('authenticated', 'public.household_owner_handover(uuid,uuid)', 'execute')
         and not has_function_privilege('authenticated', 'public.household_save_core(integer,text,jsonb,jsonb)', 'execute') from s
  union all select '24', 'the owner-leaving trigger is on sign-ins', m24,
         m24 and exists (select 1 from pg_trigger where tgname = 'household_owner_leaving' and tgrelid = 'auth.users'::regclass) from s
  union all select '25', 'calendar: RLS, members read only, anon nothing', m25,
         m25 and (select relrowsecurity from pg_class where oid = 'public.calendar_events'::regclass)
         and not has_table_privilege('anon', 'public.calendar_events', 'select') and not has_table_privilege('authenticated', 'public.calendar_events', 'insert')
         and not has_function_privilege('anon', 'public.calendar_event_save(jsonb,integer)', 'execute') from s
  union all select '26', 'every current family member has a saved, valid color', m26,
         m26 and not exists (select 1 from public.club_family_members f join public.club_households h on h.id = f.household_id
                              where f.archived_at is null and coalesce(h.preferences -> 'colors' ->> f.id::text, '') not in ('blue', 'green', 'purple', 'pink', 'orange', 'teal', 'red', 'brown')) from s
  union all select '27', 'agreements: functions for members only; no existing responsibility was touched (revision 0)', m27,
         m27 and has_function_privilege('authenticated', 'public.household_agreement_save(jsonb,integer)', 'execute')
         and not has_function_privilege('anon', 'public.household_agreements(timestamp with time zone)', 'execute') from s
  union all select '28', 'club_me still answers; billing helpers are internal', m28,
         m28 and has_function_privilege('authenticated', 'public.club_me()', 'execute') and not has_function_privilege('anon', 'public.club_me()', 'execute')
         and not has_function_privilege('authenticated', 'public.club_me_for(uuid)', 'execute')
         and not has_function_privilege('authenticated', 'public.household_billing_user(uuid)', 'execute') from s
  union all select '29', 'the deletion guard is on sign-ins, once', m29,
         m29 and (select count(*) from pg_trigger where tgname = 'account_chargeable_guard' and tgrelid = 'auth.users'::regclass) = 1
         and not has_function_privilege('authenticated', 'public.account_chargeable(uuid)', 'execute') from s
  union all select '30', 'archives: RLS, own rows only, nobody writes; join functions for members only', m30,
         m30 and (select relrowsecurity from pg_class where oid = 'public.household_archives'::regclass)
         and not has_table_privilege('authenticated', 'public.household_archives', 'insert') and not has_table_privilege('anon', 'public.household_archives', 'select')
         and has_function_privilege('authenticated', 'public.household_invite_accept_leaving(text,uuid,boolean)', 'execute')
         and not has_function_privilege('anon', 'public.household_invite_preview(text)', 'execute')
         and not has_function_privilege('authenticated', 'public.household_snapshot(uuid)', 'execute') from s
  union all select '1201', 'cleaning marks: RLS, members read only, anon nothing', m1201,
         m1201 and (select relrowsecurity from pg_class where oid = 'public.household_cleaning_marks'::regclass)
         and not has_table_privilege('authenticated', 'public.household_cleaning_marks', 'insert') and not has_table_privilege('anon', 'public.household_cleaning_marks', 'select')
         and not has_function_privilege('anon', 'public.cleaning_marks_push(jsonb)', 'execute') from s
)
select step, check_name, applied, (not applied or ok) as ok from checks order by 1, 2;
