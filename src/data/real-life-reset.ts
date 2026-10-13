import { shopConfigured, shopEnabled } from '../lib/shop';
import { routes } from '../routes';
import type { Asset } from './weekly-reset';

/**
 * The Real Life Reset Kit (/real-life-reset-kit): a $7 offer, the backup plan for when the week
 * falls apart (Plan B Quick-Pivot Framework, 15-Minute Reset Checklist, “It’s OK to Pivot” coaching
 * audio). Copy lives in the page, from the owner's original offer copy.
 *
 * Left out from the original: the 12-hour countdown ("Offer expires when timer hits 0") and "today
 * only". No offer actually expires, so a timer would be a fake deadline (as on /take-back-control).
 *
 * Sold through the website's own Stripe checkout as a download (product `real-life-reset-kit`,
 * supabase/migrations/20261016000000_shop_real_life_reset.sql). The price here must match that
 * product's price. Buttons go to the checkout only in builds with the shop switched on; until then
 * they say "Coming soon". Not wired into any funnel yet: nothing links here. Always noindex and
 * out of the sitemap ("Only available here").
 */
export const REAL_LIFE_RESET_SLUG = 'real-life-reset-kit';

export const realLifeReset = {
  name: 'Real Life Reset Kit',
  price: 7,
  /** "$15 value" in the original copy. */
  value: 15,
  buyUrl: shopEnabled() && shopConfigured() ? `${routes.checkout}?product=${REAL_LIFE_RESET_SLUG}` : null,
};

/**
 * The owner’s kit mockup, white background: keep it in a white (bg-paper) section. “7 Minute” is
 * redrawn as “4 Minute” (the audio runs 4:14), in the heading and on the phone; the untouched
 * original is design/real-life-reset/kit-original.webp.
 */
export const realLifeResetAssets = {
  kit: {
    src: '/images/real-life-reset/kit.webp',
    width: 2000,
    height: 942,
    alt: 'The Real Life Reset Kit: the Plan B Quick-Pivot Framework, the 15-Minute Reset Checklist, and the Power Packed 4 Minute “It’s Okay to Pivot” audio playing on a phone.',
    spec: 'Kit mockup on white: framework + checklist + phone · kit.webp, 2000 × 942',
  },
} satisfies Record<string, Asset>;
