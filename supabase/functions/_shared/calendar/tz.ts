/**
 * Time-zone math for imported calendars (docs/ios/CALENDAR_INTEGRATION.md). Pure, Intl-based, the same in Deno (Edge
 * Functions), Node (tests) and browsers. Wall-clock date 'YYYY-MM-DD' + time 'HH:MM:SS' in a named zone ⇄ instants.
 */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function parts(ms: number, tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return o;
}

/** Is this an IANA zone this runtime knows? */
export function validZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Outlook / Exchange feeds name zones the Windows way. The ones US families meet, plus a few common others.
const WINDOWS: Record<string, string> = {
  'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver', 'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles', 'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu', 'Atlantic Standard Time': 'America/Halifax',
  'US Eastern Standard Time': 'America/Indiana/Indianapolis', 'Newfoundland Standard Time': 'America/St_Johns',
  'GMT Standard Time': 'Europe/London', 'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest', 'AUS Eastern Standard Time': 'Australia/Sydney', 'UTC': 'UTC',
  'Coordinated Universal Time': 'UTC', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
};

/** A feed's TZID as an IANA zone, or null when it can't be understood (callers fall back to the calendar's zone). */
export function normalizeZone(tzid: string | null | undefined): string | null {
  if (!tzid) return null;
  let t = tzid.trim().replace(/^"|"$/g, '');
  // "/mozilla.org/20050126_1/America/New_York", "/citadel.org/20190914_1/America/Chicago"
  const m = t.match(/([A-Za-z_]+\/[A-Za-z_+\-]+(?:\/[A-Za-z_+\-]+)?)$/);
  if (t.startsWith('/') && m) t = m[1];
  if (WINDOWS[t]) return WINDOWS[t];
  if (/^(Z|GMT|UTC|Etc\/UTC|Etc\/GMT)$/i.test(t)) return 'UTC';
  return validZone(t) ? t : null;
}

const asUtc = (date: string, time: string) =>
  Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +time.slice(0, 2), +time.slice(3, 5), +(time.slice(6, 8) || 0));

/** Offset of `tz` from UTC at instant `ms`, in ms (New York in winter: -5h). */
export function offsetAt(ms: number, tz: string): number {
  const p = parts(ms, tz);
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/**
 * The instant a wall-clock time in `tz` happens. A time skipped by spring-forward (2:30 AM) moves an hour later, the
 * way phones show it; a repeated time in fall-back takes the first (daylight) one.
 */
export function zonedToInstant(date: string, time: string, tz: string): number {
  const guess = asUtc(date, time);
  if (tz === 'UTC') return guess;
  const o1 = offsetAt(guess - offsetAt(guess, tz), tz);
  let t = guess - o1;
  const o2 = offsetAt(t, tz);
  if (o2 !== o1) {
    // Near a transition: try both offsets and keep one that reads back as the same wall time; the earlier if both do.
    const cands = [guess - o1, guess - o2].filter((c) => { const w = instantToZoned(c, tz); return w.date === date && w.time === time.padEnd(8, ':00').slice(0, 8); });
    t = cands.length ? Math.min(...cands) : guess - Math.min(o1, o2);
  }
  return t;
}

/** An instant as wall-clock date and time in `tz`. */
export function instantToZoned(ms: number, tz: string): { date: string; time: string } {
  const p = parts(ms, tz);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${String(+p.hour % 24).padStart(2, '0')}:${p.minute}:${p.second}` };
}
