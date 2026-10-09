/** Reorder page helpers. Options and prices live in src/config.ts. */
import { BEST_VALUE_ID, CALENDAR_OPTIONS } from '../config';

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

/**
 * The calendar options as shown on the Reorder page (/app/reorder) and the public
 * product page (/calendar), best value first. Source of truth: CALENDAR_OPTIONS in src/config.ts.
 */
export function calendarOptions() {
  const smallest = CALENDAR_OPTIONS.reduce((a, b) => (b.weeks < a.weeks ? b : a));
  return CALENDAR_OPTIONS.map((o) => {
    const sets = o.weeks / smallest.weeks;
    const bestValue = o.id === BEST_VALUE_ID;
    return {
      ...o,
      url: etsyListingUrl(o.etsyUrl),
      shortName: o.name.replace(/ Calendar$/, ''),
      priceLabel: formatPrice(o.price),
      bestValue,
      span: sets === 2 ? 'Full year of planning' : `${o.weeks} weeks`,
      save: o.id === smallest.id || sets !== 2 ? 0 : savingsVersus(o, smallest),
      setsWeeks: sets === 2 ? smallest.weeks : 0,
      // Exact dates appear only once confirmed in src/config.ts.
      editions: o.editions.map((e) => ({ label: e.label, dates: e.start && e.end ? formatSpan(e.start, e.end) : '' })),
    };
    // Recommended option first, so on phones it's the first one she sees.
  }).sort((a, b) => Number(b.bestValue) - Number(a.bestValue));
}

export type CalendarOption = ReturnType<typeof calendarOptions>[number];

/** The Etsy listing to send a general "Shop" button to: the best-value option's, else any live one. Null until one is set. */
export function shopUrl(): string | null {
  const options = calendarOptions();
  return options.find((o) => o.bestValue && o.url)?.url ?? options.find((o) => o.url)?.url ?? null;
}
