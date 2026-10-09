/**
 * POST /functions/v1/shop-admin — every dashboard write. Requires a Supabase Auth access
 * token (Authorization: Bearer …) for a user listed in shop_admins; anything else gets 401/403
 * before any data is touched. Reads happen in the browser through row-level security.
 *
 * Actions (body.action):
 *   fulfillment   { order_id, status, carrier?, tracking_number?, tracking_url?, notify? }
 *   refund        { order_id, amount_cents?, restock?, request_id }
 *   restock       { order_id }
 *   resend_email  { order_id, kind }
 *   note          { order_id, note }
 *   stock         { product_id, delta? | set?, reason }
 *   product       { product_id, fields }
 *   settings      { fields }
 *   shipping_rate { rate }
 *   status        → launch readiness (which switches and settings are in place; no secret values)
 */
import { DbError, loadOrder } from '../db.ts';
import { emailDeps, stripeBlockedReason, type ShopDeps } from '../deps.ts';
import { deliverEmail, type EmailKind } from '../email.ts';
import { corsHeaders, json, readJson, type Handler } from '../http.ts';
import { applyRefund } from './webhook.ts';

interface Admin {
  id: string;
  email: string;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown) => {
  if (typeof v !== 'string' || !UUID.test(v)) throw new HttpError(400, 'invalid_id');
  return v;
};
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : null);

/** Verifies the access token with Supabase Auth, then checks shop_admins. */
async function authenticate(deps: ShopDeps, req: Request): Promise<Admin> {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'unauthorized');
  const res = await deps.fetch(`${deps.env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: deps.env.anonKey || deps.env.serviceRoleKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new HttpError(401, 'unauthorized');
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user.id || !UUID.test(user.id)) throw new HttpError(401, 'unauthorized');
  const ok = await deps.db.rpc<boolean>('shop_is_admin_user', { p_user: user.id });
  if (!ok) throw new HttpError(403, 'forbidden');
  return { id: user.id, email: user.email ?? user.id };
}

export function createAdminHandler(deps: ShopDeps): Handler {
  return async (req) => {
    const cors = corsHeaders(req, deps.env.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    try {
      const admin = await authenticate(deps, req);
      const body = await readJson(req);
      if (!body) throw new HttpError(400, 'invalid_request');
      return json(await run(deps, admin, body), 200, cors);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status, cors);
      if (err instanceof DbError && err.status < 500) return json({ error: err.message }, 400, cors);
      console.error('shop-admin', err);
      return json({ error: 'server_error' }, 500, cors);
    }
  };
}

async function run(deps: ShopDeps, admin: Admin, b: Record<string, unknown>): Promise<unknown> {
  const actor = `admin:${admin.email}`;
  switch (b.action) {
    case 'whoami':
      return { email: admin.email };

    case 'status': {
      const [settings] = await deps.db.select<{ checkout_mode: string; tax_mode: string }>('shop_settings', 'select=checkout_mode,tax_mode');
      const rates = await deps.db.select<{ test_only: boolean }>('shop_shipping_rates', 'select=test_only&active=is.true');
      const mode = deps.stripe.mode;
      const liveRates = rates.filter((r) => !r.test_only).length;
      const flag = deps.env.liveCheckoutEnabled;
      return {
        stripe_mode: deps.env.stripeSecretKey ? mode : null,
        live_checkout_flag: flag,
        webhook_secret_set: Boolean(deps.env.stripeWebhookSecret),
        preview_token_set: Boolean(deps.env.previewToken),
        email_configured: deps.mailer.configured,
        reply_to_set: Boolean(deps.env.emailReplyTo),
        checkout_mode: settings?.checkout_mode ?? null,
        tax_mode: settings?.tax_mode ?? null,
        live_shipping_rates: liveRates,
        test_shipping_rates: rates.length - liveRates,
        // What would happen right now for someone on /checkout without the preview token.
        public_checkout_open: settings?.checkout_mode === 'live' && flag && stripeBlockedReason(deps) === null && (mode === 'test' || liveRates > 0),
        real_payments_possible: mode === 'live' && flag && settings?.checkout_mode === 'live' && liveRates > 0,
      };
    }

    case 'fulfillment': {
      const id = uuid(b.order_id);
      const status = str(b.status, 20);
      await deps.db.rpc('shop_set_fulfillment', {
        p_order: id,
        p_status: status,
        p_carrier: str(b.carrier, 60),
        p_tracking: str(b.tracking_number, 100),
        p_tracking_url: str(b.tracking_url, 500),
        p_actor: actor,
      });
      let email: string | null = null;
      if (status === 'shipped' && b.notify === true) {
        const o = await loadOrder(deps.db, id);
        email = await deliverEmail(emailDeps(deps), id, 'shipped', `shipped:${id}:${o?.tracking_number ?? 'none'}`);
      }
      return { ok: true, email };
    }

    case 'refund': {
      const blocked = stripeBlockedReason(deps);
      if (blocked) throw new HttpError(503, blocked);
      const id = uuid(b.order_id);
      const requestId = str(b.request_id, 64);
      if (!requestId || !/^[A-Za-z0-9-]{8,64}$/.test(requestId)) throw new HttpError(400, 'request_id_required');
      const o = await loadOrder(deps.db, id);
      if (!o) throw new HttpError(404, 'not_found');
      if (o.payment_status !== 'paid' && o.payment_status !== 'partially_refunded') throw new HttpError(409, 'not_refundable');
      if (!o.stripe_payment_intent_id) throw new HttpError(409, 'no_payment_to_refund');
      const remaining = (o.total_cents ?? 0) - o.refunded_cents;
      const amount = b.amount_cents == null ? remaining : Number(b.amount_cents);
      if (!Number.isInteger(amount) || amount < 1 || amount > remaining) throw new HttpError(400, 'invalid_amount');

      const refund = await deps.stripe.request<{ id: string; status: string; charge: string | { id: string } }>(
        'POST',
        '/v1/refunds',
        { payment_intent: o.stripe_payment_intent_id, amount, reason: 'requested_by_customer', metadata: { order_id: id } },
        `refund:${id}:${requestId}`,
      );
      if (refund.status === 'failed' || refund.status === 'canceled') throw new HttpError(502, 'refund_failed');
      const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge.id;
      const charge = await deps.stripe.request<{ amount_refunded: number }>('GET', `/v1/charges/${chargeId}`);
      await applyRefund(deps, o.stripe_payment_intent_id, charge.amount_refunded, actor);
      const restocked = b.restock === true ? await deps.db.rpc<number>('shop_restock_order', { p_order: id, p_actor: actor }) : 0;
      return { ok: true, refund_id: refund.id, refund_status: refund.status, restocked };
    }

    case 'restock': {
      const id = uuid(b.order_id);
      const o = await loadOrder(deps.db, id);
      if (!o) throw new HttpError(404, 'not_found');
      if (o.payment_status !== 'refunded' && o.payment_status !== 'partially_refunded') throw new HttpError(409, 'refund_first');
      return { ok: true, restocked: await deps.db.rpc<number>('shop_restock_order', { p_order: id, p_actor: actor }) };
    }

    case 'resend_email': {
      const id = uuid(b.order_id);
      const kind = b.kind as EmailKind;
      if (!['confirmation', 'shipped', 'refund', 'access'].includes(kind)) throw new HttpError(400, 'invalid_kind');
      const o = await loadOrder(deps.db, id);
      if (!o) throw new HttpError(404, 'not_found');
      if (o.payment_status === 'pending' || o.payment_status === 'expired' || o.payment_status === 'canceled' || o.payment_status === 'failed') {
        throw new HttpError(409, 'not_paid');
      }
      if (kind === 'shipped' && o.fulfillment_status !== 'shipped' && o.fulfillment_status !== 'delivered') throw new HttpError(409, 'not_shipped');
      if (kind === 'refund' && o.refunded_cents === 0) throw new HttpError(409, 'not_refunded');
      const email = await deliverEmail(emailDeps(deps), id, kind, `${kind}:${id}:resend:${Date.now()}`);
      return { ok: email === 'sent' || email === 'skipped', email };
    }

    case 'note':
      await deps.db.rpc('shop_set_note', { p_order: uuid(b.order_id), p_note: str(b.note, 4000) ?? '', p_actor: actor });
      return { ok: true };

    case 'stock': {
      const delta = b.delta == null ? null : Number(b.delta);
      const set = b.set == null ? null : Number(b.set);
      if ((delta === null) === (set === null)) throw new HttpError(400, 'delta_or_set');
      if ((delta !== null && !Number.isInteger(delta)) || (set !== null && (!Number.isInteger(set) || set < 0))) throw new HttpError(400, 'invalid_amount');
      const stock = await deps.db.rpc<number>('shop_adjust_stock', {
        p_product: uuid(b.product_id),
        p_delta: delta,
        p_set: set,
        p_reason: str(b.reason, 200),
        p_actor: actor,
      });
      return { ok: true, stock };
    }

    case 'product': {
      const f = (b.fields ?? {}) as Record<string, unknown>;
      const allowed = ['name', 'edition', 'description', 'details', 'price_cents', 'images', 'active', 'max_per_order', 'sort'];
      const fields = Object.fromEntries(Object.entries(f).filter(([k]) => allowed.includes(k)));
      if ('images' in fields) {
        const imgs = fields.images;
        const okImgs =
          Array.isArray(imgs) &&
          imgs.length <= 8 &&
          imgs.every(
            (i) =>
              i && typeof i === 'object' && typeof i.src === 'string' && /^(\/(?!\/)[A-Za-z0-9/_.-]+|https:\/\/[^\s"'<>]+)$/.test(i.src) && typeof i.alt === 'string' && i.alt.trim(),
          );
        if (!okImgs) throw new HttpError(400, 'invalid_images');
      }
      if ('details' in fields && !(Array.isArray(fields.details) && fields.details.every((d) => typeof d === 'string' && d.length <= 200))) {
        throw new HttpError(400, 'invalid_details');
      }
      await deps.db.rpc('shop_update_product', { p_product: uuid(b.product_id), p: fields });
      return { ok: true };
    }

    case 'settings': {
      const f = (b.fields ?? {}) as Record<string, unknown>;
      const allowed = ['checkout_mode', 'tax_mode', 'product_tax_code', 'checkout_minutes', 'max_checkouts_per_hour'];
      await deps.db.rpc('shop_update_settings', { p: Object.fromEntries(Object.entries(f).filter(([k]) => allowed.includes(k))) });
      return { ok: true };
    }

    case 'shipping_rate': {
      const r = (b.rate ?? {}) as Record<string, unknown>;
      const allowed = ['id', 'label', 'amount_cents', 'min_days', 'max_days', 'active', 'test_only', 'sort'];
      return { ok: true, id: await deps.db.rpc('shop_save_shipping_rate', { p: Object.fromEntries(Object.entries(r).filter(([k]) => allowed.includes(k))) }) };
    }

    default:
      throw new HttpError(400, 'unknown_action');
  }
}
