import { shopConfigured, shopEnabled } from '../lib/shop';
import { routes } from '../routes';

/**
 * The "Mind Your Own Motherhood" mug (/mind-your-own-motherhood-mug): a $23, 15oz ceramic mug,
 * sold on its own (no calendar, no cleaning companion). Copy lives in the page.
 *
 * Sold through the website's own Stripe checkout as a physical product (product
 * `mind-your-own-motherhood-mug`, supabase/migrations/20261015000000_shop_mug.sql): stock,
 * US shipping, fulfilled by hand from the dashboard. The price here must match that product's
 * price. The buy button goes to the checkout only in builds with the shop switched on; until then
 * it says "Coming soon" and the page is noindex and out of the sitemap (it's still listed on /shop).
 */
export const MUG_SLUG = 'mind-your-own-motherhood-mug';

export const mug = {
  name: 'Mind Your Own Motherhood Mug',
  price: 23,
  buyUrl: shopEnabled() && shopConfigured() ? `${routes.checkout}?product=${MUG_SLUG}` : null,
};

/** The product photo (the real print on a white mug), 640/960/1280 in public/images/shop/; original in design/shop/. */
export const mugImage = {
  src: '/images/shop/mind-your-own-motherhood-mug',
  widths: [640, 960, 1280],
  width: 1280,
  height: 1280,
  alt: 'A white 15oz ceramic mug printed with “Mind your own Motherhood” in soft sage-gray lettering.',
};
