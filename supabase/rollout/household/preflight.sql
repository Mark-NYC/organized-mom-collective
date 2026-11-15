-- READ-ONLY. Before applying anything from 20261121 on (docs/ios/MIGRATION_DEPLOYMENT_PLAN.md → Preflight).
-- Every row must say ok = true; `detail` is what to look at when one doesn't. Counts only, no family data.
with checks(step, check_name, ok, detail) as (values
  ('all', 'none of the household migrations is already there',
    to_regclass('public.household_adults') is null and to_regclass('public.calendar_events') is null
    and to_regclass('public.household_archives') is null and to_regclass('public.household_cleaning_marks') is null
    and to_regprocedure('public.account_chargeable(uuid)') is null and to_regprocedure('public.household_billing_user(uuid)') is null,
    'a partial earlier attempt: stop and compare with fingerprint.sql'),
  ('24', 'every household has exactly one owner account, each account owns at most one',
    not exists (select 1 from public.club_households group by owner_user_id having count(*) > 1)
    and not exists (select 1 from public.club_households where owner_user_id is null),
    'household_adults.user_id is unique: a second household for one account would stop the backfill'),
  ('24', 'the two profile saves still carry the per-account lock 24 rewrites',
    position($m$hashtextextended('club-household:' || auth.uid()::text, 0)$m$ in pg_get_functiondef('public.club_activities_save(jsonb)'::regprocedure)) > 0
    and position($m$hashtextextended('club-household:' || auth.uid()::text, 0)$m$ in pg_get_functiondef('public.club_responsibilities_save(text,jsonb)'::regprocedure)) > 0,
    '24 stops itself if this text changed; nothing is half-applied'),
  ('24', 'the four read policies 24 replaces exist under their names',
    (select count(*) from pg_policies where schemaname = 'public' and policyname in
      ('Members read their household', 'Members read their family', 'Members read their activities', 'Members read their responsibilities')) = 4,
    '24 drops them by name'),
  ('24', 'pgcrypto is in the extensions schema (invitation codes)',
    to_regprocedure('extensions.digest(text,text)') is not null and to_regprocedure('extensions.gen_random_bytes(integer)') is not null,
    'enable pgcrypto in schema extensions'),
  ('26', 'no household holds more than 20 family members',
    not exists (select 1 from public.club_family_members group by household_id having count(*) > 20),
    'the saved colors list holds 20'),
  ('27', 'club_responsibilities has none of the agreement columns yet',
    not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'club_responsibilities'
                 and column_name in ('agreed_text', 'revision', 'deleted_at', 'updated_by')),
    'a column 27 adds already exists'),
  ('28', 'the functions 28 patches still declare uid := auth.uid()',
    (select bool_and(position('uid uuid := auth.uid();' in pg_get_functiondef(f::regprocedure)) > 0)
       from unnest(array['public.club_resource_get(text)', 'public.club_resource_save(text,jsonb,integer)', 'public.club_document_get(text)',
                         'public.club_document_save(text,text,jsonb,text,integer,integer,integer)', 'public.club_me()']) f),
    '28 stops itself if this text changed'),
  ('29', 'account_delete still has the membership check 29 extends',
    position('if public.club_has_paid_access(uid) then raise exception ''active_membership''; end if;' in pg_get_functiondef('public.account_delete()'::regprocedure)) > 0,
    '29 stops itself if this text changed'),
  ('29', 'no subscription that can still be charged is without an owner',
    not exists (select 1 from public.club_subscriptions where user_id is null and status in ('trialing', 'active', 'past_due', 'unpaid', 'incomplete', 'paused')),
    'cancel these in Stripe first: after 29 nobody could be asked to')
)
select step, check_name, ok, case when ok then '' else detail end as detail from checks
union all
select 'info', 'households / family members / accounts that 29 will refuse to delete until cancelled', true,
       (select count(*) from public.club_households) || ' / ' || (select count(*) from public.club_family_members) || ' / '
       || (select count(distinct user_id) from public.club_subscriptions where user_id is not null and status in ('trialing', 'active', 'past_due', 'unpaid', 'incomplete', 'paused'))
order by 1, 2;
