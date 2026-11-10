-- First-party last-email-campaign attribution for completed checkouts.
-- Session IDs link to Stripe-verified orders/enrollments. No personal details in this ledger.
begin;
create table if not exists public.marketing_checkout_attribution (
 stripe_session_id text primary key,
 checkout_kind text not null check (checkout_kind in ('shop','club')),
 campaign text not null check (campaign ~ '^one_small_win_[0-9]{2}$' or campaign ~ '^sunday_family_reset_[0-9]{2}$' or campaign ~ '^omc_[a-z0-9_]{1,50}$'),
 source text not null default 'omc_email' check (source='omc_email'),
 medium text not null default 'email' check (medium='email'),
 touched_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.marketing_checkout_attribution enable row level security;
revoke all on public.marketing_checkout_attribution from public,anon,authenticated;
create index if not exists marketing_checkout_attribution_kind_idx on public.marketing_checkout_attribution(checkout_kind,created_at);

create or replace function public.marketing_record_checkout_attribution(
 p_session text,p_kind text,p_campaign text,p_touched_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_session is null or p_session !~ '^cs_(test|live)_[a-zA-Z0-9]{10,200}$'
   or p_kind not in ('shop','club')
   or p_campaign is null or not
     (p_campaign ~ '^one_small_win_[0-9]{2}$' or p_campaign ~ '^sunday_family_reset_[0-9]{2}$' or p_campaign ~ '^omc_[a-z0-9_]{1,50}$')
   or p_touched_at is null or p_touched_at>now()+interval '1 minute'
   or p_touched_at<now()-interval '7 days'
 then return false;end if;
 -- Capture only an actual previously recorded session, never a guessed session ID.
 if p_kind='shop' and not exists(select 1 from public.shop_orders where stripe_session_id=p_session) then return false;end if;
 if p_kind='club' and not exists(select 1 from public.club_checkout_sessions where stripe_session_id=p_session) then return false;end if;
 insert into public.marketing_checkout_attribution(stripe_session_id,checkout_kind,campaign,touched_at)
 values(p_session,p_kind,p_campaign,p_touched_at)
 on conflict(stripe_session_id) do nothing;
 return true;
end $$;
revoke all on function public.marketing_record_checkout_attribution(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.marketing_record_checkout_attribution(text,text,text,timestamptz) to service_role;
commit;
