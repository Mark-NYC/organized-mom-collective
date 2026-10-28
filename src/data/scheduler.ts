import { shopConfigured, shopEnabled } from '../lib/shop';
import { routes } from '../routes';

/** This requires the matching shop_products record and confirmed inventory in Supabase. */
export const SCHEDULER_SLUG = 'family-schedule-calendar-2027';
export const scheduler = {
  name: '2027 Family Schedule Wall Calendar',
  price: 30.99,
  buyUrl: shopEnabled() && shopConfigured() ? `${routes.checkout}?product=${SCHEDULER_SLUG}` : null,
};
