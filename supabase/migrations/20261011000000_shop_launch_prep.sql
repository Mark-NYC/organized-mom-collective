-- Direct website shop, launch preparation. Runs after 20261010000000_shop.sql; changes nothing
-- in it, keeps every order, product, stock count, email log, survey row and admin.
--
--   * Shipping: per-product shipping units (the 52-week calendar is two 26-week sets = 2),
--     rates with a price for the first unit plus each extra unit, a units range (e.g. a
--     "1 calendar" rate and a "2+ calendars" rate) and an optional free-shipping threshold.
--     The quote is computed here, in the database, for the exact cart.
--   * Tax: a real-money checkout needs the tax setting to have been saved deliberately
--     (tax_reviewed), and never runs in "manual" mode (one rate per state can't express
--     New York's local rates or the tax on shipping). Stripe Tax ("automatic") or a
--     deliberate "off".
--   * Fulfillment: saving the same status and tracking again is a no-op (no timeline entry,
--     no email). The result says what changed, so the function only emails on a change.
--   * Inventory: return a chosen number of a refunded order's units to stock (never more than
--     were sold, never twice).
--
-- Supabase dashboard → SQL Editor → paste this whole file → Run, once. A second run stops at
-- the first statement and changes nothing (the editor runs a pasted script as one transaction).

-- ---------------------------------------------------------------- columns

alter table public.shop_settings
  -- Set when an admin saves the tax setting. Real-money checkouts need it (shop_create_order).
  add column tax_reviewed boolean not null default false;

alter table public.shop_products
  -- How many "calendars' worth" of shipping one unit takes. 26-week = 1, 52-week (two sets) = 2.
  add column ship_units int not null default 1 check (ship_units between 1 and 20);

update public.shop_products set ship_units = 2 where slug = 'calendar-52-week';

alter table public.shop_shipping_rates
  -- amount_cents is the price for the first shipping unit; each further unit adds this.
  add column per_extra_unit_cents int not null default 0 check (per_extra_unit_cents between 0 and 100000),
  -- Offered only for carts of min_units..max_units shipping units (max empty = no limit).
  add column min_units int not null default 1 check (min_units between 1 and 100),
  add column max_units int check (max_units between 1 and 100),
  -- Free when the cart subtotal (before discount codes) is at least this. Empty = never.
  add column free_over_cents int check (free_over_cents between 1 and 10000000),
  add constraint shop_shipping_rates_units check (max_units is null or max_units >= min_units);

-- ---------------------------------------------------------------- shipping quote

-- The rates offered for a cart of p_units shipping units and p_subtotal cents, with the
-- amount each one charges. Test-only placeholders only when p_livemode is false.
create function public.shop_shipping_quote(p_units int, p_subtotal int, p_livemode boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(q order by q.sort, q.amount_cents), '[]')
    from (select r.id, r.label, r.min_days, r.max_days, r.sort, r.test_only,
                 case when r.free_over_cents is not null and p_subtotal >= r.free_over_cents then 0
                      else r.amount_cents + r.per_extra_unit_cents * greatest(p_units - 1, 0) end amount_cents
            from public.shop_shipping_rates r
           where r.active
             and (not r.test_only or not coalesce(p_livemode, true))
             and p_units >= r.min_units
             and (r.max_units is null or p_units <= r.max_units)) q;
$$;

-- ---------------------------------------------------------------- checkout

-- As in 20261010000000_shop.sql, plus: the tax gate for real money, shipping quoted for the
-- cart's shipping units, and the error shipping_unavailable when no rate covers the cart.
create or replace function public.shop_create_order(p_items jsonb, p_client text, p_preview boolean, p_livemode boolean, p_public_allowed boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.shop_settings%rowtype;
  cart jsonb;
  line record;
  p public.shop_products%rowtype;
  order_id uuid := gen_random_uuid();
  subtotal int := 0;
  units int := 0;
  items jsonb := '[]';
  client_key text;
  rates jsonb;
begin
  select * into s from public.shop_settings;
  -- The launch gate. Preview never takes real money; public checkout needs both switches.
  if s.checkout_mode = 'off'
     or (s.checkout_mode = 'preview' and (not coalesce(p_preview, false) or coalesce(p_livemode, true)))
     or (s.checkout_mode = 'live' and not coalesce(p_public_allowed, false)) then
    raise exception 'checkout_closed';
  end if;

  -- Real money only once the tax setting was chosen on purpose, and never with manual rates.
  if coalesce(p_livemode, true) and (not s.tax_reviewed or s.tax_mode = 'manual') then
    raise exception 'tax_not_configured';
  end if;

  -- Placeholder (test-only) rates never reach a real-money checkout; with none left, it stays shut.
  if not exists (select 1 from public.shop_shipping_rates r where r.active and (not r.test_only or not coalesce(p_livemode, true))) then
    raise exception 'shipping_not_configured';
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
    units := units + p.ship_units * line.q;
    items := items || jsonb_build_object(
      'product_id', p.id, 'slug', p.slug, 'name', p.name, 'edition', p.edition, 'description', p.description,
      'unit_price_cents', p.price_cents, 'quantity', line.q, 'image', p.images -> 0 ->> 'src');
  end loop;

  -- No rate covers this many shipping units: the whole call (and the stock taken above) rolls back.
  rates := public.shop_shipping_quote(units, subtotal, p_livemode);
  if jsonb_array_length(rates) = 0 then
    raise exception 'shipping_unavailable';
  end if;

  insert into public.shop_orders (id, subtotal_cents, reservation_expires_at)
  values (order_id, subtotal, now() + make_interval(mins => s.checkout_minutes + 10));
  insert into public.shop_order_items (order_id, product_id, product_slug, product_name, unit_price_cents, quantity)
  select order_id, (i ->> 'product_id')::uuid, i ->> 'slug',
         case when i ->> 'edition' is null then i ->> 'name' else (i ->> 'name') || ' (' || (i ->> 'edition') || ')' end,
         (i ->> 'unit_price_cents')::int, (i ->> 'quantity')::int
    from jsonb_array_elements(items) i;
  perform public.shop_event(order_id, 'checkout_started', jsonb_build_object('subtotal_cents', subtotal, 'ship_units', units));

  return jsonb_build_object(
    'order_id', order_id,
    'subtotal_cents', subtotal,
    'checkout_minutes', s.checkout_minutes,
    'tax_mode', s.tax_mode,
    'product_tax_code', s.product_tax_code,
    'items', items,
    'shipping_rates', rates,
    'tax_rates', coalesce((select jsonb_agg(to_jsonb(t) order by t.state)
                             from public.shop_tax_rates t where t.active and s.tax_mode = 'manual'), '[]')
  );
end $$;

-- ---------------------------------------------------------------- fulfillment

-- As before, but a save that changes nothing (same status, carrier, tracking number and link)
-- records nothing. Returns what changed so the caller only emails the customer on a change.
create or replace function public.shop_set_fulfillment(p_order uuid, p_status text, p_carrier text, p_tracking text, p_tracking_url text, p_actor text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.shop_orders%rowtype;
  n public.shop_orders%rowtype;
  status_changed boolean;
  tracking_changed boolean;
begin
  if p_status is null or p_status not in ('unfulfilled', 'packing', 'shipped', 'delivered') then
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

  n := o;
  n.fulfillment_status := p_status;
  n.carrier := coalesce(nullif(btrim(p_carrier), ''), o.carrier);
  n.tracking_number := coalesce(nullif(btrim(p_tracking), ''), o.tracking_number);
  n.tracking_url := coalesce(nullif(btrim(p_tracking_url), ''), o.tracking_url);
  status_changed := n.fulfillment_status is distinct from o.fulfillment_status;
  tracking_changed := n.carrier is distinct from o.carrier
                      or n.tracking_number is distinct from o.tracking_number
                      or n.tracking_url is distinct from o.tracking_url;
  if not status_changed and not tracking_changed then
    return jsonb_build_object('order_id', o.id, 'from', o.fulfillment_status, 'to', p_status,
                              'changed', false, 'status_changed', false, 'tracking_changed', false);
  end if;

  update public.shop_orders set
    fulfillment_status = n.fulfillment_status,
    carrier = n.carrier,
    tracking_number = n.tracking_number,
    tracking_url = n.tracking_url,
    shipped_at = case when p_status in ('shipped', 'delivered') then coalesce(shipped_at, now()) else shipped_at end,
    delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
    updated_at = now()
  where id = o.id;
  perform public.shop_event(o.id, 'fulfillment', jsonb_build_object(
    'from', o.fulfillment_status, 'to', p_status, 'carrier', n.carrier, 'tracking_number', n.tracking_number,
    'tracking_changed', tracking_changed,
    'previous_tracking_number', case when tracking_changed then o.tracking_number end,
    'previous_carrier', case when tracking_changed then o.carrier end), p_actor);
  return jsonb_build_object('order_id', o.id, 'from', o.fulfillment_status, 'to', p_status,
                            'changed', true, 'status_changed', status_changed, 'tracking_changed', tracking_changed);
end $$;

-- ---------------------------------------------------------------- inventory

-- Returns up to p_units of one refunded order line to stock. Never more than were sold, never
-- the same unit twice (the line's restocked count is locked and checked). Returns units moved.
create function public.shop_restock_units(p_item uuid, p_units int, p_actor text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  it public.shop_order_items%rowtype;
  o public.shop_orders%rowtype;
  p public.shop_products%rowtype;
  n int;
begin
  if p_units is null or p_units < 1 then
    raise exception 'invalid_amount';
  end if;
  select * into it from public.shop_order_items where id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into o from public.shop_orders where id = it.order_id;
  if o.payment_status not in ('refunded', 'partially_refunded') then
    raise exception 'refund_first';
  end if;
  if o.reservation <> 'converted' then
    return 0;
  end if;
  n := least(p_units, it.quantity - it.restocked);
  if n <= 0 then
    return 0;
  end if;
  update public.shop_order_items set restocked = restocked + n where id = it.id;
  update public.shop_products set stock = stock + n, updated_at = now() where id = it.product_id returning * into p;
  insert into public.shop_inventory_log (product_id, delta, stock_after, reason, actor, order_id)
  values (it.product_id, n, p.stock, 'Returned to stock after refund', p_actor, it.order_id);
  perform public.shop_event(it.order_id, 'restocked', jsonb_build_object('units', n, 'item', it.product_name), p_actor);
  return n;
end $$;

-- ---------------------------------------------------------------- dashboard settings

-- As before, plus ship_units.
create or replace function public.shop_update_product(p_product uuid, p jsonb) returns void
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
    ship_units = coalesce((p ->> 'ship_units')::int, ship_units),
    sort = coalesce((p ->> 'sort')::int, sort),
    updated_at = now()
  where id = p_product;
  if not found then
    raise exception 'not_found';
  end if;
end $$;

-- As before, but manual tax rates can't be chosen any more, and saving the tax setting marks
-- it as reviewed (a real-money checkout needs that).
create or replace function public.shop_update_settings(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p ->> 'tax_mode' = 'manual' then
    raise exception 'manual_tax_disabled';
  end if;
  update public.shop_settings set
    checkout_mode = coalesce(p ->> 'checkout_mode', checkout_mode),
    tax_mode = coalesce(p ->> 'tax_mode', tax_mode),
    tax_reviewed = tax_reviewed or p ? 'tax_mode',
    product_tax_code = coalesce(p ->> 'product_tax_code', product_tax_code),
    checkout_minutes = coalesce((p ->> 'checkout_minutes')::int, checkout_minutes),
    max_checkouts_per_hour = coalesce((p ->> 'max_checkouts_per_hour')::int, max_checkouts_per_hour),
    updated_at = now();
end $$;

-- As before, plus the per-extra-unit price, the units range and the free-shipping threshold.
create or replace function public.shop_save_shipping_rate(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid := nullif(p ->> 'id', '')::uuid;
begin
  if rid is null then
    insert into public.shop_shipping_rates (label, amount_cents, min_days, max_days, active, test_only, sort,
                                            per_extra_unit_cents, min_units, max_units, free_over_cents)
    values (p ->> 'label', (p ->> 'amount_cents')::int, (p ->> 'min_days')::int, (p ->> 'max_days')::int,
            coalesce((p ->> 'active')::boolean, true), coalesce((p ->> 'test_only')::boolean, false), coalesce((p ->> 'sort')::int, 0),
            coalesce((p ->> 'per_extra_unit_cents')::int, 0), coalesce((p ->> 'min_units')::int, 1),
            (p ->> 'max_units')::int, (p ->> 'free_over_cents')::int)
    returning id into rid;
  else
    update public.shop_shipping_rates set
      label = coalesce(p ->> 'label', label),
      amount_cents = coalesce((p ->> 'amount_cents')::int, amount_cents),
      min_days = case when p ? 'min_days' then (p ->> 'min_days')::int else min_days end,
      max_days = case when p ? 'max_days' then (p ->> 'max_days')::int else max_days end,
      active = coalesce((p ->> 'active')::boolean, active),
      test_only = coalesce((p ->> 'test_only')::boolean, test_only),
      sort = coalesce((p ->> 'sort')::int, sort),
      per_extra_unit_cents = coalesce((p ->> 'per_extra_unit_cents')::int, per_extra_unit_cents),
      min_units = coalesce((p ->> 'min_units')::int, min_units),
      max_units = case when p ? 'max_units' then (p ->> 'max_units')::int else max_units end,
      free_over_cents = case when p ? 'free_over_cents' then (p ->> 'free_over_cents')::int else free_over_cents end
    where id = rid;
    if not found then
      raise exception 'not_found';
    end if;
  end if;
  return rid;
end $$;

-- ---------------------------------------------------------------- public API (anon)

-- As before, plus each product's shipping units and each rate's pricing rules, so /checkout can
-- show the shipping for the chosen quantity. (The amount charged is computed at checkout.)
create or replace function public.shop_catalog() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'checkout_mode', (select checkout_mode from public.shop_settings),
    'tax_mode', (select tax_mode from public.shop_settings),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'name', p.name, 'edition', p.edition, 'description', p.description, 'details', to_jsonb(p.details),
        'price_cents', p.price_cents, 'currency', p.currency, 'weeks', p.weeks, 'images', p.images,
        'includes_companion', p.includes_companion,
        'ship_units', p.ship_units,
        'available', p.stock > 0,
        'max_quantity', least(p.stock, p.max_per_order)
      ) order by p.sort, p.price_cents)
      from public.shop_products p where p.active), '[]'),
    'shipping_rates', coalesce((
      select jsonb_agg(jsonb_build_object('label', r.label, 'amount_cents', r.amount_cents, 'test_only', r.test_only,
                                          'per_extra_unit_cents', r.per_extra_unit_cents, 'min_units', r.min_units,
                                          'max_units', r.max_units, 'free_over_cents', r.free_over_cents)
                       order by r.sort, r.amount_cents)
      from public.shop_shipping_rates r where r.active), '[]')
  );
$$;

-- ---------------------------------------------------------------- function privileges

-- Same rule as the first migration: nothing new is callable from the browser.
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

