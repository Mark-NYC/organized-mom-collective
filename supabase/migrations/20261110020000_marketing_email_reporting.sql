-- Email marketing reporting. Never store raw click URLs or subscriber emails in event rows.
begin;
create table if not exists public.marketing_email_events (
 event_id text primary key,
 event_type text not null check (event_type in ('email.sent','email.delivered','email.delivery_delayed','email.failed','email.bounced','email.complained','email.clicked')),
 provider_email_id text,
 broadcast_id text,
 event_at timestamptz not null,
 link_section text check (link_section in ('guides','generators','club','calendar','shop','other') or link_section is null),
 received_at timestamptz not null default now()
);
alter table public.marketing_email_events enable row level security;
revoke all on public.marketing_email_events from public,anon,authenticated;
create index if not exists marketing_email_events_broadcast_idx
 on public.marketing_email_events(broadcast_id,event_at);
create index if not exists marketing_email_events_message_idx
 on public.marketing_email_events(provider_email_id,event_type);

create or replace function public.marketing_record_email_event(
 p_event_id text,p_type text,p_email_id text,p_broadcast_id text,p_event_at timestamptz,p_section text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_event_id is null or length(p_event_id)>150 or length(p_event_id)<3
    or p_type not in ('email.sent','email.delivered','email.delivery_delayed','email.failed','email.bounced','email.complained','email.clicked')
    or p_event_at is null or p_event_at>now()+interval '1 hour'
    or p_event_at<now()-interval '1 year'
 then return false;end if;
 -- No customer addresses, full URLs or link tokens are written to this table.
 insert into public.marketing_email_events(event_id,event_type,provider_email_id,broadcast_id,event_at,link_section)
 values(p_event_id,p_type,left(p_email_id,120),left(p_broadcast_id,80),p_event_at,
 case when p_type='email.clicked' and p_section in ('guides','generators','club','calendar','shop','other') then p_section else null end)
 on conflict(event_id) do nothing;
 return true;
end $$;
revoke all on function public.marketing_record_email_event(text,text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.marketing_record_email_event(text,text,text,text,timestamptz,text) to service_role;

create or replace function public.admin_email_reporting()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 if not public.is_admin('owner') then raise exception 'forbidden' using errcode='42501';end if;
 select jsonb_build_object(
  'generated_at',now(),
  'signups',(
   select jsonb_build_object(
    'total',count(*),
    'last_7d',count(*) filter(where created_at>=now()-interval '7 days'),
    'last_30d',count(*) filter(where created_at>=now()-interval '30 days'),
    'opted_in',count(*) filter(where marketing_opt_in=true),
    'opted_in_30d',count(*) filter(where marketing_opt_in=true and marketing_opt_in_at>=now()-interval '30 days')
   ) from public.tool_email_contacts
  ),
  'audience',(
   select jsonb_build_object(
    'ready',count(*) filter(where desired and in_segment and status='synced'),
    'sync_errors',count(*) filter(where status='failed'),
    'pending',count(*) filter(where status in ('pending','processing'))
   ) from public.marketing_newsletter_membership
  ),
  'welcome',(
   select jsonb_build_object(
    'sent_30d',count(*) filter(where status='sent' and sent_at>=now()-interval '30 days'),
    'held',count(*) filter(where status='held'),
    'failed',count(*) filter(where status='failed'),
    'due',count(*) filter(where due_at<=now() and status in ('held','ready','sending'))
   ) from public.marketing_welcome_queue
  ),
  'suppression',(
   select jsonb_build_object(
    'all_time',count(*),
    'last_30d',count(*) filter(where created_at>=now()-interval '30 days')
   ) from public.marketing_suppressions
  ),
  'broadcast',(
   select jsonb_build_object(
    'scheduled',count(*) filter(where status='scheduled' and scheduled_at>now()),
    'sent_30d',count(*) filter(where status='sent' and scheduled_at>=now()-interval '30 days'),
    'reserved',count(*) filter(where status='reserved')
   ) from public.marketing_broadcast_calendar
  ),
  'delivery',(
   select jsonb_build_object(
    'delivered_30d',count(distinct e.provider_email_id) filter(where e.event_type='email.delivered' and e.event_at>=now()-interval '30 days'),
    'failed_30d',count(distinct e.provider_email_id) filter(where e.event_type in ('email.failed','email.bounced') and e.event_at>=now()-interval '30 days'),
    'clicked_30d',count(distinct e.provider_email_id) filter(where e.event_type='email.clicked' and e.event_at>=now()-interval '30 days'),
    'click_events_30d',count(*) filter(where e.event_type='email.clicked' and e.event_at>=now()-interval '30 days')
   ) from public.marketing_email_events e
   where (e.broadcast_id is not null and exists
    (select 1 from public.marketing_broadcast_calendar b where b.broadcast_id=e.broadcast_id))
    or (e.provider_email_id is not null and exists
    (select 1 from public.marketing_welcome_queue w where w.provider_message_id=e.provider_email_id))
  ),
  'click_sections',(
   select coalesce(jsonb_agg(jsonb_build_object('section',x.link_section,'clicks',x.clicks)
    order by x.clicks desc),'[]'::jsonb)
   from (select e.link_section,count(*) as clicks from public.marketing_email_events e
     where e.event_type='email.clicked' and e.link_section is not null and e.event_at>=now()-interval '30 days'
       and exists(select 1 from public.marketing_broadcast_calendar b where b.broadcast_id=e.broadcast_id)
     group by e.link_section) x
  ),
  'trends',(
    select coalesce(jsonb_agg(jsonb_build_object('day',x.day,'signups',x.signups,'opt_ins',x.opt_ins) order by x.day),'[]'::jsonb)
    from (select created_at::date day,count(*) signups,
      count(*) filter(where marketing_opt_in=true) opt_ins
     from public.tool_email_contacts where created_at>=current_date-29
     group by created_at::date) x
  ),
  'upcoming',(
   select coalesce(jsonb_agg(jsonb_build_object('date',local_day,'title',title,'status',status,'scheduled_at',scheduled_at) order by local_day),'[]'::jsonb)
   from public.marketing_broadcast_calendar where status in ('scheduled','reserved') and scheduled_at>=now()
  ),
  'business',(
   select jsonb_build_object('club_active',coalesce((select count(*) from public.club_subscriptions
      where livemode=true and status in ('active','trialing')),0),
     'club_started_30d',coalesce((select count(*) from public.club_subscriptions
      where livemode=true and started_at>=now()-interval '30 days'),0),
     'paid_site_orders_30d',coalesce((select count(*) from public.shop_orders
      where livemode=true and payment_status in ('paid','partially_refunded','refunded')
        and paid_at>=now()-interval '30 days'),0))
  )
 ) into v;
 return v;
end $$;
revoke all on function public.admin_email_reporting() from public,anon,authenticated;
grant execute on function public.admin_email_reporting() to authenticated;
commit;