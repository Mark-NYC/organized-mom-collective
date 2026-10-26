/**
 * Stripe objects (API 2025-03-31.basil) → the rows the Club's database functions take. Pure, no I/O: tested in
 * tests/club-billing.test.ts. Basil notes: a subscription's period lives on its item; an invoice's subscription is
 * invoice.parent.subscription_details.subscription; a renewal invoice's own period_start/end is the PREVIOUS period,
 * so the period being paid for is read from its lines.
 */
import type { ClubPlan } from './deps.ts';

const iso = (s: unknown) => (typeof s === 'number' && s > 0 ? new Date(s * 1000).toISOString() : null);
export const idOf = (v: unknown): string | null =>
  typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: string }).id) : null;

export interface StripeSubscription {
  id: string;
  customer: string | { id: string };
  status: string;
  livemode: boolean;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  ended_at: number | null;
  start_date: number;
  pause_collection?: { behavior?: string } | null;
  metadata?: Record<string, string>;
  items: { data: { current_period_start?: number; current_period_end?: number; price: { id: string; recurring?: { interval?: string } | null } }[] };
}

export interface StripeInvoiceLine {
  amount: number;
  period?: { start: number; end: number };
  parent?: { subscription_item_details?: { proration?: boolean } | null } | null;
  pricing?: { price_details?: { price?: string } | null } | null;
}

export interface StripeInvoice {
  id: string;
  status: string;
  livemode: boolean;
  billing_reason?: string | null;
  amount_due: number;
  amount_paid: number;
  attempt_count?: number;
  period_start: number;
  period_end: number;
  customer: string | { id: string };
  status_transitions?: { paid_at?: number | null };
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  lines: { data: StripeInvoiceLine[] };
}

/** A recurring interval → plan. Anything else isn't a Club price. */
export const planOfInterval = (interval: string | undefined | null): ClubPlan | null =>
  interval === 'month' ? 'monthly' : interval === 'year' ? 'annual' : null;

export function subscriptionRow(s: StripeSubscription, userId: string | null, eventAt: number | null) {
  const item = s.items.data[0];
  return {
    id: s.id,
    customer: idOf(s.customer),
    user_id: userId,
    status: s.status,
    plan: planOfInterval(item?.price?.recurring?.interval),
    price_id: item?.price?.id ?? 'unknown',
    current_period_start: iso(item?.current_period_start),
    current_period_end: iso(item?.current_period_end),
    cancel_at_period_end: Boolean(s.cancel_at_period_end),
    canceled_at: iso(s.canceled_at),
    ended_at: iso(s.ended_at),
    started_at: iso(s.start_date) ?? new Date().toISOString(),
    livemode: s.livemode,
    pause_collection: s.pause_collection?.behavior ?? null,
    event_at: iso(eventAt),
  };
}

export const invoiceSubscription = (inv: StripeInvoice): string | null => idOf(inv.parent?.subscription_details?.subscription ?? null);

/**
 * The periods a paid invoice buys: each charged (positive, non-proration-credit) recurring line's own period.
 * A period of more than 40 days is a year (annual), otherwise a month. Lines without a period buy nothing.
 */
export function paidPeriods(inv: StripeInvoice): { start: string; end: string; plan: ClubPlan }[] {
  const out: { start: string; end: string; plan: ClubPlan }[] = [];
  for (const line of inv.lines?.data ?? []) {
    if (!line.period || !(line.amount > 0)) continue;
    const days = (line.period.end - line.period.start) / 86400;
    if (days < 20) continue; // a short proration remainder isn't a delivery cycle
    out.push({ start: iso(line.period.start)!, end: iso(line.period.end)!, plan: days > 40 ? 'annual' : 'monthly' });
  }
  return out;
}

export function invoiceRow(inv: StripeInvoice, payment: { paymentIntent: string | null; charge: string | null; failure: string | null }) {
  const periods = paidPeriods(inv);
  return {
    id: inv.id,
    subscription: invoiceSubscription(inv),
    status: inv.status,
    billing_reason: inv.billing_reason ?? null,
    amount_due_cents: inv.amount_due,
    amount_paid_cents: inv.amount_paid,
    // The period paid for (from the lines); the invoice's own fields when it has no recurring line.
    period_start: periods[0]?.start ?? iso(inv.period_start),
    period_end: periods[0]?.end ?? iso(inv.period_end),
    paid_at: iso(inv.status_transitions?.paid_at ?? null),
    livemode: inv.livemode,
    payment_intent: payment.paymentIntent,
    charge: payment.charge,
    attempt_count: inv.attempt_count ?? 0,
    failure_message: payment.failure,
    plan: periods[0]?.plan ?? null,
  };
}

/** Stripe Checkout's shipping details (basil: collected_information.shipping_details) → an address row. */
export function checkoutAddress(session: Record<string, unknown>): Record<string, string> | null {
  const ci = (session.collected_information ?? {}) as { shipping_details?: { name?: string; address?: Record<string, string> } | null };
  const sd = ci.shipping_details ?? (session.shipping_details as { name?: string; address?: Record<string, string> } | null) ?? null;
  const a = sd?.address;
  if (!sd?.name || !a?.line1 || !a.city || !a.state || !a.postal_code) return null;
  return { name: sd.name, line1: a.line1, line2: a.line2 ?? '', city: a.city, state: a.state, postal_code: a.postal_code, country: a.country ?? 'US' };
}

export const LIVE_STATUSES = ['trialing', 'active', 'past_due', 'unpaid', 'paused', 'incomplete'];

/** "m•••@gmail.com", for the page after checkout. */
export const maskEmail = (email: string) => email.replace(/^(.)[^@]*(@.*)$/, (_, a: string, b: string) => `${a}•••${b}`);

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
