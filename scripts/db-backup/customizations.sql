-- Read-only. Our own triggers and policies on Supabase's auth and storage schemas: `supabase db dump` leaves those
-- schemas out (Supabase manages them), so they're captured here and restored after schema.sql. Definitions only.
select 'drop trigger if exists ' || quote_ident(t.tgname) || ' on ' || quote_ident(n.nspname) || '.' || quote_ident(c.relname)
       || '; ' || pg_get_triggerdef(t.oid) || ';'
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
 where not t.tgisinternal and n.nspname in ('auth', 'storage') and pn.nspname not in ('auth', 'storage', 'extensions', 'pg_catalog')
union all
select format('drop policy if exists %I on %I.%I; create policy %I on %I.%I as %s for %s to %s%s%s;',
              policyname, schemaname, tablename, policyname, schemaname, tablename, permissive, cmd,
              (select string_agg(quote_ident(r), ', ') from unnest(roles) r),
              coalesce(' using (' || qual || ')', ''), coalesce(' with check (' || with_check || ')', ''))
  from pg_policies where schemaname in ('auth', 'storage');
