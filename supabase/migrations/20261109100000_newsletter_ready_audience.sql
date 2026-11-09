begin;
create table if not exists public.marketing_newsletter_membership (
 email text primary key references public.tool_email_contacts(email) on delete cascade,
 in_segment boolean not null default false,
 desired boolean not null default false,
 dispatch_token text not null unique,
 status text not null default 'pending' check(status in ('pending','processing','synced','failed')),
 attempts integer not null default 0,
 last_attempt_at timestamptz,
 last_error text,
 synced_at timestamptz,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 constraint newsletter_token_check check(dispatch_token ~ '^[a-f0-9]{64}$')
);
alter table public.marketing_newsletter_membership enable row level security;
revoke all on public.marketing_newsletter_membership from public,anon,authenticated;

create or replace function marketing_private.newsletter_eligible(p_email text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
 select 1 from public.tool_email_contacts c
 where c.email=p_email and c.marketing_opt_in=true
 and not exists (select 1 from public.marketing_suppressions s where s.email=c.email)
 and (
   (c.marketing_opt_in_at < '2026-11-09 00:00:00+00'::timestamptz
      and not exists(select 1 from public.marketing_welcome_queue q where q.email=c.email))
   or exists(select 1 from public.marketing_welcome_queue q where q.email=c.email
      and q.step=6 and q.status='sent')
 )
 ) $$;
revoke all on function marketing_private.newsletter_eligible(text) from public,anon,authenticated;

create or replace function public.marketing_newsletter_sync_claim(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j record; v_eligible boolean;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status','invalid');end if;
 select * into j from public.marketing_newsletter_membership
 where dispatch_token=p_token and status in ('pending','processing','failed') for update;
 if not found then return jsonb_build_object('status','not_found'); end if;
 v_eligible:=marketing_private.newsletter_eligible(j.email);
 -- Current actual eligibility always wins, regardless of stale dispatch requests.
 if v_eligible is distinct from j.desired then
  update public.marketing_newsletter_membership set desired=v_eligible,updated_at=now()
    where email=j.email;
 end if;
 return jsonb_build_object('status','ok','email',j.email,'desired',v_eligible,'known_in_segment',j.in_segment);
end $$;
revoke all on function public.marketing_newsletter_sync_claim(text) from public,anon,authenticated;
grant execute on function public.marketing_newsletter_sync_claim(text) to service_role;

create or replace function public.marketing_newsletter_sync_finish(
 p_token text,p_in_segment boolean,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare j record;
begin
 select email,desired into j from public.marketing_newsletter_membership
 where dispatch_token=p_token for update;
 if not found then return false;end if;
 if p_error is null and p_in_segment is distinct from marketing_private.newsletter_eligible(j.email) then
  -- Eligibility changed while provider call was in flight; resync immediately.
  update public.marketing_newsletter_membership
  set in_segment=p_in_segment,desired=marketing_private.newsletter_eligible(j.email),
      status='pending',attempts=0,last_attempt_at=null,dispatch_token=
       replace(pg_catalog.gen_random_uuid()::text,'-','') || replace(pg_catalog.gen_random_uuid()::text,'-',''),
      updated_at=now(),last_error=null
   where email=j.email;
 else
  update public.marketing_newsletter_membership
  set in_segment=case when p_error is null then p_in_segment else in_segment end,
      status=case when p_error is null then 'synced' else 'failed' end,
      last_error=left(p_error,100),synced_at=case when p_error is null then now() else synced_at end,
      updated_at=now()
  where email=j.email;
 end if;
 return true;
end $$;
revoke all on function public.marketing_newsletter_sync_finish(text,boolean,text) from public,anon,authenticated;
grant execute on function public.marketing_newsletter_sync_finish(text,boolean,text) to service_role;

create or replace function marketing_private.dispatch_newsletter_sync()
returns integer language plpgsql set search_path='' as $$
declare j record; n int:=0; v_desired boolean;
begin
 -- Register opt-in contacts and any existing members, re-evaluating eligibility.
 insert into public.marketing_newsletter_membership (email,desired,dispatch_token)
 select c.email,marketing_private.newsletter_eligible(c.email),
  replace(pg_catalog.gen_random_uuid()::text,'-','') || replace(pg_catalog.gen_random_uuid()::text,'-','')
 from public.tool_email_contacts c
 where c.marketing_opt_in=true
 on conflict(email) do nothing;

 for j in select email,desired,in_segment,status from public.marketing_newsletter_membership loop
  v_desired:=marketing_private.newsletter_eligible(j.email);
  if v_desired is distinct from j.desired or
    (j.status='synced' and j.in_segment is distinct from v_desired) then
   update public.marketing_newsletter_membership set
    desired=v_desired,status='pending',attempts=0,last_attempt_at=null,last_error=null,
    dispatch_token=replace(pg_catalog.gen_random_uuid()::text,'-','') ||
                   replace(pg_catalog.gen_random_uuid()::text,'-',''),updated_at=now()
   where email=j.email;
  end if;
 end loop;

 for j in select email,dispatch_token from public.marketing_newsletter_membership
  where status in ('pending','failed') and attempts < 5
    and (last_attempt_at is null or last_attempt_at < now()-interval '10 minutes')
  order by updated_at limit 30 for update skip locked
 loop
  update public.marketing_newsletter_membership
   set status='processing',attempts=attempts+1,last_attempt_at=now(),updated_at=now()
   where email=j.email;
  begin
   perform net.http_post(
    url:='https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/resend-newsletter-audience',
    body:=pg_catalog.jsonb_build_object('token',j.dispatch_token),
    headers:='{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds:=5000);
   n:=n+1;
  exception when others then
   update public.marketing_newsletter_membership set status='failed',last_error='dispatch_error',updated_at=now() where email=j.email;
  end;
 end loop;
 update public.marketing_newsletter_membership set status='failed',last_error='response_timeout',updated_at=now()
 where status='processing' and last_attempt_at < now()-interval '20 minutes';
 return n;
end $$;
revoke all on function marketing_private.dispatch_newsletter_sync() from public,anon,authenticated;
select cron.schedule('omc-newsletter-audience-sync','*/5 * * * *',
 $$select marketing_private.dispatch_newsletter_sync()$$)
where not exists(select 1 from cron.job where jobname='omc-newsletter-audience-sync');
commit;