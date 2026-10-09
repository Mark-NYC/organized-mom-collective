/** Reorder page helpers. Options and prices live in src/config.ts. */

/**
 * The URL if it's a real Etsy listing (https, etsy.com, /listing/<id>), otherwise null.
 * Anything else (null, placeholders, shop pages) keeps the buy button disabled.
 */
export function etsyListingUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const etsyHost = u.hostname === 'etsy.com' || u.hostname.endsWith('.etsy.com');
    return u.protocol === 'https:' && etsyHost && /^\/listing\/\d+/.test(u.pathname) ? u.href : null;
  } catch {
    return null;
  }
}

/** "$34" for whole dollars, "$34.50" otherwise. */
export function formatPrice(dollars: number): string {
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** Dollars saved buying `bigWeeks` at `bigPrice` versus enough `smallWeeks` calendars at `smallPrice`. */
export function savingsVersus(big: { price: number; weeks: number }, small: { price: number; weeks: number }): number {
  const save = (big.weeks / small.weeks) * small.price - big.price;
  return save > 0 ? Math.round(save * 100) / 100 : 0;
}
