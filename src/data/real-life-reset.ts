import type { Asset } from './weekly-reset';

/**
 * The Real Life Reset Kit (/real-life-reset-kit): a $7 offer, the backup plan for when the week
 * falls apart (Plan-B Quick-Pivot Framework, 15-Minute Reset Checklist, Back on Track Coaching
 * Audio). Copy lives in the page, from the owner's original offer copy.
 *
 * Left out from the original: the 12-hour countdown ("Offer expires when timer hits 0") and "today
 * only". No offer actually expires, so a timer would be a fake deadline (as on /take-back-control).
 *
 * Not sold yet and not wired into any funnel: there is no `real-life-reset-kit` shop product (no
 * migration, no files) and nothing links here. buyUrl stays null, the button says "Coming soon",
 * and the page is always noindex and out of the sitemap ("Only available here"). To go live, add the
 * product the way the Weekly Reset did (supabase/SHOP.md → Digital products), build buyUrl from
 * REAL_LIFE_RESET_SLUG exactly as src/data/weekly-reset.ts does, add this file to the
 * checkout-link allowlist in tests/shop.test.ts, and link to the page from wherever it's offered.
 */
export const REAL_LIFE_RESET_SLUG = 'real-life-reset-kit';

export const realLifeReset = {
  name: 'Real Life Reset Kit',
  price: 7,
  /** "$15 value" in the original copy. */
  value: 15,
  buyUrl: null as string | null,
};

/** The owner’s kit mockup, white background: keep it in a white (bg-paper) section. */
export const realLifeResetAssets = {
  kit: {
    src: '/images/real-life-reset/kit.webp',
    width: 2000,
    height: 942,
    alt: 'The Real Life Reset Kit: the Plan B Quick-Pivot Framework, the 15-Minute Reset Checklist, and the Power Packed 7 Minute “It’s Okay to Pivot” audio playing on a phone.',
    spec: 'Kit mockup on white: framework + checklist + phone · kit.webp, 2000 × 942',
  },
} satisfies Record<string, Asset>;
