/**
 * Connected calendars' services (docs/ios/CALENDAR_INTEGRATION.md). Its own secrets; nothing shared with the shop's or
 * the Club's Stripe, mail or billing settings.
 *
 * Secrets (Supabase → Edge Functions → Secrets):
 *   GOOGLE_CALENDAR_CLIENT_ID      OAuth client (Web application) from Google Cloud Console
 *   GOOGLE_CALENDAR_CLIENT_SECRET  its secret
 *   CALENDAR_TOKEN_KEY             32 random bytes, base64 (`openssl rand -base64 32`): seals refresh tokens and feed links
 *   CALENDAR_CRON_SECRET           a long random string the scheduled sync sends (supabase/rollout/calendar-integration/)
 *   CALENDAR_ALLOWED_ORIGINS       optional extra https origins (a Pages preview)
 * Provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY. Site: SHOP_SITE_URL.
 *
 * Without the Google pair, Google is simply unavailable ("status" says so) and feeds still work. Without
 * CALENDAR_TOKEN_KEY nothing can be connected (no secret is ever stored unencrypted).
 */
import { createDb, type Db } from '../db.ts';
import { readEnv, wwwTwin } from '../env.ts';

export interface CalendarEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  anonKey: string;
  siteUrl: string;
  allowedOrigins: string[];
  googleClientId: string;
  googleClientSecret: string;
  tokenKey: string;
  cronSecret: string;
  /** Google redirects here after consent (must be listed on the OAuth client exactly). */
  redirectUri: string;
}

export interface CalendarDeps {
  env: CalendarEnv;
  db: Db;
  fetch: typeof fetch;
  /** ms since epoch (tests move the clock). */
  now: () => number;
  /** Checks a feed host's DNS answers (Deno.resolveDns in production); tests pass their own. */
  resolves?: (host: string) => Promise<string[]>;
}

/** The iPhone app's pages run at capacitor://localhost and call this function directly. */
export const APP_ORIGIN = 'capacitor://localhost';

export function readCalendarEnv(get: (key: string) => string | undefined): CalendarEnv {
  const v = (k: string) => (get(k) ?? '').trim();
  const shop = readEnv(get);
  const extra = v('CALENDAR_ALLOWED_ORIGINS').split(',').map((o) => o.trim().replace(/\/$/, '')).filter((o) => /^https:\/\/[a-z0-9.-]+$/i.test(o));
  return {
    supabaseUrl: shop.supabaseUrl,
    serviceRoleKey: shop.serviceRoleKey,
    anonKey: shop.anonKey,
    siteUrl: shop.siteUrl,
    allowedOrigins: [...new Set([shop.siteUrl, wwwTwin(shop.siteUrl), APP_ORIGIN, ...extra].filter((o): o is string => Boolean(o)))],
    googleClientId: v('GOOGLE_CALENDAR_CLIENT_ID'),
    googleClientSecret: v('GOOGLE_CALENDAR_CLIENT_SECRET'),
    tokenKey: v('CALENDAR_TOKEN_KEY'),
    cronSecret: v('CALENDAR_CRON_SECRET'),
    redirectUri: `${shop.supabaseUrl}/functions/v1/calendar-connect`,
  };
}

export function calendarDepsFromEnv(get: (key: string) => string | undefined, fetchFn: typeof fetch = fetch, resolves?: CalendarDeps['resolves']): CalendarDeps {
  const env = readCalendarEnv(get);
  return { env, db: createDb(env.supabaseUrl, env.serviceRoleKey, fetchFn), fetch: fetchFn, now: () => Date.now(), resolves };
}
