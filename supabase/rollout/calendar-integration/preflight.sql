-- READ-ONLY. Before applying 20261205000000_calendar_connections.sql. Every row must say ok = true.
with checks(check_name, ok, detail) as (values
  ('the family calendar and shared households are applied',
    to_regclass('public.calendar_events') is not null and to_regprocedure('public.household_id_for(uuid)') is not null,
    'apply 20261124 and 20261125 first (supabase/rollout/household)'),
  ('none of the connected-calendar tables exist yet',
    to_regclass('public.calendar_connections') is null and to_regclass('public.calendar_sources') is null
    and to_regclass('public.calendar_imported_events') is null and to_regclass('public.calendar_connection_secrets') is null,
    'a partial earlier attempt: compare before going on'),
  ('the helpers the migration calls exist',
    to_regprocedure('public.club_uuid_list(jsonb)') is not null and to_regprocedure('public.club_members_belong(uuid,uuid[])') is not null,
    'household migrations missing')
)
select * from checks;
