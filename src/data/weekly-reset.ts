/**
 * The Weekly Reset System landing page (/weekly-reset): a $9 digital bundle, sold separately
 * from the wall calendar. Copy lives in the page; the things that change live here.
 *
 * ⚠️ Until `buyUrl` (the checkout) is set, the buy buttons say "Coming soon" and the page is noindex
 * and out of the sitemap. Set it to the real checkout (Etsy digital listing, Stripe link…).
 *
 * Assets switch on by themselves: drop a file at its `src` path (under public/) and the page
 * shows it; until then it shows a labeled placeholder. Never use watermarked stock (Stocksy,
 * Colourbox…): the guarantee badge is drawn in the page for that reason.
 */
export const weeklyReset = {
  name: 'The Weekly Reset System',
  price: 9,
  regularPrice: 15,
  buyUrl: null as string | null, // PLACEHOLDER: checkout URL
  contactEmail: 'contact@organizedmomcollective.com',
};

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
