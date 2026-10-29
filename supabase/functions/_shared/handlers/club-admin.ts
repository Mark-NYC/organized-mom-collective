/**
 * POST /functions/v1/club-admin (/admin/club). Owner admins only: her access token is checked with Supabase Auth,
 * then admin_users; every change is in admin_audit_log. Database-only changes (fulfillment status, entitlement
 * overrides, kit status, settings) are RPCs the page calls directly (club_admin_*); this function does what needs
 * Stripe or Resend.
 *
 *   status         → which keys, switches, prices, portal and webhook are in place (never a secret value)
 *   stripe_setup   → creates, once: the Product, the Price of each offered plan ($5.90/month; lookup keys), the
 *                    Billing Portal configuration (no plan switching) and the webhook endpoint (its signing secret is
 *                    stored server-side, not returned). An existing portal that still allows plan switching is
 *                    updated to stop it.
 *   resync         { subscription } → re-reads a subscription and its latest invoice from Stripe
 *   send_emails    { kind: 'profile_reminder'|'resource_ready'|'review', month? } → counts (each email once per key)
 *   refund         { invoice } → full refund in Stripe; the webhook then revokes that invoice's months
 */
import { clubStripeBlocked, CLUB_LEGACY_LOOKUP_KEYS, CLUB_PRICES, CLUB_PRODUCT_TAG, OFFERED_PLANS, type ClubDeps, type ClubPlan } from '../club/deps.ts';
import { monthLabel, sendClubEmail, type ClubEmailKind } from '../club/emails.ts';
import { corsHeaders, json, readJson, type Handler } from '../http.ts';
import { clubPrice } from './club-billing.ts';
import { applyInvoice, CLUB_EVENTS, syncSubscription, webhookSecret } from './club-webhook.ts';
import { userFromRequest } from '../club/members.ts';

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const MONTH = /^\d{4}-\d{2}-01$/;

export function createClubAdminHandler(deps: ClubDeps): Handler {
  return async (req) => {
    const cors = corsHeaders(req, deps.env.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response(null, { status: cors['Access-Control-Allow-Origin'] ? 204 : 403, headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    try {
      const user = await userFromRequest(deps, req);
      if (!user) throw new HttpError(401, 'unauthorized');
      if (!(await deps.db.rpc<boolean>('shop_is_admin_user', { p_user: user.id }))) throw new HttpError(403, 'forbidden');
      const body = await readJson(req);
      if (!body) throw new HttpError(400, 'invalid');
      const action = String(body.action ?? '');
      if (action !== 'status') {
        const blocked = clubStripeBlocked(deps);
        if (blocked && action !== 'send_emails') throw new HttpError(503, blocked);
        await deps.db.rpc('admin_log_service', {
          p_actor: user.id, p_action: `club.${action}`.slice(0, 60), p_target: null,
          p_detail: Object.fromEntries(['kind', 'month', 'subscription', 'invoice'].filter((k) => typeof body[k] === 'string').map((k) => [k, String(body[k]).slice(0, 60)])),
        });
      }
      switch (action) {
        case 'status':
          return json(await status(deps), 200, cors);
        case 'stripe_setup':
          return json(await stripeSetup(deps), 200, cors);
        case 'resync': {
          const sub = String(body.subscription ?? '');
          if (!/^sub_[A-Za-z0-9]+$/.test(sub)) throw new HttpError(400, 'invalid');
          const s = await syncSubscription(deps, sub, null);
          const latest = s && (s as unknown as { latest_invoice?: string | null }).latest_invoice;
          if (typeof latest === 'string') await applyInvoice(deps, latest, deps.now(), false);
          return json({ ok: Boolean(s), status: s?.status ?? null }, 200, cors);
        }
        case 'send_emails':
          return json(await sendBatch(deps, String(body.kind ?? ''), typeof body.month === 'string' ? body.month : null), 200, cors);
        case 'refund': {
          const invoice = String(body.invoice ?? '');
          if (!/^in_[A-Za-z0-9]+$/.test(invoice)) throw new HttpError(400, 'invalid');
          const [row] = await deps.db.select<{ stripe_payment_intent_id: string | null }>('club_invoices', `stripe_invoice_id=eq.${invoice}&select=stripe_payment_intent_id`);
          if (!row?.stripe_payment_intent_id) throw new HttpError(404, 'not_found');
          const r = await deps.stripe.request<{ id: string; status: string }>('POST', '/v1/refunds',
            { payment_intent: row.stripe_payment_intent_id, metadata: { club: CLUB_PRODUCT_TAG, by: 'admin' } }, `club-admin-refund:${invoice}`);
          return json({ refund_id: r.id, refund_status: r.status }, 200, cors);
        }
        default:
          throw new HttpError(400, 'unknown_action');
      }
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status, cors);
      console.error('club-admin', err);
      return json({ error: err instanceof Error ? err.message.slice(0, 200) : 'failed' }, 500, cors);
    }
  };
}

async function status(deps: ClubDeps) {
  const [settings] = await deps.db.select<Record<string, unknown>>('club_settings', 'select=checkout_mode,first_mailing_month,cutoff_ordinal,cutoff_weekday,launch_exception_month,launch_exception_cutoff_at,member_review,portal_configuration_id');
  const blocked = clubStripeBlocked(deps);
  let prices: Partial<Record<ClubPlan, boolean>> | null = null;
  if (!blocked) {
    prices = {};
    for (const plan of OFFERED_PLANS) prices[plan] = Boolean(await clubPrice(deps, plan));
  }
  return {
    stripe_key: deps.env.clubStripeSecretKey ? deps.stripe.mode : null,
    stripe_blocked: blocked,
    live_switch: deps.env.clubLiveCheckout,
    webhook_secret: Boolean(blocked ? deps.env.clubWebhookSecret : await webhookSecret(deps)),
    resend: deps.mailer.configured,
    prices,
    settings,
    webhook_url: `${deps.env.supabaseUrl}/functions/v1/club-webhook`,
  };
}

async function stripeSetup(deps: ClubDeps) {
  const done: string[] = [];
  const priceIds: Partial<Record<ClubPlan, string>> = {};
  let product: string | null = null;
  const lookup = async (key: string) =>
    (await deps.stripe.request<{ data: { id: string; product: string }[] }>('GET', '/v1/prices', { 'lookup_keys[]': key, limit: 1 })).data[0] ?? null;
  for (const plan of OFFERED_PLANS) {
    const existing = await lookup(CLUB_PRICES[plan].lookupKey);
    if (existing) {
      priceIds[plan] = existing.id;
      product ??= existing.product;
    }
  }
  // A new price for an existing Club: keep the product its earlier prices belong to.
  for (const key of CLUB_LEGACY_LOOKUP_KEYS) {
    if (product) break;
    product = (await lookup(key))?.product ?? null;
  }
  if (OFFERED_PLANS.some((plan) => !priceIds[plan])) {
    if (!product) {
      const p = await deps.stripe.request<{ id: string }>('POST', '/v1/products', {
        name: 'Organized Family Club',
        description: 'A personalized family resource each month, with a printed mailing.',
        metadata: { club: CLUB_PRODUCT_TAG },
      }, `club-product-v1-${deps.stripe.mode}`);
      product = p.id;
      done.push('product');
    }
    for (const plan of OFFERED_PLANS) {
      if (priceIds[plan]) continue;
      const c = CLUB_PRICES[plan];
      const pr = await deps.stripe.request<{ id: string }>('POST', '/v1/prices', {
        product, currency: 'usd', unit_amount: c.amount, recurring: { interval: c.interval }, lookup_key: c.lookupKey, nickname: c.nickname,
        tax_behavior: 'unspecified', metadata: { club: CLUB_PRODUCT_TAG, plan },
      }, `club-price-${c.lookupKey}-${deps.stripe.mode}`);
      priceIds[plan] = pr.id;
      done.push(`price_${plan}`);
    }
  }

  // One plan, so nothing to switch between: the portal updates the card, shows invoices and cancels.
  const [settings] = await deps.db.select<{ portal_configuration_id: string | null }>('club_settings', 'select=portal_configuration_id');
  if (!settings?.portal_configuration_id) {
    const cfg = await deps.stripe.request<{ id: string }>('POST', '/v1/billing_portal/configurations', {
      business_profile: { headline: 'Organized Family Club: manage your membership' },
      default_return_url: `${deps.env.siteUrl}/club/dashboard`,
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        // Her email is her sign-in: it changes in her account, not here.
        customer_update: { enabled: true, allowed_updates: ['shipping', 'address'] },
        subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'unused', 'other'] } },
        subscription_update: { enabled: false },
      },
      metadata: { club: CLUB_PRODUCT_TAG },
    }, `club-portal-v2-${deps.stripe.mode}`);
    await deps.db.rpc('club_settings_set_portal', { p_id: cfg.id });
    done.push('portal');
  } else {
    // The first setup allowed monthly ↔ annual switching; turn it off so annual can't be bought from the portal.
    const id = settings.portal_configuration_id;
    const cfg = await deps.stripe.request<{ features?: { subscription_update?: { enabled?: boolean } } }>('GET', `/v1/billing_portal/configurations/${id}`);
    if (cfg.features?.subscription_update?.enabled) {
      await deps.stripe.request('POST', `/v1/billing_portal/configurations/${id}`, { features: { subscription_update: { enabled: false } } }, `club-portal-no-switch-${id}`);
      done.push('portal_updated');
    }
  }

  if (!(await webhookSecret(deps))) {
    const url = `${deps.env.supabaseUrl}/functions/v1/club-webhook`;
    const ep = await deps.stripe.request<{ id: string; secret: string }>('POST', '/v1/webhook_endpoints', {
      url, enabled_events: [...CLUB_EVENTS], api_version: '2025-03-31.basil', description: 'Organized Family Club (club-webhook)',
      metadata: { club: CLUB_PRODUCT_TAG },
    }, `club-webhook-v1-${deps.stripe.mode}`);
    await deps.db.rpc('club_secret_set', { p_name: deps.stripe.mode === 'live' ? 'webhook_secret_live' : 'webhook_secret_test', p_value: ep.secret });
    done.push('webhook');
  }
  return { created: done, mode: deps.stripe.mode, prices: priceIds, product };
}

async function sendBatch(deps: ClubDeps, kind: string, month: string | null) {
  if (!['profile_reminder', 'resource_ready', 'review'].includes(kind)) throw new HttpError(400, 'invalid');
  if (kind !== 'profile_reminder' && (!month || !MONTH.test(month))) throw new HttpError(400, 'invalid_month');
  const audience = await deps.db.rpc<{ user_id: string; email: string; kit_slug: string | null; order_id: string | null }[]>(
    'club_email_audience', { p_kind: kind, p_month: month });
  const counts: Record<string, number> = { sent: 0, skipped: 0, failed: 0, duplicate: 0 };
  for (const a of audience) {
    const key = kind === 'profile_reminder' ? `profile_reminder:${a.user_id}` : kind === 'resource_ready' ? `ready:${a.user_id}:${month}` : `review:${a.order_id}`;
    const outcome = await sendClubEmail(deps, key, kind as ClubEmailKind, a.user_id, a.email, { kitSlug: a.kit_slug, monthLabel: month ? monthLabel(month) : undefined });
    counts[outcome]++;
  }
  return { audience: audience.length, ...counts };
}
