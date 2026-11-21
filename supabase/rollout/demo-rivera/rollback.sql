-- Rollback for 20261209_demo_rivera ONLY. NEVER run without the owner's go.
-- 1. Optional, first: remove the demo family itself (only the household registered in demo_households, and the
--    complimentary grant on its owner). The two demo accounts stay in Supabase Auth; delete them there if wanted.
-- 2. Then drop the demo functions and the registry. Nothing else in the database uses them.
begin;

-- 1. The demo family (uncomment to remove it too).
-- delete from public.household_invites where household_id = (select household_id from public.demo_households where key = 'rivera');
-- delete from public.household_adults where household_id = (select household_id from public.demo_households where key = 'rivera');
-- delete from public.club_households where id = (select household_id from public.demo_households where key = 'rivera');
-- update public.club_access_grants set revoked_at = now(), updated_at = now()
--  where user_id = (select owner_user_id from public.demo_households where key = 'rivera') and revoked_at is null;

-- 2. The demo objects.
drop function if exists public.demo_rivera_reset(text, text);
drop function if exists public.demo_rivera_status();
drop function if exists public.demo_rivera_seed(uuid, uuid);
drop function if exists public.demo_decide(uuid, jsonb, numeric);
drop function if exists public.demo_age_decision(uuid, numeric);
drop function if exists public.demo_account_ok(uuid, uuid);
drop function if exists public.demo_act_as(uuid);
drop function if exists public.demo_id(text);
drop table if exists public.demo_households;
do $$ begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261209000000';
  end if;
end $$;

commit;
