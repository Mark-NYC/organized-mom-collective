-- Welcome email delivery: fail-closed worker, shared send ledger, cron dispatch.
-- NEVER enable production sending via this migration.
begin;
create table if not exists public.marketing_delivery_settings (
 id integer primary key default 1 check (id = 1),
 enabled boolean not null default false,
 postal_address_verified boolean not null default false,
 broadcasts_coordinated boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.marketing_delivery_settings enable row level security;
revoke all on public.marketing_delivery_settings from public, anon, authenticated;
insert into public.marketing_delivery_settings(id,enabled,postal_address_verified,broadcasts_coordinated)
values(1,false,false,false) on conflict(id) do nothing;

create table if not exists public.marketing_send_ledger(
 email text not null,
 local_day date not null,
 step smallint not null check(step in(2,6)),
 status text not null check(status in('claimed','sent','uncertain','blocked')),
 claimed_at timestamptz not null default now(),
 confirmed_at timestamptz,
 provider_message_id text,
 primary key(email,local_day)
);
alter table public.marketing_send_ledger enable row level security;
revoke all on public.marketing_send_ledger from public,anon,authenticated;

alter table public.marketing_welcome_queue
 add column if not exists dispatch_token text,
 add column if not exists dispatch_attempts integer not null default 0,
 add column if not exists last_dispatched_at timestamptz,
 add column if not exists error_code text;
create unique index if not exists marketing_welcome_dispatch_token_unique
on public.marketing_welcome_queue(dispatch_token) where dispatch_token is not null;
create index if not exists marketing_welcome_dispatch_due
on public.marketing_welcome_queue(status,due_at,last_dispatched_at);

create or replace function marketing_private.dispatch_welcome_jobs()
returns integer language plpgsql security invoker set search_path = '' as $$
declare r record; n integer := 0; v_token text;
begin
 if not exists(select 1 from public.marketing_delivery_settings
   where id=1 and enabled and postal_address_verified and broadcasts_coordinated)
 then return 0; end if;
 for r in
   select email,step,dispatch_token from public.marketing_welcome_queue
   where status='ready' and due_at<=now() and dispatch_attempts < 5
    and (last_dispatched_at is null or last_dispatched_at <= now()-interval '10 minutes')
   order by due_at limit 25 for update skip locked
 loop
   v_token := coalesce(r.dispatch_token,
     replace(pg_catalog.gen_random_uuid()::text,'-','') ||
     replace(pg_catalog.gen_random_uuid()::text,'-',''));
   update public.marketing_welcome_queue
   set dispatch_token=v_token,dispatch_attempts=dispatch_attempts+1,
       last_dispatched_at=now(),updated_at=now()
   where email=r.email and step=r.step;
   perform net.http_post(
    url:='https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/resend-welcome-delivery',
    body:=pg_catalog.jsonb_build_object('token',v_token),
    headers:='{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds:=5000
   );
   n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function marketing_private.dispatch_welcome_jobs() from public,anon,authenticated;

-- Only the service role is allowed to claim a queued send. This transaction
-- serializes all sends to an email and reserves the recipient's local day.
create or replace function marketing_private.claim_welcome(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_day date := (now() at time zone 'America/New_York')::date;
        v_ledger integer; v_prior text;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
   return pg_catalog.jsonb_build_object('status','invalid');
 end if;
 if not exists(select 1 from public.marketing_delivery_settings where id=1
      and enabled and postal_address_verified and broadcasts_coordinated) then
   return pg_catalog.jsonb_build_object('status','disabled');
 end if;
 select email,step,due_at,status into r
 from public.marketing_welcome_queue where dispatch_token=p_token
 for update;
 if not found then return pg_catalog.jsonb_build_object('status','not_found'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('welcome:'||r.email,0));
 if r.status <> 'ready' or r.due_at > now() then
   return pg_catalog.jsonb_build_object('status','not_ready');
 end if;
 if not exists(select 1 from public.tool_email_contacts
   where email=r.email and marketing_opt_in=true)
   or exists(select 1 from public.marketing_suppressions where email=r.email) then
   update public.marketing_welcome_queue set status='cancelled',updated_at=now()
     where email=r.email and step=r.step;
   return pg_catalog.jsonb_build_object('status','blocked');
 end if;
 if r.step=6 then
   select status into v_prior from public.marketing_welcome_queue
     where email=r.email and step=2;
   if v_prior is distinct from 'sent' then
     return pg_catalog.jsonb_build_object('status','waiting_for_day2');
   end if;
 end if;
 insert into public.marketing_send_ledger(email,local_day,step,status)
 values(r.email,v_day,r.step,'claimed')
 on conflict(email,local_day) do nothing;
 get diagnostics v_ledger = row_count;
 if v_ledger <> 1 then return pg_catalog.jsonb_build_object('status','daily_limit'); end if;
 update public.marketing_welcome_queue set status='sending',updated_at=now()
  where email=r.email and step=r.step;
 return pg_catalog.jsonb_build_object('status','claimed','email',r.email,'step',r.step);
end $$;
revoke all on function marketing_private.claim_welcome(text) from public,anon,authenticated;
grant usage on schema marketing_private to service_role;
grant execute on function marketing_private.claim_welcome(text) to service_role;

create or replace function marketing_private.finish_welcome(
 p_token text,p_status text,p_message_id text default null,p_error text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare r record;
begin
 if p_status not in ('sent','blocked','uncertain') then return false; end if;
 select email,step into r from public.marketing_welcome_queue
 where dispatch_token=p_token and status='sending' for update;
 if not found then return false; end if;
 update public.marketing_welcome_queue
 set status=case when p_status='sent' then 'sent'
                 when p_status='blocked' then 'cancelled' else 'failed' end,
     sent_at=case when p_status='sent' then now() else sent_at end,
     provider_message_id=case when p_status='sent' then p_message_id else provider_message_id end,
     error_code=left(p_error,120),updated_at=now()
 where email=r.email and step=r.step;
 update public.marketing_send_ledger
  set status=p_status,confirmed_at=now(),
  provider_message_id=case when p_status='sent' then p_message_id else provider_message_id end
 where email=r.email and step=r.step and status='claimed';
 return true;
end $$;
revoke all on function marketing_private.finish_welcome(text,text,text,text) from public,anon,authenticated;
grant execute on function marketing_private.finish_welcome(text,text,text,text) to service_role;

select cron.schedule('omc-welcome-delivery-dispatch','*/5 * * * *',
 'select marketing_private.dispatch_welcome_jobs()');
commit;