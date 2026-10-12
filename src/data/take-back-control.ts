import { shopConfigured, shopEnabled } from '../lib/shop';
import { routes } from '../routes';
import type { Asset } from './weekly-reset';

/**
 * The "Take Back Control" upsell page (/take-back-control): a $29 one-time offer shown after
 * someone buys the Weekly Reset System (4-week audio course + 5 implementation tools).
 * Copy lives in the page; the things that change live here.
 *
 * Sold through the website's own Stripe checkout as a download (product `take-back-control`,
 * supabase/migrations/20261013000000_shop_take_back_control.sql, which lists its files). The
 * price here must match that product's price in the dashboard. The buttons go to the checkout
 * only in builds with the shop switched on; until then they say "Coming soon". The page is
 * always noindex and out of the sitemap (a post-purchase offer).
 *
 * Assets switch on by themselves: drop a file at its `src` path (under public/) and the page
 * shows it; until then it shows a labeled placeholder. Use the real product mockups on a white
 * background (the sections they sit in are white to match).
 */
/** The shop product this page sells. */
export const TAKE_BACK_CONTROL_SLUG = 'take-back-control';

export const takeBackControl = {
  name: 'Take Back Control',
  price: 29,
  buyUrl: shopEnabled() && shopConfigured() ? `${routes.checkout}?product=${TAKE_BACK_CONTROL_SLUG}` : null,
};

export const takeBackControlAssets = {
  overview: {
    src: '/images/take-back-control/overview.webp',
    width: 1920,
    height: 1080,
    alt: 'Everything in Take Back Control: the pantry inventory, routine printables, chore cards and decluttering guide around a laptop showing the weekly planner, and a phone playing the audio course.',
    spec: 'Full bundle mockup on white: printables, laptop, phone · overview.webp, 1920 × 1080',
  },
  course: {
    src: '/images/take-back-control/course.webp',
    width: 900,
    height: 900,
    alt: '4 Week Complete Course, Take Back Control Course, playing on a phone. Week 1: Create Your Family Reset Rhythm, 05:21. Week 2: Morning Flow That Doesn’t Break, 05:59. Week 3: Weekly Planning on Autopilot (Audio Training), 05:22. Week 4: Declutter Your Brain, Not Just the Toys, 07:27. Extra bonus: 3 Minute Reset Ritual Audio, 02:11.',
    spec: 'Course card on white: phone + episode list · course.webp, 900 × 900',
  },
  routines: {
    src: '/images/take-back-control/routines.webp',
    width: 900,
    height: 900,
    alt: 'The four editable routine printables fanned out, the Morning Routine on top with editable times.',
    spec: 'Routine printables mockup on white (“Editable Times”) · routines.webp, 900 × 900',
  },
} satisfies Record<string, Asset>;
