/**
 * Edge Function configuration, read once from the environment (Supabase → Edge Functions →
 * Secrets). Plain TypeScript with no Deno globals, so tests can build it from a map.
 * Setup and every variable: supabase/SHOP.md.
 */

export interface ShopEnv {
  /** Provided by Supabase. */
  supabaseUrl: string;
  serviceRoleKey: string;
  anonKey: string;
  /** sk_test_… until live payments are approved. */
  stripeSecretKey: string;
  /** whsec_… from the Stripe webhook endpoint. */
  stripeWebhookSecret: string;
  stripeApiBase: string;
  /** Live keys are refused unless this is exactly "enabled". */
  livePaymentsEnabled: boolean;
  /** Public site origin, for return URLs, images and emails. */
  siteUrl: string;
  /** Browser origins allowed to call shop-checkout and shop-admin. */
  allowedOrigins: string[];
  /** Lets /checkout?preview=… through while checkout_mode is 'preview'. */
  previewToken: string;
  resendApiKey: string;
  emailFrom: string;
  emailReplyTo: string;
}

export const STRIPE_API_VERSION = '2025-03-31.basil';

export function readEnv(get: (key: string) => string | undefined): ShopEnv {
  const v = (k: string, fallback = '') => (get(k) ?? fallback).trim();
  const siteUrl = v('SHOP_SITE_URL', 'https://organizedmomcollective.com').replace(/\/$/, '');
  const origins = v('SHOP_ALLOWED_ORIGINS');
  return {
    supabaseUrl: v('SUPABASE_URL').replace(/\/$/, ''),
    serviceRoleKey: v('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey: v('SUPABASE_ANON_KEY'),
    stripeSecretKey: v('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: v('STRIPE_WEBHOOK_SECRET'),
    stripeApiBase: v('STRIPE_API_BASE', 'https://api.stripe.com').replace(/\/$/, ''),
    livePaymentsEnabled: v('SHOP_LIVE_PAYMENTS') === 'enabled',
    siteUrl,
    allowedOrigins: origins ? origins.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean) : [siteUrl],
    previewToken: v('SHOP_PREVIEW_TOKEN'),
    resendApiKey: v('RESEND_API_KEY'),
    emailFrom: v('SHOP_EMAIL_FROM', 'Organized Mom Collective <orders@organizedmomcollective.com>'),
    emailReplyTo: v('SHOP_EMAIL_REPLY_TO'),
  };
}
