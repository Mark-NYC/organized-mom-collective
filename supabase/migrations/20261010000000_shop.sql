-- Direct website shop: products, inventory, orders, Stripe events, emails, entitlements.
-- Admin dashboard: /admin/orders. Checkout: /checkout. Setup: supabase/SHOP.md.
--
-- Security model
--   * The site holds only the public anon key. anon can call exactly two functions:
--       shop_catalog()                 – active products, prices, availability, shipping rates
--       shop_order_status(session_id)  – the confirmation page's minimal view of one order
--     Nothing else in this file is readable or writable with the anon key.
--   * Signed-in Supabase Auth users listed in shop_admins can READ orders, products and
--     inventory (row-level security). They write only through the shop-admin Edge Function.
--   * Every write (reserve, pay, expire, refund, ship, adjust) goes through the functions
--     below, which only the service_role key (Edge Functions) can execute.
--
-- Inventory model (direct website sales only; Etsy stock is separate):
--   shop_products.stock = units available to sell right now. Starting a checkout takes
--   units out of stock (a "held" reservation on the order); payment converts the hold;
--   an expired, canceled or failed checkout puts them back. The decrement is a single
--   conditional UPDATE (stock >= qty), so concurrent checkouts can never take the same unit.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables

create table public.shop_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One row. checkout_mode: off (nobody can pay), preview (only with the preview token),
-- live (anyone who reaches /checkout). Live *payments* also need a live Stripe key and
-- SHOP_LIVE_PAYMENTS=enabled on the functions (see supabase/SHOP.md).
create table public.shop_settings (
  id boolean primary key default true check (id),
  checkout_mode text not null default 'off' check (checkout_mode in ('off', 'preview', 'live')),
  -- off: no tax collected; automatic: Stripe Tax (needs registrations set up in Stripe);
  -- manual: the per-state rates in shop_tax_rates.
  tax_mode text not null default 'off' check (tax_mode in ('off', 'automatic', 'manual')),
  -- Stripe Tax product code, used in automatic mode. txcd_99999999 = general tangible goods.
  product_tax_code text not null default 'txcd_99999999',
  -- How long a checkout holds stock. Stripe Checkout sessions last 30 minutes to 24 hours.
  checkout_minutes int not null default 30 check (checkout_minutes between 30 and 1440),
  -- Checkouts started per connection per hour (stops one visitor holding all the stock).
  max_checkouts_per_hour int not null default 12 check (max_checkouts_per_hour between 1 and 1000),
  updated_at timestamptz not null default now()
);
insert into public.shop_settings default values;

create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  -- Which printed edition this listing ships, e.g. 'January–June 2027'. Optional.
  edition text check (char_length(edition) <= 80),
  description text not null default '' check (char_length(description) <= 2000),
  details text[] not null default '{}',
  price_cents int not null check (price_cents between 50 and 100000),
  currency text not null default 'usd' check (currency = 'usd'),
  weeks int check (weeks > 0),
  -- [{ "src": "/images/…" or "https://…", "alt": "…" }]
  images jsonb not null default '[]' check (jsonb_typeof(images) = 'array'),
  active boolean not null default false,
  stock int not null default 0 check (stock >= 0),
  max_per_order int not null default 5 check (max_per_order between 1 and 50),
  includes_companion boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Flat-rate US shipping, chosen by the customer in checkout. Amounts in cents.
create table public.shop_shipping_rates (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 100),
  amount_cents int not null check (amount_cents between 0 and 100000),
  -- Optional delivery estimate in business days, shown by Stripe. Leave empty unless you can keep it.
  min_days int check (min_days between 1 and 60),
  max_days int check (max_days between 1 and 60),
  active boolean not null default true,
  sort int not null default 0,
  check (min_days is null or max_days is null or min_days <= max_days)
);

-- Manual tax mode: one rate per state you're registered in. Stripe applies the rate whose
-- state matches the shipping address. The functions create the Stripe tax rate objects.
create table public.shop_tax_rates (
  state text primary key check (state ~ '^[A-Z]{2}$'),
  percentage numeric(6, 4) not null check (percentage > 0 and percentage < 20),
  label text not null default 'Sales tax',
  active boolean not null default true,
  -- Cached Stripe tax rate ids: { "test": "txr_…", "live": "txr_…" }
  stripe_ids jsonb not null default '{}'
);

create sequence public.shop_order_number_seq start 1001;

-- One row per checkout attempt. Abandoned attempts end as 'expired' and stay out of sales numbers.
create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  -- Assigned when payment is confirmed, so customers see consecutive numbers.
  order_number int unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'partially_refunded', 'refunded', 'failed', 'expired', 'canceled')),
  fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'packing', 'shipped', 'delivered', 'canceled')),
  reservation text not null default 'held' check (reservation in ('held', 'converted', 'released')),
  reservation_expires_at timestamptz not null,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  livemode boolean,
  email text,
  customer_name text,
  phone text,
  shipping_name text,
  -- { line1, line2, city, state, postal_code, country }
  shipping_address jsonb,
  shipping_method text,
  promotion_code text,
  currency text not null default 'usd',
  subtotal_cents int not null check (subtotal_cents >= 0),
  discount_cents int not null default 0,
  shipping_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int,
  refunded_cents int not null default 0 check (refunded_cents >= 0),
  carrier text check (char_length(carrier) <= 60),
  tracking_number text check (char_length(tracking_number) <= 100),
  tracking_url text check (char_length(tracking_url) <= 500),
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  -- Needs a look: oversold, amount_mismatch, disputed, refund_failed
  flags text[] not null default '{}',
  admin_note text check (char_length(admin_note) <= 4000)
);
create index shop_orders_created_at on public.shop_orders (created_at desc);
create index shop_orders_held on public.shop_orders (reservation_expires_at) where reservation = 'held';
create index shop_orders_email on public.shop_orders (lower(email));

create table public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  product_id uuid not null references public.shop_products (id),
  product_slug text not null,
  product_name text not null,
  unit_price_cents int not null check (unit_price_cents >= 0),
  quantity int not null check (quantity between 1 and 50),
  -- Units put back into stock after a refund (never more than were sold).
  restocked int not null default 0,
  check (restocked between 0 and quantity)
);
create index shop_order_items_order on public.shop_order_items (order_id);

-- Timeline shown in the dashboard: payments, failures, refunds, shipping, emails, notes.
create table public.shop_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  detail jsonb not null default '{}',
  actor text not null default 'system'
);
create index shop_order_events_order on public.shop_order_events (order_id, at);

-- Every manual stock change and refund restock.
create table public.shop_inventory_log (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.shop_products (id) on delete cascade,
  at timestamptz not null default now(),
  delta int not null,
  stock_after int not null,
  reason text not null,
  actor text not null,
  order_id uuid references public.shop_orders (id) on delete set null
);

-- Stripe webhook idempotency: one row per event id.
create table public.shop_stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts int not null default 1
);

-- Who bought a calendar and is entitled to the companion. Nothing is gated on this today
-- (the companion is open to everyone); it's the record a future account system can link
-- to (user_id) without asking customers to sign up at checkout.
create table public.shop_entitlements (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  kind text not null default 'companion' check (kind in ('companion')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  user_id uuid references auth.users (id) on delete set null,
  unique (order_id, kind)
);
create index shop_entitlements_email on public.shop_entitlements (lower(email));

-- Transactional emails. dedupe_key makes each email go out once, even when Stripe
-- delivers the same event twice.
create table public.shop_email_log (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  kind text not null check (kind in ('confirmation', 'shipped', 'refund', 'access')),
  dedupe_key text not null unique,
  to_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_id text,
  error text,
  attempts int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shop_email_log_order on public.shop_email_log (order_id);

create table public.shop_throttle (
  key text not null,
  kind text not null,
  at timestamptz not null default now()
);
create index shop_throttle_lookup on public.shop_throttle (key, kind, at);

create table public.shop_secret (
  id boolean primary key default true check (id),
  salt text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
insert into public.shop_secret default values;

-- ---------------------------------------------------------------- row-level security

alter table public.shop_admins enable row level security;
alter table public.shop_settings enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_shipping_rates enable row level security;
alter table public.shop_tax_rates enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
alter table public.shop_order_events enable row level security;
alter table public.shop_inventory_log enable row level security;
alter table public.shop_stripe_events enable row level security;
alter table public.shop_entitlements enable row level security;
alter table public.shop_email_log enable row level security;
alter table public.shop_throttle enable row level security;
alter table public.shop_secret enable row level security;

revoke all on public.shop_admins, public.shop_settings, public.shop_products, public.shop_shipping_rates,
  public.shop_tax_rates, public.shop_orders, public.shop_order_items, public.shop_order_events,
  public.shop_inventory_log, public.shop_stripe_events, public.shop_entitlements, public.shop_email_log,
  public.shop_throttle, public.shop_secret
  from anon, authenticated;
revoke all on sequence public.shop_order_number_seq from anon, authenticated;

create function public.is_shop_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shop_admins where user_id = auth.uid());
$$;

-- Admins read (never write) these through the REST API.
grant select on public.shop_settings, public.shop_products, public.shop_shipping_rates, public.shop_tax_rates,
  public.shop_orders, public.shop_order_items, public.shop_order_events, public.shop_inventory_log,
  public.shop_entitlements, public.shop_email_log
  to authenticated;
create policy "Shop admins read settings" on public.shop_settings for select to authenticated using ((select public.is_shop_admin()));
create policy "Shop admins read products" on public.shop_products for select to authenticated using ((select public.is_shop_admin()));
create policy "Shop admins read shipping" on public.shop_shipping_rates for select to authenticated using ((select public.is_shop_admin()));
create policy "Shop admins read tax" on public.shop_tax_rates for select to authenticated using ((select public.is_shop_admin()));
create policy "Shop admins read orders" on public.shop_orders for select to authenticated using ((select public.is_shop_admin()));
create policy "Shop admins read items" on public.shop_order_items for select to authenticated using ((select public.is_shop_admin()));
create policy "Shop admins read events" on public.shop_order_events for select to authenticated using ((select public.is_shop_admin()));
create policy "Shop admins read inventory log" on public.shop_inventory_log for select to authenticated using ((select public.is_shop_admin()));
create policy "Shop admins read entitlements" on public.shop_entitlements for select to authenticated using ((select public.is_shop_admin()));
create policy "Shop admins read emails" on public.shop_email_log for select to authenticated using ((select public.is_shop_admin()));

-- ---------------------------------------------------------------- internal helpers

create function public.shop_event(p_order uuid, p_kind text, p_detail jsonb default '{}', p_actor text default 'system')
returns void language sql security definer set search_path = '' as $$
  insert into public.shop_order_events (order_id, kind, detail, actor) values (p_order, p_kind, coalesce(p_detail, '{}'), coalesce(p_actor, 'system'));
$$;

-- Returns false once `key` has made `max_count` calls of `kind` in `win`; otherwise records this one.
create function public.shop_allow(p_key text, p_kind text, p_max int, p_win interval) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.shop_throttle t where t.key = p_key and t.kind = p_kind and t.at > now() - p_win) >= p_max then
    return false;
  end if;
  insert into public.shop_throttle (key, kind) values (p_key, p_kind);
  if random() < 0.02 then
    delete from public.shop_throttle where at < now() - interval '2 days';
  end if;
  return true;
end $$;

-- Puts a held reservation back into stock. No-op unless the order still holds stock.
create function public.shop_release_hold(p_order uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  it record;
begin
  update public.shop_orders set reservation = 'released', updated_at = now()
   where id = p_order and reservation = 'held';
  if not found then
    return false;
  end if;
  for it in select product_id, sum(quantity) q from public.shop_order_items where order_id = p_order group by product_id loop
    update public.shop_products set stock = stock + it.q, updated_at = now() where id = it.product_id;
  end loop;
  return true;
end $$;

-- Releases holds from checkouts that are past their time (Stripe's own session has expired
-- by then; this covers a missed checkout.session.expired webhook).
create function public.shop_release_stale() returns int
language plpgsql security definer set search_path = '' as $$
declare
  o record;
  n int := 0;
begin
  for o in select id from public.shop_orders
            where reservation = 'held' and reservation_expires_at < now()
            order by reservation_expires_at
            for update skip locked loop
    if public.shop_release_hold(o.id) then
      update public.shop_orders set payment_status = 'expired', updated_at = now() where id = o.id and payment_status = 'pending';
      perform public.shop_event(o.id, 'checkout_expired', '{"via":"timeout"}');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- checkout (service role)

-- Validates the cart against the database (price, active, stock, per-order limit), takes the
-- units out of stock and creates a pending order. p_items: [{ "slug": "…", "quantity": 1 }].
-- Errors (raised, message = code): checkout_closed, rate_limited, invalid_cart,
-- unavailable:<slug>, too_many:<slug>, sold_out:<slug>.
create function public.shop_create_order(p_items jsonb, p_client text, p_preview boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.shop_settings%rowtype;
  cart jsonb;
  line record;
  p public.shop_products%rowtype;
  order_id uuid := gen_random_uuid();
  subtotal int := 0;
  items jsonb := '[]';
  client_key text;
begin
  select * into s from public.shop_settings;
  if s.checkout_mode = 'off' or (s.checkout_mode = 'preview' and not coalesce(p_preview, false)) then
    raise exception 'checkout_closed';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 10 then
    raise exception 'invalid_cart';
  end if;
  -- Merge repeated slugs; reject anything that isn't a slug + whole quantity.
  begin
    select jsonb_agg(jsonb_build_object('slug', slug, 'quantity', q) order by slug) into cart
      from (select e ->> 'slug' slug, sum((e ->> 'quantity')::int) q
              from jsonb_array_elements(p_items) e
             group by e ->> 'slug') x;
  exception when others then
    raise exception 'invalid_cart';
  end;
  if exists (select 1 from jsonb_array_elements(cart) c
              where c ->> 'slug' is null or c ->> 'quantity' is null or (c ->> 'quantity')::int < 1) then
    raise exception 'invalid_cart';
  end if;

  -- Rate limit by a salted, daily-rotating hash of the connection.
  client_key := encode(extensions.digest(coalesce(p_client, 'unknown') || current_date::text || (select salt from public.shop_secret), 'sha256'), 'hex');
  if not public.shop_allow(client_key, 'checkout', s.max_checkouts_per_hour, interval '1 hour') then
    raise exception 'rate_limited';
  end if;

  perform public.shop_release_stale();

  -- Slug order keeps lock order consistent across concurrent checkouts.
  for line in select c ->> 'slug' slug, (c ->> 'quantity')::int q from jsonb_array_elements(cart) c order by 1 loop
    select * into p from public.shop_products where slug = line.slug;
    if not found or not p.active then
      raise exception 'unavailable:%', line.slug;
    end if;
    if line.q > p.max_per_order then
      raise exception 'too_many:%', line.slug;
    end if;
    -- The atomic take: waits for any concurrent checkout on this row, then re-checks stock.
    update public.shop_products set stock = stock - line.q, updated_at = now()
     where id = p.id and active and stock >= line.q
     returning * into p;
    if not found then
      raise exception 'sold_out:%', line.slug;
    end if;
    subtotal := subtotal + p.price_cents * line.q;
    items := items || jsonb_build_object(
      'product_id', p.id, 'slug', p.slug, 'name', p.name, 'edition', p.edition, 'description', p.description,
      'unit_price_cents', p.price_cents, 'quantity', line.q, 'image', p.images -> 0 ->> 'src');
  end loop;

  insert into public.shop_orders (id, subtotal_cents, reservation_expires_at)
  values (order_id, subtotal, now() + make_interval(mins => s.checkout_minutes + 10));
  insert into public.shop_order_items (order_id, product_id, product_slug, product_name, unit_price_cents, quantity)
  select order_id, (i ->> 'product_id')::uuid, i ->> 'slug',
         case when i ->> 'edition' is null then i ->> 'name' else (i ->> 'name') || ' (' || (i ->> 'edition') || ')' end,
         (i ->> 'unit_price_cents')::int, (i ->> 'quantity')::int
    from jsonb_array_elements(items) i;
  perform public.shop_event(order_id, 'checkout_started', jsonb_build_object('subtotal_cents', subtotal));

  return jsonb_build_object(
    'order_id', order_id,
    'subtotal_cents', subtotal,
    'checkout_minutes', s.checkout_minutes,
    'tax_mode', s.tax_mode,
    'product_tax_code', s.product_tax_code,
    'items', items,
    'shipping_rates', coalesce((select jsonb_agg(to_jsonb(r) order by r.sort, r.amount_cents)
                                  from public.shop_shipping_rates r where r.active), '[]'),
    'tax_rates', coalesce((select jsonb_agg(to_jsonb(t) order by t.state)
                             from public.shop_tax_rates t where t.active and s.tax_mode = 'manual'), '[]')
  );
end $$;

create function public.shop_attach_session(p_order uuid, p_session text, p_livemode boolean) returns void
language sql security definer set search_path = '' as $$
  update public.shop_orders set stripe_session_id = p_session, livemode = p_livemode, updated_at = now()
   where id = p_order and stripe_session_id is null;
$$;

-- The checkout couldn't be opened (Stripe error) or the customer left it: release now.
create function public.shop_cancel_checkout(p_order uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.shop_orders set payment_status = 'canceled', canceled_at = now(), updated_at = now()
   where id = p_order and payment_status = 'pending';
  if not found then
    return false;
  end if;
  perform public.shop_release_hold(p_order);
  perform public.shop_event(p_order, 'checkout_canceled', jsonb_build_object('reason', p_reason));
  return true;
end $$;

-- ---------------------------------------------------------------- Stripe webhook (service role)

-- 'new' (first delivery), 'retry' (seen, not finished) or 'done' (already processed: skip).
create function public.shop_stripe_event_begin(p_id text, p_type text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  done_at timestamptz;
begin
  insert into public.shop_stripe_events (id, type) values (p_id, p_type) on conflict (id) do nothing;
  if found then
    return 'new';
  end if;
  update public.shop_stripe_events set attempts = attempts + 1 where id = p_id returning processed_at into done_at;
  return case when done_at is null then 'retry' else 'done' end;
end $$;

create function public.shop_stripe_event_done(p_id text) returns void
language sql security definer set search_path = '' as $$
  update public.shop_stripe_events set processed_at = coalesce(processed_at, now()) where id = p_id;
$$;

-- Payment confirmed by Stripe (checkout.session.completed / async_payment_succeeded, with
-- the session re-fetched from the API). Idempotent: only the first call changes anything.
-- p: { order_id, payment_intent, livemode, email, name, phone, shipping_name, shipping_address,
--      shipping_method, promotion_code, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents }
create function public.shop_mark_paid(p_session text, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.shop_orders%rowtype;
  it record;
  new_flags text[] := '{}';
begin
  select * into o from public.shop_orders where stripe_session_id = p_session for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  if o.payment_status not in ('pending', 'expired', 'canceled') then
    return jsonb_build_object('found', true, 'transitioned', false, 'order_id', o.id, 'payment_status', o.payment_status);
  end if;

  if p ->> 'order_id' is distinct from o.id::text or (p ->> 'subtotal_cents')::int is distinct from o.subtotal_cents then
    new_flags := array_append(new_flags, 'amount_mismatch');
  end if;

  if o.reservation = 'held' then
    update public.shop_orders set reservation = 'converted' where id = o.id;
  else
    -- Paid after the hold was released (very late webhook): take the stock again if it's there.
    for it in select product_id, sum(quantity) q from public.shop_order_items where order_id = o.id group by product_id loop
      update public.shop_products set stock = stock - it.q, updated_at = now() where id = it.product_id and stock >= it.q;
      if not found then
        new_flags := array_append(new_flags, 'oversold');
      end if;
    end loop;
    update public.shop_orders set reservation = 'converted' where id = o.id;
  end if;

  update public.shop_orders set
    payment_status = 'paid',
    order_number = coalesce(order_number, nextval('public.shop_order_number_seq')::int),
    paid_at = now(),
    canceled_at = null,
    stripe_payment_intent_id = coalesce(p ->> 'payment_intent', stripe_payment_intent_id),
    livemode = coalesce((p ->> 'livemode')::boolean, livemode),
    email = p ->> 'email',
    customer_name = p ->> 'name',
    phone = p ->> 'phone',
    shipping_name = p ->> 'shipping_name',
    shipping_address = p -> 'shipping_address',
    shipping_method = p ->> 'shipping_method',
    promotion_code = p ->> 'promotion_code',
    discount_cents = coalesce((p ->> 'discount_cents')::int, 0),
    shipping_cents = coalesce((p ->> 'shipping_cents')::int, 0),
    tax_cents = coalesce((p ->> 'tax_cents')::int, 0),
    total_cents = (p ->> 'total_cents')::int,
    flags = coalesce((select array_agg(distinct f order by f) from unnest(flags || new_flags) f), '{}'),
    updated_at = now()
  where id = o.id
  returning * into o;

  if o.email is not null then
    insert into public.shop_entitlements (email, order_id) values (lower(o.email), o.id) on conflict (order_id, kind) do nothing;
  end if;
  perform public.shop_event(o.id, 'paid', jsonb_build_object('total_cents', o.total_cents, 'flags', new_flags), 'stripe');
  return jsonb_build_object('found', true, 'transitioned', true, 'order_id', o.id, 'order_number', o.order_number, 'flags', new_flags);
end $$;

-- checkout.session.expired (abandoned) or async_payment_failed.
create function public.shop_checkout_ended(p_session text, p_status text, p_detail jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.shop_orders%rowtype;
begin
  if p_status not in ('expired', 'failed') then
    raise exception 'invalid_status';
  end if;
  select * into o from public.shop_orders where stripe_session_id = p_session for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  if o.payment_status not in ('pending', 'expired', 'canceled') then
    return jsonb_build_object('found', true, 'transitioned', false, 'order_id', o.id);
  end if;
  update public.shop_orders set payment_status = p_status, updated_at = now() where id = o.id;
  perform public.shop_release_hold(o.id);
  perform public.shop_event(o.id, 'checkout_' || p_status, p_detail, 'stripe');
  return jsonb_build_object('found', true, 'transitioned', true, 'order_id', o.id);
end $$;

-- Timeline note found by order id or payment intent (e.g. a declined card attempt).
create function public.shop_note_event(p_order uuid, p_payment_intent text, p_kind text, p_detail jsonb, p_flag text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  oid uuid;
begin
  select id into oid from public.shop_orders
   where (p_order is not null and id = p_order) or (p_payment_intent is not null and stripe_payment_intent_id = p_payment_intent)
   limit 1;
  if oid is null then
    return null;
  end if;
  perform public.shop_event(oid, p_kind, p_detail, 'stripe');
  if p_flag is not null then
    update public.shop_orders set flags = coalesce((select array_agg(distinct f order by f) from unnest(flags || p_flag) f), '{}'), updated_at = now() where id = oid;
  end if;
  return oid;
end $$;

-- Refund state from Stripe's own total (charge.amount_refunded), so replays and refunds made
-- in the Stripe dashboard land the same way. Fully refunded and not yet shipped = canceled.
create function public.shop_apply_refund(p_payment_intent text, p_refunded_cents int, p_actor text default 'stripe') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.shop_orders%rowtype;
  before int;
begin
  select * into o from public.shop_orders where stripe_payment_intent_id = p_payment_intent for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  if o.payment_status not in ('paid', 'partially_refunded', 'refunded') or p_refunded_cents <= o.refunded_cents then
    return jsonb_build_object('found', true, 'transitioned', false, 'order_id', o.id, 'refunded_cents', o.refunded_cents);
  end if;
  before := o.refunded_cents;
  update public.shop_orders set
    refunded_cents = p_refunded_cents,
    payment_status = case when p_refunded_cents >= coalesce(total_cents, 0) then 'refunded' else 'partially_refunded' end,
    fulfillment_status = case when p_refunded_cents >= coalesce(total_cents, 0) and fulfillment_status in ('unfulfilled', 'packing')
                              then 'canceled' else fulfillment_status end,
    canceled_at = case when p_refunded_cents >= coalesce(total_cents, 0) and fulfillment_status in ('unfulfilled', 'packing')
                       then now() else canceled_at end,
    updated_at = now()
  where id = o.id
  returning * into o;
  if o.payment_status = 'refunded' then
    update public.shop_entitlements set revoked_at = now(), revoked_reason = 'refunded' where order_id = o.id and revoked_at is null;
  end if;
  perform public.shop_event(o.id, 'refunded', jsonb_build_object('amount_cents', p_refunded_cents - before, 'refunded_total_cents', p_refunded_cents), p_actor);
  return jsonb_build_object('found', true, 'transitioned', true, 'order_id', o.id, 'refunded_cents', p_refunded_cents,
                            'amount_cents', p_refunded_cents - before, 'payment_status', o.payment_status,
                            'fulfillment_status', o.fulfillment_status);
end $$;

-- ---------------------------------------------------------------- admin actions (service role, called by shop-admin)

create function public.shop_is_admin_user(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shop_admins where user_id = p_user);
$$;

create function public.shop_set_fulfillment(p_order uuid, p_status text, p_carrier text, p_tracking text, p_tracking_url text, p_actor text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.shop_orders%rowtype;
  prev text;
begin
  if p_status not in ('unfulfilled', 'packing', 'shipped', 'delivered') then
    raise exception 'invalid_status';
  end if;
  select * into o from public.shop_orders where id = p_order for update;
  if not found then
    raise exception 'not_found';
  end if;
  if o.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'not_payable_state';
  end if;
  if p_status in ('shipped', 'delivered') and nullif(btrim(coalesce(p_carrier, o.carrier, '')), '') is null then
    raise exception 'carrier_required';
  end if;
  if p_tracking_url is not null and p_tracking_url <> '' and p_tracking_url !~ '^https://' then
    raise exception 'invalid_tracking_url';
  end if;
  prev := o.fulfillment_status;
  update public.shop_orders set
    fulfillment_status = p_status,
    carrier = coalesce(nullif(btrim(p_carrier), ''), carrier),
    tracking_number = coalesce(nullif(btrim(p_tracking), ''), tracking_number),
    tracking_url = coalesce(nullif(btrim(p_tracking_url), ''), tracking_url),
    shipped_at = case when p_status in ('shipped', 'delivered') then coalesce(shipped_at, now()) else shipped_at end,
    delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
    updated_at = now()
  where id = o.id
  returning * into o;
  perform public.shop_event(o.id, 'fulfillment', jsonb_build_object('from', prev, 'to', p_status, 'carrier', o.carrier, 'tracking_number', o.tracking_number), p_actor);
  return jsonb_build_object('order_id', o.id, 'from', prev, 'to', p_status);
end $$;

-- Puts a refunded order's units back on the shelf (once per unit).
create function public.shop_restock_order(p_order uuid, p_actor text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  it record;
  n int := 0;
  p public.shop_products%rowtype;
begin
  if not exists (select 1 from public.shop_orders where id = p_order and reservation = 'converted') then
    return 0;
  end if;
  for it in select * from public.shop_order_items where order_id = p_order and restocked < quantity for update loop
    update public.shop_order_items set restocked = quantity where id = it.id;
    update public.shop_products set stock = stock + (it.quantity - it.restocked), updated_at = now() where id = it.product_id returning * into p;
    insert into public.shop_inventory_log (product_id, delta, stock_after, reason, actor, order_id)
    values (it.product_id, it.quantity - it.restocked, p.stock, 'Returned to stock after refund', p_actor, p_order);
    n := n + it.quantity - it.restocked;
  end loop;
  if n > 0 then
    perform public.shop_event(p_order, 'restocked', jsonb_build_object('units', n), p_actor);
  end if;
  return n;
end $$;

-- Add/remove units (p_delta) or set the count (p_set). Stock never goes below zero.
create function public.shop_adjust_stock(p_product uuid, p_delta int, p_set int, p_reason text, p_actor text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  p public.shop_products%rowtype;
  d int;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required';
  end if;
  select * into p from public.shop_products where id = p_product for update;
  if not found then
    raise exception 'not_found';
  end if;
  d := case when p_set is not null then p_set - p.stock else p_delta end;
  if d is null or d = 0 then
    return p.stock;
  end if;
  if p.stock + d < 0 then
    raise exception 'stock_negative';
  end if;
  update public.shop_products set stock = stock + d, updated_at = now() where id = p_product returning * into p;
  insert into public.shop_inventory_log (product_id, delta, stock_after, reason, actor) values (p_product, d, p.stock, left(p_reason, 200), p_actor);
  return p.stock;
end $$;

-- Editable product fields only (stock goes through shop_adjust_stock).
create function public.shop_update_product(p_product uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.shop_products set
    name = coalesce(p ->> 'name', name),
    edition = case when p ? 'edition' then nullif(btrim(p ->> 'edition'), '') else edition end,
    description = coalesce(p ->> 'description', description),
    details = case when p ? 'details' then array(select jsonb_array_elements_text(p -> 'details')) else details end,
    price_cents = coalesce((p ->> 'price_cents')::int, price_cents),
    images = coalesce(p -> 'images', images),
    active = coalesce((p ->> 'active')::boolean, active),
    max_per_order = coalesce((p ->> 'max_per_order')::int, max_per_order),
    sort = coalesce((p ->> 'sort')::int, sort),
    updated_at = now()
  where id = p_product;
  if not found then
    raise exception 'not_found';
  end if;
end $$;

create function public.shop_update_settings(p jsonb) returns void
language sql security definer set search_path = '' as $$
  update public.shop_settings set
    checkout_mode = coalesce(p ->> 'checkout_mode', checkout_mode),
    tax_mode = coalesce(p ->> 'tax_mode', tax_mode),
    product_tax_code = coalesce(p ->> 'product_tax_code', product_tax_code),
    checkout_minutes = coalesce((p ->> 'checkout_minutes')::int, checkout_minutes),
    max_checkouts_per_hour = coalesce((p ->> 'max_checkouts_per_hour')::int, max_checkouts_per_hour),
    updated_at = now();
$$;

create function public.shop_save_shipping_rate(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid := nullif(p ->> 'id', '')::uuid;
begin
  if rid is null then
    insert into public.shop_shipping_rates (label, amount_cents, min_days, max_days, active, sort)
    values (p ->> 'label', (p ->> 'amount_cents')::int, (p ->> 'min_days')::int, (p ->> 'max_days')::int,
            coalesce((p ->> 'active')::boolean, true), coalesce((p ->> 'sort')::int, 0))
    returning id into rid;
  else
    update public.shop_shipping_rates set
      label = coalesce(p ->> 'label', label),
      amount_cents = coalesce((p ->> 'amount_cents')::int, amount_cents),
      min_days = case when p ? 'min_days' then (p ->> 'min_days')::int else min_days end,
      max_days = case when p ? 'max_days' then (p ->> 'max_days')::int else max_days end,
      active = coalesce((p ->> 'active')::boolean, active),
      sort = coalesce((p ->> 'sort')::int, sort)
    where id = rid;
    if not found then
      raise exception 'not_found';
    end if;
  end if;
  return rid;
end $$;

create function public.shop_cache_tax_rate(p_state text, p_mode text, p_stripe_id text) returns void
language sql security definer set search_path = '' as $$
  update public.shop_tax_rates set stripe_ids = stripe_ids || jsonb_build_object(p_mode, p_stripe_id) where state = p_state;
$$;

create function public.shop_set_note(p_order uuid, p_note text, p_actor text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.shop_orders set admin_note = nullif(btrim(p_note), ''), updated_at = now() where id = p_order;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.shop_event(p_order, 'note', '{}', p_actor);
end $$;

-- ---------------------------------------------------------------- emails (service role)

-- Claims an email for sending. Returns the log id, or null if that email already went out
-- (or is going out right now). Failed / skipped / stuck sends can be claimed again.
create function public.shop_email_claim(p_order uuid, p_kind text, p_key text, p_to text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  lid bigint;
begin
  insert into public.shop_email_log (order_id, kind, dedupe_key, to_email)
  values (p_order, p_kind, p_key, p_to)
  on conflict (dedupe_key) do update
    set status = 'pending', attempts = public.shop_email_log.attempts + 1, error = null, updated_at = now(), to_email = excluded.to_email
    where public.shop_email_log.status in ('failed', 'skipped')
       or (public.shop_email_log.status = 'pending' and public.shop_email_log.updated_at < now() - interval '10 minutes')
  returning id into lid;
  return lid;
end $$;

create function public.shop_email_result(p_id bigint, p_status text, p_provider_id text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.shop_email_log%rowtype;
begin
  update public.shop_email_log set status = p_status, provider_id = p_provider_id, error = left(p_error, 500), updated_at = now()
   where id = p_id returning * into l;
  if found then
    perform public.shop_event(l.order_id, 'email_' || p_status, jsonb_build_object('kind', l.kind, 'to', l.to_email, 'error', left(p_error, 200)));
  end if;
end $$;

-- ---------------------------------------------------------------- public API (anon)

-- What /checkout shows: active products, availability (never the exact stock count above
-- the per-order limit), shipping options and whether checkout is open.
create function public.shop_catalog() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'checkout_mode', (select checkout_mode from public.shop_settings),
    'tax_mode', (select tax_mode from public.shop_settings),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'name', p.name, 'edition', p.edition, 'description', p.description, 'details', to_jsonb(p.details),
        'price_cents', p.price_cents, 'currency', p.currency, 'weeks', p.weeks, 'images', p.images,
        'includes_companion', p.includes_companion,
        'available', p.stock > 0,
        'max_quantity', least(p.stock, p.max_per_order)
      ) order by p.sort, p.price_cents)
      from public.shop_products p where p.active), '[]'),
    'shipping_rates', coalesce((
      select jsonb_agg(jsonb_build_object('label', r.label, 'amount_cents', r.amount_cents) order by r.sort, r.amount_cents)
      from public.shop_shipping_rates r where r.active), '[]')
  );
$$;

-- The confirmation page polls this. Knowing the Checkout Session id (only the buyer's browser
-- has it) shows the order's status, number, items and totals; email is masked, no address.
create function public.shop_order_status(p_session text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when o.id is null then null else jsonb_build_object(
    'payment_status', o.payment_status,
    'fulfillment_status', o.fulfillment_status,
    'order_number', o.order_number,
    'email_hint', case when o.email is null then null
                       else left(split_part(o.email, '@', 1), 1) || '•••@' || split_part(o.email, '@', 2) end,
    'subtotal_cents', o.subtotal_cents,
    'discount_cents', o.discount_cents,
    'shipping_cents', o.shipping_cents,
    'tax_cents', o.tax_cents,
    'total_cents', o.total_cents,
    'items', (select jsonb_agg(jsonb_build_object('name', i.product_name, 'quantity', i.quantity, 'unit_price_cents', i.unit_price_cents))
                from public.shop_order_items i where i.order_id = o.id)
  ) end
  from (select 1) one
  left join public.shop_orders o on o.stripe_session_id = p_session and p_session ~ '^cs_(test|live)_[A-Za-z0-9]{10,200}$';
$$;

-- ---------------------------------------------------------------- function privileges

-- Supabase grants EXECUTE on new public functions to anon and authenticated by default.
-- Take it all back, then grant exactly what each role needs.
do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'shop\_%' or p.proname = 'is_shop_admin') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

grant execute on function public.shop_catalog() to anon, authenticated;
grant execute on function public.shop_order_status(text) to anon, authenticated;
grant execute on function public.is_shop_admin() to authenticated;

-- service_role (Edge Functions) needs the tables too; it bypasses RLS.
grant select, insert, update, delete on public.shop_admins, public.shop_settings, public.shop_products,
  public.shop_shipping_rates, public.shop_tax_rates, public.shop_orders, public.shop_order_items,
  public.shop_order_events, public.shop_inventory_log, public.shop_stripe_events, public.shop_entitlements,
  public.shop_email_log
  to service_role;

-- ---------------------------------------------------------------- catalog

-- Facts from src/config.ts and the Etsy listing images (design/etsy-listing/ 07, 08).
insert into public.shop_products (slug, name, description, details, price_cents, weeks, images, active, stock, max_per_order, sort)
values
  ('calendar-26-week',
   '26-Week Family Wall Calendar',
   'The 2027 Family Wall Calendar & Organizer: one week per page, with room for the daily schedule, meal plan, grocery list, to-dos and each day’s cleaning zone. Comes with the free cleaning companion website.',
   array['26 weeks, double-sided weekly pages', '11 × 17 inches, portrait', 'Wire-O top binding with a built-in hanging hole',
         'Premium uncoated writing paper', 'Includes the free cleaning companion website (no account, no subscription)'],
   3400, 26,
   '[{"src":"/images/reorder/calendar-in-use-1280.webp","alt":"The family wall calendar filled in for the week."},
     {"src":"/images/site/calendar-specs-1280.webp","alt":"The blank calendar page, 11 by 17 inches, beside its details: premium uncoated writing paper, Wire-O binding, built-in hanging hole, double-sided weekly pages, 26 weeks."},
     {"src":"/images/site/calendar-on-wall-1280.webp","alt":"The calendar hanging on a wall from its spiral binding, open to the first week of January 2027."}]',
   true, 25, 5, 1),
  ('calendar-52-week',
   '52-Week Family Wall Calendar',
   'A full year of the 2027 Family Wall Calendar & Organizer, shipped as two 26-week sets. Comes with the free cleaning companion website.',
   array['52 weeks, shipped as two 26-week sets', '11 × 17 inches, portrait', 'Wire-O top binding with a built-in hanging hole',
         'Premium uncoated writing paper', 'Includes the free cleaning companion website (no account, no subscription)'],
   5400, 52,
   '[{"src":"/images/site/calendar-sets-1280.webp","alt":"A full year as two 26-week sets, January to June and July to December, each month in its own soft color."}]',
   false, 0, 5, 2);

-- PLACEHOLDER rate so checkout can be tested. Confirm (or replace) before launch.
insert into public.shop_shipping_rates (label, amount_cents, sort) values ('Standard shipping', 600, 1);
