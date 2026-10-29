/**
 * An in-memory Stripe for the Club's lifecycle tests (tests/club-billing-e2e.test.ts): customers, prices by lookup
 * key, subscription-mode Checkout, subscriptions, invoices with line periods (API 2025-03-31.basil shapes),
 * InvoicePayments, payment intents, charges, refunds, disputes, the Billing Portal and webhook endpoints. Only what
 * the Club's functions call, with idempotency keys honored. Simulation helpers move a subscription through its life
 * and return the events Stripe would send.
 */
import { randomBytes } from 'node:crypto';
import { parseForm } from '../shop/fakes';

const rand = (n = 12) => randomBytes(n).toString('hex').slice(0, n * 2);
const DAY = 86400;

export interface Ev {
  id: string;
  type: string;
  livemode: boolean;
  created: number;
  data: { object: { id: string } };
}

interface Sub {
  id: string;
  customer: string;
  status: string;
  livemode: boolean;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  ended_at: number | null;
  start_date: number;
  pause_collection: null;
  metadata: Record<string, string>;
  items: { data: { current_period_start: number; current_period_end: number; price: { id: string; recurring: { interval: string } } }[] };
  latest_invoice: string | null;
}

interface Inv {
  id: string;
  status: string;
  livemode: boolean;
  billing_reason: string;
  amount_due: number;
  amount_paid: number;
  attempt_count: number;
  period_start: number;
  period_end: number;
  customer: string;
  status_transitions: { paid_at: number | null };
  parent: { subscription_details: { subscription: string } };
  lines: { data: { amount: number; period: { start: number; end: number }; parent: { subscription_item_details: { proration: boolean } }; pricing: { price_details: { price: string } } }[] };
  payment_intent: string;
}

export class FakeClubStripe {
  customers = new Map<string, { id: string; email: string; metadata: Record<string, string> }>();
  prices = new Map<string, { id: string; product: string; lookup_key: string; unit_amount: number; interval: string }>();
  products: string[] = [];
  sessions = new Map<string, Record<string, unknown>>();
  subs = new Map<string, Sub>();
  invoices = new Map<string, Inv>();
  intents = new Map<string, { id: string; invoice: string; status: string; latest_charge: string | null; last_payment_error: { message: string } | null }>();
  charges = new Map<string, { id: string; payment_intent: string; amount: number; amount_refunded: number }>();
  disputes = new Map<string, { id: string; payment_intent: string }>();
  refunds: { id: string; payment_intent: string; amount: number; reason?: string }[] = [];
  portals: string[] = [];
  endpoints: { id: string; url: string; secret: string; events: string[] }[] = [];
  requests: { method: string; path: string }[] = [];
  private idem = new Map<string, unknown>();
  private n = 0;
  clock = Math.floor(Date.UTC(2026, 10, 2, 15) / 1000);

  private evt(type: string, id: string): Ev {
    return { id: `evt_${rand()}`, type, livemode: false, created: this.clock + this.n++, data: { object: { id } } };
  }

  async handle(method: string, url: URL, body: string, headers: Headers): Promise<Response> {
    this.requests.push({ method, path: url.pathname });
    if (!headers.get('authorization')?.startsWith('Bearer sk_test_')) return this.err(401, 'Invalid API key');
    const key = headers.get('idempotency-key');
    if (key && this.idem.has(`${url.pathname}:${key}`)) return this.ok(this.idem.get(`${url.pathname}:${key}`));
    const q = url.searchParams;
    const p = method === 'POST' ? parseForm(body) : {};
    const r = this.route(method, url.pathname, q, p as Record<string, unknown>);
    if (r instanceof Response) return r;
    if (key) this.idem.set(`${url.pathname}:${key}`, r);
    return this.ok(r);
  }

  private ok(v: unknown) {
    return new Response(JSON.stringify(v), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  private err(status: number, message: string) {
    return new Response(JSON.stringify({ error: { message } }), { status });
  }

  private route(method: string, path: string, q: URLSearchParams, p: Record<string, any>): unknown {
    const seg = path.split('/').filter(Boolean).slice(1); // drop v1
    const [kind, id] = seg;
    if (method === 'GET' && kind === 'prices') {
      const lk = q.get('lookup_keys[]');
      return { data: [...this.prices.values()].filter((x) => x.lookup_key === lk).map((x) => ({ id: x.id, product: x.product })) };
    }
    if (method === 'POST' && kind === 'products') {
      const pid = `prod_${rand()}`;
      this.products.push(pid);
      return { id: pid };
    }
    if (method === 'POST' && kind === 'prices') {
      const pr = { id: `price_${rand()}`, product: p.product, lookup_key: p.lookup_key, unit_amount: Number(p.unit_amount), interval: p.recurring.interval };
      this.prices.set(pr.id, pr);
      return { id: pr.id };
    }
    if (method === 'POST' && path === '/v1/billing_portal/configurations') {
      const cid = `bpc_${rand()}`;
      this.portals.push(cid);
      return { id: cid };
    }
    if (method === 'POST' && path === '/v1/billing_portal/sessions') {
      if (!this.customers.has(p.customer)) return this.err(400, 'No such customer');
      return { url: `https://billing.stripe.test/p/${rand()}` };
    }
    if (method === 'POST' && kind === 'webhook_endpoints') {
      const ep = { id: `we_${rand()}`, url: p.url, secret: `whsec_${rand()}`, events: Object.values(p.enabled_events ?? {}) as string[] };
      this.endpoints.push(ep);
      return ep;
    }
    if (kind === 'customers') {
      if (method === 'POST' && !id) {
        const c = { id: `cus_${rand()}`, email: p.email, metadata: p.metadata ?? {} };
        this.customers.set(c.id, c);
        return { id: c.id };
      }
      const c = this.customers.get(id);
      if (!c) return this.err(404, 'No such customer');
      if (method === 'POST') c.email = p.email ?? c.email;
      return c;
    }
    if (kind === 'checkout' && seg[1] === 'sessions') {
      const sid = seg[2];
      if (method === 'POST' && !sid) {
        const s = {
          id: `cs_test_${rand(16)}`, mode: p.mode, status: 'open', payment_status: 'unpaid', livemode: false,
          customer: p.customer, subscription: null, client_reference_id: p.client_reference_id ?? null,
          metadata: p.metadata ?? {}, subscription_metadata: p.subscription_data?.metadata ?? {},
          price: p.line_items?.[0]?.price, expires_at: Number(p.expires_at), url: `https://checkout.stripe.test/${rand()}`,
          customer_details: null, collected_information: null,
        };
        this.sessions.set(s.id, s);
        return s;
      }
      const s = this.sessions.get(sid);
      return s ?? this.err(404, 'No such session');
    }
    if (kind === 'subscriptions') {
      if (method === 'GET' && !id) {
        return { data: [...this.subs.values()].filter((s) => s.customer === q.get('customer')).map((s) => ({ id: s.id, status: s.status })) };
      }
      const s = this.subs.get(id);
      if (!s) return this.err(404, 'No such subscription');
      if (method === 'DELETE') {
        s.status = 'canceled';
        s.canceled_at = s.ended_at = this.clock;
      }
      return s;
    }
    if (kind === 'invoices') return this.invoices.get(id) ?? this.err(404, 'No such invoice');
    if (kind === 'invoice_payments') {
      const inv = q.get('invoice');
      const pi = q.get('payment[payment_intent]');
      const rows = [...this.intents.values()].filter((x) => (inv ? x.invoice === inv : x.id === pi))
        .map((x) => ({ status: x.status === 'succeeded' ? 'paid' : 'open', invoice: x.invoice, payment: { type: 'payment_intent', payment_intent: x.id } }));
      return { data: rows };
    }
    if (kind === 'payment_intents') return this.intents.get(id) ?? this.err(404, 'No such payment_intent');
    if (kind === 'charges') return this.charges.get(id) ?? this.err(404, 'No such charge');
    if (kind === 'disputes') return this.disputes.get(id) ?? this.err(404, 'No such dispute');
    if (method === 'POST' && kind === 'refunds') {
      const ch = [...this.charges.values()].find((c) => c.payment_intent === p.payment_intent);
      if (!ch) return this.err(400, 'No charge');
      const amount = ch.amount - ch.amount_refunded;
      ch.amount_refunded = ch.amount;
      const rf = { id: `re_${rand()}`, payment_intent: p.payment_intent, amount, reason: p.reason, status: 'succeeded' };
      this.refunds.push(rf);
      return rf;
    }
    return this.err(404, `fake: no route ${method} ${path}`);
  }

  // ---------------------------------------------------------------- simulation

  private priceOf(id: string) {
    return this.prices.get(id)!;
  }

  /** A new invoice for the subscription's current period; paid (with a charge) or failed. */
  private bill(sub: Sub, reason: string, paid: boolean): Inv {
    const item = sub.items.data[0];
    const price = this.priceOf(item.price.id);
    const inv: Inv = {
      id: `in_${rand()}`, status: paid ? 'paid' : 'open', livemode: false, billing_reason: reason,
      amount_due: price.unit_amount, amount_paid: paid ? price.unit_amount : 0, attempt_count: 1,
      // Like Stripe, a renewal's own period fields describe the period just ended.
      period_start: reason === 'subscription_create' ? item.current_period_start : item.current_period_start - (item.current_period_end - item.current_period_start),
      period_end: item.current_period_start,
      customer: sub.customer, status_transitions: { paid_at: paid ? this.clock : null },
      parent: { subscription_details: { subscription: sub.id } },
      lines: { data: [{ amount: price.unit_amount, period: { start: item.current_period_start, end: item.current_period_end }, parent: { subscription_item_details: { proration: false } }, pricing: { price_details: { price: price.id } } }] },
      payment_intent: `pi_${rand()}`,
    };
    this.invoices.set(inv.id, inv);
    const charge = paid ? `ch_${rand()}` : null;
    this.intents.set(inv.payment_intent, { id: inv.payment_intent, invoice: inv.id, status: paid ? 'succeeded' : 'requires_payment_method', latest_charge: charge, last_payment_error: paid ? null : { message: 'Your card was declined.' } });
    if (charge) this.charges.set(charge, { id: charge, payment_intent: inv.payment_intent, amount: price.unit_amount, amount_refunded: 0 });
    sub.latest_invoice = inv.id;
    return inv;
  }

  /** She pays on the Checkout page. Returns the events in the order Stripe tends to send them. */
  completeCheckout(sessionId: string, opts: { email: string; address?: Record<string, string> | null; declined?: boolean }): Ev[] {
    const s = this.sessions.get(sessionId)! as Record<string, any>;
    const price = this.priceOf(s.price);
    const days = price.interval === 'year' ? 365 : 30;
    const sub: Sub = {
      id: `sub_${rand()}`, customer: s.customer, status: opts.declined ? 'incomplete' : 'active', livemode: false,
      cancel_at_period_end: false, canceled_at: null, ended_at: null, start_date: this.clock, pause_collection: null,
      metadata: s.subscription_metadata,
      items: { data: [{ current_period_start: this.clock, current_period_end: this.clock + days * DAY, price: { id: price.id, recurring: { interval: price.interval } } }] },
      latest_invoice: null,
    };
    this.subs.set(sub.id, sub);
    const inv = this.bill(sub, 'subscription_create', !opts.declined);
    const cust = this.customers.get(s.customer)!;
    if (!cust.email) cust.email = opts.email;
    Object.assign(s, {
      status: opts.declined ? 'open' : 'complete', payment_status: opts.declined ? 'unpaid' : 'paid', subscription: sub.id,
      customer_details: { email: opts.email },
      collected_information: opts.address === null ? null : { shipping_details: { name: 'Mia Rivera', address: opts.address ?? { line1: '12 Oak Ln', city: 'Albany', state: 'NY', postal_code: '12203', country: 'US' } } },
    });
    if (opts.declined) return [this.evt('customer.subscription.created', sub.id), this.evt('invoice.payment_failed', inv.id)];
    return [
      this.evt('customer.subscription.created', sub.id),
      this.evt('invoice.paid', inv.id),
      this.evt('checkout.session.completed', sessionId),
      this.evt('customer.subscription.updated', sub.id),
    ];
  }

  /** The next period starts; the renewal invoice is paid or declined. */
  renew(subId: string, opts: { declined?: boolean } = {}): { events: Ev[]; invoice: string } {
    const sub = this.subs.get(subId)!;
    const item = sub.items.data[0];
    const len = item.current_period_end - item.current_period_start;
    this.clock = item.current_period_end + 60;
    item.current_period_start = item.current_period_end;
    item.current_period_end = item.current_period_start + len;
    const inv = this.bill(sub, 'subscription_cycle', !opts.declined);
    sub.status = opts.declined ? 'past_due' : 'active';
    return {
      invoice: inv.id,
      events: [this.evt('customer.subscription.updated', sub.id), this.evt(opts.declined ? 'invoice.payment_failed' : 'invoice.paid', inv.id)],
    };
  }

  /** Stripe's retry succeeds on an open invoice. */
  retrySucceeds(invoiceId: string): Ev[] {
    const inv = this.invoices.get(invoiceId)!;
    inv.status = 'paid';
    inv.amount_paid = inv.amount_due;
    inv.attempt_count++;
    inv.status_transitions.paid_at = this.clock;
    const pi = this.intents.get(inv.payment_intent)!;
    pi.status = 'succeeded';
    pi.latest_charge = `ch_${rand()}`;
    this.charges.set(pi.latest_charge, { id: pi.latest_charge, payment_intent: pi.id, amount: inv.amount_due, amount_refunded: 0 });
    const sub = this.subs.get(inv.parent.subscription_details.subscription)!;
    sub.status = 'active';
    return [this.evt('invoice.paid', inv.id), this.evt('customer.subscription.updated', sub.id)];
  }

  cancelAtPeriodEnd(subId: string): Ev[] {
    const s = this.subs.get(subId)!;
    s.cancel_at_period_end = true;
    s.canceled_at = this.clock;
    return [this.evt('customer.subscription.updated', subId)];
  }

  endPeriod(subId: string): Ev[] {
    const s = this.subs.get(subId)!;
    s.status = 'canceled';
    s.ended_at = s.items.data[0].current_period_end;
    return [this.evt('customer.subscription.deleted', subId)];
  }

  refundInvoice(invoiceId: string, amount?: number): Ev[] {
    const inv = this.invoices.get(invoiceId)!;
    const ch = this.charges.get(this.intents.get(inv.payment_intent)!.latest_charge!)!;
    ch.amount_refunded = Math.min(ch.amount, ch.amount_refunded + (amount ?? ch.amount));
    return [this.evt('charge.refunded', ch.id)];
  }

  /** The charge.refunded event for a refund the functions made through the API. */
  refundedEvent(invoiceId: string): Ev {
    const inv = this.invoices.get(invoiceId)!;
    return this.evt('charge.refunded', this.intents.get(inv.payment_intent)!.latest_charge!);
  }

  dispute(invoiceId: string): Ev[] {
    const inv = this.invoices.get(invoiceId)!;
    const d = { id: `dp_${rand()}`, payment_intent: inv.payment_intent };
    this.disputes.set(d.id, d);
    return [this.evt('charge.dispute.created', d.id)];
  }

  /** A subscription that isn't the Club's (anything else on the account). */
  foreignSubscription(): Ev[] {
    const id = `sub_${rand()}`;
    const anyPrice = [...this.prices.values()][0];
    this.subs.set(id, {
      id, customer: 'cus_other', status: 'active', livemode: false, cancel_at_period_end: false, canceled_at: null, ended_at: null,
      start_date: this.clock, pause_collection: null, metadata: {},
      items: { data: [{ current_period_start: this.clock, current_period_end: this.clock + 30 * DAY, price: { id: anyPrice.id, recurring: { interval: 'month' } } }] },
      latest_invoice: null,
    });
    return [this.evt('customer.subscription.created', id)];
  }
}
