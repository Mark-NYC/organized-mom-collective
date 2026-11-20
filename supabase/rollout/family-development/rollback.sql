-- Rollback for 20261207_family_development_records ONLY. Removes every family development record and its history
-- (the families' MAWL decisions since applying). Agreements made through it stay: they are ordinary club_responsibilities
-- agreements (source 'skill:<id>'), still on every list and editable in Who does what. The family profile and
-- everything else stay exactly as they are. If families have started using it, prefer fixing forward.
-- NEVER run without the owner's go.
begin;
drop function if exists public.household_development_decide(jsonb, int);
drop function if exists public.household_development();
drop function if exists public.household_development_json(public.household_development);
drop function if exists public.household_development_ensure_agreement(public.household_development, uuid, uuid);
drop table if exists public.household_development_events;
drop table if exists public.household_development;
commit;
