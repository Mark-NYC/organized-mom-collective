/**
 * Test doubles for the shop's end-to-end tests (tests/shop-e2e.test.ts): an in-memory
 * Stripe API (only the endpoints the functions call, with Stripe's idempotency and state
 * rules), a Resend inbox, Supabase Auth's /user endpoint, and a fetch router that sends
 * everything else to the real local PostgREST.
 */
import { createHmac, randomBytes } from 'node:crypto';

const rand = (n = 14) => randomBytes(n).toString('hex').slice(0, n * 2);

/** Parses Stripe's form encoding back into nested objects/arrays. */
export function parseForm(body: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of new URLSearchParams(body)) {
    const path = key.replace(/\]/g, '').split('[');
    let node: Record<string, unknown> | unknown[] = out;
    path.forEach((part, i) => {
      const last = i === path.length - 1;
      const nextIsIndex = !last && /^\d+$/.test(path[i + 1]);
      const k = /^\d+$/.test(part) ? Number(part) : part;
      const holder = node as Record<string | number, unknown>;
      if (last) holder[k] = value;
      else {
        holder[k] ??= nextIsIndex ? [] : {};
        node = holder[k] as Record<string, unknown>;
      }
    });
  }
  return out;
}

export interface FakeSession {
  id: string;
  object: 'checkout.session';
  client_secret: string;
  status: 'open' | 'complete' | 'expired';
  payment_status: 'unpaid' | 'paid' | 'no_payment_required';
  livemode: boolean;
  metadata: Record<string, string>;
  client_reference_id: string;
  payment_intent: string | null;
  amount_subtotal: number;
  amount_total: number | null;
  currency: string;
  expires_at: number;
  params: Record<string, unknown>;
  customer_details: { email: string; name: string; phone: string | null } | null;
  collected_information: { shipping_details: { name: string; address: Record<string, string> } } | null;
  shipping_cost: { amount_total: number; shipping_rate: { id: string; display_name: string } } | null;
  total_details: { amount_discount: number; amount_shipping: number; amount_tax: number; breakdown?: unknown } | null;
}

export class FakeStripe {
  sessions = new Map<string, FakeSession>();
  charges = new Map<string, { id: string; payment_intent: string; amount: number; amount_refunded: number }>();
  refunds: { id: string; charge: string; amount: number }[] = [];
  taxRates: Record<string, unknown>[] = [];
  requests: { method: string; path: string; body: Record<string, unknown>; idempotencyKey: string | null }[] = [];
  private idem = new Map<string, unknown>();
  /** Make the next session create fail (Stripe outage). */
  failNextCreate = false;
  /** The key on the current request is a live key. */
  private live = false;

  async handle(method: string, url: URL, body: string, headers: Headers): Promise<Response> {
    const params = parseForm(method === 'GET' ? url.search.slice(1) : body);
    const idempotencyKey = headers.get('idempotency-key');
    this.requests.push({ method, path: url.pathname, body: params, idempotencyKey });
    if (!headers.get('authorization')?.startsWith('Bearer sk_')) return this.error(401, 'Invalid API key');
    if (idempotencyKey && this.idem.has(`${url.pathname}:${idempotencyKey}`)) return this.ok(this.idem.get(`${url.pathname}:${idempotencyKey}`));
    this.live = headers.get('authorization')!.startsWith('Bearer sk_live_');
    const result = this.route(method, url.pathname, params);
    if (result instanceof Response) return result;
    if (idempotencyKey) this.idem.set(`${url.pathname}:${idempotencyKey}`, result);
    return this.ok(result);
  }

  private route(method: string, path: string, p: Record<string, unknown>): unknown {
    let m: RegExpMatchArray | null;
    if (method === 'POST' && path === '/v1/checkout/sessions') return this.createSession(p);
    if (method === 'GET' && (m = path.match(/^\/v1\/checkout\/sessions\/([^/]+)$/))) {
      return this.sessions.get(m[1]) ?? this.error(404, 'No such checkout.session');
    }
    if (method === 'POST' && (m = path.match(/^\/v1\/checkout\/sessions\/([^/]+)\/expire$/))) {
      const s = this.sessions.get(m[1]);
      if (!s) return this.error(404, 'No such checkout.session');
      if (s.status !== 'open') return this.error(400, `Only Checkout Sessions with a status in ["open"] can be expired.`);
      s.status = 'expired';
      return s;
    }
    if (method === 'POST' && path === '/v1/refunds') return this.createRefund(p);
    if (method === 'GET' && (m = path.match(/^\/v1\/charges\/([^/]+)$/))) return this.charges.get(m[1]) ?? this.error(404, 'No such charge');
    if (method === 'POST' && path === '/v1/tax_rates') {
      const r = { id: `txr_${rand(8)}`, ...p };
      this.taxRates.push(r);
      return r;
    }
    return this.error(404, `Unrecognized request URL (${method}: ${path})`);
  }

  private createSession(p: Record<string, unknown>) {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      return this.error(500, 'An error occurred with our connection to Stripe.');
    }
    for (const k of ['mode', 'ui_mode', 'return_url', 'line_items', 'expires_at']) if (!(k in p)) return this.error(400, `Missing ${k}`);
    const expiresIn = Number(p.expires_at) - Math.floor(Date.now() / 1000);
    if (expiresIn < 1800 - 5 || expiresIn > 86400) return this.error(400, 'expires_at must be 30 minutes to 24 hours out');
    const lines = p.line_items as { quantity: string; price_data: { unit_amount: string } }[];
    const subtotal = lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.price_data.unit_amount), 0);
    const id = `cs_test_${rand(24)}`;
    const s: FakeSession = {
      id,
      object: 'checkout.session',
      client_secret: `${id}_secret_${rand(8)}`,
      status: 'open',
      payment_status: 'unpaid',
      livemode: this.live,
      metadata: (p.metadata as Record<string, string>) ?? {},
      client_reference_id: String(p.client_reference_id),
      payment_intent: null,
      amount_subtotal: subtotal,
      amount_total: null,
      currency: 'usd',
      expires_at: Number(p.expires_at),
      params: p,
      customer_details: null,
      collected_information: null,
      shipping_cost: null,
      total_details: null,
    };
    this.sessions.set(id, s);
    return s;
  }

  private createRefund(p: Record<string, unknown>) {
    const charge = [...this.charges.values()].find((c) => c.payment_intent === p.payment_intent);
    if (!charge) return this.error(404, 'No such payment_intent');
    const amount = p.amount ? Number(p.amount) : charge.amount - charge.amount_refunded;
    if (amount < 1 || amount > charge.amount - charge.amount_refunded) return this.error(400, 'Refund amount is greater than unrefunded amount');
    charge.amount_refunded += amount;
    const refund = { id: `re_${rand(10)}`, object: 'refund', status: 'succeeded', charge: charge.id, amount, payment_intent: charge.payment_intent };
    this.refunds.push(refund);
    return refund;
  }

  /** The customer pays in the embedded form. */
  complete(
    sessionId: string,
    opts: { email?: string; name?: string; shippingIndex?: number; discount?: number; tax?: number; address?: Record<string, string> } = {},
  ) {
    const s = this.sessions.get(sessionId)!;
    const options = (s.params.shipping_options as { shipping_rate_data: { display_name: string; fixed_amount: { amount: string } } }[]) ?? [];
    const rate = options[opts.shippingIndex ?? 0]?.shipping_rate_data;
    const shipping = Number(rate?.fixed_amount.amount ?? 0);
    const discount = opts.discount ?? 0;
    const tax = opts.tax ?? 0;
    const total = s.amount_subtotal - discount + shipping + tax;
    const pi = `pi_${rand(12)}`;
    s.status = 'complete';
    s.payment_status = total === 0 ? 'no_payment_required' : 'paid';
    s.payment_intent = total === 0 ? null : pi;
    s.amount_total = total;
    s.customer_details = { email: opts.email ?? 'jamie@example.com', name: opts.name ?? 'Jamie Rivera', phone: null };
    s.collected_information = {
      shipping_details: {
        name: opts.name ?? 'Jamie Rivera',
        address: opts.address ?? { line1: '12 Maple St', line2: '', city: 'Springfield', state: 'IL', postal_code: '62701', country: 'US' },
      },
    };
    s.shipping_cost = { amount_total: shipping, shipping_rate: { id: `shr_${rand(6)}`, display_name: rate?.display_name ?? '' } };
    s.total_details = {
      amount_discount: discount,
      amount_shipping: shipping,
      amount_tax: tax,
      breakdown: discount ? { discounts: [{ amount: discount, discount: { promotion_code: { code: 'WELCOME10' } } }] } : { discounts: [] },
    };
    if (total > 0) this.charges.set(`ch_${pi}`, { id: `ch_${pi}`, payment_intent: pi, amount: total, amount_refunded: 0 });
    return s;
  }

  chargeFor(pi: string) {
    return [...this.charges.values()].find((c) => c.payment_intent === pi)!;
  }

  private ok(body: unknown) {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  private error(status: number, message: string) {
    return new Response(JSON.stringify({ error: { message, type: 'invalid_request_error' } }), { status, headers: { 'Content-Type': 'application/json' } });
  }
}

export class FakeInbox {
  sent: { to: string[]; subject: string; html: string; text: string; from: string; reply_to?: string }[] = [];
  /** Make the next send fail (provider outage). */
  failNext = false;
  handle(body: string): Response {
    if (this.failNext) {
      this.failNext = false;
      return new Response(JSON.stringify({ message: 'Service unavailable' }), { status: 503 });
    }
    const msg = JSON.parse(body);
    this.sent.push(msg);
    return new Response(JSON.stringify({ id: `email_${this.sent.length}` }), { status: 200 });
  }
  to(email: string) {
    return this.sent.filter((m) => m.to.includes(email));
  }
}

/** HS256 JWT, as Supabase (legacy keys) and PostgREST use. */
export function jwt(payload: Record<string, unknown>, secret: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...payload })}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}

/**
 * fetch for the functions under test: Stripe → FakeStripe, Resend → FakeInbox,
 * Supabase Auth /user → `users` (token → user), /rest/v1 → the real PostgREST.
 */
export function routerFetch(opts: {
  supabaseUrl: string;
  restUrl: string;
  stripe: FakeStripe;
  inbox: FakeInbox;
  users: Map<string, { id: string; email: string }>;
}): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url);
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    const body = typeof init.body === 'string' ? init.body : '';
    if (url.origin === 'https://api.stripe.com') return opts.stripe.handle(method, url, body, headers);
    if (url.href === 'https://api.resend.com/emails') return opts.inbox.handle(body);
    if (url.href.startsWith(`${opts.supabaseUrl}/auth/v1/user`)) {
      const token = headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
      const user = opts.users.get(token);
      return user ? new Response(JSON.stringify(user), { status: 200 }) : new Response(JSON.stringify({ msg: 'invalid JWT' }), { status: 401 });
    }
    if (url.href.startsWith(`${opts.supabaseUrl}/rest/v1/`)) {
      return fetch(url.href.replace(`${opts.supabaseUrl}/rest/v1`, opts.restUrl), init);
    }
    throw new Error(`Unexpected fetch in test: ${method} ${url.href}`);
  }) as typeof fetch;
}
