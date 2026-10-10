/** Wires the shop's services from its environment. Tests pass their own fetch. */
import { createDb, type Db } from './db.ts';
import { createResendMailer, type Mailer } from './email.ts';
import { readEnv, STRIPE_API_VERSION, type ShopEnv } from './env.ts';
import { createStripe, type StripeClient } from './stripe.ts';

export interface ShopDeps {
  env: ShopEnv;
  db: Db;
  stripe: StripeClient;
  mailer: Mailer;
  fetch: typeof fetch;
  /** Seconds since the epoch (tests move the clock). */
  now: () => number;
}

export function depsFromEnv(get: (key: string) => string | undefined, fetchFn: typeof fetch = fetch): ShopDeps {
  const env = readEnv(get);
  return {
    env,
    db: createDb(env.supabaseUrl, env.serviceRoleKey, fetchFn),
    stripe: createStripe({ secretKey: env.stripeSecretKey, apiVersion: STRIPE_API_VERSION, fetch: fetchFn }),
    mailer: createResendMailer({ apiKey: env.resendApiKey, from: env.emailFrom, replyTo: env.emailReplyTo, fetch: fetchFn }),
    fetch: fetchFn,
    now: () => Math.floor(Date.now() / 1000),
  };
}

/** Live keys only work once the deployment flag is on (SHOP_LIVE_CHECKOUT=enabled). */
export function stripeBlockedReason(deps: ShopDeps): string | null {
  if (!deps.env.stripeSecretKey) return 'stripe_not_configured';
  if (!/^(sk|rk)_(test|live)_/.test(deps.env.stripeSecretKey)) return 'stripe_not_configured';
  if (deps.stripe.mode === 'live' && !deps.env.liveCheckoutEnabled) return 'live_checkout_disabled';
  return null;
}

export const emailDeps = (deps: ShopDeps) => ({
  db: deps.db,
  mailer: deps.mailer,
  siteUrl: deps.env.siteUrl,
  supportEmail: deps.env.emailReplyTo,
});
