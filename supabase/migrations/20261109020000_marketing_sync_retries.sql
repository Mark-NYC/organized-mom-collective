-- Marketing contacts: recover best-effort HTTP dispatch failures automatically.
-- Does not send any marketing emails. Works with private RLS job outbox.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create schema if not exists marketing_private;
revoke all on schema marketing_private from public, anon, authenticated;

alter table public.marketing_sync_jobs
 add column if not exists dispatch_attempts integer not null default 0,
 add column if not exists last_dispatched_at timestamptz;

create or replace function marketing_private.retry_sync_jobs()
returns integer language plpgsql security invoker set search_path = '' as $$
declare r record; n integer := 0;
begin
 for r in
   select email, token
   from public.marketing_sync_jobs
   where status in ('pending', 'failed')
     and attempts < 5
     and dispatch_attempts < 5
     and (last_dispatched_at is null or last_dispatched_at <= now() - interval '5 minutes')
     and (
       (status = 'pending' and queued_at <= now() - interval '3 minutes')
       or (status = 'failed' and updated_at <= now() - interval '5 minutes' * greatest(1, attempts))
     )
   order by queued_at asc
   limit 30 for update skip locked
 loop
   perform net.http_post(
     url := 'https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/resend-marketing-signup',
     body := pg_catalog.jsonb_build_object('token', r.token),
     headers := '{"Content-Type":"application/json"}'::jsonb,
     timeout_milliseconds := 5000
   );
   update public.marketing_sync_jobs
      set dispatch_attempts = dispatch_attempts + 1, last_dispatched_at = now()
    where email = r.email;
   n := n + 1;
 end loop;
 return n;
end $$;
revoke all on function marketing_private.retry_sync_jobs() from public, anon, authenticated;

select cron.schedule(
 'omc-marketing-sync-retry',
 '*/5 * * * *',
 'select marketing_private.retry_sync_jobs()'
);
commit;
