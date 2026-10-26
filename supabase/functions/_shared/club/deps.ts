/**
 * The Organized Family Club's services. Same database, Resend and site settings as the shop (readEnv), but its own
 * Stripe key, webhook secret and live switch, so a Club test can never touch the shop's live Stripe account and the
 * shop's key can never start a subscription.
 *
 * Secrets (Supabase → Edge Functions → Secrets), docs/club/MEMBERSHIP.md:
 *   CLUB_STRIPE_SECRET_KEY      sk_test_… (or rk_test_…) until live payments are approved
 *   CLUB_STRIPE_WEBHOOK_SECRET  optional: whsec_… if the endpoint was made by hand (club-admin → stripe_setup stores its own)
 *   CLUB_LIVE_CHECKOUT          "enabled" only after the owner approves live payments; without it live keys are refused
 *   CLUB_EMAIL_FROM             optional sender, default hello@
 */
import { createDb, type Db } from '../db.ts';
import { createResendMailer, type Mailer } from '../email.ts';
import { readEnv, STRIPE_API_VERSION, type ShopEnv } from '../env.ts';
import { createStripe, type StripeClient } from '../stripe.ts';

export interface ClubEnv extends ShopEnv {
  clubStripeSecretKey: string;
  clubWebhookSecret: string;
  clubLiveCheckout: boolean;
  clubEmailFrom: string;
}

export interface ClubDeps {
  env: ClubEnv;
  db: Db;
  stripe: StripeClient;
  mailer: Mailer;
  fetch: typeof fetch;
  now: () => number;
}

export const CLUB_PRICES = {
  monthly: { lookupKey: 'club_monthly_v1', amount: 500, interval: 'month' as const, nickname: 'Organized Family Club · Monthly' },
  annual: { lookupKey: 'club_annual_v1', amount: 6000, interval: 'year' as const, nickname: 'Organized Family Club · Annual' },
};
export type ClubPlan = keyof typeof CLUB_PRICES;
export const isPlan = (v: unknown): v is ClubPlan => v === 'monthly' || v === 'annual';

export const CLUB_PRODUCT_TAG = 'organized-family-club';

export function readClubEnv(get: (key: string) => string | undefined): ClubEnv {
  const v = (k: string) => (get(k) ?? '').trim();
  return {
    ...readEnv(get),
    clubStripeSecretKey: v('CLUB_STRIPE_SECRET_KEY'),
    clubWebhookSecret: v('CLUB_STRIPE_WEBHOOK_SECRET'),
    clubLiveCheckout: v('CLUB_LIVE_CHECKOUT') === 'enabled',
    clubEmailFrom: v('CLUB_EMAIL_FROM') || 'Organized Family Club <hello@organizedmomcollective.com>',
  };
}

export function clubDepsFromEnv(get: (key: string) => string | undefined, fetchFn: typeof fetch = fetch): ClubDeps {
  const env = readClubEnv(get);
  return {
    env,
    db: createDb(env.supabaseUrl, env.serviceRoleKey, fetchFn),
    stripe: createStripe({ secretKey: env.clubStripeSecretKey, apiVersion: STRIPE_API_VERSION, fetch: fetchFn }),
    mailer: createResendMailer({ apiKey: env.resendApiKey, from: env.clubEmailFrom, replyTo: env.emailReplyTo, fetch: fetchFn }),
    fetch: fetchFn,
    now: () => Math.floor(Date.now() / 1000),
  };
}

/** Why the Club can't talk to Stripe right now (null: it can). Live keys need CLUB_LIVE_CHECKOUT=enabled. */
export function clubStripeBlocked(deps: ClubDeps): string | null {
  const key = deps.env.clubStripeSecretKey;
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) return 'stripe_not_configured';
  if (deps.stripe.mode === 'live' && !deps.env.clubLiveCheckout) return 'live_checkout_disabled';
  return null;
}
