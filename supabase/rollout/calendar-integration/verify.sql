-- READ-ONLY. After applying 20261205000000_calendar_connections.sql. Every row must say ok = true.
with checks(check_name, ok) as (values
  ('RLS on every table', (select bool_and(relrowsecurity) from pg_class where oid in (
     'public.calendar_connections'::regclass, 'public.calendar_connection_secrets'::regclass, 'public.calendar_sources'::regclass,
     'public.calendar_imported_events'::regclass, 'public.calendar_oauth_states'::regclass))),
  ('signed-in users cannot read secrets or OAuth handshakes',
    not has_table_privilege('authenticated', 'public.calendar_connection_secrets', 'select')
    and not has_table_privilege('authenticated', 'public.calendar_oauth_states', 'select')
    and not has_table_privilege('anon', 'public.calendar_connection_secrets', 'select')),
  ('signed-in users cannot write imported events', not has_table_privilege('authenticated', 'public.calendar_imported_events', 'insert,update,delete')),
  ('service functions are service-role only',
    not has_function_privilege('authenticated', 'public.calendar_sync_apply(uuid,timestamptz,timestamptz,jsonb,text,text,interval)', 'execute')
    and not has_function_privilege('authenticated', 'public.calendar_connection_for(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.calendar_secret_get(uuid)', 'execute')),
  ('adult functions are callable', has_function_privilege('authenticated', 'public.calendar_imported_feed(date,date)', 'execute')
    and has_function_privilege('authenticated', 'public.calendar_source_update(uuid,boolean,boolean,jsonb)', 'execute'))
)
select * from checks;
