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
  /**
   * Deployment-level live-checkout flag: SHOP_LIVE_CHECKOUT=enabled. Without it, live Stripe
   * keys are refused outright and public checkout stays shut even if the admin store setting
   * says "live". Preview mode never needs it (and never takes real money).
   */
  liveCheckoutEnabled: boolean;
  /** Public site origin, for return URLs, images and emails. */
  siteUrl: string;
  /**
   * Browser origins allowed to call shop-checkout, shop-download and shop-admin: always the site
   * URL and its www/bare twin (whichever the domain redirects to), plus SHOP_ALLOWED_ORIGINS.
   */
  allowedOrigins: string[];
  /** Lets /checkout?preview=… through while checkout_mode is 'preview'. */
  previewToken: string;
  resendApiKey: string;
  emailFrom: string;
  emailReplyTo: string;
}

export const STRIPE_API_VERSION = '2025-03-31.basil';

/** https://example.com ⇄ https://www.example.com; null for anything else (localhost, *.vercel.app, subdomains). */
export function wwwTwin(origin: string): string | null {
  const m = origin.match(/^https:\/\/(www\.)?([a-z0-9-]+\.[a-z]{2,})$/i);
  if (!m) return null;
  return m[1] ? `https://${m[2]}` : `https://www.${m[2]}`;
}

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
    liveCheckoutEnabled: v('SHOP_LIVE_CHECKOUT') === 'enabled',
    siteUrl,
    allowedOrigins: [
      ...new Set([siteUrl, wwwTwin(siteUrl), ...origins.split(',').map((o) => o.trim().replace(/\/$/, ''))].filter((o): o is string => Boolean(o))),
    ],
    previewToken: v('SHOP_PREVIEW_TOKEN'),
    resendApiKey: v('RESEND_API_KEY'),
    emailFrom: v('SHOP_EMAIL_FROM', 'Organized Mom Collective <orders@organizedmomcollective.com>'),
    emailReplyTo: v('SHOP_EMAIL_REPLY_TO'),
  };
}
