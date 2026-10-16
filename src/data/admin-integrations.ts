/**
 * Integrations the admin can't check live, stated as they are. Update when one is connected.
 * Stripe, Resend and the store switch are read live from the shop-admin status action instead.
 */
export const GA4_ID = 'G-VGJK1B4TJ6';

export const INTEGRATIONS: { name: string; state: string; use: string }[] = [
  { name: 'Pinterest', state: 'tag + catalog feed; analytics not connected', use: 'Pin and campaign performance (Phase 10)' },
  { name: 'Page inventory', state: 'GitHub Action after each push to main (supabase/ADMIN.md)', use: 'Pages & Funnels, broken-link alerts' },
  { name: 'Email marketing', state: 'none: consent is collected, no list provider', use: 'Subscriptions (Phase 10)' },
];
