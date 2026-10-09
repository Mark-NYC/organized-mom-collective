/**
 * Direct website shop, browser side: /checkout, /checkout/complete and /admin/orders.
 *
 * Build-time config (public by design, see .env.example):
 *   PUBLIC_SHOP_ENABLED                "true" turns the /checkout page on. Off by default.
 *   PUBLIC_STRIPE_PUBLISHABLE_KEY      pk_test_… (pk_live_… only after live payments are approved)
 *   PUBLIC_SUPABASE_URL / _ANON_KEY    shared with the survey
 *
 * The browser never sees prices it can change, stock counts, or other customers' data:
 * checkout goes through the shop-checkout Edge Function, payment state comes from the
 * database (set only by the Stripe webhook), and the dashboard reads through row-level
 * security as a signed-in admin. Server side: supabase/functions/, supabase/SHOP.md.
 */
import { toCsv } from './csv';

const SUPABASE = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const ANON = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';
const STRIPE_PK = import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export const shopEnabled = () => import.meta.env.PUBLIC_SHOP_ENABLED === 'true';
export const shopConfigured = () => Boolean(SUPABASE && ANON && STRIPE_PK);
export const supabaseConfigured = () => Boolean(SUPABASE && ANON);
export const stripeTestMode = () => STRIPE_PK.startsWith('pk_test_');

/** "$34" for whole dollars, "$34.50" otherwise. */
export const money = (cents: number | null | undefined) => {
  const c = cents ?? 0;
  return c % 100 === 0 ? `$${(c / 100).toLocaleString('en-US')}` : `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
export const orderLabel = (n: number | null | undefined) => (n ? `#${n}` : '—');

// ------------------------------------------------------------------ catalog + checkout

export interface ShopProduct {
  slug: string;
  name: string;
  edition: string | null;
  description: string;
  details: string[];
  price_cents: number;
  weeks: number | null;
  images: { src: string; alt: string }[];
  includes_companion: boolean;
  available: boolean;
  max_quantity: number;
}

export interface Catalog {
  checkout_mode: 'off' | 'preview' | 'live';
  tax_mode: 'off' | 'automatic' | 'manual';
  products: ShopProduct[];
  shipping_rates: { label: string; amount_cents: number }[];
}

async function rpc<T>(name: string, body: object): Promise<T> {
  const res = await fetch(`${SUPABASE}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} ${res.status}`);
  return (await res.json()) as T;
}

export const loadCatalog = () => rpc<Catalog>('shop_catalog', {});

const PREVIEW_KEY = 'omc:v1:shop-preview';

/** /checkout?preview=TOKEN lets the owner test while checkout is in preview mode. Kept for this tab only. */
export function previewToken(): string {
  try {
    const fromUrl = new URLSearchParams(location.search).get('preview');
    if (fromUrl) {
      sessionStorage.setItem(PREVIEW_KEY, fromUrl);
      const url = new URL(location.href);
      url.searchParams.delete('preview');
      history.replaceState(null, '', url);
    }
    return sessionStorage.getItem(PREVIEW_KEY) ?? '';
  } catch {
    return '';
  }
}

export type CheckoutError = 'checkout_closed' | 'rate_limited' | 'sold_out' | 'unavailable' | 'too_many' | 'invalid_cart' | 'payment_unavailable' | 'network';

async function callCheckout(body: object): Promise<Response> {
  const preview = previewToken();
  return fetch(`${SUPABASE}/functions/v1/shop-checkout`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json', ...(preview ? { 'x-shop-preview': preview } : {}) },
    body: JSON.stringify(body),
  });
}

export async function startCheckout(items: { slug: string; quantity: number }[]): Promise<{ client_secret: string; session_id: string } | { error: CheckoutError }> {
  try {
    const res = await callCheckout({ action: 'create', items });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.client_secret) return data;
    const known: CheckoutError[] = ['checkout_closed', 'rate_limited', 'sold_out', 'unavailable', 'too_many', 'invalid_cart'];
    return { error: known.includes(data.error) ? data.error : 'payment_unavailable' };
  } catch {
    return { error: 'network' };
  }
}

/** Releases her held stock right away when she changes her order (otherwise it frees up when Stripe expires the session). */
export function cancelCheckout(sessionId: string) {
  callCheckout({ action: 'cancel', session_id: sessionId }).catch(() => {
    /* the session expires on its own */
  });
}

export interface OrderStatus {
  payment_status: OrderRow['payment_status'];
  fulfillment_status: OrderRow['fulfillment_status'];
  order_number: number | null;
  email_hint: string | null;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number | null;
  items: { name: string; quantity: number; unit_price_cents: number }[];
}

export const loadOrderStatus = (sessionId: string) => rpc<OrderStatus | null>('shop_order_status', { p_session: sessionId });

// Stripe.js must load from js.stripe.com (PCI); card details stay inside Stripe's iframe.
interface EmbeddedCheckout {
  mount(el: HTMLElement | string): void;
  destroy(): void;
}
interface StripeJs {
  initEmbeddedCheckout(opts: { fetchClientSecret: () => Promise<string> }): Promise<EmbeddedCheckout>;
}
declare global {
  interface Window {
    Stripe?: (key: string) => StripeJs;
  }
}

let stripePromise: Promise<StripeJs> | null = null;
export function loadStripe(): Promise<StripeJs> {
  stripePromise ??= new Promise((resolve, reject) => {
    const done = () => (window.Stripe ? resolve(window.Stripe(STRIPE_PK)) : reject(new Error('Stripe.js unavailable')));
    if (window.Stripe) return done();
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.async = true;
    s.onload = done;
    s.onerror = () => {
      stripePromise = null;
      reject(new Error('Stripe.js unavailable'));
    };
    document.head.appendChild(s);
  });
  return stripePromise;
}

// ------------------------------------------------------------------ admin data

export interface Address {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  unit_price_cents: number;
  quantity: number;
  restocked: number;
}

export interface OrderRow {
  id: string;
  order_number: number | null;
  created_at: string;
  updated_at: string;
  payment_status: 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'failed' | 'expired' | 'canceled';
  fulfillment_status: 'unfulfilled' | 'packing' | 'shipped' | 'delivered' | 'canceled';
  reservation: 'held' | 'converted' | 'released';
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  livemode: boolean | null;
  email: string | null;
  customer_name: string | null;
  phone: string | null;
  shipping_name: string | null;
  shipping_address: Address | null;
  shipping_method: string | null;
  promotion_code: string | null;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number | null;
  refunded_cents: number;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  flags: string[];
  admin_note: string | null;
  shop_order_items: OrderItem[];
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  edition: string | null;
  description: string;
  details: string[];
  price_cents: number;
  weeks: number | null;
  images: { src: string; alt: string }[];
  active: boolean;
  stock: number;
  max_per_order: number;
  sort: number;
}

export interface SettingsRow {
  checkout_mode: 'off' | 'preview' | 'live';
  tax_mode: 'off' | 'automatic' | 'manual';
  product_tax_code: string;
  checkout_minutes: number;
  max_checkouts_per_hour: number;
}

export interface ShippingRateRow {
  id: string;
  label: string;
  amount_cents: number;
  min_days: number | null;
  max_days: number | null;
  active: boolean;
  sort: number;
}

export interface OrderEvent {
  id: number;
  order_id: string;
  at: string;
  kind: string;
  detail: Record<string, unknown>;
  actor: string;
}

export interface EmailLogRow {
  id: number;
  order_id: string;
  kind: string;
  to_email: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  error: string | null;
  updated_at: string;
}

export interface InventoryLogRow {
  id: number;
  product_id: string;
  at: string;
  delta: number;
  stock_after: number;
  reason: string;
  actor: string;
}

async function select<T>(token: string, table: string, query: string): Promise<T[]> {
  const rows: T[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const res = await fetch(`${SUPABASE}/rest/v1/${table}?${query}&limit=${page}&offset=${offset}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) throw new Error('expired');
    if (!res.ok) throw new Error(`Couldn’t load ${table} (${res.status}).`);
    const batch = (await res.json()) as T[];
    rows.push(...batch);
    if (batch.length < page) return rows;
  }
}

export async function loadShopData(token: string) {
  const [orders, products, settings, rates, emails] = await Promise.all([
    select<OrderRow>(token, 'shop_orders', 'select=*,shop_order_items(*)&order=created_at.desc'),
    select<ProductRow>(token, 'shop_products', 'select=*&order=sort.asc'),
    select<SettingsRow>(token, 'shop_settings', 'select=*'),
    select<ShippingRateRow>(token, 'shop_shipping_rates', 'select=*&order=sort.asc,amount_cents.asc'),
    select<EmailLogRow>(token, 'shop_email_log', 'select=id,order_id,kind,to_email,status,error,updated_at&order=id.asc'),
  ]);
  return { orders, products, settings: settings[0] ?? null, rates, emails };
}

export const loadOrderEvents = (token: string, orderId: string) =>
  select<OrderEvent>(token, 'shop_order_events', `select=*&order_id=eq.${orderId}&order=at.asc`);

export const loadInventoryLog = (token: string) => select<InventoryLogRow>(token, 'shop_inventory_log', 'select=*&order=at.desc');

/** Every dashboard write goes through the shop-admin Edge Function, which re-checks the admin. */
export async function adminAction<T = Record<string, unknown>>(token: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE}/functions/v1/shop-admin`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('expired');
  if (!res.ok) throw new Error(adminErrorText(data.error ?? `error_${res.status}`));
  return data as T;
}

const ADMIN_ERRORS: Record<string, string> = {
  forbidden: 'This account isn’t a shop admin.',
  carrier_required: 'Add the carrier before marking it shipped.',
  not_payable_state: 'Only paid orders can be packed or shipped.',
  invalid_tracking_url: 'The tracking link must start with https://.',
  not_refundable: 'This order can’t be refunded.',
  no_payment_to_refund: 'Nothing was charged for this order, so there’s nothing to refund.',
  invalid_amount: 'Check the amount.',
  refund_failed: 'Stripe couldn’t make that refund. Check the payment in Stripe.',
  stock_negative: 'That would take stock below zero.',
  reason_required: 'Add a reason for the change.',
  stripe_not_configured: 'Stripe isn’t configured on the server yet.',
  live_payments_disabled: 'A live Stripe key is set but live payments aren’t enabled.',
  not_shipped: 'This order hasn’t shipped yet.',
  not_refunded: 'This order hasn’t been refunded.',
  not_paid: 'This order isn’t paid.',
  refund_first: 'Refund the order before returning its units to stock.',
};
const adminErrorText = (code: string) => ADMIN_ERRORS[code] ?? `Something went wrong (${code}).`;

// ------------------------------------------------------------------ dashboard logic (pure)

export const PAID_STATUSES: OrderRow['payment_status'][] = ['paid', 'partially_refunded', 'refunded'];
export const isPaid = (o: Pick<OrderRow, 'payment_status'>) => PAID_STATUSES.includes(o.payment_status);

export const PAYMENT_LABELS: Record<OrderRow['payment_status'], string> = {
  pending: 'In checkout',
  paid: 'Paid',
  partially_refunded: 'Partly refunded',
  refunded: 'Refunded',
  failed: 'Payment failed',
  expired: 'Abandoned',
  canceled: 'Canceled',
};

export const FULFILLMENT_LABELS: Record<OrderRow['fulfillment_status'], string> = {
  unfulfilled: 'To pack',
  packing: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  canceled: 'Canceled',
};

export interface OrderFilter {
  q?: string;
  /** 'any_paid' (default) = paid, partly refunded or refunded; 'all' adds abandoned and in-progress checkouts. */
  payment?: 'any_paid' | 'all' | OrderRow['payment_status'];
  fulfillment?: '' | OrderRow['fulfillment_status'] | 'to_ship';
  from?: string;
  to?: string;
}

const dayStart = (d: string) => new Date(`${d}T00:00:00`).getTime();

export function filterOrders(orders: OrderRow[], f: OrderFilter): OrderRow[] {
  const q = (f.q ?? '').trim().toLowerCase().replace(/^#/, '');
  return orders.filter((o) => {
    const payment = f.payment ?? 'any_paid';
    if (payment === 'any_paid' ? !isPaid(o) : payment !== 'all' && o.payment_status !== payment) return false;
    if (f.fulfillment === 'to_ship') {
      if (!(isPaid(o) && o.payment_status !== 'refunded' && (o.fulfillment_status === 'unfulfilled' || o.fulfillment_status === 'packing'))) return false;
    } else if (f.fulfillment && o.fulfillment_status !== f.fulfillment) return false;
    const t = new Date(o.created_at).getTime();
    if (f.from && t < dayStart(f.from)) return false;
    if (f.to && t >= dayStart(f.to) + 86_400_000) return false;
    if (!q) return true;
    const hay = [
      o.order_number ? String(o.order_number) : '',
      o.email,
      o.customer_name,
      o.shipping_name,
      o.tracking_number,
      o.shipping_address?.city,
      o.shipping_address?.postal_code,
      o.stripe_payment_intent_id,
      o.id,
      ...o.shop_order_items.map((i) => i.product_name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export interface SalesTotals {
  orders: number;
  units: number;
  gross_cents: number;
  refunded_cents: number;
  net_cents: number;
  shipping_cents: number;
  tax_cents: number;
  average_cents: number;
  to_ship: number;
}

/** Sales numbers over paid orders only (abandoned and failed checkouts never count). */
export function salesTotals(orders: OrderRow[]): SalesTotals {
  const paid = orders.filter(isPaid);
  const sum = (f: (o: OrderRow) => number) => paid.reduce((n, o) => n + f(o), 0);
  const gross = sum((o) => o.total_cents ?? 0);
  const refunded = sum((o) => o.refunded_cents);
  return {
    orders: paid.length,
    units: sum((o) => o.shop_order_items.reduce((n, i) => n + i.quantity, 0)),
    gross_cents: gross,
    refunded_cents: refunded,
    net_cents: gross - refunded,
    shipping_cents: sum((o) => o.shipping_cents),
    tax_cents: sum((o) => o.tax_cents),
    average_cents: paid.length ? Math.round(gross / paid.length) : 0,
    to_ship: paid.filter((o) => o.payment_status !== 'refunded' && (o.fulfillment_status === 'unfulfilled' || o.fulfillment_status === 'packing')).length,
  };
}

/** Units sitting in open checkouts right now, per product. */
export function heldUnits(orders: OrderRow[]): Map<string, number> {
  const held = new Map<string, number>();
  for (const o of orders) {
    if (o.reservation !== 'held') continue;
    for (const i of o.shop_order_items) held.set(i.product_id, (held.get(i.product_id) ?? 0) + i.quantity);
  }
  return held;
}

/** Units sold through the website (paid, not returned to stock), per product. */
export function soldUnits(orders: OrderRow[]): Map<string, number> {
  const sold = new Map<string, number>();
  for (const o of orders) {
    if (!isPaid(o)) continue;
    for (const i of o.shop_order_items) sold.set(i.product_id, (sold.get(i.product_id) ?? 0) + i.quantity - i.restocked);
  }
  return sold;
}

const dollars = (c: number | null | undefined) => ((c ?? 0) / 100).toFixed(2);

export function ordersCsv(orders: OrderRow[]): string {
  const header = [
    'order_number', 'created_at', 'paid_at', 'payment_status', 'fulfillment_status', 'email', 'customer_name',
    'ship_name', 'ship_line1', 'ship_line2', 'ship_city', 'ship_state', 'ship_postal_code', 'ship_country',
    'items', 'units', 'subtotal', 'discount', 'promotion_code', 'shipping', 'shipping_method', 'tax', 'total', 'refunded',
    'carrier', 'tracking_number', 'shipped_at', 'delivered_at', 'flags', 'note', 'stripe_payment_intent', 'test_mode', 'order_id',
  ];
  const rows = orders.map((o) => {
    const a = o.shipping_address ?? {};
    return [
      o.order_number ? String(o.order_number) : '',
      o.created_at,
      o.paid_at ?? '',
      o.payment_status,
      o.fulfillment_status,
      o.email ?? '',
      o.customer_name ?? '',
      o.shipping_name ?? '',
      a.line1 ?? '',
      a.line2 ?? '',
      a.city ?? '',
      a.state ?? '',
      a.postal_code ?? '',
      a.country ?? '',
      o.shop_order_items.map((i) => `${i.product_name} × ${i.quantity}`).join('; '),
      String(o.shop_order_items.reduce((n, i) => n + i.quantity, 0)),
      dollars(o.subtotal_cents),
      dollars(o.discount_cents),
      o.promotion_code ?? '',
      dollars(o.shipping_cents),
      o.shipping_method ?? '',
      dollars(o.tax_cents),
      dollars(o.total_cents),
      dollars(o.refunded_cents),
      o.carrier ?? '',
      o.tracking_number ?? '',
      o.shipped_at ?? '',
      o.delivered_at ?? '',
      o.flags.join('; '),
      o.admin_note ?? '',
      o.stripe_payment_intent_id ?? '',
      o.livemode === false ? 'yes' : o.livemode === true ? 'no' : '',
      o.id,
    ];
  });
  return toCsv([header, ...rows]);
}

export function addressLines(name: string | null, a: Address | null): string[] {
  if (!a) return [];
  return [
    name ?? '',
    a.line1 ?? '',
    a.line2 ?? '',
    [a.city, [a.state, a.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    a.country && a.country !== 'US' ? a.country : '',
  ].filter((l) => l.trim());
}

/** Explains a stored order event in a line, for the order timeline. */
export function describeEvent(e: Pick<OrderEvent, 'kind' | 'detail'>): string {
  const d = e.detail ?? {};
  const s = (k: string) => (d[k] == null ? '' : String(d[k]));
  switch (e.kind) {
    case 'checkout_started':
      return 'Checkout started';
    case 'paid':
      return `Payment confirmed by Stripe (${money(Number(d.total_cents ?? 0))})`;
    case 'payment_failed':
      return `Card attempt declined${s('decline_code') ? ` (${s('decline_code').replace(/_/g, ' ')})` : ''}`;
    case 'checkout_expired':
      return s('via') === 'customer_left' ? 'Customer left checkout; stock released' : 'Checkout expired; stock released';
    case 'checkout_failed':
      return 'Payment failed; stock released';
    case 'checkout_canceled':
      return 'Checkout couldn’t open; stock released';
    case 'refunded':
      return `Refunded ${money(Number(d.amount_cents ?? 0))} (total ${money(Number(d.refunded_total_cents ?? 0))})`;
    case 'restocked':
      return `${s('units')} unit(s) returned to stock`;
    case 'fulfillment':
      return `Marked ${FULFILLMENT_LABELS[s('to') as OrderRow['fulfillment_status']] ?? s('to')}${s('to') === 'shipped' && s('tracking_number') ? ` · ${s('carrier')} ${s('tracking_number')}` : ''}`;
    case 'email_sent':
      return `Email sent: ${s('kind')}`;
    case 'email_failed':
      return `Email failed: ${s('kind')}${s('error') ? ` (${s('error')})` : ''}`;
    case 'email_skipped':
      return `Email not sent (no email provider configured): ${s('kind')}`;
    case 'refund_failed':
      return 'A refund failed in Stripe';
    case 'dispute_opened':
      return `Dispute opened${s('reason') ? `: ${s('reason').replace(/_/g, ' ')}` : ''}`;
    case 'note':
      return 'Note updated';
    default:
      return e.kind.replace(/_/g, ' ');
  }
}

export const FLAG_LABELS: Record<string, string> = {
  oversold: 'Oversold: paid after its hold expired and stock had run out',
  amount_mismatch: 'Amount didn’t match the reserved order; check it in Stripe',
  disputed: 'Payment disputed',
  refund_failed: 'A refund failed',
};
