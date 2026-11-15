-- Last step of a full rollback: AFTER rollback.sql and restore-functions.sql. Removes the two helpers the restored
-- definitions no longer use.
begin;
drop function if exists public.household_save_core(int, text, jsonb, jsonb);
drop function if exists public.household_id_for(uuid);
commit;
