-- Rollback for 20261211_calendar_event_tasks ONLY. NEVER run without the owner's go. It REMOVES every responsibility
-- families added to imported events. Imported events, subscriptions and the family's own calendar are untouched.
begin;
drop function if exists public.calendar_event_task_delete(uuid);
drop function if exists public.calendar_event_task_done(uuid, boolean);
drop function if exists public.calendar_event_task_save(jsonb);
drop function if exists public.calendar_event_tasks(date, date);
drop function if exists public.calendar_event_tasks_guard(uuid);
drop function if exists public.calendar_event_task_for(uuid, uuid);
drop function if exists public.calendar_event_task_json(public.calendar_event_tasks);
drop function if exists public.calendar_event_tasks_events(uuid);
drop table if exists public.calendar_event_tasks;
drop function if exists public.calendar_event_tasks_enabled(uuid);
alter table public.calendar_feed_rollout drop column if exists event_tasks_everyone;
alter table public.calendar_feed_testers drop column if exists event_tasks;
do $$ begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261211000000';
  end if;
end $$;
commit;
