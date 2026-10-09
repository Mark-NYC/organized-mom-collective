/**
 * Every internal URL in one place.
 *
 *   PUBLIC  /                  (future marketing site; temporary placeholder now)
 *           /resources                         resource library hub
 *           /resources/<article-slug>          articles (src/content/articles/)
 *           /resources/topics/<pillar-id>      pillar pages (src/data/pillars.ts)
 *   QR      /start             permanent entry point printed on calendars → APP
 *   APP     /app, /app/week, /app/reorder, /app/settings   (noindex)
 *           /app/tidy → /app/week (old name, kept so earlier links still work)
 *
 * Future areas (not built): /calendar, /cleaning, and auth/account
 * routes such as /login and /account.
 */
import { DAY_PARAMS } from './lib/dates';

export const routes = {
  home: '/',
  resources: '/resources',
  article: (slug: string) => `/resources/${slug}`,
  pillar: (id: string) => `/resources/topics/${id}`,
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
