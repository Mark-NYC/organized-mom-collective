begin;
-- Wednesday is reserved for One Small Win by default. All dates use America/New_York.
-- Non-Wednesday sends MUST be registered in marketing_broadcast_calendar first.
create table if not exists public.marketing_broadcast_calendar (
 local_day date primary key,
 broadcast_id text,
 title text not null,
 status text not null default 'reserved'
   check (status in ('reserved','scheduled','sent','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.marketing_broadcast_calendar enable row level security;
revoke all on public.marketing_broadcast_calendar from public, anon, authenticated;
create or replace function marketing_private.is_broadcast_day(p_local_day date)
returns boolean language sql stable security invoker set search_path = '' as $$
 select extract(isodow from p_local_day) = 3
 or exists (select 1 from public.marketing_broadcast_calendar c
   where c.local_day=p_local_day and c.status in ('reserved','scheduled','sent'));
$$;
revoke all on function marketing_private.is_broadcast_day(date) from public,anon,authenticated;

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
 if marketing_private.is_broadcast_day(v_day) then
   return pg_catalog.jsonb_build_object('status','broadcast_day');
 end if;
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
create or replace function marketing_private.dispatch_welcome_jobs()
returns integer language plpgsql security invoker set search_path = '' as $$
declare r record; n integer := 0; v_token text;
begin
 if not exists (select 1 from public.marketing_delivery_settings
    where id=1 and enabled and postal_address_verified and broadcasts_coordinated)
 then return 0; end if;
 -- Weekly newsletter reservation plus explicit broadcast dates: fail closed.
 if marketing_private.is_broadcast_day((now() at time zone 'America/New_York')::date) then return 0; end if;

 update public.marketing_welcome_queue
    set status='cancelled',error_code='stale_welcome',updated_at=now()
  where status='held' and due_at < now()-interval '14 days';

 update public.marketing_welcome_queue q
    set status='cancelled',error_code='opted_out',updated_at=now()
  where q.status in ('held','ready')
    and (exists(select 1 from public.marketing_suppressions s where s.email=q.email)
      or not exists(select 1 from public.tool_email_contacts c
                    where c.email=q.email and c.marketing_opt_in=true));

 update public.marketing_welcome_queue q
    set status='ready',updated_at=now()
  where q.status='held' and q.due_at <= now()
    and (q.step=2 or exists(
       select 1 from public.marketing_welcome_queue previous
       where previous.email=q.email and previous.step=2 and previous.status='sent'));

 for r in
   select email,step,dispatch_token from public.marketing_welcome_queue
    where status='ready' and due_at<=now() and dispatch_attempts<5
      and (last_dispatched_at is null or last_dispatched_at<=now()-interval '10 minutes')
    order by due_at limit 25 for update skip locked
 loop
   v_token:=coalesce(r.dispatch_token,
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
commit;
