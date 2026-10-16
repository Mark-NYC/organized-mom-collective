import { useEffect, useRef, useState } from 'react';
import { loadOrderStatus, money, type OrderStatus } from '../../lib/shop';
import { routes } from '../../routes';
import { weeklyReset } from '../../data/weekly-reset';

const POLL_MS = 2000;
const POLL_FOR_MS = 60_000;

/**
 * /checkout/complete?session_id=… — Stripe sends her here after paying. Reaching this
 * page proves nothing: it shows "confirmed" only once the Stripe webhook has marked the
 * order paid in the database, and polls until then.
 */
export default function CheckoutComplete() {
  const [status, setStatus] = useState<OrderStatus | null | undefined>(undefined);
  const [waitedOut, setWaitedOut] = useState(false);
  const trackedPurchase = useRef(false);

  useEffect(() => {
    if (trackedPurchase.current || status?.payment_status !== 'paid' || status.total_cents == null || status.order_number == null) return;
    const sessionId = new URLSearchParams(location.search).get('session_id') ?? '';
    if (!sessionId.startsWith('cs_live_')) return;
    const pinterest = (window as Window & { pintrk?: (...args: unknown[]) => void }).pintrk;
    if (!pinterest) return;
    const eventId = 'omc-order-' + status.order_number;
    const storageKey = 'omc:pinterest:checkout:' + eventId;
    try { if (localStorage.getItem(storageKey) === 'yes') return; } catch { /* event_id still identifies the order */ }
    try {
      pinterest('track', 'checkout', {
        event_id: eventId,
        value: status.total_cents / 100,
        order_quantity: status.items.reduce((sum, item) => sum + item.quantity, 0),
        currency: 'USD',
      });
      trackedPurchase.current = true;
      try { localStorage.setItem(storageKey, 'yes'); } catch { /* this mount is still guarded */ }
    } catch { /* tracking must never affect order confirmation */ }
  }, [status]);

  useEffect(() => {
    const sessionId = new URLSearchParams(location.search).get('session_id') ?? '';
    if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) {
      setStatus(null);
      return;
    }
    let live = true;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await loadOrderStatus(sessionId);
        if (!live) return;
        setStatus(s);
        if (s && s.payment_status !== 'pending') return;
      } catch {
        /* keep trying */
      }
      if (Date.now() - started > POLL_FOR_MS) {
        setWaitedOut(true);
        timer = setTimeout(tick, POLL_MS * 5);
      } else timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);

  if (status === undefined || (status && status.payment_status === 'pending')) {
    return (
      <div className="py-6" aria-live="polite">
        <p className="label text-soft">Almost there</p>
        <h1 className="page-title mt-3">Confirming your payment…</h1>
        {waitedOut ? (
          <p className="lede mt-4">
            This is taking longer than usual. You can close this page: as soon as Stripe confirms your payment, we’ll email your receipt.
          </p>
        ) : (
          <p className="lede mt-4">This usually takes a few seconds.</p>
        )}
      </div>
    );
  }

  if (status === null) {
    return (
      <div className="py-6">
        <h1 className="page-title">We couldn’t find that order</h1>
        <p className="lede mt-4">If you paid, your receipt is on its way to your email.</p>
        <a href={routes.home} className="btn-primary mt-8">
          Back to home
        </a>
      </div>
    );
  }

  if (status.payment_status === 'expired' || status.payment_status === 'canceled' || status.payment_status === 'failed') {
    return (
      <div className="py-6">
        <h1 className="page-title">Your order didn’t go through</h1>
        <p className="lede mt-4">
          {status.payment_status === 'failed' ? 'The payment wasn’t completed' : 'This checkout expired before it was paid'}, so you haven’t been charged.
        </p>
        <a href={status.digital ? routes.weeklyReset : routes.checkout} className="btn-primary mt-8">
          Start again
        </a>
      </div>
    );
  }

  // Test-mode Checkout Sessions have ids starting cs_test_: say so, so a test is never mistaken for a real order.
  const test = new URLSearchParams(location.search).get('session_id')?.startsWith('cs_test_') ?? false;
  // Post-purchase funnel: a Weekly Reset order goes on to Take Back Control (then the Essential
  // Routines downsell). Their "No thanks" links come back here with done=1, so it isn't offered twice.
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('session_id') ?? '';
  const offerUpsell = Boolean(status.digital) && params.get('done') !== '1' && status.items.some((i) => i.name === weeklyReset.name);

  return (
    <div className="py-6">
      {test && (
        <p className="mb-6 rounded-[3px] border border-dashed border-rule-strong bg-band px-4 py-3 text-[0.9rem] leading-snug">
          <span className="font-semibold">Test order.</span> Stripe test mode: no real payment was taken.
        </p>
      )}
      <p className="label text-soft">Order {status.order_number ? `#${status.order_number}` : ''}</p>
      <h1 className="page-title mt-3">Thank you. Your order is confirmed.</h1>
      {status.digital ? (
        <p className="lede mt-4">
          {status.email_hint ? `We’ve emailed your download link to ${status.email_hint}.` : 'Your download link is on its way to your email.'} It arrives with
          your receipt in a minute or two. Check your spam folder if you don’t see it.
        </p>
      ) : (
        <p className="lede mt-4">
          {status.email_hint ? `We’ve emailed your receipt to ${status.email_hint}.` : 'Your receipt is on its way to your email.'} We pack each order by hand
          and email you the tracking number when it ships.
        </p>
      )}

      <dl className="mt-8 border-t-2 border-ink">
        {status.items.map((i) => (
          <Row key={i.name} label={`${i.name} × ${i.quantity}`} value={money(i.unit_price_cents * i.quantity)} />
        ))}
        {status.discount_cents > 0 && <Row label="Discount" value={`−${money(status.discount_cents)}`} />}
        {!status.digital && <Row label="Shipping" value={money(status.shipping_cents)} />}
        {status.tax_cents > 0 && <Row label="Tax" value={money(status.tax_cents)} />}
        <Row label="Total paid" value={money(status.total_cents)} strong />
      </dl>

      {offerUpsell && (
        <section className="mt-10 border-l-[3px] border-month bg-band px-5 py-5">
          <h2 className="text-[1.15rem] leading-snug font-bold">Wait! One more thing before you go</h2>
          <p className="mt-2 leading-relaxed">
            Your Weekly Reset handles Sundays. See how to make the other 6 days flow just as smoothly: a one-time offer for Weekly Reset customers.
          </p>
          <a href={`${routes.takeBackControl}?session_id=${encodeURIComponent(sessionId)}`} className="btn-primary mt-4">
            See the offer
          </a>
        </section>
      )}

      {!status.digital && (
        <section className="mt-10 border-l-[3px] border-month bg-band px-5 py-5">
          <h2 className="text-[1.15rem] leading-snug font-bold">Your cleaning companion</h2>
          <p className="mt-2 leading-relaxed">
            Your calendar comes with the free cleaning companion. Open it now, or scan the QR code printed on your calendar when it arrives. No account, no
            subscription.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            <a href={routes.today} className="btn-primary">
              Open the companion
            </a>
            <a href={routes.companion} className="text-link self-center">
              How it works
            </a>
          </div>
        </section>
      )}

      <p className="mt-8 text-[0.95rem] text-soft">
        Questions about your order? Reply to your receipt email or visit{' '}
        <a href={routes.support} className="underline underline-offset-2">
          Help &amp; Support
        </a>
        .
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 border-b border-rule py-2.5 ${strong ? 'text-[1.05rem] font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
