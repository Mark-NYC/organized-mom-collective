/**
 * Checkout offer rules and attribution normalization.
 * All offers stay OFF until their actual product exists and checkout has been
 * wired end-to-end and tested in Stripe test mode.
 *
 * Never trust client-side prices or use a browser event as proof of payment.
 */
export type OfferPlacement = 'order_bump' | 'post_purchase' | 'downsell';
export type OfferEventName =
  | 'checkout_started'
  | 'offer_viewed'
  | 'offer_accepted'
  | 'offer_declined'
  | 'checkout_completed'
  | 'post_purchase_payment_succeeded'
  | 'post_purchase_payment_failed';

export interface CheckoutOffer {
  code: string;
  placement: OfferPlacement;
  trigger_product_slug: string;
  offered_product_slug: string | null;
  active: boolean;
  priority: number;
  variant: string;
}

export function eligibleOffers(offers: CheckoutOffer[], purchasedSlugs: string[], placement: OfferPlacement): CheckoutOffer[] {
  const purchased = new Set(purchasedSlugs);
  return offers.filter((offer) =>
    offer.active &&
    offer.placement === placement &&
    purchased.has(offer.trigger_product_slug) &&
    Boolean(offer.offered_product_slug) &&
    !purchased.has(offer.offered_product_slug!)
  ).sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
}

export type Attribution = Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term', string | null>;

/** Keep campaign strings short; refuse suspicious keys and do not capture sensitive URL params. */
export function parseAttribution(input: string | URLSearchParams): Attribution {
  const params = typeof input === 'string' ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input) : input;
  const clean = (key: keyof Attribution) => {
    const value = params.get(key)?.trim();
    return value && value.length <= 180 && /^[\w .:/-]+$/.test(value) ? value : null;
  };
  return {
    utm_source: clean('utm_source'),
    utm_medium: clean('utm_medium'),
    utm_campaign: clean('utm_campaign'),
    utm_content: clean('utm_content'),
    utm_term: clean('utm_term'),
  };
}

export function hasAttribution(a: Attribution): boolean {
  return Object.values(a).some((value) => value !== null);
}

/** Keep a visitor's first known source and most recent known campaign separately. */
export function mergeAttribution(first: Attribution | null, last: Attribution | null, incoming: Attribution) {
  if (!hasAttribution(incoming)) return { first, last };
  return { first: first ?? incoming, last: incoming };
}
