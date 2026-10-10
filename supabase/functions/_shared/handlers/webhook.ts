/**
 * POST /functions/v1/stripe-webhook (called by Stripe only).
 *
 * The only place an order becomes paid. Every request must carry a valid Stripe
 * signature. Each event id is processed once (shop_stripe_events); every state change
 * is itself idempotent, and each email has a dedupe key, so retries and duplicate
 * deliveries are harmless. Payment status is re-read from the Stripe API, never taken
 * from the success page or trusted from the payload alone.
 */
import { isPaidSession, paidOrderData, type StripeSession } from '../checkout.ts';
import { stripeBlockedReason, emailDeps, type ShopDeps } from '../deps.ts';
import { deliverEmail } from '../email.ts';
import { json, type Handler } from '../http.ts';
import { verifyStripeSignature } from '../stripe.ts';

interface StripeEvent {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: Record<string, unknown> };
}

export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'charge.refunded',
  'refund.failed',
  'charge.dispute.created',
] as const;

export function createWebhookHandler(deps: ShopDeps): Handler {
  return async (req) => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const raw = await req.text();
    const valid = await verifyStripeSignature(raw, req.headers.get('stripe-signature'), deps.env.stripeWebhookSecret, deps.now());
    if (!valid) return json({ error: 'invalid_signature' }, 400);

    let event: StripeEvent;
    try {
      event = JSON.parse(raw);
    } catch {
      return json({ error: 'invalid_payload' }, 400);
    }
    const blocked = stripeBlockedReason(deps);
    if (blocked) return json({ error: blocked }, 503);
    // A live event while the functions hold a test key (or the reverse) is a misconfiguration.
    if (event.livemode !== (deps.stripe.mode === 'live')) return json({ error: 'mode_mismatch' }, 400);

    const state = await deps.db.rpc<'new' | 'retry' | 'done'>('shop_stripe_event_begin', { p_id: event.id, p_type: event.type });
    if (state === 'done') return json({ received: true, duplicate: true });

    try {
      await handleEvent(deps, event);
      await deps.db.rpc('shop_stripe_event_done', { p_id: event.id });
      return json({ received: true });
    } catch (err) {
      // Not marked done, so Stripe's retry runs it again.
      console.error('stripe-webhook', event.type, event.id, err);
      return json({ error: 'processing_failed' }, 500);
    }
  };
}

const idOf = (v: unknown): string | null => (typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: string }).id) : null);

async function handleEvent(deps: ShopDeps, event: StripeEvent) {
  const obj = event.data.object;
  if (event.type.startsWith('checkout.session.') && !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(String(obj.id))) return;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = await deps.stripe.request<StripeSession>('GET', `/v1/checkout/sessions/${obj.id}`, {
        expand: ['shipping_cost.shipping_rate', 'total_details.breakdown'],
      });
      // Delayed methods complete "unpaid" first; async_payment_succeeded follows.
      if (!isPaidSession(session)) return;
      const r = await deps.db.rpc<{ found: boolean; order_id?: string }>('shop_mark_paid', { p_session: session.id, p: paidOrderData(session) });
      if (!r.found) {
        console.warn('stripe-webhook: paid session with no order', session.id);
        return;
      }
      // Sent once per order, whether this delivery or an earlier one made it paid.
      await deliverEmail(emailDeps(deps), r.order_id!, 'confirmation', `confirmation:${r.order_id}`);
      return;
    }
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      await deps.db.rpc('shop_checkout_ended', {
        p_session: obj.id,
        p_status: event.type === 'checkout.session.expired' ? 'expired' : 'failed',
        p_detail: { event: event.id },
      });
      return;
    }
    case 'payment_intent.payment_failed': {
      // A declined card inside an open checkout: she can try another card, so the order
      // stays pending (and its stock held) until it's paid or the session expires.
      const err = (obj.last_payment_error ?? {}) as { message?: string; code?: string; decline_code?: string };
      await deps.db.rpc('shop_note_event', {
        p_order: (obj.metadata as Record<string, string> | undefined)?.order_id ?? null,
        p_payment_intent: obj.id,
        p_kind: 'payment_failed',
        p_detail: { message: err.message ?? null, code: err.code ?? null, decline_code: err.decline_code ?? null },
        p_flag: null,
      });
      return;
    }
    case 'charge.refunded': {
      const pi = idOf(obj.payment_intent);
      if (!pi) return;
      await applyRefund(deps, pi, Number(obj.amount_refunded ?? 0), 'stripe');
      return;
    }
    case 'refund.failed': {
      await deps.db.rpc('shop_note_event', {
        p_order: (obj.metadata as Record<string, string> | undefined)?.order_id ?? null,
        p_payment_intent: idOf(obj.payment_intent),
        p_kind: 'refund_failed',
        p_detail: { amount_cents: obj.amount ?? null, reason: obj.failure_reason ?? null },
        p_flag: 'refund_failed',
      });
      return;
    }
    case 'charge.dispute.created': {
      await deps.db.rpc('shop_note_event', {
        p_order: null,
        p_payment_intent: idOf(obj.payment_intent),
        p_kind: 'dispute_opened',
        p_detail: { amount_cents: obj.amount ?? null, reason: obj.reason ?? null },
        p_flag: 'disputed',
      });
      return;
    }
    default:
      return;
  }
}

/**
 * Records Stripe's refunded total and emails the customer once per new total. Shared with
 * shop-admin. `email` is what happened to the refund email: this call's outcome, or, when an
 * earlier call (e.g. Stripe's own webhook) already recorded this total, that email's logged status.
 */
export async function applyRefund(deps: ShopDeps, paymentIntent: string, refundedTotal: number, actor: string) {
  const r = await deps.db.rpc<{ found: boolean; transitioned?: boolean; order_id?: string; amount_cents?: number }>('shop_apply_refund', {
    p_payment_intent: paymentIntent,
    p_refunded_cents: refundedTotal,
    p_actor: actor,
  });
  let email: string | null = null;
  if (r.found && r.order_id) {
    const key = `refund:${r.order_id}:${refundedTotal}`;
    if (r.transitioned) {
      email = await deliverEmail(emailDeps(deps), r.order_id, 'refund', key, { refundCents: r.amount_cents });
    } else {
      const [row] = await deps.db.select<{ status: string }>('shop_email_log', `dedupe_key=eq.${encodeURIComponent(key)}&select=status`);
      email = row?.status ?? null;
    }
  }
  return { ...r, email };
}
