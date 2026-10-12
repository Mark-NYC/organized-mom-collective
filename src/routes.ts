/**
 * Every internal URL in one place.
 *
 *   PUBLIC  /                  brand homepage
 *           /calendar          the Family Wall Calendar product page (buy on Etsy)
 *           /companion         how the cleaning companion works (public explainer)
 *           /weekly-reset      Weekly Reset System landing page ($9 digital bundle; noindex until checkout is live)
 *           /take-back-control "Take Back Control" upsell ($29 course + tools after the Weekly Reset; always noindex)
 *           /planner           free weekly planner, filled in on screen, downloads as a PNG (the upgraded one,
 *                              for Take Back Control buyers, is unlisted: PLANNER_PLUS_PATH in src/data/planner.ts)
 *           /pantry            free pantry inventory tracker, same idea
 *           /resources                         resource library hub
 *           /resources/<article-slug>          articles (src/content/articles/)
 *           /resources/topics/<pillar-id>      pillar pages (src/data/pillars.ts)
 *           /survey            customer discovery survey (noindex, shared by link)
 *           /survey/admin      survey results, admins only (noindex)
 *   SHOP    /checkout           direct checkout (noindex; off unless PUBLIC_SHOP_ENABLED). Linked only from /weekly-reset and /take-back-control
 *                               (?product=weekly-reset-system / take-back-control), and only in builds with the shop on
 *           /checkout/complete  confirmation after Stripe (noindex)
 *           /download?t=…       a digital order's files, from the emailed link (noindex)
 *           /admin/orders       order, inventory and shipping dashboard, shop admins only (noindex)
 *   QR      /start             permanent entry point printed on calendars → APP
 *   APP     /app, /app/week, /app/reorder, /app/settings   (noindex)
 *           /app/tidy → /app/week (old name, kept so earlier links still work)
 *
 * Future areas (not built): auth/account routes such as /login and /account.
 */
import { DAY_PARAMS } from './lib/dates';

export const routes = {
  home: '/',
  calendar: '/calendar',
  /** The calendar page's options and Etsy buttons. */
  buy: '/calendar#buy',
  companion: '/companion',
  weeklyReset: '/weekly-reset',
  takeBackControl: '/take-back-control',
  planner: '/planner',
  pantry: '/pantry',
  resources: '/resources',
  article: (slug: string) => `/resources/${slug}`,
  pillar: (id: string) => `/resources/topics/${id}`,
  survey: '/survey',
  surveyAdmin: '/survey/admin',
  /** Direct website checkout. Calendar buy buttons still go to Etsy; only /weekly-reset and /take-back-control link here, in shop-enabled builds. */
  checkout: '/checkout',
  checkoutComplete: '/checkout/complete',
  download: '/download',
  adminOrders: '/admin/orders',
  start: '/start',
  today: '/app',
  week: '/app/week',
  /** Old name for the Week page; redirects to `week`. */
  tidy: '/app/tidy',
  reorder: '/app/reorder',
  settings: '/app/settings',
  monthlyFocus: '/app/week#monthly-focus',
  /** A specific weekday of the current week, e.g. /app?day=monday */
  day: (dow: number) => `/app?day=${DAY_PARAMS[dow]}`,
} as const;

/** True for paths inside the companion app. */
export const isAppPath = (path: string) => path === '/app' || path.startsWith('/app/');
