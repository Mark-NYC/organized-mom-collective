/**
 * Pure checkout logic: the Stripe Checkout Session we create from a reserved order, and
 * the order details we record from a completed session. No I/O, so it's unit tested
 * directly (tests/shop.test.ts).
 */
import type { Address } from './db.ts';

/** What shop_create_order returns. */
export interface ReservedOrder {
  order_id: string;
  subtotal_cents: number;
  checkout_minutes: number;
  tax_mode: 'off' | 'automatic' | 'manual';
  product_tax_code: string;
  items: {
    product_id: string;
    slug: string;
    name: string;
    edition: string | null;
    unit_price_cents: number;
    quantity: number;
    image: string | null;
  }[];
  shipping_rates: { id: string; label: string; amount_cents: number; min_days: number | null; max_days: number | null }[];
  tax_rates: { state: string; percentage: number; label: string; stripe_ids: Record<string, string> }[];
}

/** Stripe's tax code for shipping charges (used with Stripe Tax). */
export const SHIPPING_TAX_CODE = 'txcd_92010001';

const absolute = (src: string, siteUrl: string) => (/^https:\/\//.test(src) ? src : `${siteUrl}${src.startsWith('/') ? '' : '/'}${src}`);

export function sessionParams(order: ReservedOrder, opts: { siteUrl: string; nowSeconds: number; taxRateIds: string[] }) {
  const automatic = order.tax_mode === 'automatic';
  return {
    mode: 'payment',
    ui_mode: 'embedded',
    return_url: `${opts.siteUrl}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
    client_reference_id: order.order_id,
    metadata: { order_id: order.order_id },
    payment_intent_data: { metadata: { order_id: order.order_id }, description: 'Organized Mom Collective order' },
    // Cards, plus Apple Pay and Google Pay (wallets ride on the card method).
    payment_method_types: ['card'],
    line_items: order.items.map((i) => ({
      quantity: i.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: i.unit_price_cents,
        tax_behavior: 'exclusive',
        product_data: {
          name: i.edition ? `${i.name} (${i.edition})` : i.name,
          images: i.image ? [absolute(i.image, opts.siteUrl)] : undefined,
          tax_code: automatic ? order.product_tax_code : undefined,
          metadata: { slug: i.slug },
        },
      },
      dynamic_tax_rates: opts.taxRateIds.length ? opts.taxRateIds : undefined,
    })),
    shipping_address_collection: { allowed_countries: ['US'] },
    shipping_options: order.shipping_rates.slice(0, 5).map((r) => ({
      shipping_rate_data: {
        type: 'fixed_amount',
        display_name: r.label,
        fixed_amount: { amount: r.amount_cents, currency: 'usd' },
        tax_behavior: 'exclusive',
        tax_code: automatic ? SHIPPING_TAX_CODE : undefined,
        delivery_estimate:
          r.min_days || r.max_days
            ? {
                minimum: r.min_days ? { unit: 'business_day', value: r.min_days } : undefined,
                maximum: r.max_days ? { unit: 'business_day', value: r.max_days } : undefined,
              }
            : undefined,
      },
    })),
    automatic_tax: { enabled: automatic },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    customer_creation: 'if_required',
    submit_type: 'pay',
    expires_at: opts.nowSeconds + order.checkout_minutes * 60,
  };
}

// ------------------------------------------------------------------ completed sessions

/** The fields of a Checkout Session the shop reads. Covers both pre- and post-2025 API shapes. */
export interface StripeSession {
  id: string;
  object?: string;
  status?: string | null;
  payment_status?: string;
  livemode?: boolean;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  payment_intent?: string | { id: string } | null;
  amount_subtotal?: number | null;
  amount_total?: number | null;
  currency?: string | null;
  customer_details?: { email?: string | null; name?: string | null; phone?: string | null } | null;
  shipping_details?: { name?: string | null; address?: Address | null } | null;
  collected_information?: { shipping_details?: { name?: string | null; address?: Address | null } | null } | null;
  shipping_cost?: { amount_total?: number; shipping_rate?: string | { display_name?: string | null } | null } | null;
  total_details?: {
    amount_discount?: number;
    amount_shipping?: number;
    amount_tax?: number;
    breakdown?: { discounts?: { discount?: Record<string, unknown> }[] } | null;
  } | null;
}

export const isPaidSession = (s: StripeSession) =>
  s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required');

function promotionLabel(s: StripeSession): string | null {
  const d = s.total_details?.breakdown?.discounts?.[0]?.discount;
  if (!d) return null;
  const promo = d.promotion_code as { code?: string } | string | undefined;
  if (promo && typeof promo === 'object' && promo.code) return promo.code;
  const coupon = (d.coupon ?? (d.source as { coupon?: unknown } | undefined)?.coupon) as { name?: string; id?: string } | string | undefined;
  if (coupon && typeof coupon === 'object') return coupon.name ?? coupon.id ?? null;
  if (typeof promo === 'string') return promo;
  return typeof coupon === 'string' ? coupon : null;
}

/** What shop_mark_paid records from a completed (re-fetched) session. */
export function paidOrderData(s: StripeSession) {
  const ship = s.collected_information?.shipping_details ?? s.shipping_details ?? null;
  const pi = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null);
  const rate = s.shipping_cost?.shipping_rate;
  const t = s.total_details ?? {};
  return {
    order_id: s.metadata?.order_id ?? s.client_reference_id ?? null,
    payment_intent: pi,
    livemode: Boolean(s.livemode),
    email: s.customer_details?.email ?? null,
    name: s.customer_details?.name ?? null,
    phone: s.customer_details?.phone ?? null,
    shipping_name: ship?.name ?? s.customer_details?.name ?? null,
    shipping_address: ship?.address ?? null,
    shipping_method: rate && typeof rate === 'object' ? (rate.display_name ?? null) : null,
    promotion_code: promotionLabel(s),
    currency: s.currency ?? null,
    subtotal_cents: s.amount_subtotal ?? null,
    discount_cents: t.amount_discount ?? 0,
    shipping_cents: t.amount_shipping ?? s.shipping_cost?.amount_total ?? 0,
    tax_cents: t.amount_tax ?? 0,
    total_cents: s.amount_total ?? null,
  };
}

/** Validates the browser's cart: 1–10 lines of { slug, quantity }. Prices never come from the browser. */
export function parseCart(raw: unknown): { slug: string; quantity: number }[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10) return null;
  const out: { slug: string; quantity: number }[] = [];
  for (const line of raw) {
    if (!line || typeof line !== 'object') return null;
    const { slug, quantity } = line as Record<string, unknown>;
    if (typeof slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) return null;
    out.push({ slug, quantity });
  }
  return out;
}

/** Maps a shop_create_order error to an HTTP status and a code the page understands. */
export function checkoutError(message: string): { status: number; code: string; slug?: string } {
  const [code, slug] = message.split(':');
  switch (code) {
    case 'checkout_closed':
      return { status: 403, code };
    case 'shipping_not_configured':
      return { status: 503, code };
    case 'rate_limited':
      return { status: 429, code };
    case 'sold_out':
    case 'unavailable':
    case 'too_many':
      return { status: 409, code, slug };
    case 'invalid_cart':
      return { status: 400, code };
    default:
      return { status: 500, code: 'server_error' };
  }
}
