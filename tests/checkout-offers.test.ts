import { describe, expect, it } from 'vitest';
import { eligibleOffers, mergeAttribution, parseAttribution, type CheckoutOffer } from '../src/lib/checkout-offers';

const catalog: CheckoutOffer[] = [
  { code: 'cards', placement: 'order_bump', trigger_product_slug: 'calendar', offered_product_slug: 'responsibility-cards', active: false, priority: 1, variant: 'a' },
  { code: 'club', placement: 'post_purchase', trigger_product_slug: 'calendar', offered_product_slug: 'club', active: true, priority: 2, variant: 'a' },
];

describe('checkout offers foundation', () => {
  it('keeps inactive bumps invisible', () => {
    expect(eligibleOffers(catalog, ['calendar'], 'order_bump')).toEqual([]);
  });
  it('does not offer an item already purchased', () => {
    expect(eligibleOffers(catalog, ['calendar', 'club'], 'post_purchase')).toEqual([]);
  });
  it('matches placement and trigger only', () => {
    expect(eligibleOffers(catalog, ['calendar'], 'post_purchase').map((o) => o.code)).toEqual(['club']);
  });
  it('accepts attribution but rejects oversized and unsafe values', () => {
    const a = parseAttribution('?utm_source=pinterest&utm_campaign=calendar_2027&utm_content=pin_042&utm_term=' + 'z'.repeat(200));
    expect(a.utm_source).toBe('pinterest');
    expect(a.utm_content).toBe('pin_042');
    expect(a.utm_term).toBeNull();
  });
  it('preserves first touch and updates last touch', () => {
    const pinterest = parseAttribution('utm_source=pinterest');
    const email = parseAttribution('utm_source=email');
    expect(mergeAttribution(pinterest, pinterest, email)).toEqual({first:pinterest,last:email});
  });
});
