import { shopConfigured, shopEnabled } from '../lib/shop';
import { routes } from '../routes';
import type { Asset } from './weekly-reset';

/**
 * The Essential Routines Bundle (/essential-routines): the $12 downsell, shown when someone passes
 * on Take Back Control after buying the Weekly Reset System. The 4 routine printables plus two
 * bonuses (Quick Setup Audio, "Why Routines Work" cheat sheet). Copy lives in the page.
 *
 * Funnel: /checkout/complete (Weekly Reset order) → /take-back-control → "No thanks" →
 * /essential-routines → "No thanks" → back to /checkout/complete. The Stripe session id rides
 * along in the URL (?session_id=) so the last step can show her order again; nothing else does.
 *
 * Sold through the website's own Stripe checkout as a download (product `essential-routines`,
 * supabase/migrations/20261014000000_shop_essential_routines.sql). The price here must match
 * that product's price. Buttons go to the checkout only in builds with the shop switched on;
 * until then they say "Coming soon". Always noindex and out of the sitemap.
 */
export const ESSENTIAL_ROUTINES_SLUG = 'essential-routines';

/**
 * "Why Routines Work", the bundle's cheat sheet, is a page on the site, not a file: unlisted (noindex,
 * out of the sitemap), linked only from an Essential Routines buyer's download page. Unlisted, not
 * locked: anyone with the link can read it. Change the path to retire a shared link.
 */
export const WHY_ROUTINES_PATH = '/why-routines-work/k4p8n2';

export const essentialRoutines = {
  name: 'Essential Routines Bundle',
  price: 12,
  buyUrl: shopEnabled() && shopConfigured() ? `${routes.checkout}?product=${ESSENTIAL_ROUTINES_SLUG}` : null,
};

/**
 * Customer quotes from the original page, confirmed by the shop owner as real customers' words,
 * used with permission. Shown only when `verified` is true. Never invent or edit a quote.
 */
export const routinesTestimonials: { quote: string; name: string; verified: boolean }[] = [
  { quote: 'The morning routine alone was worth way more than $12. My kids actually get ready without me nagging!', name: 'Sarah M.', verified: true },
  {
    quote: 'I thought routines would feel restrictive, but they actually gave me so much freedom. Now I know exactly what to do instead of winging it every day.',
    name: 'Jessica K.',
    verified: true,
  },
];

export const essentialRoutinesAssets = {
  overview: {
    src: '/images/essential-routines/overview.webp',
    width: 2000,
    height: 852,
    alt: 'The Essential Routines Bundle: the four routine printables, the “Why Routines Work” cheat sheet on a laptop, and the Quick Setup Audio on a phone.',
    spec: 'Bundle mockup on white · overview.webp, 2000 × 852',
  },
  routines: {
    src: '/images/take-back-control/routines.webp',
    width: 900,
    height: 900,
    alt: 'The four editable routine printables fanned out, the Morning Routine on top with editable times.',
    spec: 'Routine printables mockup on white · routines.webp, 900 × 900',
  },
  audio: {
    src: '/images/essential-routines/quick-setup-audio.webp',
    width: 1815,
    height: 1430,
    alt: 'Power Packed 8 Minute “Quick Setup Audio” playing on a phone, 08:21.',
    spec: 'Quick Setup Audio mockup on white · quick-setup-audio.webp, 1815 × 1430',
  },
} satisfies Record<string, Asset>;
