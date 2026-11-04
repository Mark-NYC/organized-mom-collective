-- Checkout offers: disabled-by-default configuration and private funnel event ledger.
-- No public insert/select permissions. Only trusted Edge Functions (service_role)
-- may record events or change offers. Run in Supabase before enabling offers.
create table if not exists public.shop_offers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{3,80}$'),
  placement text not null check (placement in ('order_bump','post_purchase','downsell')),
  trigger_product_slug text not null,
  offered_product_slug text,
  headline text not null,
  description text not null default '',
  active boolean not null default false,
  -- A displayed price is never sourced from this table: the checkout must use
  -- existing shop_products pricing and reserve stock through shop_create_order.
  priority integer not null default 100,
  variant text not null default 'control',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_offers_trigger_idx on public.shop_offers (trigger_product_slug, placement, priority) where active;

create table if not exists public.shop_checkout_journeys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_source text,
  first_medium text,
  first_campaign text,
  first_content text,
  first_term text,
  last_source text,
  last_medium text,
  last_campaign text,
  last_content text,
  last_term text,
  landing_path text,
  -- Link only to an existing actual checkout; do not expose order details.
  order_id uuid unique references public.shop_orders(id) on delete set null,
  stripe_session_id text unique
);
create index if not exists shop_checkout_journeys_created_idx on public.shop_checkout_journeys(created_at desc);

create table if not exists public.shop_offer_events (
  id bigint generated always as identity primary key,
  journey_id uuid not null references public.shop_checkout_journeys(id) on delete cascade,
  offer_id uuid references public.shop_offers(id) on delete set null,
  offer_code text,
  variant text,
  event_name text not null check (event_name in (
    'checkout_started', 'offer_viewed', 'offer_accepted', 'offer_declined',
    'checkout_completed', 'post_purchase_payment_succeeded',
    'post_purchase_payment_failed'
  )),
  -- Event deduplication across page retries and duplicated Stripe webhooks.
  event_key text unique,
  stripe_session_id text,
  stripe_payment_intent_id text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists shop_offer_events_journey_idx on public.shop_offer_events(journey_id, occurred_at);
create index if not exists shop_offer_events_funnel_idx on public.shop_offer_events(event_name, occurred_at desc);

alter table public.shop_offers enable row level security;
alter table public.shop_checkout_journeys enable row level security;
alter table public.shop_offer_events enable row level security;
revoke all on public.shop_offers, public.shop_checkout_journeys, public.shop_offer_events from anon, authenticated;
-- These tables have no public write policy. Stripe must confirm actual revenue.
comment on table public.shop_offer_events is 'Offer impressions and intent, not proof of payment. Derive sales from paid shop_orders/Stripe webhooks.';
