/** Local-time date helpers. Everything is keyed to the user's own calendar day. */

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD in local time */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM in local time */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 5 || day === 6;
}

/** The Friday that starts the Fri–Sun block containing `d` (only meaningful on weekends). */
export function weekendStart(d: Date): Date {
  const back = { 5: 0, 6: 1, 0: 2 }[d.getDay()] ?? 0;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
