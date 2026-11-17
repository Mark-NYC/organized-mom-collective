-- Read-only. Structure counts compared between the source and the restored copy (no customer data).
select 'public functions', count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
union all select 'public tables', count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')
union all select 'public views', count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v'
union all select 'public policies', count(*)::text from pg_policies where schemaname = 'public'
union all select 'public triggers', count(*)::text from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal
union all select 'our triggers on auth/storage', count(*)::text from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
   join pg_proc p on p.oid = t.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
 where not t.tgisinternal and n.nspname in ('auth', 'storage') and pn.nspname not in ('auth', 'storage', 'extensions', 'pg_catalog')
union all select 'storage policies', count(*)::text from pg_policies where schemaname = 'storage'
union all select 'sign-ins (auth.users)', count(*)::text from auth.users
union all select 'migration history rows', coalesce((select count(*)::text from supabase_migrations.schema_migrations), 'none')
union all select 'latest migration', coalesce((select max(version) from supabase_migrations.schema_migrations), 'none')
order by 1;
