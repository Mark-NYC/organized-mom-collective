import { useEffect, useRef, useState } from 'react';
import {
  cancelCheckout,
  loadCatalog,
  loadStripe,
  money,
  previewToken,
  startCheckout,
  stripeTestMode,
  type Catalog,
  type CheckoutError,
  type ShopProduct,
} from '../../lib/shop';
import { routes } from '../../routes';

/**
 * /checkout: pick the calendar and quantity, then pay in Stripe's embedded checkout
 * (cards, Apple Pay, Google Pay; email, US shipping address, shipping option, tax and
 * discount codes are all collected by Stripe). Prices and stock are checked on the
 * server; this page only sends a product and a quantity.
 */
export default function Checkout() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [slug, setSlug] = useState('');
  const [qty, setQty] = useState(1);
  const [phase, setPhase] = useState<'choose' | 'opening' | 'paying'>('choose');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const session = useRef<{ id: string; mount: (el: HTMLElement) => void; destroy: () => void } | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  const refresh = () =>
    loadCatalog()
      .then((c) => {
        setCatalog(c);
        const params = new URLSearchParams(location.search);
        const wanted = params.get('product');
        const pick = c.products.find((p) => p.slug === wanted && p.available) ?? c.products.find((p) => p.available) ?? c.products[0];
        setSlug((s) => (s && c.products.some((p) => p.slug === s && p.available) ? s : (pick?.slug ?? '')));
      })
      .catch(() => setLoadError(true));

  useEffect(() => {
    setPreview(previewToken());
    refresh();
    return () => session.current?.destroy();
  }, []);

  useEffect(() => {
    if (phase !== 'paying' || !session.current || !mountRef.current) return;
    session.current.mount(mountRef.current);
    mountRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [phase]);

  const product = catalog?.products.find((p) => p.slug === slug) ?? null;
  const max = product ? Math.max(1, product.max_quantity) : 1;
  useEffect(() => setQty((q) => Math.min(q, max)), [max]);

  if (loadError) return <Notice title="Checkout isn’t available right now" body="Please try again in a few minutes." />;
  if (!catalog) return <p className="py-10 text-center text-soft">Loading…</p>;

  const open = catalog.checkout_mode === 'live' || (catalog.checkout_mode === 'preview' && preview);
  if (!open || catalog.products.length === 0) {
    return <Notice title="Online checkout isn’t open yet" body="For now, the calendar is available on Etsy." etsy />;
  }

  const pay = async () => {
    if (!product) return;
    setError('');
    setPhase('opening');
    const res = await startCheckout([{ slug: product.slug, quantity: qty }]);
    if ('error' in res) {
      setPhase('choose');
      setError(errorText(res.error, product));
      if (res.error === 'sold_out' || res.error === 'too_many' || res.error === 'unavailable') refresh();
      return;
    }
    try {
      const stripe = await loadStripe();
      const embedded = await stripe.initEmbeddedCheckout({ fetchClientSecret: async () => res.client_secret });
      session.current = { id: res.session_id, mount: (el) => embedded.mount(el), destroy: () => embedded.destroy() };
      setPhase('paying'); // the effect above mounts it once its container renders
    } catch {
      cancelCheckout(res.session_id);
      setPhase('choose');
      setError('We couldn’t load the secure payment form. Check your connection and try again.');
    }
  };

  const change = () => {
    if (session.current) {
      session.current.destroy();
      cancelCheckout(session.current.id);
      session.current = null;
    }
    setPhase('choose');
    refresh();
  };

  // Placeholder (test-only) rates are never offered with a live key, so don't advertise them.
  const shipping = catalog.shipping_rates.filter((r) => stripeTestMode() || !r.test_only);
  const shippingNote =
    shipping.length === 0
      ? ''
      : shipping.length === 1
        ? shipping[0].amount_cents === 0
          ? 'Free shipping'
          : `Shipping: ${money(shipping[0].amount_cents)}`
        : `Shipping from ${money(Math.min(...shipping.map((s) => s.amount_cents)))}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
      {stripeTestMode() && (
        <p className="rounded-[3px] border border-dashed border-rule-strong bg-band px-4 py-3 text-[0.9rem] leading-snug lg:col-span-2">
          <span className="font-semibold">Test mode.</span> No real charges. Pay with card 4242 4242 4242 4242, any future date, any CVC.
          {catalog.checkout_mode === 'preview' && ' Preview: only people with the preview link can check out.'}
        </p>
      )}

      <section aria-labelledby="order-title">
        <h2 id="order-title" className="label text-soft">
          Your order
        </h2>

        {phase === 'paying' && product ? (
          <div className="mt-4 flex gap-4 border-y border-rule py-4">
            <ProductImage product={product} className="size-20 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="leading-snug font-semibold">{productTitle(product)}</p>
              <p className="mt-1 text-[0.95rem] text-soft">
                Qty {qty} · {money(product.price_cents * qty)}
              </p>
              <button type="button" onClick={change} className="text-link mt-3">
                Change order
              </button>
            </div>
          </div>
        ) : (
          <>
            {catalog.products.length > 1 && (
              <fieldset className="mt-4">
                <legend className="sr-only">Choose a calendar</legend>
                <div className="grid gap-3">
                  {catalog.products.map((p) => (
                    <label
                      key={p.slug}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-[3px] border px-4 py-3 ${
                        p.slug === slug ? 'border-2 border-ink' : 'border-rule-strong'
                      } ${p.available ? '' : 'cursor-not-allowed opacity-60'}`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="product"
                          value={p.slug}
                          checked={p.slug === slug}
                          disabled={!p.available}
                          onChange={() => setSlug(p.slug)}
                          className="size-4 accent-[#545454]"
                        />
                        <span className="font-semibold">{productTitle(p)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{p.available ? money(p.price_cents) : 'Sold out'}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {product && (
              <article className="mt-5">
                <ProductImage product={product} className="aspect-[4/3] w-full" />
                <div className="mt-5 flex items-start justify-between gap-4">
                  <h3 className="text-[1.3rem] leading-tight font-bold">{productTitle(product)}</h3>
                  <p className="shrink-0 text-[1.3rem] leading-tight font-bold tabular-nums">{money(product.price_cents)}</p>
                </div>
                {product.description && <p className="mt-3 leading-relaxed">{product.description}</p>}
                {product.details.length > 0 && (
                  <ul className="mt-4 space-y-1.5 border-t border-rule pt-4 text-[0.95rem]">
                    {product.details.map((d) => (
                      <li key={d} className="flex gap-2.5">
                        <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-month" />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}

                {product.available ? (
                  <>
                    <div className="mt-6 flex items-center justify-between gap-4 border-t border-rule pt-5">
                      <span className="label" id="qty-label">
                        Quantity
                      </span>
                      <div className="flex items-center" role="group" aria-labelledby="qty-label">
                        <button type="button" className="btn-secondary min-w-11 px-0 text-[1rem]" aria-label="One fewer" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>
                          −
                        </button>
                        <output aria-live="polite" className="w-12 text-center text-[1.1rem] font-semibold tabular-nums">
                          {qty}
                        </output>
                        <button type="button" className="btn-secondary min-w-11 px-0 text-[1rem]" aria-label="One more" disabled={qty >= max} onClick={() => setQty(qty + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                    {qty >= max && max < 5 && <p className="mt-2 text-right text-[0.85rem] text-soft">Only {max} available right now.</p>}

                    <dl className="mt-5 space-y-1.5 border-t border-rule pt-4">
                      <div className="flex justify-between text-[1.05rem] font-bold">
                        <dt>Subtotal</dt>
                        <dd className="tabular-nums">{money(product.price_cents * qty)}</dd>
                      </div>
                      {shippingNote && (
                        <div className="flex justify-between text-[0.95rem] text-soft">
                          <dt>{shippingNote}</dt>
                          <dd>at the next step</dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-3 text-[0.9rem] leading-snug text-soft">
                      {catalog.tax_mode === 'off' ? '' : 'Sales tax, where it applies, is added at the next step. '}Have a discount code? You can add it at the next step.
                    </p>

                    {error && (
                      <p role="alert" className="mt-4 border-l-[3px] border-month bg-band px-4 py-3 font-semibold">
                        {error}
                      </p>
                    )}

                    <button type="button" onClick={pay} disabled={phase === 'opening'} className="btn-primary mt-5 min-h-14 w-full">
                      {phase === 'opening' ? 'Opening secure checkout…' : 'Continue to payment'}
                    </button>
                    <p className="mt-3 flex items-center justify-center gap-2 text-[0.85rem] text-soft">
                      <LockIcon /> Secure payment by Stripe. Card, Apple Pay or Google Pay.
                    </p>
                  </>
                ) : (
                  <div className="mt-6 border-t border-rule pt-5">
                    <p className="font-semibold">Sold out on the website right now.</p>
                    <a href={routes.buy} className="text-link mt-3 inline-block">
                      See where to buy
                    </a>
                  </div>
                )}
              </article>
            )}
          </>
        )}
      </section>

      <section aria-label="Payment" className={phase === 'paying' ? '' : 'hidden lg:block'}>
        {phase === 'paying' ? (
          <div ref={mountRef} id="payment" className="min-h-[32rem] scroll-mt-4" />
        ) : (
          <div className="hidden h-full min-h-[20rem] flex-col items-center justify-center rounded-[3px] border border-dashed border-rule px-8 text-center text-soft lg:flex">
            <LockIcon />
            <p className="mt-3 max-w-xs text-[0.95rem] leading-snug">Your email, shipping address and payment details go here, in Stripe’s secure checkout.</p>
          </div>
        )}
      </section>
    </div>
  );
}

const productTitle = (p: Pick<ShopProduct, 'name' | 'edition'>) => (p.edition ? `${p.name}, ${p.edition}` : p.name);

function ProductImage({ product, className }: { product: ShopProduct; className: string }) {
  const img = product.images[0];
  if (!img) return <div className={`${className} rounded-[3px] bg-band`} />;
  return <img src={img.src} alt={img.alt} className={`${className} rounded-[3px] bg-band object-cover`} loading="eager" decoding="async" />;
}

function errorText(code: CheckoutError, p: ShopProduct): string {
  switch (code) {
    case 'sold_out':
      return 'Sorry, there aren’t enough left for that quantity. We’ve updated what’s available.';
    case 'too_many':
      return `You can order up to ${p.max_quantity} at a time.`;
    case 'unavailable':
      return 'That calendar isn’t available on the website right now.';
    case 'checkout_closed':
    case 'shipping_not_configured':
      return 'Online checkout isn’t open right now.';
    case 'rate_limited':
      return 'Too many checkout attempts from this connection. Please wait a few minutes and try again.';
    default:
      return 'We couldn’t open the secure checkout. Please try again in a minute.';
  }
}

function Notice({ title, body, etsy }: { title: string; body: string; etsy?: boolean }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h2 className="text-[1.3rem] leading-tight font-bold">{title}</h2>
      <p className="mt-3 leading-relaxed">{body}</p>
      {etsy && (
        <a href={routes.buy} className="btn-primary mt-6">
          See the calendar
        </a>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
