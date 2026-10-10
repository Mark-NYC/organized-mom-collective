/**
 * End-to-end tests for the direct shop: the real migrations on a real Postgres, served by a
 * real PostgREST, driven through the real Edge Function handlers. Stripe, Resend and
 * Supabase Auth are in-memory fakes (tests/shop/fakes.ts).
 *
 *   npm run test:shop     (scripts/test-shop.sh sets up the database and PostgREST)
 *
 * Skipped by plain `npm test`, which has no database.
 */
import { execFileSync } from 'node:child_process';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { depsFromEnv, type ShopDeps } from '../supabase/functions/_shared/deps.ts';
import { createAdminHandler } from '../supabase/functions/_shared/handlers/admin.ts';
import { createCheckoutHandler } from '../supabase/functions/_shared/handlers/checkout.ts';
import { createWebhookHandler } from '../supabase/functions/_shared/handlers/webhook.ts';
import { signStripePayload } from '../supabase/functions/_shared/stripe.ts';
import { FakeInbox, FakeStripe, jwt, routerFetch } from './shop/fakes.ts';

const REST = process.env.SHOP_E2E_REST ?? '';
const SECRET = process.env.SHOP_E2E_JWT_SECRET ?? '';
const PSQL = process.env.SHOP_E2E_PSQL ?? '';

const SUPABASE_URL = 'https://project.supabase.test';
const SITE = 'https://organizedmomcollective.com';
const WHSEC = 'whsec_test_secret';
const PREVIEW = 'preview-token-123';
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

/** Runs SQL as the database owner; returns rows as JSON. */
function sql<T = unknown>(query: string): T {
  const out = execFileSync('psql', [PSQL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8' }).trim();
  return (out ? JSON.parse(out) : null) as T;
}
const one = <T = Record<string, unknown>>(q: string) => sql<T>(`select row_to_json(x) from (${q}) x`);
const all = <T = Record<string, unknown>>(q: string) => sql<T[]>(`select coalesce(json_agg(x), '[]') from (${q}) x`);
const run = (q: string) => execFileSync('psql', [PSQL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' });

describe.skipIf(!REST)('direct shop, end to end', () => {
  let stripe: FakeStripe;
  let inbox: FakeInbox;
  let deps: ShopDeps;
  let checkout: (req: Request) => Promise<Response>;
  let webhook: (req: Request) => Promise<Response>;
  let admin: (req: Request) => Promise<Response>;
  const users = new Map<string, { id: string; email: string }>();
  const adminToken = 'admin-access-token';
  const userToken = 'regular-user-token';
  let ip = 0;
  let clock: number | null = null;

  const env = (over: Record<string, string> = {}) => ({
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: jwt({ role: 'service_role' }, SECRET),
    SUPABASE_ANON_KEY: jwt({ role: 'anon' }, SECRET),
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: WHSEC,
    SHOP_SITE_URL: SITE,
    SHOP_ALLOWED_ORIGINS: `${SITE},http://localhost:4321`,
    SHOP_PREVIEW_TOKEN: PREVIEW,
    RESEND_API_KEY: 're_test_key',
    // Public (non-preview) checkout needs the deployment flag; most tests run it with a test key.
    SHOP_LIVE_CHECKOUT: 'enabled',
    SHOP_EMAIL_REPLY_TO: 'hello@organizedmomcollective.com',
    ...over,
  });

  const build = (over: Record<string, string> = {}) => {
    const e = env(over);
    const d = depsFromEnv((k) => (e as Record<string, string>)[k], routerFetch({ supabaseUrl: SUPABASE_URL, restUrl: REST, stripe, inbox, users }));
    d.now = () => clock ?? Math.floor(Date.now() / 1000);
    return d;
  };

  const post = (handler: (r: Request) => Promise<Response>, body: unknown, headers: Record<string, string> = {}) =>
    handler(
      new Request('https://fn.test/', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: SITE, 'x-forwarded-for': `10.0.0.${++ip % 250}`, ...headers },
        body: JSON.stringify(body),
      }),
    );

  const create = async (items: unknown = [{ slug: 'calendar-26-week', quantity: 1 }], headers: Record<string, string> = {}) => {
    const res = await post(checkout, { action: 'create', items }, headers);
    return { status: res.status, body: (await res.json()) as Record<string, string> };
  };

  let eventSeq = 0;
  const sendEvent = async (type: string, object: Record<string, unknown>, opts: { id?: string; secret?: string; t?: number; livemode?: boolean } = {}) => {
    const event = { id: opts.id ?? `evt_${Date.now()}_${++eventSeq}`, object: 'event', type, livemode: opts.livemode ?? false, data: { object } };
    const payload = JSON.stringify(event);
    const sig = await signStripePayload(payload, opts.secret ?? WHSEC, opts.t);
    const res = await webhook(new Request('https://fn.test/', { method: 'POST', headers: { 'stripe-signature': sig }, body: payload }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown>, event };
  };

  const adminCall = async (body: unknown, token = adminToken) => {
    const res = await post(admin, body, token ? { authorization: `Bearer ${token}` } : {});
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  const order = (sessionId: string) => one<Record<string, any>>(`select * from shop_orders where stripe_session_id = '${sessionId}'`);
  const stock = (slug = 'calendar-26-week') => one<{ stock: number }>(`select stock from shop_products where slug = '${slug}'`).stock;
  const setMode = (mode: string) => run(`update shop_settings set checkout_mode = '${mode}', max_checkouts_per_hour = 1000`);

  /** A paid order, through the full flow. */
  const buy = async (qty = 1, opts: Parameters<FakeStripe['complete']>[1] = {}) => {
    const c = await create([{ slug: 'calendar-26-week', quantity: qty }]);
    expect(c.status).toBe(200);
    stripe.complete(c.body.session_id, opts);
    const w = await sendEvent('checkout.session.completed', { id: c.body.session_id, object: 'checkout.session' });
    expect(w.status).toBe(200);
    return order(c.body.session_id);
  };

  // PostgREST as the browser sees it.
  const rest = (path: string, role: 'anon' | 'authenticated', sub?: string, init: RequestInit = {}) =>
    fetch(`${REST}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${jwt({ role, ...(sub ? { sub } : {}) }, SECRET)}`, ...(init.headers ?? {}) },
    });

  beforeAll(() => {
    run(`insert into auth.users (id, email) values ('${ADMIN_ID}', 'owner@example.com'), ('${USER_ID}', 'someone@example.com') on conflict do nothing;
         insert into shop_admins (user_id) values ('${ADMIN_ID}') on conflict do nothing;`);
    users.set(adminToken, { id: ADMIN_ID, email: 'owner@example.com' });
    users.set(userToken, { id: USER_ID, email: 'someone@example.com' });
  });

  beforeEach(() => {
    stripe = new FakeStripe();
    inbox = new FakeInbox();
    deps = build();
    checkout = createCheckoutHandler(deps);
    webhook = createWebhookHandler(deps);
    admin = createAdminHandler(deps);
    clock = null;
    run(`update shop_products set stock = 25, active = true, max_per_order = 5 where slug = 'calendar-26-week';
         update shop_products set stock = 0, active = false where slug = 'calendar-52-week';
         update shop_settings set checkout_mode = 'live', tax_mode = 'off', tax_reviewed = false, checkout_minutes = 30, max_checkouts_per_hour = 1000;
         update shop_orders set reservation = 'released' where reservation = 'held';
         delete from shop_throttle;`);
  });

  // ---------------------------------------------------------------- launch controls

  describe('launch controls', () => {
    it('is closed by default and with checkout_mode off', async () => {
      // The migration ships 'off'; beforeEach opened it for the other tests.
      expect(sql(`select to_json(column_default) from information_schema.columns where table_name = 'shop_settings' and column_name = 'checkout_mode'`)).toBe(
        "'off'::text",
      );
      setMode('off');
      const r = await create();
      expect(r).toMatchObject({ status: 403, body: { error: 'checkout_closed' } });
      expect(stock()).toBe(25);
      expect(stripe.requests).toHaveLength(0);
    });

    it('preview mode needs the preview token', async () => {
      setMode('preview');
      expect((await create()).status).toBe(403);
      expect((await create(undefined, { 'x-shop-preview': 'wrong' })).status).toBe(403);
      expect((await create(undefined, { 'x-shop-preview': PREVIEW })).status).toBe(200);
    });

    it('refuses a live Stripe key without the deployment flag, whatever the store setting', async () => {
      const live = createCheckoutHandler(build({ STRIPE_SECRET_KEY: 'sk_live_fake', SHOP_LIVE_CHECKOUT: '' }));
      const res = await post(live, { action: 'create', items: [{ slug: 'calendar-26-week', quantity: 1 }] });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'live_checkout_disabled' });
      const hook = createWebhookHandler(build({ STRIPE_SECRET_KEY: 'sk_live_fake', SHOP_LIVE_CHECKOUT: '' }));
      const payload = JSON.stringify({ id: 'evt_live', type: 'checkout.session.completed', livemode: true, data: { object: {} } });
      const r = await hook(new Request('https://fn.test/', { method: 'POST', headers: { 'stripe-signature': await signStripePayload(payload, WHSEC) }, body: payload }));
      expect(r.status).toBe(503);
    });

    it('public checkout needs BOTH the deployment flag and the store setting', async () => {
      // Store setting open, deployment flag off → closed (test key or not).
      const noFlag = createCheckoutHandler(build({ SHOP_LIVE_CHECKOUT: '' }));
      expect((await post(noFlag, { action: 'create', items: [{ slug: 'calendar-26-week', quantity: 1 }] })).status).toBe(403);
      // Deployment flag on, store setting off or preview → closed for the public.
      setMode('off');
      expect((await create()).body).toEqual({ error: 'checkout_closed' });
      setMode('preview');
      expect((await create()).body).toEqual({ error: 'checkout_closed' });
      expect(stock()).toBe(25);
      expect(stripe.requests).toHaveLength(0);
    });

    it('preview mode never takes real money, even with the token and the deployment flag', async () => {
      setMode('preview');
      run(`insert into shop_shipping_rates (label, amount_cents) values ('Real rate', 800)`);
      const live = createCheckoutHandler(build({ STRIPE_SECRET_KEY: 'sk_live_fake' }));
      const res = await post(live, { action: 'create', items: [{ slug: 'calendar-26-week', quantity: 1 }] }, { 'x-shop-preview': PREVIEW });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'checkout_closed' });
      expect(stripe.requests).toHaveLength(0);
      run(`delete from shop_shipping_rates where label = 'Real rate'`);
    });

    it('live checkout never offers the test placeholder rate, and stays shut until a real rate exists', async () => {
      const liveDeps = build({ STRIPE_SECRET_KEY: 'sk_live_fake' });
      const live = createCheckoutHandler(liveDeps);
      const go = () => post(live, { action: 'create', items: [{ slug: 'calendar-26-week', quantity: 1 }] });
      run(`update shop_settings set tax_reviewed = true`);
      const shut = await go();
      expect(shut.status).toBe(503);
      expect(await shut.json()).toEqual({ error: 'shipping_not_configured' });
      expect(stock()).toBe(25);
      expect(stripe.requests).toHaveLength(0);

      run(`insert into shop_shipping_rates (label, amount_cents, sort) values ('USPS Ground Advantage', 750, 2)`);
      const ok = await go();
      expect(ok.status).toBe(200);
      const { session_id } = await ok.json();
      const p = stripe.sessions.get(session_id)!;
      expect(p.livemode).toBe(true);
      expect((p.params.shipping_options as any[]).map((o) => o.shipping_rate_data.display_name)).toEqual(['USPS Ground Advantage']);
      // The same rates in test mode include the placeholder.
      const t = stripe.sessions.get((await create()).body.session_id)!;
      expect((t.params.shipping_options as any[]).map((o) => o.shipping_rate_data.display_name)).toEqual(['Standard shipping (test placeholder)', 'USPS Ground Advantage']);
      run(`delete from shop_shipping_rates where label = 'USPS Ground Advantage'`);
    });

    it('real money needs a deliberate tax decision, and never runs with manual state rates', async () => {
      run(`insert into shop_shipping_rates (label, amount_cents, sort) values ('Real rate', 800, 2)`);
      const live = createCheckoutHandler(build({ STRIPE_SECRET_KEY: 'sk_live_fake' }));
      const go = () => post(live, { action: 'create', items: [{ slug: 'calendar-26-week', quantity: 1 }] });
      // Never saved: closed, nothing held, Stripe never called.
      const r = await go();
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ error: 'tax_not_configured' });
      expect(stock()).toBe(25);
      expect(stripe.requests).toHaveLength(0);
      // Saving the setting (even "off") in the dashboard is the deliberate decision.
      expect((await adminCall({ action: 'settings', fields: { tax_mode: 'manual' } })).body).toEqual({ error: 'manual_tax_disabled' });
      expect((await adminCall({ action: 'settings', fields: { tax_mode: 'off' } })).status).toBe(200);
      expect(one(`select tax_reviewed from shop_settings`)).toEqual({ tax_reviewed: true });
      expect((await go()).status).toBe(200);
      // Manual mode set behind the dashboard's back still can't take real money.
      run(`update shop_settings set tax_mode = 'manual'`);
      expect((await go()).status).toBe(503);
      // Test mode is unaffected by the tax gate.
      run(`update shop_settings set tax_mode = 'off', tax_reviewed = false`);
      expect((await create()).status).toBe(200);
      run(`delete from shop_shipping_rates where label = 'Real rate'`);
    });

    it('reports Stripe Tax setup and registrations when Stripe Tax is on', async () => {
      run(`update shop_settings set tax_mode = 'automatic', tax_reviewed = true`);
      stripe.taxStatus = 'active';
      stripe.taxRegistrations = ['NY'];
      const r = await adminCall({ action: 'status' });
      expect(r.body).toMatchObject({ tax_mode: 'automatic', tax_reviewed: true, stripe_tax: { status: 'active', registrations: ['US-NY'] } });
    });

    it('the readiness report shows what is and isn’t switched on, without secrets', async () => {
      const r = await adminCall({ action: 'status' });
      expect(r.body).toMatchObject({
        stripe_mode: 'test',
        live_checkout_flag: true,
        webhook_secret_set: true,
        checkout_mode: 'live',
        live_shipping_rates: 0,
        test_shipping_rates: 1,
        tax_reviewed: false,
        stripe_tax: null,
        public_checkout_open: true,
        real_payments_possible: false,
      });
      expect(JSON.stringify(r.body)).not.toMatch(/sk_|whsec|re_test|preview-token/);
      expect((await adminCall({ action: 'status' }, userToken)).status).toBe(403);
    });

    it('returns 503 when Stripe is not configured', async () => {
      const h = createCheckoutHandler(build({ STRIPE_SECRET_KEY: '' }));
      expect((await post(h, { action: 'create', items: [{ slug: 'calendar-26-week', quantity: 1 }] })).status).toBe(503);
    });

    it('only answers CORS for the site’s own origins', async () => {
      const ok = await checkout(new Request('https://fn.test/', { method: 'OPTIONS', headers: { origin: SITE } }));
      expect(ok.headers.get('access-control-allow-origin')).toBe(SITE);
      const bad = await checkout(new Request('https://fn.test/', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
      expect(bad.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  // ---------------------------------------------------------------- catalog and validation

  describe('catalog and server-side validation', () => {
    it('shows only active products, with availability but not the stock count', async () => {
      const res = await rest('/rpc/shop_catalog', 'anon', undefined, { method: 'POST', body: '{}' });
      const cat = await res.json();
      expect(cat.products.map((p: { slug: string }) => p.slug)).toEqual(['calendar-26-week']);
      expect(cat.products[0]).toMatchObject({ price_cents: 3400, available: true, max_quantity: 5 });
      expect(cat.products[0]).not.toHaveProperty('stock');
    });

    it('the 52-week calendar can’t be bought until it is enabled and stocked', async () => {
      expect((await create([{ slug: 'calendar-52-week', quantity: 1 }])).body).toMatchObject({ error: 'unavailable', slug: 'calendar-52-week' });
      run(`update shop_products set active = true where slug = 'calendar-52-week'`);
      expect((await create([{ slug: 'calendar-52-week', quantity: 1 }])).body).toMatchObject({ error: 'sold_out' });
      run(`update shop_products set stock = 3 where slug = 'calendar-52-week'`);
      const ok = await create([{ slug: 'calendar-52-week', quantity: 1 }]);
      expect(ok.status).toBe(200);
      expect(stripe.sessions.get(ok.body.session_id)!.amount_subtotal).toBe(5400);
    });

    it('prices come from the database, never the browser', async () => {
      const r = await create([{ slug: 'calendar-26-week', quantity: 2, price_cents: 1, unit_amount: 1 }]);
      expect(r.status).toBe(200);
      const s = stripe.sessions.get(r.body.session_id)!;
      const line = (s.params.line_items as any[])[0];
      expect(line.price_data.unit_amount).toBe('3400');
      expect(line.quantity).toBe('2');
      expect(s.amount_subtotal).toBe(6800);
    });

    it('rejects malformed carts, unknown products and quantities over the limit', async () => {
      for (const items of [[], [{ slug: 'calendar-26-week', quantity: 0 }], [{ slug: 'calendar-26-week', quantity: 1.5 }], [{ slug: 'Bad Slug', quantity: 1 }], 'x']) {
        expect((await create(items)).status).toBe(400);
      }
      expect((await create([{ slug: 'no-such-thing', quantity: 1 }])).body).toMatchObject({ error: 'unavailable' });
      expect((await create([{ slug: 'calendar-26-week', quantity: 6 }])).body).toMatchObject({ error: 'too_many' });
      // Split lines of the same product are merged before the limit check.
      expect((await create([{ slug: 'calendar-26-week', quantity: 3 }, { slug: 'calendar-26-week', quantity: 3 }])).body).toMatchObject({ error: 'too_many' });
      expect(stock()).toBe(25);
    });

    it('opens an embedded, US-only, guest checkout with shipping, promo codes and a 30-minute expiry', async () => {
      const before = Math.floor(Date.now() / 1000);
      const r = await create();
      const p = stripe.sessions.get(r.body.session_id)!.params as any;
      expect(p).toMatchObject({
        mode: 'payment',
        ui_mode: 'embedded',
        return_url: `${SITE}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
        allow_promotion_codes: 'true',
        customer_creation: 'if_required',
        shipping_address_collection: { allowed_countries: ['US'] },
        payment_method_types: ['card'],
        automatic_tax: { enabled: 'false' },
      });
      expect(p.shipping_options[0].shipping_rate_data).toMatchObject({ display_name: 'Standard shipping (test placeholder)', fixed_amount: { amount: '600', currency: 'usd' } });
      expect(p.line_items[0].price_data.product_data.name).toBe('26-Week Family Wall Calendar (January–June 2027)');
      expect(p.line_items[0].price_data.product_data.images[0]).toBe(`${SITE}/images/reorder/calendar-in-use-1280.webp`);
      expect(Number(p.expires_at) - before).toBeGreaterThanOrEqual(1800);
      expect(Number(p.expires_at) - before).toBeLessThan(1810);
      expect(stripe.requests[0].idempotencyKey).toMatch(/^checkout:/);
      expect(r.body.client_secret).toMatch(/_secret_/);
    });

    it('shipping is quoted for the cart: per extra unit, units ranges, the 52-week counts as two, free over a threshold', async () => {
      run(`update shop_shipping_rates set active = false where test_only;
           insert into shop_shipping_rates (label, amount_cents, per_extra_unit_cents, min_units, max_units, sort)
             values ('One calendar', 700, 0, 1, 1, 1), ('Two or more', 900, 150, 2, null, 2);
           update shop_products set active = true, stock = 10 where slug = 'calendar-52-week'`);
      const quote = async (items: { slug: string; quantity: number }[]) => {
        const r = await create(items);
        if (r.status !== 200) return r.body;
        return (stripe.sessions.get(r.body.session_id)!.params.shipping_options as any[]).map((o) => [o.shipping_rate_data.display_name, Number(o.shipping_rate_data.fixed_amount.amount)]);
      };
      expect(await quote([{ slug: 'calendar-26-week', quantity: 1 }])).toEqual([['One calendar', 700]]);
      expect(await quote([{ slug: 'calendar-26-week', quantity: 3 }])).toEqual([['Two or more', 900 + 150 * 2]]);
      // One 52-week calendar ships as two sets: two shipping units.
      expect(await quote([{ slug: 'calendar-52-week', quantity: 1 }])).toEqual([['Two or more', 1050]]);
      expect(await quote([{ slug: 'calendar-26-week', quantity: 1 }, { slug: 'calendar-52-week', quantity: 1 }])).toEqual([['Two or more', 1200]]);
      // The catalog carries the same rules for the page's estimate.
      const cat = await (await rest('/rpc/shop_catalog', 'anon', undefined, { method: 'POST', body: '{}' })).json();
      expect(cat.products.find((p: any) => p.slug === 'calendar-52-week').ship_units).toBe(2);
      expect(cat.shipping_rates.find((r: any) => r.label === 'Two or more')).toMatchObject({ amount_cents: 900, per_extra_unit_cents: 150, min_units: 2, max_units: null });
      // Free shipping at or above the subtotal threshold (before discount codes).
      run(`update shop_shipping_rates set free_over_cents = 10000 where label = 'Two or more'`);
      expect(await quote([{ slug: 'calendar-26-week', quantity: 2 }])).toEqual([['Two or more', 1050]]); // $68
      expect(await quote([{ slug: 'calendar-26-week', quantity: 3 }])).toEqual([['Two or more', 0]]); // $102
      // No rate covers the cart: refused, and nothing stays held.
      run(`update shop_shipping_rates set max_units = 2 where label = 'Two or more'`);
      const before = stock();
      expect(await quote([{ slug: 'calendar-26-week', quantity: 3 }])).toEqual({ error: 'shipping_unavailable' });
      expect(stock()).toBe(before);
      run(`delete from shop_shipping_rates where not test_only; update shop_shipping_rates set active = true where test_only`);
    });

    it('rate-limits checkouts per connection', async () => {
      run(`update shop_settings set max_checkouts_per_hour = 2`);
      const h = { 'x-forwarded-for': '203.0.113.9' };
      const res = [];
      for (let i = 0; i < 3; i++) res.push((await post(checkout, { action: 'create', items: [{ slug: 'calendar-26-week', quantity: 1 }] }, h)).status);
      expect(res).toEqual([200, 200, 429]);
    });

    it('tax: automatic mode turns on Stripe Tax; manual mode attaches per-state rates', async () => {
      run(`update shop_settings set tax_mode = 'automatic'`);
      let p = stripe.sessions.get((await create()).body.session_id)!.params as any;
      expect(p.automatic_tax.enabled).toBe('true');
      expect(p.line_items[0].price_data.product_data.tax_code).toBe('txcd_99999999');
      expect(p.shipping_options[0].shipping_rate_data.tax_code).toBe('txcd_92010001');

      run(`update shop_settings set tax_mode = 'manual'; insert into shop_tax_rates (state, percentage) values ('IL', 6.25) on conflict (state) do update set stripe_ids = '{}'`);
      p = stripe.sessions.get((await create()).body.session_id)!.params as any;
      expect(p.automatic_tax.enabled).toBe('false');
      expect(p.line_items[0].dynamic_tax_rates).toHaveLength(1);
      expect(stripe.taxRates[0]).toMatchObject({ state: 'IL', percentage: '6.25', inclusive: 'false', country: 'US' });
      // Created once, then reused from the cache.
      await create();
      expect(stripe.taxRates).toHaveLength(1);
      run(`delete from shop_tax_rates`);
    });
  });

  // ---------------------------------------------------------------- payments

  describe('successful payment', () => {
    it('only the signed webhook marks an order paid; then it gets a number, an entitlement and one confirmation email', async () => {
      const c = await create([{ slug: 'calendar-26-week', quantity: 2 }]);
      const sid = c.body.session_id;
      expect(stock()).toBe(23); // held while she pays

      // Reaching the success page proves nothing: still pending.
      stripe.complete(sid, { email: 'Jamie@Example.com', discount: 680, tax: 0 });
      const before = await (await rest('/rpc/shop_order_status', 'anon', undefined, { method: 'POST', body: JSON.stringify({ p_session: sid }) })).json();
      expect(before.payment_status).toBe('pending');
      expect(before.order_number).toBeNull();

      const w = await sendEvent('checkout.session.completed', { id: sid, object: 'checkout.session', payment_status: 'paid' });
      expect(w.status).toBe(200);
      const o = order(sid);
      expect(o).toMatchObject({
        payment_status: 'paid',
        fulfillment_status: 'unfulfilled',
        reservation: 'converted',
        email: 'Jamie@Example.com',
        subtotal_cents: 6800,
        discount_cents: 680,
        shipping_cents: 600,
        total_cents: 6720,
        promotion_code: 'WELCOME10',
        shipping_method: 'Standard shipping (test placeholder)',
        flags: [],
      });
      expect(o.order_number).toBeGreaterThanOrEqual(1001);
      expect(o.shipping_address).toMatchObject({ city: 'Springfield', state: 'IL' });
      expect(stock()).toBe(23);

      expect(one(`select email, kind, revoked_at from shop_entitlements where order_id = '${o.id}'`)).toEqual({ email: 'jamie@example.com', kind: 'companion', revoked_at: null });

      const mail = inbox.to('Jamie@Example.com');
      expect(mail).toHaveLength(1);
      expect(mail[0].subject).toBe(`[Test] Your Organized Mom Collective order #${o.order_number}`);
      expect(mail[0].text).toContain('Total paid: $67.20');
      expect(mail[0].text).toContain('Discount: −$6.80');
      expect(mail[0].text).toContain(`${SITE}/app`);
      expect(mail[0].text).toContain('No account, no subscription');
      expect(mail[0].reply_to).toBe('hello@organizedmomcollective.com');
      expect(mail[0].html).not.toMatch(/<script/i);

      const after = await (await rest('/rpc/shop_order_status', 'anon', undefined, { method: 'POST', body: JSON.stringify({ p_session: sid }) })).json();
      expect(after).toMatchObject({ payment_status: 'paid', order_number: o.order_number, email_hint: 'J•••@Example.com', total_cents: 6720 });
      expect(after).not.toHaveProperty('shipping_address');
    });

    it('re-reads the session from Stripe instead of trusting the event payload', async () => {
      const c = await create();
      // Forged-looking payload claims paid, but Stripe says the session is still open.
      const w = await sendEvent('checkout.session.completed', { id: c.body.session_id, payment_status: 'paid', status: 'complete' });
      expect(w.status).toBe(200);
      expect(order(c.body.session_id).payment_status).toBe('pending');
      expect(inbox.sent).toHaveLength(0);
    });

    it('a 100% discount completes without a payment and still confirms', async () => {
      const c = await create();
      stripe.sessions.get(c.body.session_id)!.params.shipping_options = [{ shipping_rate_data: { display_name: 'Free', fixed_amount: { amount: '0' } } }];
      stripe.complete(c.body.session_id, { discount: 3400 });
      await sendEvent('checkout.session.completed', { id: c.body.session_id });
      expect(order(c.body.session_id)).toMatchObject({ payment_status: 'paid', total_cents: 0, stripe_payment_intent_id: null });
    });
  });

  describe('webhook security and duplicates', () => {
    it('rejects bad signatures, other secrets, stale timestamps and test/live mix-ups', async () => {
      const c = await create();
      stripe.complete(c.body.session_id);
      const obj = { id: c.body.session_id };
      expect((await sendEvent('checkout.session.completed', obj, { secret: 'whsec_wrong' })).status).toBe(400);
      expect((await sendEvent('checkout.session.completed', obj, { t: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(400);
      expect((await sendEvent('checkout.session.completed', obj, { livemode: true })).status).toBe(400);
      const unsigned = await webhook(new Request('https://fn.test/', { method: 'POST', body: JSON.stringify({ id: 'evt_x', type: 'checkout.session.completed', data: { object: obj } }) }));
      expect(unsigned.status).toBe(400);
      expect(order(c.body.session_id).payment_status).toBe('pending');
    });

    it('a duplicate delivery, or a second event for the same payment, changes nothing and sends nothing', async () => {
      const c = await create();
      stripe.complete(c.body.session_id);
      const first = await sendEvent('checkout.session.completed', { id: c.body.session_id }, { id: 'evt_dup_1' });
      const num = order(c.body.session_id).order_number;
      const again = await sendEvent('checkout.session.completed', { id: c.body.session_id }, { id: 'evt_dup_1' });
      expect(again.body).toEqual({ received: true, duplicate: true });
      const other = await sendEvent('checkout.session.async_payment_succeeded', { id: c.body.session_id }, { id: 'evt_dup_2' });
      expect(first.status).toBe(200);
      expect(other.status).toBe(200);
      expect(order(c.body.session_id).order_number).toBe(num);
      expect(inbox.sent).toHaveLength(1);
      expect(stock()).toBe(24);
      expect(one(`select attempts from shop_stripe_events where id = 'evt_dup_1'`)).toEqual({ attempts: 2 });
    });

    it('concurrent duplicate deliveries still produce one paid order and one email', async () => {
      const c = await create();
      stripe.complete(c.body.session_id);
      const results = await Promise.all([1, 2, 3, 4].map((i) => sendEvent('checkout.session.completed', { id: c.body.session_id }, { id: `evt_par_${i}` })));
      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(inbox.sent).toHaveLength(1);
      expect(one(`select count(*)::int n from shop_email_log where order_id = '${order(c.body.session_id).id}' and kind = 'confirmation'`)).toEqual({ n: 1 });
    });

    it('a processing error returns 500 so Stripe retries, and the retry succeeds', async () => {
      const c = await create();
      stripe.complete(c.body.session_id);
      const s = stripe.sessions.get(c.body.session_id)!;
      stripe.sessions.delete(c.body.session_id); // Stripe API briefly unavailable
      const r1 = await sendEvent('checkout.session.completed', { id: c.body.session_id }, { id: 'evt_retry' });
      expect(r1.status).toBe(500);
      stripe.sessions.set(c.body.session_id, s);
      const r2 = await sendEvent('checkout.session.completed', { id: c.body.session_id }, { id: 'evt_retry' });
      expect(r2.status).toBe(200);
      expect(order(c.body.session_id).payment_status).toBe('paid');
    });
  });

  describe('failed, canceled and expired checkouts', () => {
    it('a declined card is logged; the order and its stock stay held while she can retry', async () => {
      const c = await create();
      const o = order(c.body.session_id);
      await sendEvent('payment_intent.payment_failed', {
        id: 'pi_declined',
        metadata: { order_id: o.id },
        last_payment_error: { message: 'Your card was declined.', code: 'card_declined', decline_code: 'insufficient_funds' },
      });
      expect(order(c.body.session_id).payment_status).toBe('pending');
      expect(stock()).toBe(24);
      expect(one(`select kind, detail->>'decline_code' code from shop_order_events where order_id = '${o.id}' and kind = 'payment_failed'`)).toEqual({
        kind: 'payment_failed',
        code: 'insufficient_funds',
      });
    });

    it('an async payment failure fails the order and releases its stock', async () => {
      const c = await create([{ slug: 'calendar-26-week', quantity: 2 }]);
      expect(stock()).toBe(23);
      await sendEvent('checkout.session.async_payment_failed', { id: c.body.session_id });
      expect(order(c.body.session_id)).toMatchObject({ payment_status: 'failed', reservation: 'released' });
      expect(stock()).toBe(25);
    });

    it('leaving the checkout (Change order) expires the Stripe session and releases stock at once', async () => {
      const c = await create([{ slug: 'calendar-26-week', quantity: 3 }]);
      expect(stock()).toBe(22);
      const res = await post(checkout, { action: 'cancel', session_id: c.body.session_id });
      expect(await res.json()).toEqual({ canceled: true });
      expect(stripe.sessions.get(c.body.session_id)!.status).toBe('expired');
      expect(order(c.body.session_id)).toMatchObject({ payment_status: 'expired', reservation: 'released' });
      expect(stock()).toBe(25);
      // Stripe's own expired event arrives later: no double release.
      await sendEvent('checkout.session.expired', { id: c.body.session_id });
      expect(stock()).toBe(25);
    });

    it('cancel can’t undo a checkout that was already paid', async () => {
      const c = await create();
      stripe.complete(c.body.session_id);
      const res = await post(checkout, { action: 'cancel', session_id: c.body.session_id });
      expect(await res.json()).toEqual({ canceled: false });
      expect(order(c.body.session_id).reservation).toBe('held');
      expect(stock()).toBe(24);
    });

    it('checkout.session.expired releases an abandoned checkout, once', async () => {
      const c = await create([{ slug: 'calendar-26-week', quantity: 2 }]);
      await sendEvent('checkout.session.expired', { id: c.body.session_id });
      await sendEvent('checkout.session.expired', { id: c.body.session_id });
      expect(order(c.body.session_id)).toMatchObject({ payment_status: 'expired', reservation: 'released' });
      expect(stock()).toBe(25);
    });

    it('if the expired webhook never arrives, the hold times out on the next checkout', async () => {
      const c = await create([{ slug: 'calendar-26-week', quantity: 4 }]);
      expect(stock()).toBe(21);
      run(`update shop_orders set reservation_expires_at = now() - interval '1 minute' where stripe_session_id = '${c.body.session_id}'`);
      await create();
      expect(order(c.body.session_id)).toMatchObject({ payment_status: 'expired', reservation: 'released' });
      expect(stock()).toBe(24); // 25 − the new checkout's 1
    });

    it('if Stripe can’t open the checkout, the reservation is released immediately', async () => {
      stripe.failNextCreate = true;
      const r = await create([{ slug: 'calendar-26-week', quantity: 2 }]);
      expect(r).toMatchObject({ status: 502, body: { error: 'payment_unavailable' } });
      expect(stock()).toBe(25);
      expect(one(`select payment_status, reservation from shop_orders order by created_at desc limit 1`)).toEqual({ payment_status: 'canceled', reservation: 'released' });
    });

    it('a payment that lands after its hold was released still counts, and is flagged if the unit is gone', async () => {
      run(`update shop_products set stock = 1 where slug = 'calendar-26-week'`);
      const late = await create();
      run(`update shop_orders set reservation_expires_at = now() - interval '1 minute' where stripe_session_id = '${late.body.session_id}'`);
      const other = await buy(1); // releases the stale hold, then takes the last unit
      expect(other.payment_status).toBe('paid');
      expect(stock()).toBe(0);
      stripe.complete(late.body.session_id);
      await sendEvent('checkout.session.completed', { id: late.body.session_id });
      expect(order(late.body.session_id)).toMatchObject({ payment_status: 'paid', flags: ['oversold'] });
      expect(stock()).toBe(0);
    });
  });

  // ---------------------------------------------------------------- inventory

  describe('inventory protection', () => {
    it('40 simultaneous checkouts for 25 units: exactly 25 succeed, the rest are told it sold out', async () => {
      const results = await Promise.all(Array.from({ length: 40 }, () => create()));
      const ok = results.filter((r) => r.status === 200);
      const soldOut = results.filter((r) => r.body.error === 'sold_out');
      expect(ok).toHaveLength(25);
      expect(soldOut).toHaveLength(15);
      expect(stock()).toBe(0);
      expect(one(`select count(*)::int n from shop_orders where reservation = 'held'`)).toEqual({ n: 25 });
    });

    it('mixed quantities racing for the last units never go below zero', async () => {
      run(`update shop_products set stock = 7 where slug = 'calendar-26-week'`);
      const results = await Promise.all([3, 3, 3, 2, 2, 1, 1].map((q) => create([{ slug: 'calendar-26-week', quantity: q }])));
      const taken = results.reduce((n, r, i) => n + (r.status === 200 ? [3, 3, 3, 2, 2, 1, 1][i] : 0), 0);
      expect(taken).toBeLessThanOrEqual(7);
      expect(stock()).toBe(7 - taken);
      expect(stock()).toBeGreaterThanOrEqual(0);
    });

    it('the dashboard can adjust stock with a reason, never below zero', async () => {
      const id = one<{ id: string }>(`select id from shop_products where slug = 'calendar-26-week'`).id;
      expect((await adminCall({ action: 'stock', product_id: id, delta: -5, reason: 'Damaged in storage' })).body).toEqual({ ok: true, stock: 20 });
      expect((await adminCall({ action: 'stock', product_id: id, set: 40, reason: 'New print run' })).body).toEqual({ ok: true, stock: 40 });
      expect((await adminCall({ action: 'stock', product_id: id, delta: -41, reason: 'x' })).status).toBe(400);
      expect((await adminCall({ action: 'stock', product_id: id, delta: 1, reason: '' })).status).toBe(400);
      expect(all(`select delta, stock_after, reason, actor from shop_inventory_log where product_id = '${id}' order by id desc limit 2`)).toEqual([
        { delta: 20, stock_after: 40, reason: 'New print run', actor: 'admin:owner@example.com' },
        { delta: -5, stock_after: 20, reason: 'Damaged in storage', actor: 'admin:owner@example.com' },
      ]);
    });
  });

  // ---------------------------------------------------------------- refunds

  describe('refunds', () => {
    it('partial then full refund from the dashboard: statuses, emails, restock, entitlement', async () => {
      const o = await buy(2); // 6800 + 600 shipping = 7400
      const r1 = await adminCall({ action: 'refund', order_id: o.id, amount_cents: 1000, request_id: 'req-partial-1' });
      expect(r1.body).toMatchObject({ ok: true, restocked: 0 });
      expect(one(`select payment_status, refunded_cents, fulfillment_status from shop_orders where id = '${o.id}'`)).toEqual({
        payment_status: 'partially_refunded',
        refunded_cents: 1000,
        fulfillment_status: 'unfulfilled',
      });
      // Double-click: same request id → Stripe idempotency → no second refund.
      await adminCall({ action: 'refund', order_id: o.id, amount_cents: 1000, request_id: 'req-partial-1' });
      expect(stripe.refunds).toHaveLength(1);
      // Stripe's own charge.refunded webhook for the same refund: no change, no second email.
      await sendEvent('charge.refunded', { id: stripe.chargeFor(o.stripe_payment_intent_id).id, payment_intent: o.stripe_payment_intent_id, amount_refunded: 1000 });
      expect(inbox.sent.map((m) => m.subject)).toEqual([`[Test] Your Organized Mom Collective order #${o.order_number}`, `[Test] Refund for order #${o.order_number}`]);

      expect((await adminCall({ action: 'refund', order_id: o.id, amount_cents: 99999, request_id: 'req-too-much' })).status).toBe(400);

      const r2 = await adminCall({ action: 'refund', order_id: o.id, restock: true, request_id: 'req-full-2' });
      expect(r2.body).toMatchObject({ ok: true, restocked: 2 });
      expect(one(`select payment_status, refunded_cents, fulfillment_status from shop_orders where id = '${o.id}'`)).toEqual({
        payment_status: 'refunded',
        refunded_cents: 7400,
        fulfillment_status: 'canceled',
      });
      expect(stock()).toBe(25);
      expect(one<{ revoked: boolean }>(`select revoked_at is not null revoked from shop_entitlements where order_id = '${o.id}'`).revoked).toBe(true);
      const last = inbox.sent.at(-1)!;
      expect(last.subject).toBe(`[Test] Order #${o.order_number} canceled and refunded`);
      expect(last.text).toContain('$74.00');
      // Restock can't happen twice.
      expect((await adminCall({ action: 'restock', order_id: o.id })).body).toEqual({ ok: true, restocked: 0 });
      expect(stock()).toBe(25);
      expect((await adminCall({ action: 'refund', order_id: o.id, request_id: 'req-again-3' })).status).toBe(409);
    });

    it('refunding never touches stock unless asked; a chosen number of units can be returned, once', async () => {
      const o = await buy(3);
      expect(stock()).toBe(22);
      const r = await adminCall({ action: 'refund', order_id: o.id, amount_cents: 3400, request_id: 'req-one-unit' });
      expect(r.body).toMatchObject({ ok: true, restocked: 0, email: 'sent' });
      expect(stock()).toBe(22);
      // Restocking together with the refund needs a full refund.
      expect((await adminCall({ action: 'refund', order_id: o.id, amount_cents: 100, restock: true, request_id: 'req-bad-restock' })).body).toEqual({
        error: 'restock_needs_full_refund',
      });
      expect(stripe.refunds).toHaveLength(1);
      const item = one<{ id: string }>(`select id from shop_order_items where order_id = '${o.id}'`).id;
      expect((await adminCall({ action: 'restock', order_id: o.id, item_id: item, units: 1 })).body).toEqual({ ok: true, restocked: 1 });
      expect(stock()).toBe(23);
      // Asking for more than are left only returns what's left; then nothing.
      expect((await adminCall({ action: 'restock', order_id: o.id, item_id: item, units: 5 })).body).toEqual({ ok: true, restocked: 2 });
      expect((await adminCall({ action: 'restock', order_id: o.id, item_id: item, units: 1 })).body).toEqual({ ok: true, restocked: 0 });
      expect((await adminCall({ action: 'restock', order_id: o.id })).body).toEqual({ ok: true, restocked: 0 });
      expect(stock()).toBe(25);
      expect(one(`select restocked from shop_order_items where id = '${item}'`)).toEqual({ restocked: 3 });
      expect(all(`select delta from shop_inventory_log where order_id = '${o.id}' order by id`)).toEqual([{ delta: 1 }, { delta: 2 }]);
      // Concurrent restocks of the same units move them once.
      const o2 = await buy(2);
      await adminCall({ action: 'refund', order_id: o2.id, request_id: 'req-full-o2' });
      const item2 = one<{ id: string }>(`select id from shop_order_items where order_id = '${o2.id}'`).id;
      const both = await Promise.all([1, 2, 3].map(() => adminCall({ action: 'restock', order_id: o2.id, item_id: item2, units: 2 })));
      expect(both.reduce((n, x) => n + Number(x.body.restocked), 0)).toBe(2);
      expect(stock()).toBe(25);
      // A paid order that wasn't refunded can't be restocked.
      const o3 = await buy(1);
      const item3 = one<{ id: string }>(`select id from shop_order_items where order_id = '${o3.id}'`).id;
      expect((await adminCall({ action: 'restock', order_id: o3.id, item_id: item3, units: 1 })).body).toEqual({ error: 'refund_first' });
    });

    it('a refund made in the Stripe dashboard arrives by webhook', async () => {
      const o = await buy(1);
      await sendEvent('charge.refunded', { id: 'ch_x', payment_intent: o.stripe_payment_intent_id, amount_refunded: o.total_cents });
      expect(one(`select payment_status, fulfillment_status from shop_orders where id = '${o.id}'`)).toEqual({ payment_status: 'refunded', fulfillment_status: 'canceled' });
      expect(inbox.sent).toHaveLength(2);
    });

    it('a shipped order that is refunded stays shipped', async () => {
      const o = await buy(1);
      await adminCall({ action: 'fulfillment', order_id: o.id, status: 'shipped', carrier: 'USPS', tracking_number: '9400 1000 0000 0000 0000 00' });
      await adminCall({ action: 'refund', order_id: o.id, request_id: 'req-shipped-1' });
      expect(one(`select payment_status, fulfillment_status from shop_orders where id = '${o.id}'`)).toEqual({ payment_status: 'refunded', fulfillment_status: 'shipped' });
      expect(inbox.sent.at(-1)!.subject).toBe(`[Test] Refund for order #${o.order_number}`);
    });

    it('failed refunds and disputes flag the order', async () => {
      const o = await buy(1);
      await sendEvent('refund.failed', { id: 're_1', payment_intent: o.stripe_payment_intent_id, amount: 100, failure_reason: 'expired_or_canceled_card' });
      await sendEvent('charge.dispute.created', { id: 'dp_1', payment_intent: o.stripe_payment_intent_id, amount: o.total_cents, reason: 'fraudulent' });
      expect(one(`select flags from shop_orders where id = '${o.id}'`)).toEqual({ flags: ['disputed', 'refund_failed'] });
    });
  });

  // ---------------------------------------------------------------- fulfillment and emails

  describe('fulfillment and emails', () => {
    it('packing → shipped (with tracking email) → delivered', async () => {
      const o = await buy(1, { email: 'ship@example.com' });
      expect((await adminCall({ action: 'fulfillment', order_id: o.id, status: 'packing' })).status).toBe(200);
      expect((await adminCall({ action: 'fulfillment', order_id: o.id, status: 'shipped' })).body).toEqual({ error: 'carrier_required' });
      const r = await adminCall({ action: 'fulfillment', order_id: o.id, status: 'shipped', carrier: 'USPS', tracking_number: '9400111899223344556677', notify: true });
      expect(r.body).toEqual({ ok: true, changed: true, status_changed: true, tracking_changed: true, email: 'sent' });
      const mail = inbox.to('ship@example.com').at(-1)!;
      expect(mail.subject).toBe(`[Test] Your order #${o.order_number} has shipped`);
      expect(mail.text).toContain('Tracking number: 9400111899223344556677');
      expect(mail.text).toContain('https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223344556677');
      await adminCall({ action: 'fulfillment', order_id: o.id, status: 'delivered' });
      expect(one(`select fulfillment_status, shipped_at is not null shipped, delivered_at is not null delivered from shop_orders where id = '${o.id}'`)).toEqual({
        fulfillment_status: 'delivered',
        shipped: true,
        delivered: true,
      });
      expect((await adminCall({ action: 'fulfillment', order_id: o.id, status: 'shipped', tracking_url: 'javascript:alert(1)' })).status).toBe(400);
      expect((await adminCall({ action: 'fulfillment', order_id: o.id })).body).toEqual({ error: 'invalid_status' });
    });

    it('saving the same shipment again changes nothing: no timeline entry, no email', async () => {
      const o = await buy(1, { email: 'repeat@example.com' });
      const ship = (tracking: string) => adminCall({ action: 'fulfillment', order_id: o.id, status: 'shipped', carrier: 'USPS', tracking_number: tracking, notify: true });
      const fulfillmentEvents = () =>
        all<{ detail: Record<string, unknown> }>(`select detail from shop_order_events where order_id = '${o.id}' and kind = 'fulfillment' order by id`);
      expect((await ship('9400100000000000000001')).body).toMatchObject({ changed: true, email: 'sent' });
      for (let i = 0; i < 3; i++) {
        expect((await ship('9400100000000000000001')).body).toEqual({ ok: true, changed: false, status_changed: false, tracking_changed: false, email: null });
      }
      expect(fulfillmentEvents()).toHaveLength(1);
      expect(inbox.to('repeat@example.com')).toHaveLength(2); // receipt + one shipping email

      // A corrected tracking number is a change: recorded with the old number, and emailed.
      expect((await ship('9400100000000000000002')).body).toMatchObject({ changed: true, status_changed: false, tracking_changed: true, email: 'sent' });
      expect(fulfillmentEvents()).toHaveLength(2);
      expect(fulfillmentEvents()[1].detail).toMatchObject({ tracking_number: '9400100000000000000002', previous_tracking_number: '9400100000000000000001' });
      expect(inbox.to('repeat@example.com').at(-1)!.text).toContain('9400100000000000000002');
      expect(inbox.to('repeat@example.com')).toHaveLength(3);

      // The deliberate resend still works, once per click.
      expect((await adminCall({ action: 'resend_email', order_id: o.id, kind: 'shipped', request_id: 'resend-ship-1' })).body).toEqual({ ok: true, email: 'sent' });
      expect((await adminCall({ action: 'resend_email', order_id: o.id, kind: 'shipped', request_id: 'resend-ship-1' })).body).toEqual({ ok: false, email: 'duplicate' });
      expect(inbox.to('repeat@example.com')).toHaveLength(4);
    });

    it('unpaid orders can’t be fulfilled', async () => {
      const c = await create();
      const id = order(c.body.session_id).id;
      expect((await adminCall({ action: 'fulfillment', order_id: id, status: 'packing' })).body).toEqual({ error: 'not_payable_state' });
    });

    it('an email provider outage is logged on the order and can be resent', async () => {
      inbox.failNext = true;
      const o = await buy(1, { email: 'outage@example.com' });
      expect(one(`select status, error from shop_email_log where order_id = '${o.id}'`)).toEqual({ status: 'failed', error: 'Service unavailable' });
      expect(o.payment_status).toBe('paid'); // the payment isn't affected
      // Retrying a failed email retries that same email (no request id needed).
      const r = await adminCall({ action: 'resend_email', order_id: o.id, kind: 'confirmation' });
      expect(r.body).toEqual({ ok: true, email: 'sent' });
      expect(inbox.to('outage@example.com')).toHaveLength(1);
      expect(all(`select status from shop_email_log where order_id = '${o.id}'`)).toEqual([{ status: 'sent' }]);
      // Resending one that was sent is a new email and needs the dashboard's request id.
      expect((await adminCall({ action: 'resend_email', order_id: o.id, kind: 'confirmation' })).body).toEqual({ error: 'request_id_required' });
      const a = await adminCall({ action: 'resend_email', order_id: o.id, kind: 'access', request_id: 'access-req-1' });
      expect(a.body).toEqual({ ok: true, email: 'sent' });
      expect(inbox.to('outage@example.com')[1].subject).toBe('[Test] Your cleaning companion: how to get started');
      expect((await adminCall({ action: 'resend_email', order_id: o.id, kind: 'shipped', request_id: 'ship-req-1' })).status).toBe(409);
    });

    it('a send that timed out but actually went out is not sent twice on retry', async () => {
      inbox.loseNextResponse = true;
      const o = await buy(1, { email: 'timeout@example.com' });
      expect(one(`select status from shop_email_log where order_id = '${o.id}'`)).toEqual({ status: 'failed' });
      expect(inbox.to('timeout@example.com')).toHaveLength(1); // it did go out
      const r = await adminCall({ action: 'resend_email', order_id: o.id, kind: 'confirmation' });
      expect(r.body).toEqual({ ok: true, email: 'sent' });
      expect(inbox.to('timeout@example.com')).toHaveLength(1); // Resend's idempotency key: no second copy
    });

    it('a retry while the same email is mid-send does nothing', async () => {
      const o = await buy(1, { email: 'midsend@example.com' });
      run(`update shop_email_log set status = 'pending', updated_at = now() where order_id = '${o.id}'`);
      expect((await adminCall({ action: 'resend_email', order_id: o.id, kind: 'confirmation', request_id: 'mid-req-1' })).body).toEqual({ ok: false, email: 'duplicate' });
      expect(inbox.to('midsend@example.com')).toHaveLength(1);
    });

    it('without an email provider, emails are logged as skipped and the dashboard is told so', async () => {
      deps = build({ RESEND_API_KEY: '' });
      webhook = createWebhookHandler(deps);
      admin = createAdminHandler(deps);
      const o = await buy(1);
      expect(o.payment_status).toBe('paid');
      expect(inbox.sent).toHaveLength(0);
      expect(one(`select status from shop_email_log where order_id = '${o.id}'`)).toEqual({ status: 'skipped' });
      const ship = await adminCall({ action: 'fulfillment', order_id: o.id, status: 'shipped', carrier: 'USPS', tracking_number: '9400', notify: true });
      expect(ship.body).toMatchObject({ changed: true, email: 'skipped' });
      expect((await adminCall({ action: 'resend_email', order_id: o.id, kind: 'confirmation' })).body).toEqual({ ok: false, email: 'skipped' });
      const refund = await adminCall({ action: 'refund', order_id: o.id, amount_cents: 100, request_id: 'skip-refund-1' });
      expect(refund.body).toMatchObject({ ok: true, email: 'skipped', restocked: 0 });
      expect(inbox.sent).toHaveLength(0);
    });

    it('escapes customer-supplied text in emails', async () => {
      await buy(1, { email: 'xss@example.com', name: '<img src=x onerror=alert(1)> Bob' });
      expect(inbox.to('xss@example.com')[0].html).not.toContain('<img src=x');
      expect(inbox.to('xss@example.com')[0].html).toContain('&lt;img src=x');
    });
  });

  // ---------------------------------------------------------------- access control

  describe('admin authentication and unauthorized access', () => {
    it('no token, a bad token, or a signed-in non-admin can’t use the dashboard API', async () => {
      const o = await buy(1);
      const body = { action: 'refund', order_id: o.id, request_id: 'req-unauth-1' };
      expect((await adminCall(body, '')).status).toBe(401);
      expect((await adminCall(body, 'forged-token')).status).toBe(401);
      expect((await adminCall(body, userToken)).status).toBe(403);
      expect(stripe.refunds).toHaveLength(0);
      expect((await adminCall({ action: 'whoami' })).body).toEqual({ email: 'owner@example.com' });
    });

    it('row-level security: anon sees nothing, a non-admin sees nothing, an admin reads orders', async () => {
      await buy(1);
      const anon = await rest('/shop_orders?select=id', 'anon');
      expect(anon.status).toBe(401);
      const user = await rest('/shop_orders?select=id', 'authenticated', USER_ID);
      expect(await user.json()).toEqual([]);
      const adminRes = await rest('/shop_orders?select=id,email', 'authenticated', ADMIN_ID);
      expect((await adminRes.json()).length).toBeGreaterThan(0);
      for (const table of ['shop_products', 'shop_entitlements', 'shop_email_log', 'shop_stripe_events', 'shop_admins', 'shop_secret']) {
        expect((await rest(`/${table}?select=*`, 'anon')).status, table).toBe(401);
      }
    });

    it('browsers can’t write directly, even as an admin', async () => {
      const id = one<{ id: string }>(`select id from shop_products where slug = 'calendar-26-week'`).id;
      const patch = await rest(`/shop_products?id=eq.${id}`, 'authenticated', ADMIN_ID, { method: 'PATCH', body: JSON.stringify({ stock: 999, price_cents: 1 }) });
      expect(patch.status).toBeGreaterThanOrEqual(400);
      const ins = await rest('/shop_orders', 'authenticated', ADMIN_ID, { method: 'POST', body: JSON.stringify({ subtotal_cents: 0, reservation_expires_at: new Date().toISOString() }) });
      expect(ins.status).toBeGreaterThanOrEqual(400);
      expect(stock()).toBe(25);
    });

    it('the internal functions aren’t callable with the anon key or a user token', async () => {
      const calls: [string, unknown][] = [
        ['shop_create_order', { p_items: [{ slug: 'calendar-26-week', quantity: 1 }], p_client: 'x', p_preview: true, p_livemode: false, p_public_allowed: true }],
        ['shop_mark_paid', { p_session: 'cs_test_x', p: {} }],
        ['shop_adjust_stock', { p_product: '00000000-0000-0000-0000-000000000000', p_delta: 5, p_set: null, p_reason: 'x', p_actor: 'x' }],
        ['shop_apply_refund', { p_payment_intent: 'pi_x', p_refunded_cents: 1, p_actor: 'x' }],
        ['shop_update_settings', { p: { checkout_mode: 'live' } }],
        ['shop_release_stale', {}],
      ];
      for (const [fn, args] of calls) {
        for (const [role, sub] of [['anon', undefined], ['authenticated', ADMIN_ID]] as const) {
          const res = await rest(`/rpc/${fn}`, role, sub, { method: 'POST', body: JSON.stringify(args) });
          // 401/403 = permission denied (a 404 would mean a wrong signature, i.e. a broken test).
          expect([401, 403], `${fn} as ${role}`).toContain(res.status);
        }
      }
      expect(stock()).toBe(25);
    });

    it('the database grants the browser roles nothing beyond the intended entry points', () => {
      // Every public function anon can execute: the four intended ones, nothing else.
      expect(
        all(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`).map((r: any) => r.proname),
      ).toEqual(['shop_catalog', 'shop_order_status', 'survey_submit', 'survey_track']);
      expect(
        all(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute') order by 1`).map((r: any) => r.proname),
      ).toEqual(['is_shop_admin', 'is_survey_admin', 'shop_catalog', 'shop_order_status', 'survey_submit', 'survey_track']);
      // anon has no table privileges at all on shop tables.
      expect(
        all(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'shop%'
                and has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')`),
      ).toEqual([]);
      // authenticated: SELECT only (row-level security limits it to shop admins), never writes,
      // and never the admin list, Stripe events, throttle or salt.
      expect(
        all(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'shop%'
                and has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate')`),
      ).toEqual([]);
      const readable = all<{ relname: string; rls: boolean }>(`select c.relname, c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'shop%' and has_table_privilege('authenticated', c.oid, 'select') order by 1`);
      expect(readable.every((t) => t.rls)).toBe(true);
      expect(readable.map((t) => t.relname)).not.toContain('shop_admins');
      expect(readable.map((t) => t.relname)).not.toContain('shop_stripe_events');
      expect(readable.map((t) => t.relname)).not.toContain('shop_secret');
      // Every shop table has row-level security on.
      expect(all(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and relname like 'shop%' and not relrowsecurity`)).toEqual([]);
    });

    it('a signed-in non-admin reads zero rows from every shop table', async () => {
      await buy(1);
      for (const t of ['shop_orders', 'shop_order_items', 'shop_order_events', 'shop_entitlements', 'shop_email_log', 'shop_products', 'shop_settings', 'shop_inventory_log']) {
        const res = await rest(`/${t}?select=*`, 'authenticated', USER_ID);
        expect(await res.json(), t).toEqual([]);
      }
    });

    it('order status needs the exact session id and reveals no address', async () => {
      const o = await buy(1);
      const look = async (s: string) => (await rest('/rpc/shop_order_status', 'anon', undefined, { method: 'POST', body: JSON.stringify({ p_session: s }) })).json();
      expect(await look('cs_test_%')).toBeNull();
      expect(await look(o.stripe_session_id.slice(0, -2))).toBeNull();
      const full = await look(o.stripe_session_id);
      expect(full.payment_status).toBe('paid');
      for (const secret of ['Maple', 'Springfield', 'jamie@example.com', 'Jamie', 'pi_', o.id]) expect(JSON.stringify(full)).not.toContain(secret);
      // Only for 30 days.
      run(`update shop_orders set created_at = now() - interval '31 days' where id = '${o.id}'`);
      expect(await look(o.stripe_session_id)).toBeNull();
    });
  });

  // ---------------------------------------------------------------- dashboard writes

  describe('dashboard settings and products', () => {
    it('edits products, shipping rates and the checkout switch; rejects bad values', async () => {
      const id = one<{ id: string }>(`select id from shop_products where slug = 'calendar-52-week'`).id;
      expect((await adminCall({ action: 'product', product_id: id, fields: { active: true, price_cents: 5400, stock: 999 } })).status).toBe(200);
      expect(one(`select active, stock from shop_products where id = '${id}'`)).toEqual({ active: true, stock: 0 }); // stock ignored here
      expect((await adminCall({ action: 'product', product_id: id, fields: { price_cents: -1 } })).status).toBe(400);
      expect((await adminCall({ action: 'product', product_id: id, fields: { images: [{ src: 'javascript:alert(1)', alt: 'x' }] } })).status).toBe(400);
      const rate = await adminCall({ action: 'shipping_rate', rate: { label: 'Priority', amount_cents: 1200, sort: 2 } });
      expect(rate.status).toBe(200);
      const p = stripe.sessions.get((await create()).body.session_id)!.params as any;
      expect(p.shipping_options.map((o: any) => o.shipping_rate_data.display_name)).toEqual(['Standard shipping (test placeholder)', 'Priority']);
      expect((await adminCall({ action: 'settings', fields: { tax_mode: 'manual' } })).status).toBe(400);
      await adminCall({ action: 'shipping_rate', rate: { id: rate.body.id, active: false } });
      expect((await adminCall({ action: 'settings', fields: { checkout_mode: 'sideways' } })).status).toBe(400);
      expect((await adminCall({ action: 'settings', fields: { checkout_mode: 'off' } })).status).toBe(200);
      expect((await create()).status).toBe(403);
    });
  });
});
