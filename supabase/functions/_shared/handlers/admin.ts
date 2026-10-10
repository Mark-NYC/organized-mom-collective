/**
 * POST /functions/v1/shop-admin — every dashboard write. Requires a Supabase Auth access
 * token (Authorization: Bearer …) for a user listed in shop_admins; anything else gets 401/403
 * before any data is touched. Reads happen in the browser through row-level security.
 *
 * Actions (body.action):
 *   fulfillment   { order_id, status, carrier?, tracking_number?, tracking_url?, notify? }
 *                 → { changed, email }: an unchanged save records nothing and emails nobody
 *   refund        { order_id, amount_cents?, restock?, request_id }  (restock only with a full refund)
 *                 → { refund_id, refund_status, restocked, email }
 *   restock       { order_id, item_id?, units? }  (item + units: that many; otherwise every unit)
 *   resend_email  { order_id, kind, request_id }
 *                 → { ok, email }: email is the real outcome (sent | skipped | failed | duplicate | no_email)
 *   note          { order_id, note }
 *   stock         { product_id, delta? | set?, reason }
 *   product       { product_id, fields }
 *   settings      { fields }
 *   shipping_rate { rate }
 *   status        → launch readiness (which switches and settings are in place; no secret values)
 */
import { DbError, loadOrder } from '../db.ts';
import { emailDeps, stripeBlockedReason, type ShopDeps } from '../deps.ts';
import { deliverEmail, type EmailKind, type EmailOutcome } from '../email.ts';
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

/**
 * Stripe Tax as Stripe sees it (read-only): whether it's set up, and the registrations it
 * collects for. Stripe Tax only charges tax where a registration is active.
 */
async function stripeTaxStatus(deps: ShopDeps) {
  try {
    const settings = await deps.stripe.request<{ status?: string; head_office?: { address?: { state?: string | null } } | null }>('GET', '/v1/tax/settings');
    const regs = await deps.stripe.request<{ data?: { country?: string; country_options?: { us?: { state?: string; type?: string } } }[] }>(
      'GET',
      '/v1/tax/registrations',
      { status: 'active', limit: 100 },
    );
    return {
      status: settings.status ?? 'unknown',
      registrations: (regs.data ?? []).map((r) => (r.country === 'US' && r.country_options?.us?.state ? `US-${r.country_options.us.state}` : (r.country ?? '?'))),
    };
  } catch (err) {
    return { status: 'unavailable', registrations: [] as string[], error: (err as Error).message.slice(0, 200) };
  }
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
      const [settings] = await deps.db.select<{ checkout_mode: string; tax_mode: string; tax_reviewed: boolean }>(
        'shop_settings',
        'select=checkout_mode,tax_mode,tax_reviewed',
      );
      const rates = await deps.db.select<{ test_only: boolean }>('shop_shipping_rates', 'select=test_only&active=is.true');
      const mode = deps.stripe.mode;
      const liveRates = rates.filter((r) => !r.test_only).length;
      const flag = deps.env.liveCheckoutEnabled;
      const taxReady = Boolean(settings?.tax_reviewed) && settings?.tax_mode !== 'manual';
      return {
        stripe_mode: deps.env.stripeSecretKey ? mode : null,
        live_checkout_flag: flag,
        webhook_secret_set: Boolean(deps.env.stripeWebhookSecret),
        preview_token_set: Boolean(deps.env.previewToken),
        email_configured: deps.mailer.configured,
        reply_to_set: Boolean(deps.env.emailReplyTo),
        checkout_mode: settings?.checkout_mode ?? null,
        tax_mode: settings?.tax_mode ?? null,
        tax_reviewed: taxReady,
        stripe_tax: settings?.tax_mode === 'automatic' && stripeBlockedReason(deps) === null ? await stripeTaxStatus(deps) : null,
        live_shipping_rates: liveRates,
        test_shipping_rates: rates.length - liveRates,
        // What would happen right now for someone on /checkout without the preview token.
        public_checkout_open: settings?.checkout_mode === 'live' && flag && stripeBlockedReason(deps) === null && (mode === 'test' || liveRates > 0),
        real_payments_possible: mode === 'live' && flag && settings?.checkout_mode === 'live' && liveRates > 0 && taxReady,
      };
    }

    case 'fulfillment': {
      const id = uuid(b.order_id);
      const status = str(b.status, 20);
      const r = await deps.db.rpc<{ changed: boolean; status_changed: boolean; tracking_changed: boolean }>('shop_set_fulfillment', {
        p_order: id,
        p_status: status,
        p_carrier: str(b.carrier, 60),
        p_tracking: str(b.tracking_number, 100),
        p_tracking_url: str(b.tracking_url, 500),
        p_actor: actor,
      });
      // Email only when the shipment is new or its tracking changed. Saving the same details
      // again sends nothing; "Resend shipping email" is the deliberate way to send it again.
      let email: EmailOutcome | null = null;
      if (status === 'shipped' && b.notify === true && r.changed) {
        const o = await loadOrder(deps.db, id);
        email = await deliverEmail(emailDeps(deps), id, 'shipped', `shipped:${id}:${o?.carrier ?? ''}:${o?.tracking_number ?? 'none'}`);
      }
      return { ok: true, changed: r.changed, status_changed: r.status_changed, tracking_changed: r.tracking_changed, email };
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
      // Restocking with a partial refund would put back units that may still be with the customer:
      // return those through "restock" with a unit count instead.
      if (b.restock === true && amount !== remaining) throw new HttpError(400, 'restock_needs_full_refund');

      const refund = await deps.stripe.request<{ id: string; status: string; charge: string | { id: string } }>(
        'POST',
        '/v1/refunds',
        { payment_intent: o.stripe_payment_intent_id, amount, reason: 'requested_by_customer', metadata: { order_id: id } },
        `refund:${id}:${requestId}`,
      );
      if (refund.status === 'failed' || refund.status === 'canceled') throw new HttpError(502, 'refund_failed');
      const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge.id;
      const charge = await deps.stripe.request<{ amount_refunded: number }>('GET', `/v1/charges/${chargeId}`);
      const applied = await applyRefund(deps, o.stripe_payment_intent_id, charge.amount_refunded, actor);
      const restocked = b.restock === true ? await deps.db.rpc<number>('shop_restock_order', { p_order: id, p_actor: actor }) : 0;
      return { ok: true, refund_id: refund.id, refund_status: refund.status, restocked, email: applied.email };
    }

    case 'restock': {
      const id = uuid(b.order_id);
      const o = await loadOrder(deps.db, id);
      if (!o) throw new HttpError(404, 'not_found');
      if (o.payment_status !== 'refunded' && o.payment_status !== 'partially_refunded') throw new HttpError(409, 'refund_first');
      if (b.item_id != null) {
        const itemId = uuid(b.item_id);
        if (!o.shop_order_items.some((i) => i.id === itemId)) throw new HttpError(404, 'not_found');
        const units = Number(b.units);
        if (!Number.isInteger(units) || units < 1) throw new HttpError(400, 'invalid_amount');
        return { ok: true, restocked: await deps.db.rpc<number>('shop_restock_units', { p_item: itemId, p_units: units, p_actor: actor }) };
      }
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
      // The latest email of this kind decides: one that failed, was skipped or is mid-send is
      // retried as itself (same log row, so two clicks can't both send). Only after a successful
      // send does a resend become a new email, keyed by the dashboard's request id so a
      // double-submitted click still sends once.
      const [latest] = await deps.db.select<{ dedupe_key: string; status: string }>(
        'shop_email_log',
        `order_id=eq.${id}&kind=eq.${kind}&select=dedupe_key,status&order=id.desc&limit=1`,
      );
      let key: string;
      if (latest && latest.status !== 'sent') key = latest.dedupe_key;
      else {
        const requestId = str(b.request_id, 64);
        if (!requestId || !/^[A-Za-z0-9-]{8,64}$/.test(requestId)) throw new HttpError(400, 'request_id_required');
        key = `${kind}:${id}:resend:${requestId}`;
      }
      const email = await deliverEmail(emailDeps(deps), id, kind, key);
      return { ok: email === 'sent', email };
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
      const allowed = ['name', 'edition', 'description', 'details', 'price_cents', 'images', 'active', 'max_per_order', 'ship_units', 'sort'];
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
      // A malformed code would make every Stripe Tax checkout fail to open.
      if ('product_tax_code' in f && (typeof f.product_tax_code !== 'string' || !/^txcd_\d{8}$/.test(f.product_tax_code))) {
        throw new HttpError(400, 'invalid_tax_code');
      }
      await deps.db.rpc('shop_update_settings', { p: Object.fromEntries(Object.entries(f).filter(([k]) => allowed.includes(k))) });
      return { ok: true };
    }

    case 'shipping_rate': {
      const r = (b.rate ?? {}) as Record<string, unknown>;
      const allowed = [
        'id', 'label', 'amount_cents', 'min_days', 'max_days', 'active', 'test_only', 'sort',
        'per_extra_unit_cents', 'min_units', 'max_units', 'free_over_cents',
      ];
      return { ok: true, id: await deps.db.rpc('shop_save_shipping_rate', { p: Object.fromEntries(Object.entries(r).filter(([k]) => allowed.includes(k))) }) };
    }

    default:
      throw new HttpError(400, 'unknown_action');
  }
}
