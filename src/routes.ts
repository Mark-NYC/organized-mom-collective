/**
 * Every internal URL in one place.
 *
 *   PUBLIC  /                  (future marketing site; temporary placeholder now)
 *   QR      /start             permanent entry point printed on calendars → APP
 *   APP     /app, /app/tidy, /app/reorder, /app/settings   (noindex)
 *
 * Future areas (not built): /calendar, /cleaning, /blog/…, and auth/account
 * routes such as /login and /account.
 */
import { DAY_PARAMS } from './lib/dates';

export const routes = {
  home: '/',
  start: '/start',
  today: '/app',
  tidy: '/app/tidy',
  reorder: '/app/reorder',
  settings: '/app/settings',
  monthlyFocus: '/app/tidy#monthly-focus',
  /** A specific weekday of the current week, e.g. /app?day=monday */
  day: (dow: number) => `/app?day=${DAY_PARAMS[dow]}`,
} as const;

/** True for paths inside the companion app. */
export const isAppPath = (path: string) => path === '/app' || path.startsWith('/app/');
