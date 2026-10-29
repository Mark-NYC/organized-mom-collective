/**
 * POST /functions/v1/club-webhook (Stripe only; its own endpoint and signing secret, separate from the shop's).
 *
 * Every request needs a valid Stripe signature. Each event id is processed once (club_stripe_events). The handler
 * never trusts the payload's state: it re-reads the subscription, invoice, charge or session from the API and hands
 * the database the current truth, so duplicate and out-of-order deliveries converge on the same rows. Access is
 * granted only by club_invoice_apply from a PAID invoice's line periods; emails are deduped by key.
 */
import { clubStripeBlocked, CLUB_PRODUCT_TAG, type ClubDeps } from '../club/deps.ts';
import { longDate, monthLabel, sendClubEmail } from '../club/emails.ts';
import { findOrCreateUser } from '../club/members.ts';
import {
  checkoutAddress,
  idOf,
  invoiceRow,
  invoiceSubscription,
  paidPeriods,
  subscriptionRow,
  type StripeInvoice,
  type StripeSubscription,
} from '../club/stripe-map.ts';
import { json, type Handler } from '../http.ts';
import { verifyStripeSignature } from '../stripe.ts';

interface StripeEvent {
  id: string;
  type: string;
  livemode: boolean;
  created: number;
  data: { object: Record<string, unknown> };
}

export const CLUB_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.voided',
  'invoice.marked_uncollectible',
  'charge.refunded',
  'charge.dispute.created',
] as const;

/** The endpoint's signing secret: the function secret if set, else the one stripe_setup stored. */
export async function webhookSecret(deps: ClubDeps): Promise<string> {
  if (deps.env.clubWebhookSecret) return deps.env.clubWebhookSecret;
  const name = deps.stripe.mode === 'live' ? 'webhook_secret_live' : 'webhook_secret_test';
  const [row] = await deps.db.select<{ value: string }>('club_secret', `name=eq.${name}&select=value`);
  return row?.value ?? '';
}

export function createClubWebhookHandler(deps: ClubDeps): Handler {
  return async (req) => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const blocked = clubStripeBlocked(deps);
    if (blocked) return json({ error: blocked }, 503);
    const raw = await req.text();
    const secret = await webhookSecret(deps);
    if (!(await verifyStripeSignature(raw, req.headers.get('stripe-signature'), secret, deps.now()))) {
      return json({ error: 'invalid_signature' }, 400);
    }
    let event: StripeEvent;
    try {
      event = JSON.parse(raw);
    } catch {
      return json({ error: 'invalid_payload' }, 400);
    }
    if (event.livemode !== (deps.stripe.mode === 'live')) return json({ error: 'mode_mismatch' }, 400);

    const state = await deps.db.rpc<'new' | 'retry' | 'done'>('club_stripe_event_begin', { p_id: event.id, p_type: event.type });
    if (state === 'done') return json({ received: true, duplicate: true });
    try {
      await handleClubEvent(deps, event);
      await deps.db.rpc('club_stripe_event_done', { p_id: event.id });
      return json({ received: true });
    } catch (err) {
      // Not marked done: Stripe retries it, and every step is safe to repeat.
      console.error('club-webhook', event.type, event.id, err);
      return json({ error: 'processing_failed' }, 500);
    }
  };
}

export async function handleClubEvent(deps: ClubDeps, event: StripeEvent) {
  const obj = event.data.object;
  const id = String(obj.id ?? '');
  switch (event.type) {
    case 'checkout.session.completed':
      return checkoutCompleted(deps, id, event.created);
    case 'checkout.session.expired':
      return void (await deps.db.rpc('club_checkout_ended', { p_session: id, p_status: 'expired' }));
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      return void (await syncSubscription(deps, id, event.created));
    case 'invoice.paid':
    case 'invoice.voided':
    case 'invoice.marked_uncollectible':
      return void (await applyInvoice(deps, id, event.created, false));
    case 'invoice.payment_failed':
      return void (await applyInvoice(deps, id, event.created, true));
    case 'charge.refunded':
      return chargeRefunded(deps, id);
    case 'charge.dispute.created':
      return disputeCreated(deps, id);
    default:
      return;
  }
}

interface Member {
  userId: string;
  email: string;
}

/** Her account for a Stripe customer: the stored link, else the customer's email (account created if needed). */
async function memberFor(deps: ClubDeps, customerId: string, hint?: { userId?: string | null; email?: string | null }): Promise<Member> {
  const [row] = await deps.db.select<{ user_id: string | null; email: string }>('club_customers', `stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=user_id,email`);
  if (row?.user_id) return { userId: row.user_id, email: row.email };
  const c = await deps.stripe.request<{ email: string | null; metadata?: Record<string, string> }>('GET', `/v1/customers/${customerId}`);
  const email = (c.email ?? hint?.email ?? '').toLowerCase();
  if (!email) throw new Error('customer_without_email');
  const userId = hint?.userId || c.metadata?.user_id || (await findOrCreateUser(deps, email));
  await deps.db.rpc('club_member_link', { p_user: userId, p_email: email, p_customer: customerId, p_livemode: deps.stripe.mode === 'live' });
  return { userId, email };
}

async function checkoutCompleted(deps: ClubDeps, sessionId: string, eventAt: number) {
  const s = await deps.stripe.request<Record<string, unknown>>('GET', `/v1/checkout/sessions/${sessionId}`);
  const meta = (s.metadata ?? {}) as Record<string, string>;
  if (meta.club !== CLUB_PRODUCT_TAG || s.mode !== 'subscription') return;
  const customer = idOf(s.customer);
  if (!customer) return;
  const details = (s.customer_details ?? {}) as { email?: string };
  const member = await memberFor(deps, customer, { userId: meta.user_id ?? (s.client_reference_id as string | null), email: details.email ?? meta.email });
  const address = checkoutAddress(s);
  if (address) await deps.db.rpc('club_address_from_checkout', { p_user: member.userId, p: address });
  await deps.db.rpc('club_checkout_ended', { p_session: sessionId, p_status: 'complete' });
  const subId = idOf(s.subscription);
  if (!subId) return;
  const sub = await syncSubscription(deps, subId, eventAt);
  const latest = sub && idOf((sub as unknown as { latest_invoice?: unknown }).latest_invoice);
  if (latest) await applyInvoice(deps, latest, eventAt, false);
}

/** Re-reads a subscription and writes Stripe's current state. Returns it (null: not a Club subscription). */
export async function syncSubscription(deps: ClubDeps, subId: string, eventAt: number | null): Promise<StripeSubscription | null> {
  const sub = await deps.stripe.request<StripeSubscription & { latest_invoice?: unknown }>('GET', `/v1/subscriptions/${subId}`);
  if (sub.metadata?.club !== CLUB_PRODUCT_TAG) return null;
  const member = await memberFor(deps, idOf(sub.customer)!, { userId: sub.metadata?.user_id, email: sub.metadata?.email });
  const row = subscriptionRow(sub, member.userId, eventAt);
  const r = await deps.db.rpc<{ duplicate: boolean; previous_status: string | null; status: string; previous_cancel_at_period_end: boolean | null; cancel_at_period_end: boolean }>(
    'club_subscription_sync', { p: row });
  if (r.duplicate) {
    await cancelDuplicate(deps, sub, member.userId);
    return null;
  }
  const key = `canceled:${sub.id}`;
  if (r.cancel_at_period_end && r.previous_cancel_at_period_end !== true && row.status !== 'canceled') {
    await sendClubEmail(deps, key, 'canceled', member.userId, member.email, { ended: false, endsOn: row.current_period_end ? longDate(row.current_period_end) : null });
  } else if (row.status === 'canceled' && r.previous_status !== 'canceled') {
    await sendClubEmail(deps, key, 'canceled', member.userId, member.email, { ended: true });
  }
  return sub;
}

/**
 * Two checkouts finished for one account (two tabs, a webhook in flight): keep the first membership, cancel the
 * second at once and refund what it charged. Stripe's idempotency keys make a retry harmless.
 */
async function cancelDuplicate(deps: ClubDeps, sub: StripeSubscription & { latest_invoice?: unknown }, userId: string) {
  console.warn('club-webhook: duplicate subscription, canceling', sub.id);
  if (!['canceled', 'incomplete_expired'].includes(sub.status)) {
    await deps.stripe.request('DELETE', `/v1/subscriptions/${sub.id}`, {}, `club-dup-cancel:${sub.id}`);
  }
  // Kept as a canceled, flagged record, so a late or replayed invoice.paid for it never grants anything.
  const ended = await deps.stripe.request<StripeSubscription>('GET', `/v1/subscriptions/${sub.id}`);
  await deps.db.rpc('club_subscription_sync', { p: subscriptionRow(ended, userId, null) });
  await deps.db.rpc('club_subscription_flag', { p_sub: sub.id, p_flag: 'duplicate' });
  const invoice = idOf(sub.latest_invoice);
  if (!invoice) return;
  const pays = await deps.stripe.request<{ data: { status: string; payment: { payment_intent?: string | { id: string } } }[] }>(
    'GET', '/v1/invoice_payments', { invoice });
  for (const pay of pays.data.filter((x) => x.status === 'paid')) {
    const pi = idOf(pay.payment.payment_intent);
    if (pi) await deps.stripe.request('POST', '/v1/refunds', { payment_intent: pi, reason: 'duplicate', metadata: { club: CLUB_PRODUCT_TAG } }, `club-dup-refund:${pi}`);
  }
}

async function paymentFor(deps: ClubDeps, invoiceId: string): Promise<{ paymentIntent: string | null; charge: string | null; failure: string | null }> {
  const pays = await deps.stripe.request<{ data: { status: string; payment: { payment_intent?: string | { id: string } } }[] }>(
    'GET', '/v1/invoice_payments', { invoice: invoiceId, limit: 10 });
  const pay = pays.data.find((x) => x.status === 'paid') ?? pays.data[0];
  const pi = idOf(pay?.payment?.payment_intent ?? null);
  if (!pi) return { paymentIntent: null, charge: null, failure: null };
  const intent = await deps.stripe.request<{ latest_charge?: string | { id: string } | null; last_payment_error?: { message?: string } | null }>(
    'GET', `/v1/payment_intents/${pi}`);
  return { paymentIntent: pi, charge: idOf(intent.latest_charge ?? null), failure: intent.last_payment_error?.message ?? null };
}

export async function applyInvoice(deps: ClubDeps, invoiceId: string, eventAt: number, failed: boolean) {
  const inv = await deps.stripe.request<StripeInvoice>('GET', `/v1/invoices/${invoiceId}`);
  const subId = invoiceSubscription(inv);
  if (!subId) return;
  let [known] = await deps.db.select<{ id: string }>('club_subscriptions', `stripe_subscription_id=eq.${encodeURIComponent(subId)}&select=id`);
  if (!known) {
    // The invoice arrived first: bring the subscription in, then the invoice.
    if (!(await syncSubscription(deps, subId, eventAt))) return;
    [known] = await deps.db.select<{ id: string }>('club_subscriptions', `stripe_subscription_id=eq.${encodeURIComponent(subId)}&select=id`);
    if (!known) return;
  }
  const payment = inv.status === 'paid' || failed ? await paymentFor(deps, inv.id) : { paymentIntent: null, charge: null, failure: null };
  const r = await deps.db.rpc<{ granted: number; first_paid: boolean; months: string[]; user_id?: string }>('club_invoice_apply', {
    p: invoiceRow(inv, payment),
    p_periods: inv.status === 'paid' ? paidPeriods(inv) : [],
  });
  const member = await memberFor(deps, idOf(inv.customer)!);
  if (r.first_paid) {
    const first = [...r.months].sort()[0];
    await sendClubEmail(deps, `welcome:${member.userId}`, 'welcome', member.userId, member.email, {
      plan: paidPeriods(inv)[0]?.plan ?? null,
      monthLabel: first ? monthLabel(first) : undefined,
    });
  }
  if (failed && inv.status !== 'paid') {
    await sendClubEmail(deps, `payment_failed:${inv.id}`, 'payment_failed', member.userId, member.email, {});
  }
}

/** The invoice a payment intent paid (basil: through the InvoicePayments API). */
async function invoiceForPaymentIntent(deps: ClubDeps, pi: string): Promise<string | null> {
  const r = await deps.stripe.request<{ data: { invoice: string | { id: string } }[] }>('GET', '/v1/invoice_payments', {
    'payment[type]': 'payment_intent',
    'payment[payment_intent]': pi,
    limit: 1,
  });
  return idOf(r.data[0]?.invoice ?? null);
}

async function chargeRefunded(deps: ClubDeps, chargeId: string) {
  const ch = await deps.stripe.request<{ payment_intent?: string | { id: string } | null; amount_refunded: number }>('GET', `/v1/charges/${chargeId}`);
  const pi = idOf(ch.payment_intent ?? null);
  if (!pi) return;
  const invoice = await invoiceForPaymentIntent(deps, pi);
  if (!invoice) return;
  // Not ours (a shop order): found = false, nothing changes.
  await deps.db.rpc('club_invoice_refund', { p_invoice: invoice, p_refunded_cents: ch.amount_refunded });
}

async function disputeCreated(deps: ClubDeps, disputeId: string) {
  const d = await deps.stripe.request<{ payment_intent?: string | { id: string } | null }>('GET', `/v1/disputes/${disputeId}`);
  const pi = idOf(d.payment_intent ?? null);
  if (!pi) return;
  const invoice = await invoiceForPaymentIntent(deps, pi);
  if (invoice) await deps.db.rpc('club_invoice_dispute', { p_invoice: invoice });
}
