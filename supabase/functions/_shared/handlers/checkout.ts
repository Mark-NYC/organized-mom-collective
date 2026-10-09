/**
 * POST /functions/v1/shop-checkout
 *   { action: "create", items: [{ slug, quantity }] } → { client_secret, session_id }
 *   { action: "cancel", session_id }                  → { canceled: boolean }
 *
 * "create" reserves stock in the database first (shop_create_order), then opens an
 * embedded Stripe Checkout Session for exactly those server-side prices. If Stripe
 * fails, the reservation is released at once.
 */
import { checkoutError, parseCart, sessionParams, type ReservedOrder } from '../checkout.ts';
import { DbError } from '../db.ts';
import { stripeBlockedReason, type ShopDeps } from '../deps.ts';
import { clientIp, corsHeaders, json, readJson, safeEqual, type Handler } from '../http.ts';

export function createCheckoutHandler(deps: ShopDeps): Handler {
  return async (req) => {
    const cors = corsHeaders(req, deps.env.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);

    const body = await readJson(req);
    if (!body) return json({ error: 'invalid_request' }, 400, cors);

    const blocked = stripeBlockedReason(deps);
    if (blocked) return json({ error: blocked }, 503, cors);

    try {
      if (body.action === 'cancel') return json(await cancel(deps, body.session_id), 200, cors);
      if (body.action !== 'create') return json({ error: 'invalid_request' }, 400, cors);
      const cart = parseCart(body.items);
      if (!cart) return json({ error: 'invalid_cart' }, 400, cors);
      const header = req.headers.get('x-shop-preview') ?? '';
      const preview = Boolean(deps.env.previewToken) && safeEqual(header, deps.env.previewToken);
      const result = await create(deps, cart, clientIp(req), preview);
      return json(result.body, result.status, cors);
    } catch (err) {
      console.error('shop-checkout', err);
      return json({ error: 'server_error' }, 500, cors);
    }
  };
}

async function create(deps: ShopDeps, cart: { slug: string; quantity: number }[], ip: string, preview: boolean) {
  let order: ReservedOrder;
  try {
    // The database makes the final call (shop_create_order): preview only with a test key,
    // public checkout only with the deployment flag AND the admin setting.
    order = await deps.db.rpc<ReservedOrder>('shop_create_order', {
      p_items: cart,
      p_client: ip,
      p_preview: preview,
      p_livemode: deps.stripe.mode === 'live',
      p_public_allowed: deps.env.liveCheckoutEnabled,
    });
  } catch (err) {
    if (err instanceof DbError) {
      const e = checkoutError(err.message);
      if (e.code !== 'server_error') return { status: e.status, body: { error: e.code, slug: e.slug } };
    }
    throw err;
  }

  try {
    if (order.shipping_rates.length === 0) throw new Error('no_shipping_rates');
    const taxRateIds = order.tax_mode === 'manual' ? await stripeTaxRates(deps, order) : [];
    const session = await deps.stripe.request<{ id: string; client_secret: string; livemode: boolean }>(
      'POST',
      '/v1/checkout/sessions',
      sessionParams(order, { siteUrl: deps.env.siteUrl, nowSeconds: deps.now(), taxRateIds }),
      `checkout:${order.order_id}`,
    );
    await deps.db.rpc('shop_attach_session', { p_order: order.order_id, p_session: session.id, p_livemode: session.livemode });
    return { status: 200, body: { client_secret: session.client_secret, session_id: session.id } };
  } catch (err) {
    console.error('shop-checkout: could not open Stripe checkout', err);
    await deps.db.rpc('shop_cancel_checkout', { p_order: order.order_id, p_reason: (err as Error).message.slice(0, 200) });
    return { status: 502, body: { error: 'payment_unavailable' } };
  }
}

/** Manual tax mode: one Stripe tax rate per registered state, created once and cached. */
async function stripeTaxRates(deps: ShopDeps, order: ReservedOrder): Promise<string[]> {
  const ids: string[] = [];
  for (const rate of order.tax_rates) {
    let id = rate.stripe_ids?.[deps.stripe.mode];
    if (!id) {
      const created = await deps.stripe.request<{ id: string }>(
        'POST',
        '/v1/tax_rates',
        {
          display_name: rate.label,
          percentage: Number(rate.percentage),
          inclusive: false,
          country: 'US',
          state: rate.state,
          jurisdiction: rate.state,
          tax_type: 'sales_tax',
        },
        `tax-rate:${rate.state}:${rate.percentage}`,
      );
      id = created.id;
      await deps.db.rpc('shop_cache_tax_rate', { p_state: rate.state, p_mode: deps.stripe.mode, p_stripe_id: id });
    }
    ids.push(id);
  }
  // Stripe accepts up to 100 dynamic tax rates per line; there are at most 51 states/DC.
  return ids;
}

/** The customer left the checkout (Change order / back): expire the session so stock is released now. */
async function cancel(deps: ShopDeps, sessionId: unknown) {
  if (typeof sessionId !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return { canceled: false };
  const [order] = await deps.db.select<{ id: string; payment_status: string }>(
    'shop_orders',
    `stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=id,payment_status`,
  );
  if (!order || order.payment_status !== 'pending') return { canceled: false };
  try {
    const s = await deps.stripe.request<{ status: string }>('POST', `/v1/checkout/sessions/${sessionId}/expire`);
    if (s.status !== 'expired') return { canceled: false };
  } catch {
    // Already complete or already expired: the webhook decides.
    return { canceled: false };
  }
  const r = await deps.db.rpc<{ transitioned?: boolean }>('shop_checkout_ended', {
    p_session: sessionId,
    p_status: 'expired',
    p_detail: { via: 'customer_left' },
  });
  return { canceled: Boolean(r?.transitioned) };
}
