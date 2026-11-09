-- New consented tool signups enqueue an idempotent Resend contact sync.
-- No API secret is sent in database webhook payloads. A 244-bit random
-- one-time token refers to a private, RLS-protected outbox entry.
-- This function creates/updates contacts only; it NEVER sends email.
begin;
create extension if not exists pg_net;

create table if not exists public.marketing_sync_jobs (
  email text primary key,
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'synced', 'blocked', 'failed')),
  attempts integer not null default 0,
  error_code text,
  queued_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.marketing_sync_jobs enable row level security;
revoke all on public.marketing_sync_jobs from public, anon, authenticated;

create or replace function public.marketing_enqueue_signup()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_token text := replace(pg_catalog.gen_random_uuid()::text, '-', '') ||
                         replace(pg_catalog.gen_random_uuid()::text, '-', '');
begin
  if new.marketing_opt_in is distinct from true then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.marketing_opt_in is not distinct from true then
    return new;
  end if;
  if exists (select 1 from public.marketing_suppressions s where s.email = new.email) then
    return new;
  end if;

  insert into public.marketing_sync_jobs (email, token, status, attempts, error_code, queued_at, updated_at)
  values (new.email, v_token, 'pending', 0, null, now(), now())
  on conflict (email) do update
    set token = excluded.token, status = 'pending', attempts = 0,
        error_code = null, queued_at = now(), updated_at = now();

  -- pg_net is asynchronous and begins only after the originating transaction commits.
  -- An external HTTP failure cannot roll back the email signup.
  begin
    perform net.http_post(
      url := 'https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/resend-marketing-signup',
      body := pg_catalog.jsonb_build_object('token', v_token),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  exception when others then
    -- The queued job remains available for retry; do not break the signup.
    raise warning 'marketing signup enqueue HTTP dispatch failed';
  end;
  return new;
end;
$$;

revoke all on function public.marketing_enqueue_signup() from public, anon, authenticated;
drop trigger if exists marketing_auto_sync on public.tool_email_contacts;
create trigger marketing_auto_sync
after insert or update of marketing_opt_in on public.tool_email_contacts
for each row execute function public.marketing_enqueue_signup();

commit;
