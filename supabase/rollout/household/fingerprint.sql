-- READ-ONLY. One row per public function, table column, policy and trigger, with a hash of its definition. Run before
-- applying and after a rollback: the two outputs must be identical (scripts/rehearse-household-rollback.sh does this).
select 'function' as kind, p.oid::regprocedure::text as name, md5(pg_get_functiondef(p.oid)) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
union all
select 'column', c.table_name || '.' || c.column_name, md5(c.data_type || coalesce(c.column_default, '') || c.is_nullable)
  from information_schema.columns c where c.table_schema = 'public'
union all
select 'policy', tablename || ': ' || policyname, md5(coalesce(qual, '') || coalesce(with_check, '') || cmd || array_to_string(roles, ',')) from pg_policies where schemaname = 'public'
union all
select 'trigger', c.relname || ': ' || t.tgname, md5(pg_get_triggerdef(t.oid))
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
 where not t.tgisinternal and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
union all
select 'grant', p.oid::regprocedure::text || ' → ' || r.rolname, 'execute'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join pg_roles r
 where n.nspname = 'public' and r.rolname in ('anon', 'authenticated') and has_function_privilege(r.oid, p.oid, 'execute')
order by 1, 2;
