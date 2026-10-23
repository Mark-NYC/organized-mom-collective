/**
 * Copy for the countdown bar above every public page (src/components/site/CountdownBar.astro).
 * Allow 10 days for processing and shipping (owner, 2026-10-23), so the last order that lands by
 * Christmas Eve is placed by the end of December 14. Dates are the visitor's local time.
 *
 *   more than 21 days to the cutoff  "The 2027 calendar is here · Order by Dec 14 for Christmas"
 *   21 days or fewer                 "{n} days left to order for Christmas"
 *   after the cutoff, before Jan 1   "{n} days left to get your 2027 calendar"
 *   from Jan 1, 2027                 no bar
 */
export const CHRISTMAS_CUTOFF = new Date(2026, 11, 15); // midnight ending Dec 14
export const NEW_YEAR = new Date(2027, 0, 1);
/** A countdown only feels urgent under about three weeks; before that the bar announces instead. */
const URGENT_DAYS = 21;

const daysUntil = (end: Date, now: Date) => Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
const unit = (n: number) => (n === 1 ? 'day' : 'days');

export interface CountdownCopy {
  /** Big number at the start of the bar, when there is one. */
  count?: string;
  text: string;
}

export function countdownCopy(now: Date): CountdownCopy | null {
  const toCutoff = daysUntil(CHRISTMAS_CUTOFF, now);
  if (toCutoff > URGENT_DAYS) return { text: 'The 2027 calendar is here · Order by Dec\u00a014 for Christmas' };
  if (toCutoff > 0) return { count: String(toCutoff), text: `${unit(toCutoff)} left to order for Christmas` };
  const toNewYear = daysUntil(NEW_YEAR, now);
  if (toNewYear > 0) return { count: String(toNewYear), text: `${unit(toNewYear)} left to get your 2027 calendar` };
  return null;
}
