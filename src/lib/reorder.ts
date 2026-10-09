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

const parseDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Whole days from `start` to `end`, inclusive. */
export function daysCovered(start: string, end: string): number {
  return Math.round((parseDay(end).getTime() - parseDay(start).getTime()) / 86_400_000) + 1;
}

/** "Dec 28, 2026 – Jun 27, 2027"; the first year is dropped when both dates share it. */
export function formatSpan(start: string, end: string): string {
  const a = parseDay(start);
  const b = parseDay(end);
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' });
  return `${fmt(a, a.getUTCFullYear() !== b.getUTCFullYear())} – ${fmt(b, true)}`;
}
