import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import ConfirmationDialog from '../ConfirmationDialog';
import { adminSignIn, type AdminSession } from '../../lib/survey';
import {
  EMAIL_STATUS_LABELS,
  FLAG_LABELS,
  FULFILLMENT_LABELS,
  PAYMENT_LABELS,
  addressLines,
  adminAction,
  defaultOrderMode,
  describeEvent,
  emailOutcomeText,
  filterOrders,
  heldUnits,
  isPaid,
  loadInventoryLog,
  loadOrderEvents,
  loadShopData,
  money,
  orderLabel,
  ordersCsv,
  salesTotals,
  soldUnits,
  stripeTestMode,
  supabaseConfigured,
  type EmailLogRow,
  type EmailOutcome,
  type InventoryLogRow,
  type OrderEvent,
  type OrderFilter,
  type OrderRow,
  type ProductRow,
  type SettingsRow,
  type ShippingRateRow,
  type ShopStatus,
} from '../../lib/shop';

const TOKEN_KEY = 'omc:v1:shop-admin';
const inputClass = 'mt-1.5 block min-h-11 w-full rounded-[3px] border border-rule-strong bg-paper px-3 text-[1rem] focus:border-ink';
const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL', 'Other'];

type Data = Awaited<ReturnType<typeof loadShopData>>;

/**
 * /admin/orders: website orders, inventory and checkout settings, for Supabase Auth users
 * listed in shop_admins. Reads go through row-level security; writes through the
 * shop-admin Edge Function. Without an admin token the database returns nothing.
 */
export default function OrdersAdmin() {
  const [auth, setAuth] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as AdminSession | null;
      if (saved && saved.expires_at > Date.now() + 60_000) setAuth(saved);
    } catch {
      /* sign in again */
    }
    setReady(true);
  }, []);

  const signOut = () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing saved */
    }
    setAuth(null);
  };

  if (!ready) return null;
  if (!supabaseConfigured()) {
    return <p className="mt-8 text-[1.0625rem]">Supabase isn’t configured for this build. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY (see .env.example).</p>;
  }
  if (!auth) {
    return (
      <SignIn
        onSignedIn={(s) => {
          try {
            sessionStorage.setItem(TOKEN_KEY, JSON.stringify(s));
          } catch {
            /* this tab only */
          }
          setAuth(s);
        }}
      />
    );
  }
  return <Dashboard auth={auth} onSignOut={signOut} />;
}

function SignIn({ onSignedIn }: { onSignedIn: (s: AdminSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSignedIn(await adminSignIn(email.trim(), password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 max-w-sm space-y-4">
      <Field label="Email">
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Password">
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </Field>
      {error && (
        <p role="alert" className="text-[0.95rem] font-semibold">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="label text-soft">{label}</span>
      {children}
    </label>
  );
}

function Dashboard({ auth, onSignOut }: { auth: AdminSession; onSignOut: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'orders' | 'inventory' | 'settings'>('orders');
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadShopData(auth.access_token));
    } catch (err) {
      if ((err as Error).message === 'expired') onSignOut();
      else setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [auth.access_token]);

  /** Runs a dashboard action, shows the outcome (built from the server's answer), reloads. Returns the result or null. */
  const act = async <T,>(body: Record<string, unknown>, success: string | ((r: T) => string)): Promise<T | null> => {
    setNotice('');
    try {
      const r = await adminAction<T>(auth.access_token, body);
      setNotice(typeof success === 'function' ? success(r) : success);
      await reload();
      return r;
    } catch (err) {
      if ((err as Error).message === 'expired') onSignOut();
      else setNotice((err as Error).message);
      return null;
    }
  };

  const open = data?.orders.find((o) => o.id === openId) ?? null;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[0.9rem] text-soft">
        <span>
          Signed in as {auth.email}
          {stripeTestMode() && <span className="ml-3 rounded-full border border-dashed border-rule-strong px-2 py-0.5 text-[0.75rem] whitespace-nowrap">Stripe test mode</span>}
        </span>
        <span className="flex gap-5">
          <button type="button" onClick={reload} className="text-link">
            Refresh
          </button>
          <button type="button" onClick={onSignOut} className="text-link">
            Sign out
          </button>
        </span>
      </div>

      {data?.settings && data.settings.checkout_mode !== 'live' && (
        <p className="mt-4 border-l-[3px] border-month bg-band px-4 py-3 text-[0.95rem]">
          Website checkout is <strong>{data.settings.checkout_mode === 'off' ? 'off' : 'in preview (test link only)'}</strong>. Customers buy on Etsy. Change it under
          Settings.
        </p>
      )}

      <nav className="mt-6 flex gap-1 border-b border-rule" aria-label="Dashboard sections">
        {(['orders', 'inventory', 'settings'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-current={tab === t ? 'page' : undefined}
            onClick={() => {
              setTab(t);
              setOpenId(null);
              setNotice('');
            }}
            className={`relative min-h-11 px-3 text-[0.7rem] font-semibold tracking-[0.18em] uppercase ${tab === t ? 'text-ink' : 'text-muted hover:text-ink'}`}
          >
            {t}
            {tab === t && <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[3px] bg-month" />}
          </button>
        ))}
      </nav>

      {notice && (
        <p role="status" className="mt-4 rounded-[3px] bg-band px-4 py-3 text-[0.95rem] font-semibold">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 font-semibold">
          {error}
        </p>
      )}
      {loading && !data && <p className="mt-6">Loading…</p>}

      {data && (
        <div aria-busy={loading}>
          {tab === 'orders' &&
            (open ? (
              <OrderDetail order={open} emails={data.emails.filter((e) => e.order_id === open.id)} token={auth.access_token} act={act} onBack={() => setOpenId(null)} />
            ) : (
              <OrdersList orders={data.orders} onOpen={setOpenId} />
            ))}
          {tab === 'inventory' && <Inventory data={data} token={auth.access_token} act={act} />}
          {tab === 'settings' && data.settings && <Settings settings={data.settings} rates={data.rates} act={act} token={auth.access_token} />}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ orders list

function OrdersList({ orders, onOpen }: { orders: OrderRow[]; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<OrderFilter>(() => ({ payment: 'any_paid', fulfillment: '', q: '', from: '', to: '', mode: defaultOrderMode(orders) }));
  const set = (f: Partial<OrderFilter>) => setFilter((x) => ({ ...x, ...f }));
  const shown = useMemo(() => filterOrders(orders, filter), [orders, filter]);
  // Totals follow the date range and search, but always count paid orders only.
  const totals = useMemo(() => salesTotals(filterOrders(orders, { ...filter, payment: 'any_paid', fulfillment: '' })), [orders, filter]);

  const exportCsv = () => {
    const blob = new Blob([ordersCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${filter.from || 'start'}-to-${filter.to || new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      {filter.mode !== 'live' && orders.some((o) => o.livemode === false) && (
        <p className="mt-6 text-[0.9rem] text-soft">
          {filter.mode === 'test' ? 'Showing test orders only' : 'These numbers include test-mode orders'} (Stripe test mode, no real money).
        </p>
      )}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-rule bg-rule sm:grid-cols-4">
        <Stat label="Orders" value={String(totals.orders)} note={`${totals.units} calendar${totals.units === 1 ? '' : 's'}`} />
        <Stat label="Net sales" value={money(totals.net_cents)} note={totals.refunded_cents ? `${money(totals.gross_cents)} − ${money(totals.refunded_cents)} refunded` : 'after refunds'} />
        <Stat label="Average order" value={money(totals.average_cents)} note={`incl. ${money(totals.shipping_cents)} shipping, ${money(totals.tax_cents)} tax in total`} />
        <Stat label="To ship" value={String(totals.to_ship)} note="paid, not shipped" />
      </dl>

      <div className="mt-6 grid gap-3 border-y border-rule py-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
        <Field label="Search">
          <input
            type="search"
            value={filter.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Order #, name, email, tracking…"
            className={inputClass}
          />
        </Field>
        <Field label="Payment">
          <select value={filter.payment} onChange={(e) => set({ payment: e.target.value as OrderFilter['payment'] })} className={inputClass}>
            <option value="any_paid">All paid orders</option>
            {(['paid', 'partially_refunded', 'refunded'] as const).map((s) => (
              <option key={s} value={s}>
                {s === 'paid' ? 'Paid, no refund' : PAYMENT_LABELS[s]}
              </option>
            ))}
            <option value="pending">In checkout now</option>
            <option value="expired">Abandoned</option>
            <option value="failed">Payment failed</option>
            <option value="all">Everything</option>
          </select>
        </Field>
        <Field label="Orders">
          <select value={filter.mode} onChange={(e) => set({ mode: e.target.value as OrderFilter['mode'] })} className={inputClass}>
            <option value="all">Real and test</option>
            <option value="live">Real only</option>
            <option value="test">Test only</option>
          </select>
        </Field>
        <Field label="Shipping">
          <select value={filter.fulfillment} onChange={(e) => set({ fulfillment: e.target.value as OrderFilter['fulfillment'] })} className={inputClass}>
            <option value="">Any</option>
            <option value="to_ship">To ship</option>
            {(Object.keys(FULFILLMENT_LABELS) as OrderRow['fulfillment_status'][]).map((s) => (
              <option key={s} value={s}>
                {FULFILLMENT_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input type="date" value={filter.from} max={filter.to || undefined} onChange={(e) => set({ from: e.target.value })} className={inputClass} />
        </Field>
        <Field label="To">
          <input type="date" value={filter.to} min={filter.from || undefined} onChange={(e) => set({ to: e.target.value })} className={inputClass} />
        </Field>
        <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!shown.length}>
          Export CSV
        </button>
      </div>

      <p className="mt-4 text-[0.9rem] text-soft">
        {shown.length} order{shown.length === 1 ? '' : 's'}. Website orders only; Etsy orders aren’t here.
      </p>

      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {shown.length === 0 && <li className="py-6 text-center text-soft">No orders match.</li>}
        {shown.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => onOpen(o.id)} className="grid w-full gap-1 py-3.5 text-left hover:bg-band sm:grid-cols-[6rem_1fr_auto] sm:items-center sm:gap-4 sm:px-2">
              <span className="font-bold tabular-nums">
                {orderLabel(o.order_number)}
                {o.flags.length > 0 && (
                  <span title={o.flags.map((f) => FLAG_LABELS[f] ?? f).join('\n')} className="ml-1.5" aria-label="Needs attention">
                    ⚠
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{o.shipping_name || o.customer_name || o.email || 'Checkout in progress'}</span>
                <span className="block truncate text-[0.875rem] text-soft">
                  {new Date(o.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                  {o.shop_order_items.map((i) => `${i.product_name} × ${i.quantity}`).join(', ')}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="font-semibold tabular-nums">{money(o.total_cents ?? o.subtotal_cents)}</span>
                <Badge kind="payment" status={o.payment_status} />
                {isPaid(o) && <Badge kind="fulfillment" status={o.fulfillment_status} />}
                {o.livemode === false && <span className="status status-soon">Test</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Badge({ kind, status }: { kind: 'payment' | 'fulfillment'; status: string }) {
  const label = kind === 'payment' ? PAYMENT_LABELS[status as OrderRow['payment_status']] : FULFILLMENT_LABELS[status as OrderRow['fulfillment_status']];
  const strong = status === 'paid' || status === 'unfulfilled';
  const done = status === 'shipped' || status === 'delivered';
  return (
    <span
      className={`status ${
        strong ? 'bg-ink text-white' : done ? 'status-now' : status === 'packing' ? 'bg-month text-ink' : 'border border-dashed border-rule-strong text-soft'
      }`}
    >
      {label}
    </span>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-paper px-4 py-4">
      <dt className="label text-soft">{label}</dt>
      <dd className="mt-1.5 text-[1.6rem] leading-none font-bold tabular-nums sm:text-[1.9rem]">{value}</dd>
      {note && <dd className="mt-1.5 text-[0.8rem] leading-snug text-soft">{note}</dd>}
    </div>
  );
}

// ------------------------------------------------------------------ order detail

type Act = <T>(body: Record<string, unknown>, success: string | ((r: T) => string)) => Promise<T | null>;

interface FulfillmentResult {
  changed: boolean;
  status_changed: boolean;
  tracking_changed: boolean;
  email: EmailOutcome | null;
}
interface RefundResult {
  refund_status: string;
  restocked: number;
  email: EmailOutcome | 'pending' | null;
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function OrderDetail({ order: o, emails, token, act, onBack }: { order: OrderRow; emails: EmailLogRow[]; token: string; act: Act; onBack: () => void }) {
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [carrier, setCarrier] = useState(o.carrier && !CARRIERS.includes(o.carrier) ? 'Other' : (o.carrier ?? 'USPS'));
  const [otherCarrier, setOtherCarrier] = useState(o.carrier && !CARRIERS.includes(o.carrier) ? o.carrier : '');
  const [tracking, setTracking] = useState(o.tracking_number ?? '');
  const [trackingUrl, setTrackingUrl] = useState(o.tracking_url ?? '');
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState(o.admin_note ?? '');
  const remaining = (o.total_cents ?? 0) - o.refunded_cents;
  const [refundDollars, setRefundDollars] = useState((remaining / 100).toFixed(2));
  // Never ticked by default: only units that are physically back on the shelf go back in stock.
  const [restock, setRestock] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  // One id per deliberate resend: a double-submitted click sends once (see shop-admin resend_email).
  const [emailRequestId, setEmailRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadOrderEvents(token, o.id)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [o.id, o.updated_at, token]);

  useEffect(() => setRefundDollars((remaining / 100).toFixed(2)), [remaining]);
  // A different amount is a different refund: new idempotency key.
  useEffect(() => setRequestId(crypto.randomUUID()), [refundDollars, restock]);

  const paid = isPaid(o);
  const canShip = o.payment_status === 'paid' || o.payment_status === 'partially_refunded';
  const refundCents = Math.round(Number(refundDollars) * 100);
  const refundValid = Number.isFinite(refundCents) && refundCents >= 1 && refundCents <= remaining;
  const fullRefund = refundValid && refundCents === remaining;
  const unitsOut = o.shop_order_items.reduce((n, i) => n + i.quantity - i.restocked, 0);
  const unitsRestocked = o.shop_order_items.reduce((n, i) => n + i.restocked, 0);
  const refunded = o.refunded_cents > 0;
  const neverShipped = o.fulfillment_status === 'canceled' || o.fulfillment_status === 'unfulfilled' || o.fulfillment_status === 'packing';

  // Units only go back to stock together with a full refund.
  useEffect(() => {
    if (!fullRefund) setRestock(false);
  }, [fullRefund]);
  const carrierValue = carrier === 'Other' ? otherCarrier.trim() : carrier;
  const stripeUrl = o.stripe_payment_intent_id ? `https://dashboard.stripe.com/${o.livemode ? '' : 'test/'}payments/${o.stripe_payment_intent_id}` : null;

  const run = async <T,>(body: Record<string, unknown>, success: string | ((r: T) => string)) => {
    setBusy(true);
    const r = await act<T>(body, success);
    setBusy(false);
    return r;
  };

  const setStatus = (status: OrderRow['fulfillment_status']) =>
    run<FulfillmentResult>(
      { action: 'fulfillment', order_id: o.id, status, carrier: carrierValue, tracking_number: tracking, tracking_url: trackingUrl, notify: status === 'shipped' && notify },
      (r) => {
        if (!r.changed) return 'Nothing changed: same status and tracking. Nothing saved, no email sent.';
        const what = r.status_changed ? `Marked ${FULFILLMENT_LABELS[status].toLowerCase()}.` : 'Tracking updated.';
        if (status !== 'shipped') return what;
        return `${what} ${r.email ? emailOutcomeText('shipped', r.email) : 'No email sent (the box was unticked).'}`;
      },
    );

  const resend = (kind: string) =>
    run<{ email: EmailOutcome }>({ action: 'resend_email', order_id: o.id, kind, request_id: emailRequestId }, (r) => emailOutcomeText(kind, r.email)).finally(() =>
      setEmailRequestId(crypto.randomUUID()),
    );

  return (
    <div className="mt-6">
      <button type="button" onClick={onBack} className="text-link">
        ← All orders
      </button>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[1.6rem] leading-tight font-bold">Order {orderLabel(o.order_number)}</h2>
        <span className="flex flex-wrap gap-2">
          <Badge kind="payment" status={o.payment_status} />
          {paid && <Badge kind="fulfillment" status={o.fulfillment_status} />}
          {o.livemode === false && <span className="status status-soon">Test</span>}
        </span>
      </div>
      <p className="mt-1 text-[0.9rem] text-soft">
        Placed {new Date(o.created_at).toLocaleString()}
        {o.paid_at && ` · paid ${new Date(o.paid_at).toLocaleString()}`}
      </p>

      {o.flags.length > 0 && (
        <ul className="mt-4 space-y-1 border-l-[3px] border-month bg-band px-4 py-3 text-[0.95rem] font-semibold">
          {o.flags.map((f) => (
            <li key={f}>⚠ {FLAG_LABELS[f] ?? f}</li>
          ))}
        </ul>
      )}

      {refunded && unitsOut > 0 && (
        <p className="mt-4 border-l-[3px] border-month bg-band px-4 py-3 text-[0.95rem]">
          <strong>
            Refunded; {plural(unitsOut, 'unit')} not returned to stock.
          </strong>{' '}
          {neverShipped
            ? 'This order never shipped, so the calendars are probably still on your shelf. Return them to stock below if they are.'
            : 'Refunds don’t change inventory. Return units to stock below only once they’re back on your shelf and sellable.'}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Customer">
          <p className="font-semibold">{o.customer_name ?? '—'}</p>
          {o.email && (
            <p>
              <a href={`mailto:${o.email}`} className="underline decoration-rule underline-offset-4">
                {o.email}
              </a>
            </p>
          )}
          {o.phone && <p>{o.phone}</p>}
        </Panel>
        <Panel title="Ship to">
          {o.shipping_address ? (
            <>
              <p className="whitespace-pre-line">{addressLines(o.shipping_name, o.shipping_address).join('\n')}</p>
              <button
                type="button"
                className="text-link mt-3"
                onClick={() => navigator.clipboard?.writeText(addressLines(o.shipping_name, o.shipping_address).join('\n'))}
              >
                Copy address
              </button>
            </>
          ) : (
            <p className="text-soft">Not collected yet.</p>
          )}
          {o.shipping_method && <p className="mt-2 text-[0.9rem] text-soft">Chosen: {o.shipping_method}</p>}
        </Panel>
      </div>

      <Panel title="Items" className="mt-6">
        <dl>
          {o.shop_order_items.map((i) => (
            <Line key={i.id} label={`${i.product_name} × ${i.quantity}`} value={money(i.unit_price_cents * i.quantity)} />
          ))}
          <Line label="Subtotal" value={money(o.subtotal_cents)} />
          {o.discount_cents > 0 && <Line label={`Discount${o.promotion_code ? ` (${o.promotion_code})` : ''}`} value={`−${money(o.discount_cents)}`} />}
          <Line label="Shipping" value={money(o.shipping_cents)} />
          <Line label="Tax" value={money(o.tax_cents)} />
          <Line label="Total" value={money(o.total_cents)} strong />
          {o.refunded_cents > 0 && <Line label="Refunded" value={`−${money(o.refunded_cents)}`} />}
        </dl>
        {stripeUrl && (
          <a href={stripeUrl} target="_blank" rel="noopener noreferrer" className="text-link mt-4 inline-block">
            View payment in Stripe ↗
          </a>
        )}
      </Panel>

      {canShip && (
        <Panel title="Shipping" className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Carrier">
              <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputClass}>
                {CARRIERS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            {carrier === 'Other' && (
              <Field label="Carrier name">
                <input value={otherCarrier} onChange={(e) => setOtherCarrier(e.target.value)} maxLength={60} className={inputClass} />
              </Field>
            )}
            <Field label="Tracking number">
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={100} autoComplete="off" className={inputClass} />
            </Field>
            <Field label="Tracking link (optional)">
              <input
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://…"
                maxLength={500}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="mt-2 text-[0.85rem] text-soft">USPS, UPS and FedEx tracking links are filled in automatically from the number.</p>
          <label className="mt-4 flex items-center gap-2.5">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-[#545454]" />
            Email the customer when it ships or the tracking changes (saving the same details again sends nothing)
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" disabled={busy || o.fulfillment_status === 'packing'} onClick={() => setStatus('packing')}>
              Packing
            </button>
            <button type="button" className="btn-primary" disabled={busy || !carrierValue} onClick={() => setStatus('shipped')}>
              {o.fulfillment_status === 'shipped' ? 'Update tracking' : 'Mark shipped'}
            </button>
            <button type="button" className="btn-secondary" disabled={busy || o.fulfillment_status === 'delivered' || !o.carrier} onClick={() => setStatus('delivered')}>
              Delivered
            </button>
            {o.fulfillment_status !== 'unfulfilled' && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setStatus('unfulfilled')}>
                Back to “to pack”
              </button>
            )}
          </div>
        </Panel>
      )}

      {paid && (
        <Panel title="Refund" className="mt-6">
          {remaining > 0 && o.stripe_payment_intent_id ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[12rem_1fr] sm:items-end">
                <Field label={`Amount (up to ${money(remaining)})`}>
                  <input inputMode="decimal" value={refundDollars} onChange={(e) => setRefundDollars(e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} />
                </Field>
                {unitsOut > 0 && fullRefund && (
                  <label className="flex min-h-11 items-center gap-2.5">
                    <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="size-4 accent-[#545454]" />
                    Also put {plural(unitsOut, 'unit')} back in stock (only if {unitsOut === 1 ? 'it’s' : 'they’re'} on your shelf and sellable)
                  </label>
                )}
              </div>
              <button type="button" className="btn-secondary mt-4" disabled={busy || !refundValid} onClick={() => setConfirmRefund(true)}>
                Refund {refundValid ? money(refundCents) : ''}
              </button>
              <p className="mt-2 text-[0.85rem] text-soft">
                The refund goes back to the original payment method through Stripe, and the customer is emailed. A refund does <strong>not</strong> change
                inventory: units go back to stock only when you say so.
              </p>
            </>
          ) : (
            <p className="text-soft">{o.stripe_payment_intent_id ? 'Fully refunded.' : 'Nothing was charged for this order.'}</p>
          )}
          <ConfirmationDialog
            open={confirmRefund}
            title={`Refund ${money(refundCents)}?`}
            message={`This sends ${money(refundCents)} back to the customer through Stripe. ${
              restock && unitsOut ? `It also puts ${plural(unitsOut, 'unit')} back in stock.` : 'Stock stays as it is.'
            } It can’t be undone.`}
            confirmLabel="Refund"
            onCancel={() => setConfirmRefund(false)}
            onConfirm={async () => {
              setConfirmRefund(false);
              const done = await run<RefundResult>(
                { action: 'refund', order_id: o.id, amount_cents: refundCents, restock: restock && unitsOut > 0, request_id: requestId },
                (r) =>
                  `Refunded ${money(refundCents)}${r.refund_status === 'pending' ? ' (pending at Stripe)' : ''}. ${emailOutcomeText('refund', r.email)} ${
                    r.restocked ? `${plural(r.restocked, 'unit')} returned to stock.` : 'Stock not changed.'
                  }`,
              );
              // Keep the same request id after a failure: retrying then can't refund twice
              // (Stripe idempotency). A new id only for a new refund.
              if (done) {
                setRequestId(crypto.randomUUID());
                setRestock(false);
              }
            }}
          />
        </Panel>
      )}

      {paid && (
        <Panel title="Stock" className="mt-6">
          <ul className="space-y-3 text-[0.95rem]">
            {o.shop_order_items.map((i) => (
              <RestockLine key={i.id} item={i} canRestock={refunded} busy={busy} onRestock={(units) =>
                run<{ restocked: number }>({ action: 'restock', order_id: o.id, item_id: i.id, units }, (r) =>
                  r.restocked ? `${plural(r.restocked, 'unit')} returned to stock.` : 'Nothing returned: those units were already back in stock.',
                )
              } />
            ))}
          </ul>
          <p className="mt-3 text-[0.85rem] text-soft">
            {refunded
              ? `${plural(unitsRestocked, 'unit')} of this order ${unitsRestocked === 1 ? 'is' : 'are'} back in stock. Each unit can only be returned once.`
              : 'Sold units stay out of stock. After a refund, return the ones that come back to your shelf.'}
          </p>
        </Panel>
      )}

      {paid && (
        <Panel title="Emails" className="mt-6">
          {emails.length === 0 ? (
            <p className="text-soft">None yet.</p>
          ) : (
            <ul className="space-y-1.5 text-[0.95rem]">
              {emails.map((e) => (
                <li key={e.id}>
                  <span className="font-semibold">{emailKindLabel(e.kind)}</span> to {e.to_email}:{' '}
                  <span className={e.status === 'sent' ? '' : 'font-semibold'}>{EMAIL_STATUS_LABELS[e.status]}</span>
                  <span className="text-soft">
                    {' '}
                    · {new Date(e.updated_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    {e.attempts > 1 && ` · ${e.attempts} attempts`}
                    {e.error && e.status !== 'sent' && ` · ${e.error}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <EmailButton label={retryLabel(emails, 'confirmation', 'Resend receipt')} onClick={() => resend('confirmation')} busy={busy} />
            <EmailButton label={retryLabel(emails, 'access', 'Send companion instructions')} onClick={() => resend('access')} busy={busy} />
            {(o.fulfillment_status === 'shipped' || o.fulfillment_status === 'delivered') && (
              <EmailButton label={retryLabel(emails, 'shipped', 'Resend shipping email')} onClick={() => resend('shipped')} busy={busy} />
            )}
            {o.refunded_cents > 0 && <EmailButton label={retryLabel(emails, 'refund', 'Resend refund email')} onClick={() => resend('refund')} busy={busy} />}
          </div>
          <p className="mt-2 text-[0.85rem] text-soft">A failed or unsent email is retried as the same email, so the customer never gets two copies of it.</p>
        </Panel>
      )}

      <Panel title="Private note" className="mt-6">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={4000} className={`${inputClass} py-2`} />
        <button type="button" className="btn-secondary mt-3" disabled={busy || note === (o.admin_note ?? '')} onClick={() => run({ action: 'note', order_id: o.id, note }, 'Note saved.')}>
          Save note
        </button>
      </Panel>

      <Panel title="Timeline" className="mt-6">
        <ol className="space-y-1.5 text-[0.95rem]">
          {events.map((e) => (
            <li key={e.id} className="grid gap-x-4 sm:grid-cols-[11rem_1fr]">
              <span className="text-[0.85rem] text-soft tabular-nums">{new Date(e.at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span>
                {describeEvent(e)}
                {e.actor.startsWith('admin:') && <span className="text-soft"> · {e.actor.slice(6)}</span>}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

const emailKindLabel = (kind: string) => ({ confirmation: 'Receipt', shipped: 'Shipping', refund: 'Refund', access: 'Companion instructions' })[kind] ?? kind;

/** "Retry …" when the latest email of that kind didn't go out. */
function retryLabel(emails: EmailLogRow[], kind: string, label: string) {
  const latest = emails.filter((e) => e.kind === kind).at(-1);
  return latest && (latest.status === 'failed' || latest.status === 'skipped') ? `Retry ${emailKindLabel(kind).toLowerCase()} email` : label;
}

function RestockLine({ item: i, canRestock, busy, onRestock }: { item: OrderRow['shop_order_items'][number]; canRestock: boolean; busy: boolean; onRestock: (units: number) => void }) {
  const out = i.quantity - i.restocked;
  const [units, setUnits] = useState(String(out));
  useEffect(() => setUnits(String(out)), [out]);
  const n = Number(units);
  const valid = Number.isInteger(n) && n >= 1 && n <= out;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3">
      <span>
        <span className="font-semibold">{i.product_name}</span>: {i.quantity} sold
        {i.restocked > 0 ? `, ${i.restocked} returned to stock` : ''}
        {canRestock && out > 0 ? `, ${out} not returned` : ''}
      </span>
      {canRestock && out > 0 && (
        <span className="flex items-center gap-2">
          <input
            inputMode="numeric"
            aria-label={`Units of ${i.product_name} to return to stock`}
            value={units}
            onChange={(e) => setUnits(e.target.value.replace(/\D/g, ''))}
            className={`${inputClass} mt-0 w-16`}
          />
          <button type="button" className="btn-secondary" disabled={busy || !valid} onClick={() => onRestock(n)}>
            Return to stock
          </button>
        </span>
      )}
    </li>
  );
}

function EmailButton({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return (
    <button type="button" className="text-link" disabled={busy} onClick={onClick}>
      {label}
    </button>
  );
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[3px] border border-rule px-4 py-4 sm:px-5 ${className ?? ''}`}>
      <h3 className="label mb-3 text-soft">{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 border-b border-rule py-2 last:border-b-0 ${strong ? 'font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ inventory

function Inventory({ data, token, act }: { data: Data; token: string; act: Act }) {
  const held = useMemo(() => heldUnits(data.orders), [data.orders]);
  const sold = useMemo(() => soldUnits(data.orders), [data.orders]);
  // Units of refunded orders that haven't been returned to stock (refunds never restock on their own).
  const refundedOut = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of data.orders) {
      if (o.refunded_cents === 0) continue;
      for (const i of o.shop_order_items) m.set(i.product_id, (m.get(i.product_id) ?? 0) + i.quantity - i.restocked);
    }
    return m;
  }, [data.orders]);
  const [log, setLog] = useState<InventoryLogRow[]>([]);

  useEffect(() => {
    loadInventoryLog(token)
      .then(setLog)
      .catch(() => setLog([]));
  }, [data, token]);

  return (
    <div className="mt-6 space-y-6">
      <p className="text-[0.95rem] text-soft">
        Stock for website sales only. Etsy stock is separate: if a calendar sells on Etsy from the same shelf, take it out here too.
      </p>
      {data.products.map((p) => (
        <ProductCard key={p.id} product={p} held={held.get(p.id) ?? 0} sold={sold.get(p.id) ?? 0} refundedOut={refundedOut.get(p.id) ?? 0} act={act} />
      ))}
      <Panel title="Stock changes">
        {log.length === 0 ? (
          <p className="text-soft">None yet.</p>
        ) : (
          <ol className="space-y-1.5 text-[0.95rem]">
            {log.slice(0, 30).map((l) => (
              <li key={l.id} className="grid gap-x-4 sm:grid-cols-[11rem_1fr]">
                <span className="text-[0.85rem] text-soft tabular-nums">{new Date(l.at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span>
                  {data.products.find((p) => p.id === l.product_id)?.name}: {l.delta > 0 ? `+${l.delta}` : l.delta} → {l.stock_after}. {l.reason}
                  <span className="text-soft"> · {l.actor.replace(/^admin:/, '')}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function ProductCard({ product: p, held, sold, refundedOut, act }: { product: ProductRow; held: number; sold: number; refundedOut: number; act: Act }) {
  const [mode, setMode] = useState<'delta' | 'set'>('delta');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const n = Number(amount);
  const valid = amount.trim() !== '' && Number.isInteger(n) && (mode === 'set' ? n >= 0 : n !== 0 && p.stock + n >= 0) && reason.trim() !== '';

  const save = async () => {
    setBusy(true);
    const r = await act({ action: 'stock', product_id: p.id, [mode]: n, reason }, 'Stock updated.');
    if (r) {
      setAmount('');
      setReason('');
    }
    setBusy(false);
  };

  return (
    <Panel title={p.active ? 'Active' : 'Hidden from checkout'}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[1.2rem] leading-tight font-bold">
          {p.name}
          {p.edition && <span className="font-normal text-soft">, {p.edition}</span>}
        </h3>
        <span className="font-semibold tabular-nums">{money(p.price_cents)}</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[6px] border border-rule bg-rule">
        <Stat label="Available" value={String(p.stock)} note={p.stock === 0 ? 'sold out' : undefined} />
        <Stat label="In checkout" value={String(held)} note="held while paying" />
        <Stat label="Sold here" value={String(sold)} note={refundedOut ? `incl. ${refundedOut} refunded, not back in stock` : 'not returned to stock'} />
      </dl>
      {refundedOut > 0 && (
        <p className="mt-2 text-[0.85rem] text-soft">
          {plural(refundedOut, 'refunded unit')} {refundedOut === 1 ? 'hasn’t' : 'haven’t'} been returned to stock. Open the order to return {refundedOut === 1 ? 'it' : 'them'} once
          {refundedOut === 1 ? ' it’s' : ' they’re'} back on your shelf.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[9rem_7rem_1fr_auto] sm:items-end">
        <Field label="Change">
          <select value={mode} onChange={(e) => setMode(e.target.value as 'delta' | 'set')} className={inputClass}>
            <option value="delta">Add / remove</option>
            <option value="set">Set count to</option>
          </select>
        </Field>
        <Field label={mode === 'set' ? 'Count' : 'Units (+/−)'}>
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9-]/g, ''))} placeholder={mode === 'set' ? '25' : '-1'} className={inputClass} />
        </Field>
        <Field label="Reason">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="New print run, damaged, sold on Etsy…" className={inputClass} />
        </Field>
        <button type="button" className="btn-primary" disabled={busy || !valid} onClick={save}>
          Save
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        <button
          type="button"
          className="text-link"
          disabled={busy}
          onClick={() => act({ action: 'product', product_id: p.id, fields: { active: !p.active } }, p.active ? 'Hidden from checkout.' : 'Shown in checkout.')}
        >
          {p.active ? 'Hide from checkout' : 'Show in checkout'}
        </button>
        <button type="button" className="text-link" onClick={() => setEditing(!editing)}>
          {editing ? 'Close details' : 'Edit details'}
        </button>
      </div>
      {editing && <ProductEditor product={p} act={act} onDone={() => setEditing(false)} />}
    </Panel>
  );
}

function ProductEditor({ product: p, act, onDone }: { product: ProductRow; act: Act; onDone: () => void }) {
  const [name, setName] = useState(p.name);
  const [edition, setEdition] = useState(p.edition ?? '');
  const [price, setPrice] = useState((p.price_cents / 100).toFixed(2));
  const [maxPer, setMaxPer] = useState(String(p.max_per_order));
  const [shipUnits, setShipUnits] = useState(String(p.ship_units));
  const [description, setDescription] = useState(p.description);
  const [details, setDetails] = useState(p.details.join('\n'));
  const [images, setImages] = useState(p.images.map((i) => `${i.src} | ${i.alt}`).join('\n'));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const r = await act(
      {
        action: 'product',
        product_id: p.id,
        fields: {
          name: name.trim(),
          edition,
          price_cents: Math.round(Number(price) * 100),
          max_per_order: Number(maxPer),
          ship_units: Number(shipUnits),
          description: description.trim(),
          details: details.split('\n').map((d) => d.trim()).filter(Boolean),
          images: images
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => {
              const [src, ...alt] = l.split('|');
              return { src: src.trim(), alt: alt.join('|').trim() };
            }),
        },
      },
      'Product saved.',
    );
    setBusy(false);
    if (r) onDone();
  };

  return (
    <div className="mt-4 grid gap-3 border-t border-rule pt-4 sm:grid-cols-2">
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputClass} />
      </Field>
      <Field label="Edition (optional)">
        <input value={edition} onChange={(e) => setEdition(e.target.value)} maxLength={80} placeholder="January–June 2027" className={inputClass} />
      </Field>
      <Field label="Price ($)">
        <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} className={inputClass} />
      </Field>
      <Field label="Most per order">
        <input inputMode="numeric" value={maxPer} onChange={(e) => setMaxPer(e.target.value.replace(/\D/g, ''))} className={inputClass} />
      </Field>
      <Field label="Shipping units per calendar">
        <input inputMode="numeric" value={shipUnits} onChange={(e) => setShipUnits(e.target.value.replace(/\D/g, ''))} className={inputClass} />
      </Field>
      <p className="self-end text-[0.85rem] text-soft">How much shipping one of these takes, in “calendars”: 1 for the 26-week, 2 for the 52-week (two sets).</p>
      <Field label="Description" className="sm:col-span-2">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className={`${inputClass} py-2`} />
      </Field>
      <Field label="Details (one per line)" className="sm:col-span-2">
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={5} className={`${inputClass} py-2`} />
      </Field>
      <Field label="Photos (one per line: path | description)" className="sm:col-span-2">
        <textarea value={images} onChange={(e) => setImages(e.target.value)} rows={4} className={`${inputClass} py-2 font-mono text-[0.85rem]`} />
      </Field>
      <p className="text-[0.85rem] text-soft sm:col-span-2">
        Photos are real product photos from the site (/images/…) or https links. The first one shows in checkout and on Stripe’s payment page.
      </p>
      <div className="sm:col-span-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>
          Save product
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ settings

function Settings({ settings: s, rates, act, token }: { settings: SettingsRow; rates: ShippingRateRow[]; act: Act; token: string }) {
  const [confirm, setConfirm] = useState<SettingsRow['checkout_mode'] | null>(null);
  const [tax, setTax] = useState(s.tax_mode);
  const [confirmTax, setConfirmTax] = useState(false);
  const [taxCode, setTaxCode] = useState(s.product_tax_code);
  const [status, setStatus] = useState<ShopStatus | null>(null);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    adminAction<ShopStatus>(token, { action: 'status' })
      .then(setStatus)
      .catch((err: Error) => setStatusError(err.message));
  }, [token, s, rates]);

  return (
    <div className="mt-6 space-y-6">
      <Panel title="Launch readiness">
        {statusError && <p className="font-semibold">{statusError}</p>}
        {!status && !statusError && <p className="text-soft">Checking…</p>}
        {status && (
          <>
            <p className="text-[1.05rem] font-bold">
              {status.real_payments_possible
                ? 'Real payments are ON: anyone on /checkout can pay.'
                : status.public_checkout_open
                  ? 'Public checkout is open in Stripe TEST mode (no real charges).'
                  : 'Real payments are OFF.'}
            </p>
            <p className="mt-1 text-[0.9rem] text-soft">Real payments need every item marked ★. Preview mode never takes real money.</p>
            <ul className="mt-3 space-y-1.5 text-[0.95rem]">
              <Check ok={status.stripe_mode === 'live'} star label={`Stripe key: ${status.stripe_mode ?? 'not set'}`} />
              <Check ok={status.live_checkout_flag} star label="Deployment flag SHOP_LIVE_CHECKOUT=enabled (Supabase function secret)" />
              <Check ok={status.checkout_mode === 'live'} star label={`Store setting: ${status.checkout_mode === 'live' ? 'Open' : (status.checkout_mode ?? '—')} (below)`} />
              <Check ok={status.live_shipping_rates > 0} star label={`Real shipping rates: ${status.live_shipping_rates} (test placeholders: ${status.test_shipping_rates})`} />
              <Check
                ok={status.tax_reviewed}
                star
                label={`Sales tax decided and saved below: ${status.tax_reviewed ? (status.tax_mode === 'automatic' ? 'Stripe Tax' : 'not collecting') : 'not yet'}`}
              />
              {status.stripe_tax && (
                <Check
                  ok={status.stripe_tax.status === 'active' && status.stripe_tax.registrations.length > 0}
                  label={`Stripe Tax: ${status.stripe_tax.status}; collecting in ${status.stripe_tax.registrations.length ? status.stripe_tax.registrations.join(', ') : 'no registrations (no tax will be charged anywhere)'}`}
                />
              )}
              <Check ok={status.webhook_secret_set} label="Stripe webhook signing secret" />
              <Check ok={status.email_configured} label="Email provider (Resend): without it, no customer emails go out" />
              <Check ok={status.reply_to_set} label="Support address (SHOP_EMAIL_REPLY_TO): shown in every customer email" />
              <Check ok={status.preview_token_set} label="Preview token (for testing)" />
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Website checkout">
        <p>
          Now: <strong>{s.checkout_mode === 'off' ? 'Off' : s.checkout_mode === 'preview' ? 'Preview (test link only)' : 'Open'}</strong>
          {stripeTestMode() ? ' · Stripe test mode (no real charges)' : ''}
        </p>
        <ul className="mt-3 space-y-1.5 text-[0.95rem] text-soft">
          <li>
            <strong className="text-ink">Off</strong>: nobody can check out on the website.
          </li>
          <li>
            <strong className="text-ink">Preview</strong>: only someone who opens /checkout?preview=… with the preview token, and only while Stripe is in test mode. Never
            real money.
          </li>
          <li>
            <strong className="text-ink">Open</strong>: anyone who reaches /checkout, but only once the deployment flag SHOP_LIVE_CHECKOUT=enabled is also set. The
            site’s buy buttons still go to Etsy until they’re switched in the code.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['off', 'preview', 'live'] as const).map((m) => (
            <button key={m} type="button" className={m === s.checkout_mode ? 'btn-primary' : 'btn-secondary'} disabled={m === s.checkout_mode} onClick={() => setConfirm(m)}>
              {m === 'live' ? 'Open' : m}
            </button>
          ))}
        </div>
        <ConfirmationDialog
          open={confirm !== null}
          title={confirm === 'live' ? 'Open website checkout?' : `Switch checkout to ${confirm}?`}
          message={
            confirm === 'live'
              ? 'If the deployment flag SHOP_LIVE_CHECKOUT is enabled, anyone who reaches /checkout will be able to pay. Check Launch readiness first.'
              : confirm === 'off'
                ? 'Nobody will be able to start a website checkout. Orders already paid aren’t affected.'
                : 'Only people with the preview link will be able to check out.'
          }
          confirmLabel="Switch"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const m = confirm;
            setConfirm(null);
            await act({ action: 'settings', fields: { checkout_mode: m } }, 'Checkout setting saved.');
          }}
        />
      </Panel>

      <Panel title="Sales tax">
        <div className="grid gap-3 sm:grid-cols-[16rem_auto] sm:items-end">
          <Field label="Collect tax">
            <select value={tax} onChange={(e) => setTax(e.target.value as SettingsRow['tax_mode'])} className={inputClass}>
              <option value="off">Don’t collect tax</option>
              <option value="automatic">Stripe Tax (automatic)</option>
              {s.tax_mode === 'manual' && <option value="manual">Manual state rates (switched off)</option>}
            </select>
          </Field>
          <button
            type="button"
            className="btn-secondary sm:justify-self-start"
            disabled={tax === 'manual' || (tax === s.tax_mode && s.tax_reviewed)}
            onClick={() => setConfirmTax(true)}
          >
            {s.tax_reviewed ? 'Save' : 'Confirm and save'}
          </button>
        </div>
        <p className="mt-3 text-[0.9rem] text-soft">
          {s.tax_reviewed ? 'Decided.' : 'Not decided yet: real-money checkout stays closed until this is saved.'} Stripe Tax charges tax only where you’ve added a
          registration in Stripe (Tax → Registrations), on the item and on shipping wherever that state taxes shipping, after any discount. It has a per-transaction
          fee. Decide with your accountant.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[16rem_auto] sm:items-end">
          <Field label="Calendar tax code (Stripe Tax)">
            <input value={taxCode} onChange={(e) => setTaxCode(e.target.value.trim())} maxLength={13} className={`${inputClass} font-mono`} />
          </Field>
          <button
            type="button"
            className="btn-secondary sm:justify-self-start"
            disabled={taxCode === s.product_tax_code || !/^txcd_\d{8}$/.test(taxCode)}
            onClick={() => act({ action: 'settings', fields: { product_tax_code: taxCode } }, 'Tax code saved.')}
          >
            Save code
          </button>
        </div>
        <p className="mt-2 text-[0.85rem] text-soft">
          txcd_99999999 is Stripe’s “General - Tangible Goods”. Change it only if your accountant points you to a more specific code in Stripe’s tax code list.
          Shipping always uses Stripe’s shipping code (txcd_92010001).
        </p>
        <ConfirmationDialog
          open={confirmTax}
          title={tax === 'automatic' ? 'Use Stripe Tax?' : 'Don’t collect sales tax?'}
          message={
            tax === 'automatic'
              ? 'Tax will be charged only in the states registered in your Stripe dashboard. Check Tax → Registrations there first.'
              : 'Customers won’t be charged any sales tax on website orders. Only choose this if your accountant has confirmed you don’t need to collect it.'
          }
          confirmLabel="Save"
          onCancel={() => setConfirmTax(false)}
          onConfirm={async () => {
            setConfirmTax(false);
            await act({ action: 'settings', fields: { tax_mode: tax } }, 'Tax setting saved.');
          }}
        />
      </Panel>

      <Panel title="Shipping rates (US)">
        <ul className="space-y-3">
          {rates.map((r) => (
            <RateRow key={r.id} rate={r} act={act} />
          ))}
          <RateRow rate={null} act={act} />
        </ul>
        <p className="mt-3 text-[0.9rem] text-soft">
          Customers pick one in checkout (Stripe shows up to 5). Each rate costs its price for the first calendar plus the “each extra” price per additional calendar
          (a 52-week calendar counts as two). Limit a rate to a number of calendars with From/To, and make it free at or over a subtotal (before discount codes). US
          addresses only. Rates marked “test only” are placeholders, offered only in Stripe test mode; a live checkout won’t open until at least one real rate is on.
        </p>
      </Panel>
    </div>
  );
}

function RateRow({ rate, act }: { rate: ShippingRateRow | null; act: Act }) {
  const dollars = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(2));
  const [label, setLabel] = useState(rate?.label ?? '');
  const [amount, setAmount] = useState(dollars(rate?.amount_cents));
  const [extra, setExtra] = useState(dollars(rate?.per_extra_unit_cents ?? 0));
  const [minUnits, setMinUnits] = useState(String(rate?.min_units ?? 1));
  const [maxUnits, setMaxUnits] = useState(rate?.max_units == null ? '' : String(rate.max_units));
  const [freeOver, setFreeOver] = useState(dollars(rate?.free_over_cents));
  const [busy, setBusy] = useState(false);
  const cents = (v: string) => (v.trim() === '' ? null : Math.round(Number(v) * 100));
  const fields = {
    label: label.trim(),
    amount_cents: cents(amount),
    per_extra_unit_cents: cents(extra) ?? 0,
    min_units: Number(minUnits || 1),
    max_units: maxUnits === '' ? null : Number(maxUnits),
    free_over_cents: cents(freeOver),
  };
  const valid =
    fields.label !== '' &&
    fields.amount_cents != null &&
    Number.isFinite(fields.amount_cents) &&
    fields.amount_cents >= 0 &&
    Number.isFinite(fields.per_extra_unit_cents) &&
    fields.min_units >= 1 &&
    (fields.max_units == null || fields.max_units >= fields.min_units) &&
    (fields.free_over_cents == null || (Number.isFinite(fields.free_over_cents) && fields.free_over_cents > 0));
  const changed =
    !rate ||
    fields.label !== rate.label ||
    fields.amount_cents !== rate.amount_cents ||
    fields.per_extra_unit_cents !== rate.per_extra_unit_cents ||
    fields.min_units !== rate.min_units ||
    fields.max_units !== rate.max_units ||
    fields.free_over_cents !== rate.free_over_cents;

  const save = async (more: Record<string, unknown> = {}) => {
    setBusy(true);
    const r = await act({ action: 'shipping_rate', rate: { ...(rate ? { id: rate.id } : {}), ...fields, ...more } }, 'Shipping rate saved.');
    setBusy(false);
    if (r && !rate) {
      setLabel('');
      setAmount('');
      setExtra('0.00');
      setMinUnits('1');
      setMaxUnits('');
      setFreeOver('');
    }
  };
  const money$ = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/[^0-9.]/g, ''));
  const count = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/\D/g, ''));

  return (
    <li className="grid gap-3 border-b border-rule pb-4 last:border-b-0 sm:grid-cols-[1fr_6.5rem_6.5rem_4.5rem_4.5rem_7rem] sm:items-end">
      <Field label={rate ? (rate.test_only ? 'Name (test only)' : rate.active ? 'Name' : 'Name (off)') : 'Add a real rate'}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder="Standard shipping" className={inputClass} />
      </Field>
      <Field label="First ($)">
        <input inputMode="decimal" value={amount} onChange={money$(setAmount)} className={inputClass} />
      </Field>
      <Field label="Each extra ($)">
        <input inputMode="decimal" value={extra} onChange={money$(setExtra)} className={inputClass} />
      </Field>
      <Field label="From">
        <input inputMode="numeric" value={minUnits} onChange={count(setMinUnits)} className={inputClass} />
      </Field>
      <Field label="To">
        <input inputMode="numeric" value={maxUnits} onChange={count(setMaxUnits)} placeholder="any" className={inputClass} />
      </Field>
      <Field label="Free over ($)">
        <input inputMode="decimal" value={freeOver} onChange={money$(setFreeOver)} placeholder="never" className={inputClass} />
      </Field>
      <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-6">
        <button type="button" className="btn-secondary" disabled={busy || !valid || !changed} onClick={() => save()}>
          {rate ? 'Save' : 'Add'}
        </button>
        {rate && (
          <button type="button" className="text-link min-h-11" disabled={busy} onClick={() => save({ active: !rate.active })}>
            {rate.active ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </div>
    </li>
  );
}

function Check({ ok, label, star }: { ok: boolean; label: string; star?: boolean }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className={`w-4 shrink-0 font-bold ${ok ? 'text-[#55684b]' : 'text-soft'}`}>
        {ok ? '✓' : '✗'}
      </span>
      <span>
        <span className="sr-only">{ok ? 'Done: ' : 'Not yet: '}</span>
        {label}
        {star && <span className="text-soft"> ★</span>}
      </span>
    </li>
  );
}
