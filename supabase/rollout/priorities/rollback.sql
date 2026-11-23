-- Rollback for 20261212_household_priorities ONLY. NEVER run without the owner's go. It REMOVES the priorities families
-- chose. Calendars, agreements and responsibilities are untouched.
begin;
drop function if exists public.household_priority_remove(uuid);
drop function if exists public.household_priority_save(jsonb);
drop function if exists public.household_priorities(date, date);
drop function if exists public.household_priorities_guard(uuid);
drop function if exists public.household_shared_occurrence(uuid, text, text);
drop function if exists public.household_priority_json(public.household_priorities, uuid);
drop table if exists public.household_priorities;
do $$ begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261212000000';
  end if;
end $$;
commit;
