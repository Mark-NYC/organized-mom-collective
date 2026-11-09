-- Database source mirror for subscriber access (already applied in production).
-- This feature gates only the free-download modal. Static files remain public.
begin;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.subscriber_resource_passes(
 email text primary key references public.tool_email_contacts(email) on delete cascade,
 token text not null unique check(token ~ '^[0-9a-f]{64}$'),
 token_hash text not null unique,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 synced_at timestamptz,
 sync_attempts integer not null default 0,
 sync_error text
);
alter table public.subscriber_resource_passes enable row level security;
revoke all on public.subscriber_resource_passes from public,anon,authenticated;
create table if not exists public.subscriber_resource_pass_sync_jobs(
 email text primary key references public.subscriber_resource_passes(email) on delete cascade,
 dispatch_token text not null unique check(dispatch_token ~ '^[0-9a-f]{64}$'),
 status text not null default 'pending' check(status in ('pending','processing','synced','failed','blocked')),
 attempts integer not null default 0,
 last_attempt_at timestamptz,
 error_code text,
 updated_at timestamptz not null default now()
);
alter table public.subscriber_resource_pass_sync_jobs enable row level security;
revoke all on public.subscriber_resource_pass_sync_jobs from public,anon,authenticated;
CREATE OR REPLACE FUNCTION marketing_private.issue_resource_pass(p_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_token text;
begin
 if not exists(select 1 from public.tool_email_contacts c
    where c.email=p_email and c.marketing_opt_in=true)
 or exists(select 1 from public.marketing_suppressions s where s.email=p_email)
 then return false; end if;

 if exists(select 1 from public.subscriber_resource_passes p
    where p.email=p_email and p.expires_at > now() + interval '21 days')
 then return false; end if;

 v_token := replace(pg_catalog.gen_random_uuid()::text,'-','') ||
            replace(pg_catalog.gen_random_uuid()::text,'-','');
 insert into public.subscriber_resource_passes(email,token,token_hash,expires_at,synced_at,sync_attempts,sync_error)
 values(p_email,v_token,encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '90 days',null,0,null)
 on conflict(email) do update set
   token=excluded.token,token_hash=excluded.token_hash,
   expires_at=excluded.expires_at,updated_at=now(),synced_at=null,
   sync_attempts=0,sync_error=null;

 insert into public.subscriber_resource_pass_sync_jobs(email,dispatch_token,status,attempts,last_attempt_at,error_code,updated_at)
 values(p_email,
 replace(pg_catalog.gen_random_uuid()::text,'-','') || replace(pg_catalog.gen_random_uuid()::text,'-',''),
 'pending',0,null,null,now())
 on conflict(email) do update set dispatch_token=excluded.dispatch_token,
 status='pending',attempts=0,last_attempt_at=null,error_code=null,updated_at=now();
 return true;
end $function$

CREATE OR REPLACE FUNCTION marketing_private.resource_pass_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.marketing_opt_in = true and
    (tg_op='INSERT' or old.marketing_opt_in is distinct from true) then
   perform marketing_private.issue_resource_pass(new.email);
 end if;
 return new;
end $function$

CREATE OR REPLACE FUNCTION marketing_private.dispatch_resource_pass_sync()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j record; c int:=0;
begin
 -- Batch new/expiring opt-ins; don't issue tokens for unsubscribed contacts.
 for j in select c.email from public.tool_email_contacts c
  where c.marketing_opt_in=true
    and not exists(select 1 from public.marketing_suppressions s where s.email=c.email)
    and (not exists(select 1 from public.subscriber_resource_passes p where p.email=c.email)
       or exists(select 1 from public.subscriber_resource_passes p
          where p.email=c.email and p.expires_at<now()+interval '21 days'))
  order by c.email limit 50
 loop perform marketing_private.issue_resource_pass(j.email); end loop;

 for j in select email,dispatch_token from public.subscriber_resource_pass_sync_jobs
  where status in ('pending','failed') and attempts<5
    and (last_attempt_at is null or last_attempt_at<now()-interval '30 minutes')
  order by updated_at limit 40 for update skip locked
 loop
   update public.subscriber_resource_pass_sync_jobs
    set attempts=attempts+1,last_attempt_at=now(),status='processing',updated_at=now()
    where email=j.email;
   begin
     perform net.http_post(
      url:='https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/resend-resource-pass-sync',
      body:=pg_catalog.jsonb_build_object('token',j.dispatch_token),
      headers:='{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds:=5000);
     c:=c+1;
   exception when others then
     update public.subscriber_resource_pass_sync_jobs
       set status='failed',error_code='dispatch_failure',updated_at=now() where email=j.email;
   end;
 end loop;
 -- A lost pg_net HTTP response must not leave a job stuck in processing.
 update public.subscriber_resource_pass_sync_jobs
    set status='failed',error_code='retry_after_timeout',updated_at=now()
  where status='processing' and last_attempt_at<now()-interval '30 minutes';
 return c;
end $function$

revoke all on function marketing_private.issue_resource_pass(text) from public,anon,authenticated;
revoke all on function marketing_private.resource_pass_signup() from public,anon,authenticated;
revoke all on function marketing_private.dispatch_resource_pass_sync() from public,anon,authenticated;
drop trigger if exists marketing_resource_pass_signup on public.tool_email_contacts;
create trigger marketing_resource_pass_signup
 after insert or update of marketing_opt_in on public.tool_email_contacts
 for each row execute function marketing_private.resource_pass_signup();
select cron.schedule('omc-resource-pass-sync','*/15 * * * *',
 $$select marketing_private.dispatch_resource_pass_sync()$$)
where not exists(select 1 from cron.job where jobname='omc-resource-pass-sync');
commit;
