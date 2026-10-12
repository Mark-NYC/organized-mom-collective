import type { Asset } from './weekly-reset';

/**
 * The "Take Back Control" upsell page (/take-back-control): a $29 one-time offer shown after
 * someone buys the Weekly Reset System (4-week audio course + 6 implementation tools).
 * Copy lives in the page; the things that change live here.
 *
 * Not sold anywhere yet: there's no shop product for it. Until buyUrl is set the buttons say
 * "Coming soon". The page is always noindex and out of the sitemap (a post-purchase offer).
 *
 * Assets switch on by themselves: drop a file at its `src` path (under public/) and the page
 * shows it; until then it shows a labeled placeholder. Use the real product mockups on a white
 * background (the sections they sit in are white to match).
 */
export const takeBackControl = {
  name: 'Take Back Control',
  price: 29,
  /** Checkout link, once a shop product exists for it. */
  buyUrl: null as string | null,
};

/** The course episodes, in order, with their running times. */
export const courseEpisodes = [
  { title: 'Week 1: Create Your Family Reset Rhythm', time: '05:24' },
  { title: 'Week 2: Morning Flow That Doesn’t Break', time: '06:08' },
  { title: 'Week 3: Weekly Planning on Autopilot (Audio Training)', time: '05:23' },
  { title: 'Week 4: Declutter Your Brain, Not Just the Toys', time: '07:26' },
  { title: '3 Minute Reset Ritual Audio', time: '02:11', bonus: true },
];

export const takeBackControlAssets = {
  overview: {
    src: '/images/take-back-control/overview.webp',
    width: 1920,
    height: 1080,
    alt: 'Everything in Take Back Control: the pantry inventory, routine printables, chore cards and decluttering guide around a laptop showing the weekly planner, and a phone playing the audio course.',
    spec: 'Full bundle mockup on white: printables, laptop, phone · overview.webp, about 1920 × 1080',
  },
  course: {
    src: '/images/take-back-control/course-phone.webp',
    width: 600,
    height: 1100,
    alt: 'The Take Back Control course playing on a phone: Week 2, Morning Flow That Doesn’t Break.',
    spec: 'Phone playing the course, on white (phone only; the episode list is on the page) · course-phone.webp, about 600 × 1100',
  },
  routines: {
    src: '/images/take-back-control/routines.webp',
    width: 1200,
    height: 1100,
    alt: 'The four editable routine printables fanned out, the Morning Routine on top with editable times.',
    spec: 'Routine printables mockup on white (“Editable Times”) · routines.webp, about 1200 × 1100',
  },
} satisfies Record<string, Asset>;
