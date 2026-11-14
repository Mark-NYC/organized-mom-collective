/**
 * Family calendar events and their repeats, in wall-clock time (docs/ios/FAMILY_CALENDAR.md).
 *
 * A family calendar is local: "swim at 4:15 on Mondays and Wednesdays" stays 4:15 across a daylight-saving change, the
 * way the paper calendar on the wall does. So dates are plain 'YYYY-MM-DD' strings and times 'HH:MM', never instants,
 * and all date math is done on calendar dates (UTC-based Date arithmetic on midnight, so no DST surprises).
 * Mirrors the database rule in supabase/migrations/20261125000000_family_calendar.sql (calendar_recurrence_ok).
 */

export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';
export interface Recurrence {
  freq: Freq;
  /** Every N days/weeks/months/years (1–52). */
  interval?: number;
  /** Weekly only: 0 = Sunday … 6 = Saturday. Defaults to the first date's weekday. */
  by_day?: number[];
  /** Last date it can happen (inclusive). */
  until?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  notes?: string | null;
  location?: string | null;
  starts_on: string;
  start_time?: string | null;
  end_time?: string | null;
  ends_on?: string | null;
  timezone: string;
  recurrence?: Recurrence | null;
  skip_dates?: string[];
  member_ids: string[];
  owner_member_id?: string | null;
  source?: 'manual' | 'activity';
  source_ref?: string | null;
  /** Server revision this copy matches; 0 = never saved to the server. */
  revision: number;
  deleted?: boolean;
  updated_at?: string;
}

export interface Occurrence {
  event: CalendarEvent;
  /** The local date this occurrence is on. */
  date: string;
  /** Multi-day all-day events: is this a continuing day (not the first)? */
  continued: boolean;
}

const DAY = 86_400_000;
const toDays = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY;
const fromDays = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromDays(toDays(d) + n);
export const weekday = (d: string) => new Date(toDays(d) * DAY).getUTCDay();
export const daysBetween = (a: string, b: string) => toDays(b) - toDays(a);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const isDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && fromDays(toDays(d)) === d;

/** Today in the device's own time zone, as a calendar date. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The Sunday (or Monday) that starts the week containing `d`. */
export function weekStart(d: string, startsOn: 0 | 1 = 0): string {
  return addDays(d, -((weekday(d) - startsOn + 7) % 7));
}

/** Does a repeating event happen on `date`? (Ignores skip dates.) */
function repeatsOn(e: CalendarEvent, r: Recurrence, date: string): boolean {
  const gap = daysBetween(e.starts_on, date);
  if (gap < 0) return false;
  if (r.until && date > r.until) return false;
  const n = Math.max(1, r.interval ?? 1);
  switch (r.freq) {
    case 'daily':
      return gap % n === 0;
    case 'weekly': {
      const days = r.by_day?.length ? r.by_day : [weekday(e.starts_on)];
      if (!days.includes(weekday(date))) return false;
      // Weeks counted from the week of the first date (Sunday-based), so "every 2 weeks on Tue and Thu" stays paired.
      const weeks = Math.floor(daysBetween(weekStart(e.starts_on), weekStart(date)) / 7);
      return weeks % n === 0;
    }
    case 'monthly': {
      const [y0, m0, d0] = [+e.starts_on.slice(0, 4), +e.starts_on.slice(5, 7) - 1, +e.starts_on.slice(8, 10)];
      const [y, m, d] = [+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)];
      const months = (y - y0) * 12 + (m - m0);
      if (months % n !== 0) return false;
      // The 31st in a 30-day month lands on the last day, so "the 31st" never silently disappears.
      return d === Math.min(d0, daysInMonth(y, m));
    }
    case 'yearly': {
      const years = +date.slice(0, 4) - +e.starts_on.slice(0, 4);
      if (years % n !== 0) return false;
      const [m0, d0] = [+e.starts_on.slice(5, 7) - 1, +e.starts_on.slice(8, 10)];
      const [y, m, d] = [+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)];
      return m === m0 && d === Math.min(d0, daysInMonth(y, m)); // Feb 29 → Feb 28 in other years
    }
  }
}

/** Every occurrence of the events between `from` and `to` (inclusive), sorted by date, then all-day first, then time. */
export function occurrences(events: CalendarEvent[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const e of events) {
    if (e.deleted) continue;
    const skip = new Set(e.skip_dates ?? []);
    if (e.recurrence) {
      for (let d = from > e.starts_on ? from : e.starts_on; d <= to; d = addDays(d, 1)) {
        if (!skip.has(d) && repeatsOn(e, e.recurrence, d)) out.push({ event: e, date: d, continued: false });
      }
    } else {
      const last = e.ends_on && !e.start_time ? e.ends_on : e.starts_on;
      for (let d = e.starts_on > from ? e.starts_on : from; d <= last && d <= to; d = addDays(d, 1)) {
        if (!skip.has(d)) out.push({ event: e, date: d, continued: d !== e.starts_on });
      }
    }
  }
  return out.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1)
      : (a.event.start_time ?? '') !== (b.event.start_time ?? '') ? ((a.event.start_time ?? '') < (b.event.start_time ?? '') ? -1 : 1)
        : a.event.title.localeCompare(b.event.title));
}

/** "4:15 PM", "4:15–5:30 PM", or "All day". */
export function timeLabel(e: Pick<CalendarEvent, 'start_time' | 'end_time'>): string {
  if (!e.start_time) return 'All day';
  const f = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return { text: `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}`, pm: h >= 12 };
  };
  const a = f(e.start_time);
  if (!e.end_time) return `${a.text} ${a.pm ? 'PM' : 'AM'}`;
  const b = f(e.end_time);
  return a.pm === b.pm ? `${a.text}–${b.text} ${b.pm ? 'PM' : 'AM'}` : `${a.text} ${a.pm ? 'PM' : 'AM'}–${b.text} ${b.pm ? 'PM' : 'AM'}`;
}

/** "Every Mon and Wed", "Every 2 weeks on Tue", "Every day", "Monthly on the 15th", "Every year". */
export function repeatLabel(e: Pick<CalendarEvent, 'recurrence' | 'starts_on'>): string | null {
  const r = e.recurrence;
  if (!r) return null;
  const n = r.interval ?? 1;
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const until = r.until ? ` until ${new Date(toDays(r.until) * DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}` : '';
  if (r.freq === 'daily') return (n === 1 ? 'Every day' : `Every ${n} days`) + until;
  if (r.freq === 'weekly') {
    const days = (r.by_day?.length ? r.by_day : [weekday(e.starts_on)]).slice().sort().map((d) => names[d]);
    const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}` : days[0];
    return (n === 1 ? `Every ${list}` : `Every ${n} weeks on ${list}`) + until;
  }
  const day = +e.starts_on.slice(8, 10);
  const ord = day + (['th', 'st', 'nd', 'rd'][day % 100 > 10 && day % 100 < 14 ? 0 : day % 10 < 4 ? day % 10 : 0] ?? 'th');
  if (r.freq === 'monthly') return (n === 1 ? `Monthly on the ${ord}` : `Every ${n} months on the ${ord}`) + until;
  return (n === 1 ? 'Every year' : `Every ${n} years`) + until;
}
