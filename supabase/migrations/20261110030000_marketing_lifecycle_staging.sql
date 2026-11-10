-- Stage future calendar/Club lifecycle coaching without enabling any sending.
-- No historical backfill. Resend templates remain draft.
begin;
create table if not exists public.marketing_lifecycle_queue (
  id bigint generated always as identity primary key,
  journey text not null check (journey in ('calendar','club')),
  source_id uuid not null,
  step text not null check (step in ('first_week','week_two','day_three','day_ten')),
  email text not null,
  due_at timestamptz not null,
  status text not null default 'held' check (status in ('held','ready','sending','sent','cancelled','failed','uncertain')),
  provider_message_id text,
  sent_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(journey,source_id,step),
  check ((journey='calendar' and step in ('first_week','week_two')) or (journey='club' and step in ('day_three','day_ten')))
);
alter table public.marketing_lifecycle_queue enable row level security;
revoke all on public.marketing_lifecycle_queue from public, anon, authenticated;
create index if not exists marketing_lifecycle_due_idx on public.marketing_lifecycle_queue(status,due_at);

create or replace function marketing_private.stage_calendar_followups()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
 -- Trigger only on the transition to a known physical delivery.
 if new.delivered_at is null or (tg_op = 'UPDATE' and old.delivered_at is not null) then return new; end if;
 if new.livemode is distinct from true or new.digital is true or new.payment_status <> 'paid'
     or new.canceled_at is not null or coalesce(new.refunded_cents,0)>0 then return new; end if;
 if not exists(select 1 from public.shop_order_items i where i.order_id=new.id
    and (i.product_slug ilike '%calendar%' or i.product_name ilike '%calendar%')) then return new; end if;
 v_email:=lower(btrim(new.email));
 if v_email is null or v_email='' then return new; end if;
 -- These are marketing follow-ups: require affirmative opt-in at staging and again before future sending.
 if not exists(select 1 from public.tool_email_contacts c where lower(c.email)=v_email and c.marketing_opt_in=true)
   or exists(select 1 from public.marketing_suppressions s where lower(s.email)=v_email) then return new; end if;
 insert into public.marketing_lifecycle_queue(journey,source_id,step,email,due_at)
 values ('calendar',new.id,'first_week',v_email,greatest(new.delivered_at,now())),
        ('calendar',new.id,'week_two',v_email,greatest(new.delivered_at,now())+interval '7 days')
 on conflict(journey,source_id,step) do nothing;
 return new;
end $$;
revoke all on function marketing_private.stage_calendar_followups() from public,anon,authenticated;
drop trigger if exists omc_calendar_lifecycle_stage on public.shop_orders;
create trigger omc_calendar_lifecycle_stage after insert or update of delivered_at on public.shop_orders
for each row execute function marketing_private.stage_calendar_followups();

create or replace function marketing_private.stage_club_followups()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
 if new.started_at is null or (tg_op='UPDATE' and old.started_at is not null) then return new; end if;
 if new.livemode is distinct from true or new.status not in ('active','trialing')
  or new.access_revoked_at is not null or new.user_id is null then return new; end if;
 select lower(btrim(c.email)) into v_email from public.club_customers c
 where c.stripe_customer_id=new.stripe_customer_id and c.user_id=new.user_id and c.livemode=true limit 1;
 if v_email is null or v_email='' then return new; end if;
 if not exists(select 1 from public.tool_email_contacts c where lower(c.email)=v_email and c.marketing_opt_in=true)
  or exists(select 1 from public.marketing_suppressions s where lower(s.email)=v_email) then return new; end if;
 insert into public.marketing_lifecycle_queue(journey,source_id,step,email,due_at)
 values ('club',new.id,'day_three',v_email,greatest(new.started_at,now())+interval '3 days'),
        ('club',new.id,'day_ten',v_email,greatest(new.started_at,now())+interval '10 days')
 on conflict(journey,source_id,step) do nothing;
 return new;
end $$;
revoke all on function marketing_private.stage_club_followups() from public,anon,authenticated;
drop trigger if exists omc_club_lifecycle_stage on public.club_subscriptions;
create trigger omc_club_lifecycle_stage after insert or update of started_at on public.club_subscriptions
for each row execute function marketing_private.stage_club_followups();

-- Held jobs are not dispatched. No cron, worker, or production launch flag is added.
commit;