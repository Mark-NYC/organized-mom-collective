import { shopStats } from './reviews';
import type { Asset } from './weekly-reset';

/**
 * The Family Sanity Saver Starter Kit landing page (/family-sanity-saver-starter-kit): a $7 digital
 * offer, the Family Command Center (12-month family wall calendar with the auto-fill name system, Quick-Start Audio Guide, 30-minute tidy
 * system, bonuses). A standalone entry point: not linked from the other funnel pages, and they
 * don't link here. Copy lives in the page; the things that change live here.
 *
 * Recreated as is from the original WordPress page, colors included (orange buttons, green
 * checks). Those colors are the old look, not the new brand: restyle when the page is rebranded.
 *
 * Not sold yet: there is no `family-sanity-saver-starter-kit` shop product (no migration, no files), so
 * buyUrl stays null and the buttons say "Coming soon"; the page is noindex and out of the sitemap.
 * To go live, add the product the way the Weekly Reset did (supabase/SHOP.md → Digital products),
 * then build buyUrl from FAMILY_SANITY_SAVER_SLUG exactly as src/data/weekly-reset.ts does (and add
 * this file to the checkout-link allowlist in tests/shop.test.ts).
 */
export const FAMILY_SANITY_SAVER_SLUG = 'family-sanity-saver-starter-kit';

export const familyCommandCenter = {
  name: 'Family Command Center',
  price: 7,
  /** Struck-through price from the original page. */
  regularPrice: 19,
  buyUrl: null as string | null,
  /** Families served, as on the original page (supplied by the shop owner). */
  families: '500+',
  /** Shop rating shown under the hero button: the whole Etsy shop's figure (src/data/reviews.ts). */
  rating: shopStats.rating,
  /** What the buyer actually gets, in the owner's words. */
  summary: 'A customizable 12-month wall calendar with your family’s names already filled in, plus the exact system to make it work on day one.',
};

/**
 * What's in the kit at checkout (owner-supplied mockup, kit.webp): the 12-month wall calendar with
 * the family's names filled in, the Command Center Refresh Sheet, the 30-Minute Daily Tidy System and
 * the "Quick Coaching Guide: The Weekly Planning System" audio. The page's value-stack copy is the
 * original page's and doesn't map one to one onto these (e.g. "Weekly Sanity Check-Ins" isn't in the
 * mockup): reconcile it before the page goes live.
 */

/**
 * Customer reviews from the original page, supplied by the shop owner as images (name, date and
 * words exactly as she received them). Shown as the images; the alt text carries the full quote.
 */
export const familyCommandCenterAssets = {
  hero: {
    src: '/images/family-sanity-saver/hero.webp',
    width: 1080,
    height: 1080,
    alt: 'Sticky-note speech bubbles reading “When is my practice?”, “Mom what time is…” and “I forgot to tell you about…” above the filled-in January page of the Family Command Center wall calendar, with the 7 Minute Quick-Start Guide playing on a phone. Badge: 15 min setup, Family Command Center, auto-fill.',
    spec: 'Hero: speech bubbles + calendar + phone · hero.webp, 1080 × 1080',
  },
  kit: {
    src: '/images/family-sanity-saver/kit.webp',
    width: 1080,
    height: 1280,
    alt: 'The Family Sanity Saver Starter Kit: the 12-month wall calendar, January to May fanned out with the family’s names (Dad, Mom, Jonathan, Rose, Jaden) filled in on every week, the Command Center Refresh Sheet, the 30-Minute Daily Tidy System, and the Quick Coaching Guide: The Weekly Planning System audio playing on a phone.',
    spec: 'Kit mockup on white · kit.webp, 1080 × 1280',
  },
  reviewMegan: {
    src: '/images/family-sanity-saver/review-megan.webp',
    width: 1080,
    height: 284,
    alt: '5 stars. Megan G., September 14, 2025: “I finally have a system that stuck. That’s worth way more than $7”',
    spec: 'Review card · review-megan.webp, 1080 × 284',
  },
  reviewLauren: {
    src: '/images/family-sanity-saver/review-lauren.webp',
    width: 1080,
    height: 282,
    alt: '5 stars. Lauren Windsor, May 11, 2025: “I love this layout! Excellent family organization calendar.”',
    spec: 'Review card · review-lauren.webp, 1080 × 282',
  },
} satisfies Record<string, Asset>;
