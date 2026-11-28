-- Rollback for 20261210_app_feedback ONLY (roll back 20261216 first: its pilot funnel uses the cohort). NEVER run
-- without the owner's go. Feedback already sent stays in support_requests (ordinary support requests).
begin;
drop function if exists public.pilot_feedback(date);
drop function if exists public.app_feedback(text, text, text, text, int);
drop function if exists public.pilot_cohort(date);
do $$ begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261210000000';
  end if;
end $$;
commit;
