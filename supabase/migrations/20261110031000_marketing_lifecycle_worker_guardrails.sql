-- Lifecycle email delivery infrastructure. Intentionally disabled and no cron.
begin;
create table if not exists public.marketing_lifecycle_settings(
 id integer primary key default 1 check(id=1),
 enabled boolean not null default false,
 approved_templates boolean not null default false,
 deliverability_verified boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.marketing_lifecycle_settings enable row level security;
revoke all on public.marketing_lifecycle_settings from public,anon,authenticated;
insert into public.marketing_lifecycle_settings(id) values(1) on conflict do nothing;

alter table public.marketing_lifecycle_queue
 add column if not exists dispatch_token text,
 add column if not exists dispatch_attempts integer not null default 0,
 add column if not exists last_dispatched_at timestamptz;
create unique index if not exists marketing_lifecycle_token_uniq
 on public.marketing_lifecycle_queue(dispatch_token) where dispatch_token is not null;

create or replace function public.marketing_claim_lifecycle(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare j record; v_day date := (now() at time zone 'America/New_York')::date;
        n integer; v_ready boolean := false; v_first record;
begin
 if auth.role() is distinct from 'service_role' then return jsonb_build_object('status','forbidden'); end if;
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status','invalid'); end if;
 if not exists(select 1 from public.marketing_lifecycle_settings
   where id=1 and enabled and approved_templates and deliverability_verified) then
    return jsonb_build_object('status','disabled'); end if;
 select * into j from public.marketing_lifecycle_queue where dispatch_token=p_token for update;
 if not found then return jsonb_build_object('status','not_found'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('welcome:'||j.email,0));
 if j.status <> 'ready' or j.due_at > now() or j.due_at < now()-interval '30 days' then
   return jsonb_build_object('status','not_ready'); end if;
 if extract(isodow from v_day)=3 or exists(select 1 from public.marketing_broadcast_calendar b
    where b.local_day=v_day and b.status in('reserved','scheduled','sent')) then
    return jsonb_build_object('status','broadcast_day'); end if;
 if not exists(select 1 from public.tool_email_contacts c
    where lower(c.email)=j.email and c.marketing_opt_in=true)
   or exists(select 1 from public.marketing_suppressions s where lower(s.email)=j.email) then
    update public.marketing_lifecycle_queue set status='cancelled',error_code='opted_out',updated_at=now() where id=j.id;
    return jsonb_build_object('status','blocked'); end if;
 if j.journey='calendar' then
   select exists(select 1 from public.shop_orders o
      where o.id=j.source_id and lower(o.email)=j.email
       and o.livemode=true and o.digital=false and o.payment_status='paid'
       and o.delivered_at is not null and o.delivered_at<=now()
       and o.canceled_at is null and coalesce(o.refunded_cents,0)=0
       and exists(select 1 from public.shop_order_items i where i.order_id=o.id
          and (i.product_slug ilike '%calendar%' or i.product_name ilike '%calendar%'))) into v_ready;
   if j.step='week_two' then
     select status,sent_at into v_first from public.marketing_lifecycle_queue
      where journey='calendar' and source_id=j.source_id and step='first_week';
     v_ready:=v_ready and v_first.status='sent' and v_first.sent_at <= now()-interval '7 days';
   end if;
 elsif j.journey='club' then
   select exists(select 1 from public.club_subscriptions s join public.club_customers c
     on c.stripe_customer_id=s.stripe_customer_id and c.user_id=s.user_id and c.livemode=true
     where s.id=j.source_id and lower(c.email)=j.email and s.livemode=true
       and s.status in ('active','trialing') and s.started_at is not null and s.started_at<=now()
       and s.access_revoked_at is null and s.ended_at is null
       and exists(select 1 from public.club_entitlements e
         where e.user_id=s.user_id and e.revoked_at is null)) into v_ready;
 end if;
 if not v_ready then return jsonb_build_object('status','not_eligible'); end if;
 insert into public.marketing_send_ledger(email,local_day,step,status)
 values(j.email,v_day,0,'claimed') on conflict(email,local_day) do nothing;
 get diagnostics n = row_count;
 if n<>1 then return jsonb_build_object('status','daily_limit'); end if;
 update public.marketing_lifecycle_queue set status='sending',updated_at=now() where id=j.id;
 return jsonb_build_object('status','claimed','email',j.email,'journey',j.journey,'step',j.step);
end $$;
revoke all on function public.marketing_claim_lifecycle(text) from public,anon,authenticated;
grant execute on function public.marketing_claim_lifecycle(text) to service_role;

-- The shared ledger previously restricted steps to Day 2/6. Reserve step 0 for lifecycle follow-ups.
alter table public.marketing_send_ledger drop constraint if exists marketing_send_ledger_step_check;
alter table public.marketing_send_ledger add constraint marketing_send_ledger_step_check check(step in(0,2,6));

create or replace function public.marketing_finish_lifecycle(
 p_token text,p_status text,p_message_id text default null,p_error text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare j record;
begin
 if auth.role() is distinct from 'service_role' then return false; end if;
 if p_status not in ('sent','blocked','uncertain') then return false; end if;
 select id,email into j from public.marketing_lifecycle_queue
  where dispatch_token=p_token and status='sending' for update;
 if not found then return false; end if;
 update public.marketing_lifecycle_queue set
    status=case when p_status='sent' then 'sent' when p_status='blocked' then 'cancelled' else 'uncertain' end,
    sent_at=case when p_status='sent' then now() else sent_at end,
    provider_message_id=case when p_status='sent' then p_message_id else provider_message_id end,
    error_code=left(p_error,120),updated_at=now()
 where id=j.id;
 update public.marketing_send_ledger set
    status=p_status,confirmed_at=now(),
    provider_message_id=case when p_status='sent' then p_message_id else provider_message_id end
 where email=j.email and step=0 and status='claimed'
   and local_day=(now() at time zone 'America/New_York')::date;
 return true;
end $$;
revoke all on function public.marketing_finish_lifecycle(text,text,text,text) from public,anon,authenticated;
grant execute on function public.marketing_finish_lifecycle(text,text,text,text) to service_role;

create or replace function marketing_private.prepare_lifecycle_dispatch()
returns integer language plpgsql security definer set search_path = '' as $$
declare j record; v_token text; n integer:=0;
begin
 if not exists(select 1 from public.marketing_lifecycle_settings
     where id=1 and enabled and approved_templates and deliverability_verified) then return 0; end if;
 if extract(isodow from (now() at time zone 'America/New_York')::date)=3
  or exists(select 1 from public.marketing_broadcast_calendar b
   where b.local_day=(now() at time zone 'America/New_York')::date
   and b.status in ('reserved','scheduled','sent')) then return 0; end if;
 -- Does NOT auto-enable jobs in held state. A separate reviewed approval is required.
 for j in select id,dispatch_token from public.marketing_lifecycle_queue
   where status='ready' and due_at<=now() and due_at>=now()-interval '30 days'
    and dispatch_attempts<3 and (last_dispatched_at is null or last_dispatched_at<now()-interval '15 minutes')
   order by due_at limit 15 for update skip locked loop
   v_token:=coalesce(j.dispatch_token,
     replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
   update public.marketing_lifecycle_queue set dispatch_token=v_token,
    dispatch_attempts=dispatch_attempts+1,last_dispatched_at=now(),updated_at=now()
    where id=j.id;
   perform net.http_post(
    url:='https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/resend-lifecycle-delivery',
    body:=jsonb_build_object('token',v_token),
    headers:='{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds:=5000);
   n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function marketing_private.prepare_lifecycle_dispatch() from public,anon,authenticated;
-- No cron scheduled and launch gate remains false.
commit;