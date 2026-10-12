-- Direct website shop: digital products (downloads). Runs after 20261011000000_shop_launch_prep.sql;
-- keeps every order, product, stock count, email log, survey row and admin.
--
--   * A product is 'physical' (the calendars: stock, shipping) or 'digital' (a download: no
--     stock, no shipping, no address). A cart is one or the other, never both.
--   * The files live in a PRIVATE Supabase Storage bucket, `shop-downloads`. Nothing in it is
--     public: the shop-download Edge Function hands out short-lived signed links, and only to
--     someone holding a valid download token.
--   * Paying for a digital order records a 'download' entitlement with a random token that
--     works for DOWNLOAD_DAYS (7). The confirmation email carries the link. A full refund
--     revokes it (as before for every entitlement). From the dashboard, "Send a new download
--     link" replaces the token (the old link stops working) and emails the new one.
--   * Digital orders are fulfilled at payment (fulfillment_status 'delivered'): they never show
--     as waiting to ship, can't be marked shipped, and never touch stock.
--
-- Supabase dashboard → SQL Editor → paste this whole file → Run, once. A second run stops at
-- the first statement and changes nothing (the editor runs a pasted script as one transaction).

-- ---------------------------------------------------------------- columns

alter table public.shop_products
  add column kind text not null default 'physical' check (kind in ('physical', 'digital')),
  -- Digital only: the files in the shop-downloads bucket, [{ "path": "folder/file.pdf", "label": "…" }].
  add column files jsonb not null default '[]' check (jsonb_typeof(files) = 'array'),
  -- Stripe Tax product code for this product; empty = the store default (settings.product_tax_code).
  add column tax_code text check (tax_code ~ '^txcd_[0-9]{8}$');

alter table public.shop_orders
  -- Every item is a download: nothing to ship.
  add column digital boolean not null default false;

alter table public.shop_entitlements drop constraint shop_entitlements_kind_check;
alter table public.shop_entitlements
  add constraint shop_entitlements_kind_check check (kind in ('companion', 'download')),
  -- 'download' only: the secret in the emailed link, when it stops working, and how often it was used.
  add column token text unique check (token ~ '^[0-9a-f]{48}$'),
  add column expires_at timestamptz,
  add column downloads int not null default 0;

alter table public.shop_email_log drop constraint shop_email_log_kind_check;
alter table public.shop_email_log
  add constraint shop_email_log_kind_check check (kind in ('confirmation', 'shipped', 'refund', 'access', 'download'));

-- The private bucket for the files (on a Supabase project; the local test database has no Storage).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('shop-downloads', 'shop-downloads', false) on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------- helpers

-- How long a download link works. Customers can ask for a new one; the dashboard sends it.
create function public.shop_download_days() returns int language sql immutable as $$ select 7 $$;

create function public.shop_new_token() returns text
language sql volatile security definer set search_path = '' as $$
  select encode(extensions.gen_random_bytes(24), 'hex');
$$;

-- As before, but only physical products go back into stock (downloads never left it).
create or replace function public.shop_release_hold(p_order uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  it record;
begin
  update public.shop_orders set reservation = 'released', updated_at = now()
   where id = p_order and reservation = 'held';
  if not found then
    return false;
  end if;
  for it in select i.product_id, sum(i.quantity) q
              from public.shop_order_items i join public.shop_products p on p.id = i.product_id and p.kind = 'physical'
             where i.order_id = p_order group by i.product_id loop
    update public.shop_products set stock = stock + it.q, updated_at = now() where id = it.product_id;
  end loop;
  return true;
end $$;

-- ---------------------------------------------------------------- checkout

-- As in 20261011000000_shop_launch_prep.sql, plus digital products: no stock taken, no shipping
-- (and no shipping rate needed), and a cart can't mix downloads with calendars (mixed_cart).
-- Items carry their Stripe tax code; the result says whether the order is digital.
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
  rates jsonb := '[]';
  has_digital boolean := false;
  has_physical boolean := false;
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

  -- Which kind of order this is, decided before anything is taken.
  select coalesce(bool_or(p2.kind = 'digital'), false), coalesce(bool_or(p2.kind = 'physical'), false)
    into has_digital, has_physical
    from jsonb_array_elements(cart) c join public.shop_products p2 on p2.slug = c ->> 'slug';
  if has_digital and has_physical then
    raise exception 'mixed_cart';
  end if;

  -- Placeholder (test-only) rates never reach a real-money checkout; with none left, a calendar
  -- checkout stays shut. Downloads need no shipping.
  if not has_digital
     and not exists (select 1 from public.shop_shipping_rates r where r.active and (not r.test_only or not coalesce(p_livemode, true))) then
    raise exception 'shipping_not_configured';
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
    if p.kind = 'physical' then
      -- The atomic take: waits for any concurrent checkout on this row, then re-checks stock.
      update public.shop_products set stock = stock - line.q, updated_at = now()
       where id = p.id and active and stock >= line.q
       returning * into p;
      if not found then
        raise exception 'sold_out:%', line.slug;
      end if;
      units := units + p.ship_units * line.q;
    end if;
    subtotal := subtotal + p.price_cents * line.q;
    items := items || jsonb_build_object(
      'product_id', p.id, 'slug', p.slug, 'name', p.name, 'edition', p.edition, 'description', p.description,
      'unit_price_cents', p.price_cents, 'quantity', line.q, 'image', p.images -> 0 ->> 'src',
      'kind', p.kind, 'tax_code', coalesce(p.tax_code, s.product_tax_code));
  end loop;

  if has_physical then
    -- No rate covers this many shipping units: the whole call (and the stock taken above) rolls back.
    rates := public.shop_shipping_quote(units, subtotal, p_livemode);
    if jsonb_array_length(rates) = 0 then
      raise exception 'shipping_unavailable';
    end if;
  end if;

  insert into public.shop_orders (id, subtotal_cents, reservation_expires_at, digital)
  values (order_id, subtotal, now() + make_interval(mins => s.checkout_minutes + 10), not has_physical);
  insert into public.shop_order_items (order_id, product_id, product_slug, product_name, unit_price_cents, quantity)
  select order_id, (i ->> 'product_id')::uuid, i ->> 'slug',
         case when i ->> 'edition' is null then i ->> 'name' else (i ->> 'name') || ' (' || (i ->> 'edition') || ')' end,
         (i ->> 'unit_price_cents')::int, (i ->> 'quantity')::int
    from jsonb_array_elements(items) i;
  perform public.shop_event(order_id, 'checkout_started', jsonb_build_object('subtotal_cents', subtotal, 'ship_units', units, 'digital', not has_physical));

  return jsonb_build_object(
    'order_id', order_id,
    'digital', not has_physical,
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

-- ---------------------------------------------------------------- payment

-- As in 20261010000000_shop.sql, plus digital orders: a late payment never takes stock for a
-- download, the order is fulfilled at once ('delivered'), and the entitlement is a download
-- token (instead of the companion, which comes with the calendar).
create or replace function public.shop_mark_paid(p_session text, p jsonb) returns jsonb
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

  if p ->> 'order_id' is distinct from o.id::text
     or (p ->> 'subtotal_cents')::int is distinct from o.subtotal_cents
     or lower(p ->> 'currency') is distinct from o.currency then
    new_flags := array_append(new_flags, 'amount_mismatch');
  end if;
  if (p ->> 'livemode')::boolean is distinct from o.livemode then
    new_flags := array_append(new_flags, 'mode_mismatch');
  end if;

  if o.reservation = 'held' then
    update public.shop_orders set reservation = 'converted' where id = o.id;
  else
    -- Paid after the hold was released (very late webhook): take the stock again if it's there.
    for it in select i.product_id, sum(i.quantity) q
                from public.shop_order_items i join public.shop_products pr on pr.id = i.product_id and pr.kind = 'physical'
               where i.order_id = o.id group by i.product_id loop
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
    shipping_name = case when digital then null else p ->> 'shipping_name' end,
    shipping_address = case when digital then null else p -> 'shipping_address' end,
    shipping_method = case when digital then null else p ->> 'shipping_method' end,
    promotion_code = p ->> 'promotion_code',
    discount_cents = coalesce((p ->> 'discount_cents')::int, 0),
    shipping_cents = coalesce((p ->> 'shipping_cents')::int, 0),
    tax_cents = coalesce((p ->> 'tax_cents')::int, 0),
    total_cents = (p ->> 'total_cents')::int,
    fulfillment_status = case when digital then 'delivered' else fulfillment_status end,
    delivered_at = case when digital then coalesce(delivered_at, now()) else delivered_at end,
    flags = coalesce((select array_agg(distinct f order by f) from unnest(flags || new_flags) f), '{}'),
    updated_at = now()
  where id = o.id
  returning * into o;

  if o.email is not null then
    if o.digital then
      insert into public.shop_entitlements (email, order_id, kind, token, expires_at)
      values (lower(o.email), o.id, 'download', public.shop_new_token(), now() + make_interval(days => public.shop_download_days()))
      on conflict (order_id, kind) do nothing;
    else
      insert into public.shop_entitlements (email, order_id) values (lower(o.email), o.id) on conflict (order_id, kind) do nothing;
    end if;
  end if;
  perform public.shop_event(o.id, 'paid', jsonb_build_object('total_cents', o.total_cents, 'flags', new_flags), 'stripe');
  return jsonb_build_object('found', true, 'transitioned', true, 'order_id', o.id, 'order_number', o.order_number, 'flags', new_flags);
end $$;

-- ---------------------------------------------------------------- downloads (service role)

-- The shop-download Edge Function calls this with the token from the emailed link. Returns the
-- files to sign, or raises: invalid_link, link_expired, access_revoked, rate_limited.
create function public.shop_download(p_token text, p_client text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.shop_entitlements%rowtype;
  o public.shop_orders%rowtype;
  client_key text;
begin
  -- Guessing tokens is hopeless (192 bits), but cap tries per connection anyway.
  client_key := encode(extensions.digest(coalesce(p_client, 'unknown') || current_date::text || (select salt from public.shop_secret), 'sha256'), 'hex');
  if not public.shop_allow(client_key, 'download', 60, interval '1 hour') then
    raise exception 'rate_limited';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    raise exception 'invalid_link';
  end if;
  select * into e from public.shop_entitlements where token = p_token and kind = 'download' for update;
  if not found then
    raise exception 'invalid_link';
  end if;
  select * into o from public.shop_orders where id = e.order_id;
  if e.revoked_at is not null or o.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'access_revoked';
  end if;
  if e.expires_at is null or e.expires_at < now() then
    raise exception 'link_expired';
  end if;
  update public.shop_entitlements set downloads = downloads + 1 where id = e.id;
  if e.downloads = 0 then
    perform public.shop_event(o.id, 'downloaded', '{}', 'customer');
  end if;
  return jsonb_build_object(
    'order_number', o.order_number,
    'livemode', o.livemode,
    'expires_at', e.expires_at,
    'files', coalesce((select jsonb_agg(x.value || jsonb_build_object('product', i.product_name) order by i.product_name, x.ordinality)
                         from public.shop_order_items i
                         join public.shop_products p on p.id = i.product_id and p.kind = 'digital'
                         cross join lateral jsonb_array_elements(p.files) with ordinality x
                        where i.order_id = o.id), '[]'));
end $$;

-- "Send a new download link": a fresh token (the old link stops working) good for another
-- DOWNLOAD_DAYS. Refused once the order is fully refunded. Returns the new token.
create function public.shop_renew_download(p_order uuid, p_actor text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.shop_orders%rowtype;
  e public.shop_entitlements%rowtype;
begin
  select * into o from public.shop_orders where id = p_order;
  if not found then
    raise exception 'not_found';
  end if;
  if not o.digital then
    raise exception 'not_digital';
  end if;
  if o.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'not_payable_state';
  end if;
  if o.email is null then
    raise exception 'no_email';
  end if;
  insert into public.shop_entitlements (email, order_id, kind, token, expires_at)
  values (lower(o.email), o.id, 'download', public.shop_new_token(), now() + make_interval(days => public.shop_download_days()))
  on conflict (order_id, kind) do update
    set token = excluded.token, expires_at = excluded.expires_at, revoked_at = null, revoked_reason = null
  returning * into e;
  perform public.shop_event(o.id, 'download_link_renewed', jsonb_build_object('expires_at', e.expires_at), p_actor);
  return jsonb_build_object('order_id', o.id, 'token', e.token, 'expires_at', e.expires_at);
end $$;

-- ---------------------------------------------------------------- fulfillment and inventory

-- As in 20261011000000_shop_launch_prep.sql, but digital orders can't be shipped (digital_order).
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
  if o.digital then
    raise exception 'digital_order';
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

-- As in 20261010000000_shop.sql, but downloads are never "returned to stock".
create or replace function public.shop_restock_order(p_order uuid, p_actor text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  it record;
  n int := 0;
  p public.shop_products%rowtype;
begin
  if not exists (select 1 from public.shop_orders where id = p_order and reservation = 'converted') then
    return 0;
  end if;
  for it in select i.* from public.shop_order_items i join public.shop_products pr on pr.id = i.product_id and pr.kind = 'physical'
             where i.order_id = p_order and i.restocked < i.quantity for update of i loop
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

-- As in 20261011000000_shop_launch_prep.sql, but a download line has nothing to return (0).
create or replace function public.shop_restock_units(p_item uuid, p_units int, p_actor text) returns int
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
  if o.reservation <> 'converted' or exists (select 1 from public.shop_products where id = it.product_id and kind = 'digital') then
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

-- As before, plus a digital product's files and its tax code.
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
    files = coalesce(p -> 'files', files),
    tax_code = case when p ? 'tax_code' then nullif(btrim(p ->> 'tax_code'), '') else tax_code end,
    sort = coalesce((p ->> 'sort')::int, sort),
    updated_at = now()
  where id = p_product;
  if not found then
    raise exception 'not_found';
  end if;
end $$;

-- ---------------------------------------------------------------- public API (anon)

-- As before, plus each product's kind. A download is always available (no stock), one per order.
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
        'kind', p.kind,
        'ship_units', p.ship_units,
        'available', p.kind = 'digital' or p.stock > 0,
        'max_quantity', case when p.kind = 'digital' then p.max_per_order else least(p.stock, p.max_per_order) end
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

-- As before, plus whether the order is a download (the confirmation page words it differently).
create or replace function public.shop_order_status(p_session text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when o.id is null then null else jsonb_build_object(
    'payment_status', o.payment_status,
    'fulfillment_status', o.fulfillment_status,
    'order_number', o.order_number,
    'digital', o.digital,
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
  left join public.shop_orders o on o.stripe_session_id = p_session
        and p_session ~ '^cs_(test|live)_[A-Za-z0-9]{10,200}$'
        and o.created_at > now() - interval '30 days';
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

-- ---------------------------------------------------------------- catalog

-- The Weekly Reset System, the $9 download sold at /weekly-reset. Upload its three files to the
-- shop-downloads bucket at exactly these paths (supabase/SHOP.md → Digital products).
-- tax_code txcd_10000000 is Stripe's general code for electronically supplied services:
-- CONFIRM it with your accountant before turning on Stripe Tax (Dashboard → Inventory).
insert into public.shop_products (slug, name, description, details, price_cents, images, active, stock, max_per_order, includes_companion,
                                  ship_units, kind, files, tax_code, sort)
values
  ('weekly-reset-system',
   'The Weekly Reset System',
   'End Sunday night chaos in 30 minutes: the Weekly Command Center, the 30-Minute Daily Tidy System and a personal coaching audio. Instant download.',
   array['The Weekly Command Center (digital + print-ready)', 'The 30-Minute Daily Tidy System (step-by-step guide)',
         'Personal coaching audio (real mom voice, not AI)'],
   900,
   '[{"src":"/images/weekly-reset/bundle.webp","alt":"The Weekly Reset System: the Weekly Command Center planner page, the 30-Minute Daily Tidy System guide, and the coaching audio playing on a phone."}]',
   true, 0, 1, false, 1, 'digital',
   '[{"path":"weekly-reset/weekly-command-center.pdf","label":"The Weekly Command Center (printable PDF)"},
     {"path":"weekly-reset/weekly-command-center-editable.pdf","label":"The Weekly Command Center (fillable PDF: type in it on your computer)"},
     {"path":"weekly-reset/30-minute-daily-tidy-system.pdf","label":"The 30-Minute Daily Tidy System (PDF)"},
     {"path":"weekly-reset/weekly-reset-coaching-audio.mp3","label":"Personal Coaching Audio (MP3)"}]',
   'txcd_10000000', 10);
