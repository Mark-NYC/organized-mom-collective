-- Read-only. Fingerprints of the objects 20261108_club_welcome_kit replaces, plus club_households' columns: run on
-- production and on a local replay (scripts/rehearse-club-rollout.sh) and compare. Same md5 = same definition.
select p.oid::regprocedure::text as obj, md5(pg_get_functiondef(p.oid)) as md5
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('club_admin_set_fulfillment', 'club_admin_fulfillment', 'club_admin_welcome_queue', 'club_resource_save',
                     'club_email_audience', 'club_intro_grant', 'club_invoice_apply')
union all
select 'view club_fulfillment_queue', md5(pg_get_viewdef('public.club_fulfillment_queue'::regclass, true))
union all
select 'table club_households columns', md5(string_agg(column_name || ':' || data_type, ',' order by ordinal_position))
  from information_schema.columns where table_schema = 'public' and table_name = 'club_households'
order by 1;
