/**
 * Direct shop: pure logic and launch guards. Runs in `npm test` with no database.
 * The full flow (database, webhooks, concurrency, refunds, access control) is in
 * tests/shop-e2e.test.ts (`npm run test:shop`).
 */
import { describe, expect, it } from 'vitest';
import { checkoutError, paidOrderData, parseCart, sessionParams, isPaidSession, type ReservedOrder } from '../supabase/functions/_shared/checkout.ts';
import type { OrderRow as ServerOrder } from '../supabase/functions/_shared/db.ts';
import { renderEmail, trackingLink } from '../supabase/functions/_shared/email.ts';
import { readEnv } from '../supabase/functions/_shared/env.ts';
import { formEncode, signStripePayload, stripeMode, verifyStripeSignature } from '../supabase/functions/_shared/stripe.ts';
import { describeEvent, filterOrders, heldUnits, money, ordersCsv, salesTotals, soldUnits, type OrderRow } from '../src/lib/shop';
import { routes } from '../src/routes';

import envExample from '../.env.example?raw';
import { DASHBOARD_FUNCTIONS, bundle } from '../scripts/build-dashboard-functions.mjs';

// Source files as text, keyed like '../src/pages/x.astro'.
const files = {
  ...import.meta.glob<string>('../src/**/*.{ts,tsx,astro}', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }),
};
const read = (p: string) => {
  if (p === '.env.example') return envExample;
  const text = files[`../${p}`];
  if (text === undefined) throw new Error(`not loaded: ${p}`);
  return text;
};

describe('Stripe client', () => {
  it('form-encodes nested params the way Stripe expects', () => {
    const body = formEncode({ a: 1, b: { c: [{ d: 'x' }, { d: 'y' }] }, skip: undefined, n: null, t: true });
    expect(decodeURIComponent(body)).toBe('a=1&b[c][0][d]=x&b[c][1][d]=y&t=true');
  });

  it('tells test keys from live keys', () => {
    expect(stripeMode('sk_test_123')).toBe('test');
    expect(stripeMode('rk_test_123')).toBe('test');
    expect(stripeMode('sk_live_123')).toBe('live');
    expect(stripeMode('rk_live_123')).toBe('live');
  });

  it('verifies webhook signatures: right secret, untampered body, fresh timestamp', async () => {
    const body = '{"id":"evt_1"}';
    const now = 1_800_000_000;
    const header = await signStripePayload(body, 'whsec_a', now);
    expect(await verifyStripeSignature(body, header, 'whsec_a', now)).toBe(true);
    expect(await verifyStripeSignature(body, header, 'whsec_b', now)).toBe(false);
    expect(await verifyStripeSignature(body + ' ', header, 'whsec_a', now)).toBe(false);
    expect(await verifyStripeSignature(body, header, 'whsec_a', now + 301)).toBe(false);
    expect(await verifyStripeSignature(body, null, 'whsec_a', now)).toBe(false);
    expect(await verifyStripeSignature(body, header, '', now)).toBe(false);
    // Stripe may send several v1 signatures while a secret is being rolled.
    const [t, v1] = header.split(',');
    expect(await verifyStripeSignature(body, `${t},v1=deadbeef,${v1}`, 'whsec_a', now)).toBe(true);
  });
});

describe('checkout logic', () => {
  const order: ReservedOrder = {
    order_id: '3f1c2a4e-0000-4000-8000-000000000001',
    subtotal_cents: 6800,
    checkout_minutes: 30,
    tax_mode: 'off',
    product_tax_code: 'txcd_99999999',
    items: [{ product_id: 'p', slug: 'calendar-26-week', name: '26-Week Family Wall Calendar', edition: null, unit_price_cents: 3400, quantity: 2, image: '/images/x.webp' }],
    shipping_rates: [{ id: 'r', label: 'Standard shipping', amount_cents: 600, min_days: null, max_days: null }],
    tax_rates: [],
  };

  it('builds an embedded, guest, US-shipping checkout from server prices', () => {
    const p = sessionParams(order, { siteUrl: 'https://organizedmomcollective.com', nowSeconds: 1000, taxRateIds: [] });
    expect(p).toMatchObject({
      mode: 'payment',
      ui_mode: 'embedded',
      customer_creation: 'if_required',
      allow_promotion_codes: true,
      payment_method_types: ['card'],
      shipping_address_collection: { allowed_countries: ['US'] },
      automatic_tax: { enabled: false },
      expires_at: 1000 + 1800,
      metadata: { order_id: order.order_id },
      client_reference_id: order.order_id,
    });
    expect(p.return_url).toBe('https://organizedmomcollective.com/checkout/complete?session_id={CHECKOUT_SESSION_ID}');
    expect(p.line_items[0]).toMatchObject({ quantity: 2, price_data: { unit_amount: 3400, currency: 'usd' } });
    expect(p.line_items[0].price_data.product_data.images).toEqual(['https://organizedmomcollective.com/images/x.webp']);
    expect(p.shipping_options[0].shipping_rate_data.delivery_estimate).toBeUndefined();
  });

  it('reads completed sessions from both the current and older Stripe API shapes', () => {
    const base = {
      id: 'cs_test_abc',
      status: 'complete',
      payment_status: 'paid',
      metadata: { order_id: 'o1' },
      amount_subtotal: 3400,
      amount_total: 4000,
      payment_intent: 'pi_1',
      customer_details: { email: 'a@b.co', name: 'A B' },
      total_details: { amount_discount: 0, amount_shipping: 600, amount_tax: 0 },
      shipping_cost: { amount_total: 600, shipping_rate: { display_name: 'Standard shipping' } },
    };
    const address = { line1: '1 A St', city: 'X', state: 'IL', postal_code: '60601', country: 'US' };
    const newer = paidOrderData({ ...base, collected_information: { shipping_details: { name: 'A B', address } } });
    const older = paidOrderData({ ...base, shipping_details: { name: 'A B', address } });
    expect(newer).toEqual(older);
    expect(newer).toMatchObject({ order_id: 'o1', payment_intent: 'pi_1', shipping_cents: 600, total_cents: 4000, shipping_method: 'Standard shipping' });
    expect(isPaidSession({ id: 'x', status: 'complete', payment_status: 'paid' })).toBe(true);
    expect(isPaidSession({ id: 'x', status: 'complete', payment_status: 'unpaid' })).toBe(false);
    expect(isPaidSession({ id: 'x', status: 'open', payment_status: 'paid' })).toBe(false);
  });

  it('accepts only slugs and whole quantities from the browser', () => {
    expect(parseCart([{ slug: 'calendar-26-week', quantity: 2 }])).toEqual([{ slug: 'calendar-26-week', quantity: 2 }]);
    for (const bad of [null, [], [{ slug: 'x', quantity: 0 }], [{ slug: 'x', quantity: 2.5 }], [{ slug: '../x', quantity: 1 }], [{ slug: 'x' }], Array(11).fill({ slug: 'x', quantity: 1 })]) {
      expect(parseCart(bad)).toBeNull();
    }
    // Extra fields (like a price) are dropped, never passed on.
    expect(parseCart([{ slug: 'x', quantity: 1, price_cents: 1 }])).toEqual([{ slug: 'x', quantity: 1 }]);
  });

  it('maps database errors to clear HTTP answers', () => {
    expect(checkoutError('sold_out:calendar-26-week')).toEqual({ status: 409, code: 'sold_out', slug: 'calendar-26-week' });
    expect(checkoutError('checkout_closed').status).toBe(403);
    expect(checkoutError('rate_limited').status).toBe(429);
    expect(checkoutError('shipping_not_configured')).toEqual({ status: 503, code: 'shipping_not_configured' });
    expect(checkoutError('something else')).toEqual({ status: 500, code: 'server_error' });
  });

  it('defaults to the production site and test-safe settings', () => {
    const env = readEnv(() => undefined);
    expect(env.siteUrl).toBe('https://organizedmomcollective.com');
    expect(env.allowedOrigins).toEqual(['https://organizedmomcollective.com']);
    expect(env.liveCheckoutEnabled).toBe(false);
    // Only the exact value turns it on.
    expect(readEnv((k) => (k === 'SHOP_LIVE_CHECKOUT' ? 'true' : undefined)).liveCheckoutEnabled).toBe(false);
    expect(readEnv((k) => (k === 'SHOP_LIVE_CHECKOUT' ? 'enabled' : undefined)).liveCheckoutEnabled).toBe(true);
  });
});

describe('emails', () => {
  const order: ServerOrder = {
    id: 'o1',
    order_number: 1001,
    created_at: '2026-10-10T12:00:00Z',
    payment_status: 'paid',
    fulfillment_status: 'unfulfilled',
    reservation: 'converted',
    stripe_session_id: 'cs_test_x',
    stripe_payment_intent_id: 'pi_x',
    livemode: false,
    email: 'jamie@example.com',
    customer_name: 'Jamie Rivera',
    shipping_name: 'Jamie Rivera',
    shipping_address: { line1: '12 Maple St', city: 'Springfield', state: 'IL', postal_code: '62701', country: 'US' },
    shipping_method: 'Standard shipping',
    subtotal_cents: 3400,
    discount_cents: 0,
    shipping_cents: 600,
    tax_cents: 0,
    total_cents: 4000,
    refunded_cents: 0,
    carrier: 'USPS',
    tracking_number: '9400 1118',
    tracking_url: null,
    flags: [],
    shop_order_items: [{ id: 'i', product_id: 'p', product_slug: 's', product_name: '26-Week Family Wall Calendar', unit_price_cents: 3400, quantity: 1, restocked: 0 }],
  };
  const opts = { siteUrl: 'https://organizedmomcollective.com', replyTo: true };

  it('never promises accounts, sync, future features or delivery dates', () => {
    for (const kind of ['confirmation', 'shipped', 'refund', 'access'] as const) {
      const { subject, text, html } = renderEmail(kind, order, opts);
      expect(subject.length).toBeGreaterThan(5);
      const all = `${subject}\n${text}`.toLowerCase();
      for (const banned of ['create an account', 'log in', 'login', 'sign up', 'family system', 'coming soon', 'sync', 'arrives by', 'business days to arrive', 'premium']) {
        expect(all, `${kind}: "${banned}"`).not.toContain(banned);
      }
      expect(html).toContain('omc-badge-160.png');
    }
    expect(renderEmail('confirmation', order, opts).text).toContain('No account, no subscription');
  });

  it('links carriers’ tracking pages, and only https links', () => {
    expect(trackingLink('USPS', '9400 1118', null)).toBe('https://tools.usps.com/go/TrackConfirmAction?tLabels=94001118');
    expect(trackingLink('UPS', '1Z9', null)).toBe('https://www.ups.com/track?tracknum=1Z9');
    expect(trackingLink('Other', '123', null)).toBeNull();
    expect(trackingLink('Other', '123', 'https://track.example/123')).toBe('https://track.example/123');
    expect(trackingLink('USPS', '123', 'javascript:alert(1)')).toBe('https://tools.usps.com/go/TrackConfirmAction?tLabels=123');
  });

  it('says canceled for a full refund before shipping, refund otherwise', () => {
    const live = { ...order, livemode: true };
    expect(renderEmail('refund', { ...live, payment_status: 'refunded', fulfillment_status: 'canceled', refunded_cents: 4000 }, opts).subject).toBe(
      'Order #1001 canceled and refunded',
    );
    expect(renderEmail('refund', { ...live, payment_status: 'partially_refunded', refunded_cents: 500 }, { ...opts, refundCents: 500 }).subject).toBe('Refund for order #1001');
  });

  it('marks test-mode emails as tests', () => {
    expect(renderEmail('confirmation', order, opts).subject).toBe('[Test] Your Organized Mom Collective order #1001');
    expect(renderEmail('confirmation', { ...order, livemode: true }, opts).subject).toBe('Your Organized Mom Collective order #1001');
  });
});

describe('dashboard logic', () => {
  const o = (over: Partial<OrderRow>): OrderRow => ({
    id: crypto.randomUUID(),
    order_number: 1001,
    created_at: '2026-10-10T12:00:00Z',
    updated_at: '2026-10-10T12:00:00Z',
    payment_status: 'paid',
    fulfillment_status: 'unfulfilled',
    reservation: 'converted',
    stripe_session_id: 'cs_test_1',
    stripe_payment_intent_id: 'pi_1',
    livemode: false,
    email: 'a@example.com',
    customer_name: 'Ann Lee',
    phone: null,
    shipping_name: 'Ann Lee',
    shipping_address: { line1: '1 Oak', city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' },
    shipping_method: 'Standard shipping',
    promotion_code: null,
    subtotal_cents: 3400,
    discount_cents: 0,
    shipping_cents: 600,
    tax_cents: 0,
    total_cents: 4000,
    refunded_cents: 0,
    carrier: null,
    tracking_number: null,
    tracking_url: null,
    paid_at: '2026-10-10T12:01:00Z',
    shipped_at: null,
    delivered_at: null,
    flags: [],
    admin_note: null,
    shop_order_items: [{ id: 'i', product_id: 'p26', product_slug: 'calendar-26-week', product_name: '26-Week Family Wall Calendar', unit_price_cents: 3400, quantity: 1, restocked: 0 }],
    ...over,
  });

  const orders = [
    o({ order_number: 1001 }),
    o({ order_number: 1002, fulfillment_status: 'shipped', customer_name: 'Bea Cruz', shipping_name: 'Bea Cruz', tracking_number: '9400XYZ' }),
    o({ order_number: 1003, payment_status: 'refunded', fulfillment_status: 'canceled', refunded_cents: 4000 }),
    o({ order_number: null, payment_status: 'expired', reservation: 'released', total_cents: null }),
    o({ order_number: null, payment_status: 'pending', reservation: 'held', total_cents: null, shop_order_items: [{ id: 'j', product_id: 'p26', product_slug: 's', product_name: 'x', unit_price_cents: 3400, quantity: 2, restocked: 0 }] }),
  ];

  it('totals count paid orders only and subtract refunds', () => {
    expect(salesTotals(orders)).toEqual({
      orders: 3,
      units: 3,
      gross_cents: 12000,
      refunded_cents: 4000,
      net_cents: 8000,
      shipping_cents: 1800,
      tax_cents: 0,
      average_cents: 4000,
      to_ship: 1,
    });
  });

  it('filters by status, shipping, search and date', () => {
    expect(filterOrders(orders, {}).map((x) => x.order_number)).toEqual([1001, 1002, 1003]);
    expect(filterOrders(orders, { payment: 'all' })).toHaveLength(5);
    expect(filterOrders(orders, { payment: 'expired' })).toHaveLength(1);
    expect(filterOrders(orders, { fulfillment: 'to_ship' }).map((x) => x.order_number)).toEqual([1001]);
    expect(filterOrders(orders, { q: '#1002' }).map((x) => x.order_number)).toEqual([1002]);
    expect(filterOrders(orders, { q: 'bea' }).map((x) => x.order_number)).toEqual([1002]);
    expect(filterOrders(orders, { q: '9400xyz' }).map((x) => x.order_number)).toEqual([1002]);
    expect(filterOrders(orders, { from: '2026-10-11' })).toHaveLength(0);
  });

  it('counts units held in open checkouts and units sold', () => {
    expect(heldUnits(orders).get('p26')).toBe(2);
    expect(soldUnits(orders).get('p26')).toBe(3);
    expect(soldUnits([o({ shop_order_items: [{ id: 'i', product_id: 'p26', product_slug: 's', product_name: 'x', unit_price_cents: 1, quantity: 2, restocked: 2 }] })]).get('p26')).toBe(0);
  });

  it('exports CSV with formulas neutralized', () => {
    const csv = ordersCsv([o({ customer_name: '=HYPERLINK("http://evil")', admin_note: 'line1\nline2' })]);
    const [header, row] = csv.split('\r\n');
    expect(header.split(',')).toContain('tracking_number');
    expect(row).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(row).toContain('"line1\nline2"');
    expect(row).toContain('40.00');
  });

  it('formats money and timeline events', () => {
    expect(money(3400)).toBe('$34');
    expect(money(3450)).toBe('$34.50');
    expect(money(123400)).toBe('$1,234');
    expect(describeEvent({ kind: 'refunded', detail: { amount_cents: 1000, refunded_total_cents: 1000 } })).toBe('Refunded $10 (total $10)');
    expect(describeEvent({ kind: 'payment_failed', detail: { decline_code: 'insufficient_funds' } })).toBe('Card attempt declined (insufficient funds)');
  });
});

describe('launch guards', () => {
  it('nothing on the public site links to the website checkout yet; buy buttons stay on Etsy', () => {
    const allowed = new Set(['../src/routes.ts', '../src/lib/shop.ts']);
    const src = Object.keys(files).filter((f) => f.startsWith('../src/'));
    expect(src.length).toBeGreaterThan(30);
    const offenders = src
      .filter((f) => !f.startsWith('../src/components/shop/') && !f.startsWith('../src/pages/checkout/') && !allowed.has(f))
      .filter((f) => /routes\.checkout|['"`]\/checkout/.test(files[f]));
    expect(offenders).toEqual([]);
    expect(routes.buy).toBe('/calendar#buy');
  });

  it('ships switched off: build flag off, database switch off, test keys only', () => {
    const env = read('.env.example');
    expect(env).toMatch(/^PUBLIC_SHOP_ENABLED=false$/m);
    expect(env).toMatch(/^PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_/m);
    expect(env).not.toMatch(/sk_(live|test)_/);
    const sql = read('supabase/migrations/20261010000000_shop.sql');
    expect(sql).toMatch(/checkout_mode text not null default 'off'/);
    expect(sql).toMatch(/tax_mode text not null default 'off'/);
    // The only seeded shipping rate is a test-only placeholder.
    expect(sql).toMatch(/insert into public\.shop_shipping_rates \(label, amount_cents, test_only, sort\) values \('[^']*placeholder\)', 600, true, 1\);/);
    expect(sql.match(/^insert into public\.shop_shipping_rates/gm)).toHaveLength(1);
  });

  it('seeds the catalog as specified', () => {
    const sql = read('supabase/migrations/20261010000000_shop.sql');
    const seed = sql.slice(sql.indexOf('insert into public.shop_products'));
    expect(seed).toMatch(/'calendar-26-week',\s*'26-Week Family Wall Calendar',\s*'January–June 2027',[\s\S]*?3400, 26,[\s\S]*?true, 25, 5, 1\)/);
    expect(seed).toMatch(/'calendar-52-week',\s*'52-Week Family Wall Calendar',\s*null,[\s\S]*?5400, 52,[\s\S]*?false, 0, 5, 2\)/);
    // Only the January–June edition is listed; July–December isn't assumed to exist.
    expect(seed).not.toMatch(/July–December 2027'/);
    expect((seed.match(/^\s*\('calendar-/gm) ?? []).length).toBe(2);
  });

  it('admin and checkout pages are noindex and stay out of the sitemap', () => {
    for (const page of ['src/pages/checkout/index.astro', 'src/pages/checkout/complete.astro', 'src/pages/admin/orders.astro']) {
      expect(read(page), page).toContain('indexable={false}');
    }
    expect(read('src/pages/sitemap.xml.ts')).not.toMatch(/checkout|admin/);
  });
});

describe('paste-ready dashboard function files', () => {
  const committed = import.meta.glob<string>('../supabase/dashboard/*.ts', { query: '?raw', import: 'default', eager: true });

  it('exist for all three functions and are up to date with the sources (run `npm run build:functions`)', async () => {
    for (const fn of DASHBOARD_FUNCTIONS as { name: string }[]) {
      const file = committed[`../supabase/dashboard/${fn.name}.ts`];
      expect(file, `${fn.name}.ts missing`).toBeDefined();
      expect(file === (await bundle(fn)), `${fn.name}.ts is out of date`).toBe(true);
    }
    expect(Object.keys(committed)).toHaveLength(3);
  });

  it('are self-contained: no imports to resolve, no secrets baked in', () => {
    for (const [path, code] of Object.entries(committed)) {
      expect(code, path).not.toMatch(/^\s*import\s|^\s*export\s.*\sfrom\s|\bimport\(/m);
      expect(code, path).not.toMatch(/sk_(live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|re_[A-Za-z0-9]{8}/);
      expect(code, path).toMatch(/Deno\.serve\(/);
      expect(code, path).toContain('Deno.env.get(key)');
    }
  });
});
