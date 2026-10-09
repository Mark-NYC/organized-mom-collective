/**
 * Smoke test for the paste-ready Edge Function files (supabase/dashboard/*.ts), run under
 * Deno exactly as the Supabase dashboard would run them: each file is loaded on its own,
 * with Deno.serve captured and the global fetch routed to fake Stripe / Resend / Auth and
 * the real local PostgREST. Run by scripts/test-shop.sh (needs SHOP_E2E_* from it).
 */
import { signStripePayload } from '../../supabase/functions/_shared/stripe.ts';
import { FakeInbox, FakeStripe, jwt, routerFetch } from './fakes.ts';

const REST = Deno.env.get('SHOP_E2E_REST')!;
const SECRET = Deno.env.get('SHOP_E2E_JWT_SECRET')!;
const PSQL = Deno.env.get('SHOP_E2E_PSQL')!;
const SUPABASE_URL = 'https://project.supabase.test';
const ADMIN = { id: '33333333-3333-4333-8333-333333333333', email: 'dashboard-smoke@example.com' };

const sql = async (q: string) => {
  const out = await new Deno.Command('psql', { args: [PSQL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', q] }).output();
  if (!out.success) throw new Error(new TextDecoder().decode(out.stderr));
  return new TextDecoder().decode(out.stdout).trim();
};
const check = (ok: unknown, what: string) => {
  if (!ok) throw new Error(`FAILED: ${what}`);
  console.log(`  ✓ ${what}`);
};

// Exactly the secrets the dashboard would hold (plus Supabase's own three).
const env: Record<string, string> = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: jwt({ role: 'service_role' }, SECRET),
  SUPABASE_ANON_KEY: jwt({ role: 'anon' }, SECRET),
  STRIPE_SECRET_KEY: 'sk_test_dashboard',
  STRIPE_WEBHOOK_SECRET: 'whsec_dashboard',
  SHOP_PREVIEW_TOKEN: 'dashboard-preview',
  RESEND_API_KEY: 're_dashboard',
};
for (const [k, v] of Object.entries(env)) Deno.env.set(k, v);

const stripe = new FakeStripe();
const inbox = new FakeInbox();
const token = 'dashboard-admin-token';
const fakeFetch = routerFetch({ supabaseUrl: SUPABASE_URL, restUrl: REST, stripe, inbox, users: new Map([[token, ADMIN]]) });
globalThis.fetch = fakeFetch;

const handlers: Record<string, (req: Request) => Promise<Response>> = {};
for (const name of ['shop-checkout', 'stripe-webhook', 'shop-admin']) {
  let captured: ((req: Request) => Promise<Response>) | null = null;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: (req: Request) => Promise<Response>) => {
    captured = h;
    return {};
  };
  await import(new URL(`../../supabase/dashboard/${name}.ts`, import.meta.url).href);
  if (!captured) throw new Error(`${name}: the file didn't call Deno.serve`);
  handlers[name] = captured;
}
console.log('dashboard files: all three load on their own and register a handler');

const post = (fn: string, body: unknown, headers: Record<string, string> = {}) =>
  handlers[fn](new Request('https://fn.test/', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://organizedmomcollective.com', 'x-forwarded-for': '198.51.100.7', ...headers }, body: JSON.stringify(body) }));

await sql(`insert into auth.users values ('${ADMIN.id}', '${ADMIN.email}') on conflict do nothing;
           insert into shop_admins values ('${ADMIN.id}') on conflict do nothing;
           update shop_products set stock = 25, active = true, max_per_order = 5 where slug = 'calendar-26-week';
           update shop_settings set checkout_mode = 'preview', max_checkouts_per_hour = 1000;
           delete from shop_throttle;`);

const opts = await handlers['shop-checkout'](new Request('https://fn.test/', { method: 'OPTIONS', headers: { origin: 'https://organizedmomcollective.com' } }));
check(opts.status === 204 && opts.headers.get('access-control-allow-origin') === 'https://organizedmomcollective.com', 'shop-checkout answers the browser preflight (CORS) for the site');

const closed = await post('shop-checkout', { action: 'create', items: [{ slug: 'calendar-26-week', quantity: 1 }] });
check(closed.status === 403, 'preview mode without the token: closed');

const created = await post('shop-checkout', { action: 'create', items: [{ slug: 'calendar-26-week', quantity: 2 }] }, { 'x-shop-preview': 'dashboard-preview' });
const c = await created.json();
check(created.status === 200 && c.client_secret, 'preview checkout opens a Stripe session');
check((await sql(`select stock from shop_products where slug = 'calendar-26-week'`)) === '23', 'stock held: 25 → 23');

stripe.complete(c.session_id, { email: 'smoke@example.com' });
const payload = JSON.stringify({ id: `evt_dash_${Date.now()}`, type: 'checkout.session.completed', livemode: false, data: { object: { id: c.session_id } } });
const bad = await handlers['stripe-webhook'](new Request('https://fn.test/', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=00' }, body: payload }));
check(bad.status === 400, 'stripe-webhook rejects an unsigned/forged call');
const hook = await handlers['stripe-webhook'](new Request('https://fn.test/', { method: 'POST', headers: { 'stripe-signature': await signStripePayload(payload, 'whsec_dashboard') }, body: payload }));
check(hook.status === 200, 'stripe-webhook accepts a correctly signed event');
const order = JSON.parse(await sql(`select row_to_json(o) from shop_orders o where stripe_session_id = '${c.session_id}'`));
check(order.payment_status === 'paid' && order.order_number > 1000, `order paid, numbered #${order.order_number}`);
check(inbox.sent.some((m) => m.subject.includes(`#${order.order_number}`)), 'confirmation email sent');

const unauth = await post('shop-admin', { action: 'status' });
check(unauth.status === 401, 'shop-admin refuses a call without an admin token');
const status = await post('shop-admin', { action: 'status' }, { authorization: `Bearer ${token}` });
const s = await status.json();
check(status.status === 200 && s.stripe_mode === 'test' && s.real_payments_possible === false, 'shop-admin status: test mode, real payments impossible');
const ship = await post('shop-admin', { action: 'fulfillment', order_id: order.id, status: 'shipped', carrier: 'USPS', tracking_number: '9400100000000000000000', notify: true }, { authorization: `Bearer ${token}` });
check(ship.status === 200, 'shop-admin marks the order shipped');
const refund = await post('shop-admin', { action: 'refund', order_id: order.id, amount_cents: 500, request_id: 'dashboard-smoke-1' }, { authorization: `Bearer ${token}` });
check(refund.status === 200, 'shop-admin refunds $5 through Stripe');
check((await sql(`select payment_status || ':' || refunded_cents from shop_orders where id = '${order.id}'`)) === 'partially_refunded:500', 'order shows the partial refund');
check(inbox.sent.length === 3, 'confirmation, shipping and refund emails sent (3)');

await sql(`update shop_settings set checkout_mode = 'off'`);
console.log('dashboard files: smoke test passed');
