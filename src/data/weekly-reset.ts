import { shopConfigured, shopEnabled } from '../lib/shop';
import { routes } from '../routes';

/**
 * The Weekly Reset System landing page (/weekly-reset): a $9 digital bundle, sold separately
 * from the wall calendar. Copy lives in the page; the things that change live here.
 *
 * Sold through the website's own Stripe checkout as a download (product `weekly-reset-system`,
 * supabase/migrations/20261012000000_shop_digital.sql; setup in supabase/SHOP.md → Digital
 * products). The price shown here must match that product's price in the dashboard.
 * The buy buttons go to the checkout only in builds with the shop switched on
 * (PUBLIC_SHOP_ENABLED=true plus its keys); until then they say "Coming soon" and the page is
 * noindex and out of the sitemap.
 *
 * Assets switch on by themselves: drop a file at its `src` path (under public/) and the page
 * shows it; until then it shows a labeled placeholder. Never use watermarked stock (Stocksy,
 * Colourbox…): the guarantee badge is drawn in the page for that reason.
 */
/** The shop product this page sells. */
export const WEEKLY_RESET_SLUG = 'weekly-reset-system';

export const weeklyReset = {
  name: 'The Weekly Reset System',
  price: 9,
  regularPrice: 15,
  buyUrl: shopEnabled() && shopConfigured() ? `${routes.checkout}?product=${WEEKLY_RESET_SLUG}` : null,
  contactEmail: 'contact@organizedmomcollective.com',
};

/**
 * Etsy shop figures for this page's trust row, as supplied by the shop owner (from the shop's
 * Etsy profile). Update them here; they're shown as they are, never rounded up.
 */
export const etsyStats = { sales: '939', rating: '5.0', reviews: 104, badge: 'Super seller', years: 4 };

export interface Asset {
  /** Site-relative path of the file in public/. */
  src: string;
  width: number;
  height: number;
  alt: string;
  /** What to supply (shown in the placeholder only). */
  spec: string;
}

export const weeklyResetAssets = {
  hero: {
    src: '/images/weekly-reset/hero.webp',
    width: 1542,
    height: 1194,
    alt: 'Two moms side by side: one on the floor with her kids holding up a sign that says HELP, the other smiling and holding up the Weekly Command Center.',
    spec: 'Hero: the two-photo composite (HELP sign + planner) · hero.webp, about 1542 × 1194',
  },
  bundle: {
    src: '/images/weekly-reset/bundle.webp',
    width: 1920,
    height: 1080,
    alt: 'The Weekly Reset System: the Weekly Command Center planner page, the 30-Minute Daily Tidy System guide, and the coaching audio playing on a phone.',
    spec: 'Bundle mockup: planner + tidy guide + phone · bundle.webp, 1920 × 1080',
  },
} satisfies Record<string, Asset>;

/** The coaching audio preview, in public/. The player shows once the file exists. */
export const coachingPreviewAudio = '/audio/weekly-reset-preview.mp3';
