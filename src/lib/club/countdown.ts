/**
 * The month's action as a dated countdown (three-part kits; August's Back-to-School Countdown). She enters when school
 * starts; each line gets a suggested day, counted back from that first day. Suggestions, never deadlines: a day that's
 * already gone moves to a practical one from today, a first day that's very close keeps only the essentials, and
 * a first day that's passed retires the countdown. Her own dates are never overwritten.
 *
 * Saved as the kit's own document (the countdown printable's id). Dates are plain calendar days ('YYYY-MM-DD'), done
 * as whole-day arithmetic, so nothing shifts across time zones.
 */

export type Day = string;

export interface CountdownItem {
  text: string;
  /** A sentence under the line (December's plan: "Pick two or three Christmas traditions…"). Her own wording replaces both. */
  detail?: string;
  /** Suggested days before the first day of school (a countdown; a plain checklist has none). */
  daysBefore?: number;
  /** Still worth doing when school starts in a day or two. */
  essential?: true;
}

/** A first day of school. The family's is always there; she can add one per child. */
export interface SchoolStart {
  id: string;
  /** 'Everyone', or the child's first name. */
  label: string;
  /** A child on her family profile, when she picked one. */
  childId?: string;
  date: Day | '';
}

export interface CountdownState {
  done: boolean[];
  helpers: string[];
  /** Her own wording for a line (kits whose action is `editable`), or null for the kit's. */
  texts: (string | null)[];
  /** Her own date for a line, or null to follow the suggestion. */
  dates: (Day | null)[];
  starts: SchoolStart[];
  /** The start the dates count back from. */
  basis: string;
  /** The family's one thing (kits with `action.focus`): a suggestion's id or null for her own words, a plan, a start day. */
  focus: FocusState;
}

export interface FocusState {
  area: string | null;
  text: string;
  plan: string;
  start: Day | '';
}
export const MAX_FOCUS = 80;
export const MAX_PLAN = 160;

export const MAX_HELPER = 40;
/** A helper blank under the line holds a short note (February's "Our idea"), so saved blanks keep up to this. */
export const MAX_NOTE = 60;
export const MAX_TEXT = 90;
export const MAX_STARTS = 6;
export const FAMILY_START = 'family';

const DAY_MS = 86_400_000;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (n: number) => String(n).padStart(2, '0');

/** A real calendar day ('2027-02-30' isn't). */
export function isDay(s: unknown): s is Day {
  if (typeof s !== 'string') return false;
  const m = DAY.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// Whole days since 1970-01-01 for a calendar day. UTC is only the counting frame here: no clock time is involved.
const serial = (d: Day) => {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd) / DAY_MS;
};
const fromSerial = (n: number): Day => {
  const d = new Date(n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const addDays = (d: Day, n: number) => fromSerial(serial(d) + n);
export const daysBetween = (from: Day, to: Day) => serial(to) - serial(from);

/** Today on her own calendar (the device's local date, never UTC's). */
export const localToday = (now = new Date()): Day => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** "August 24" */
export const dayLabel = (d: Day) => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8)}`;
/** "Aug 24" */
export const shortLabel = (d: Day) => `${MONTHS[+d.slice(5, 7) - 1].slice(0, 3)} ${+d.slice(8)}`;
/** "Wednesday, August 25" */
export const longLabel = (d: Day) => `${WEEKDAYS[new Date(serial(d) * DAY_MS).getUTCDay()]}, ${dayLabel(d)}`;

export type CountdownStatus =
  | 'undated' // no first day yet: the six lines, no dates
  | 'ahead' // every suggestion fits before the first day
  | 'tight' // some suggestions were already past and moved to the days left
  | 'last-minute' // a day or two left: only the essentials get a day
  | 'today' // school starts today
  | 'started'; // the first day has passed

export interface PlannedLine {
  /** The suggested day, or null (no first day, not needed now, or the countdown is over). */
  suggested: Day | null;
  /** What shows: her own date, else the suggestion. */
  date: Day | null;
  edited: boolean;
  /** The suggestion was already past, so it moved to a day from today. */
  moved: boolean;
  /** Not needed before a first day this close: "when you can". */
  later: boolean;
}

export interface CountdownPlan {
  status: CountdownStatus;
  start: Day | null;
  /** Days from today to the first day (negative once it's passed). */
  daysLeft: number | null;
  lines: PlannedLine[];
}

/** Most lines moved onto one day before a first day that's coming fast. */
const PER_DAY = 2;

/** Suggested days for each line, counted back from `start`, as seen on `today`. `dates` are her own. */
export function planCountdown(items: readonly CountdownItem[], start: Day | '' | null, today: Day, dates: readonly (Day | null)[] = []): CountdownPlan {
  const own = (i: number) => (isDay(dates[i]) ? dates[i]! : null);
  const line = (i: number, suggested: Day | null, moved = false, later = false): PlannedLine => ({
    suggested, date: own(i) ?? suggested, edited: own(i) !== null, moved, later,
  });
  if (!start || !isDay(start)) return { status: 'undated', start: null, daysLeft: null, lines: items.map((_, i) => line(i, null)) };

  const left = daysBetween(today, start);
  if (left <= 0) return { status: left === 0 ? 'today' : 'started', start, daysLeft: left, lines: items.map((_, i) => line(i, null)) };

  if (left <= 2) {
    // A day or two: the essentials, from today, in order; the rest can wait.
    return {
      status: 'last-minute',
      start,
      daysLeft: left,
      lines: items.map((item, i) => {
        if (!item.essential) return line(i, null, false, true);
        if (item.daysBefore === undefined) return line(i, null);
        const ideal = addDays(start, -item.daysBefore);
        return daysBetween(today, ideal) >= 0 ? line(i, ideal) : line(i, today, true);
      }),
    };
  }

  // Lines whose day has gone move to the days left (never onto the night before), at most a couple a day,
  // more only when the days run out. Everything else keeps its suggested day.
  const ideal = items.map((item) => addDays(start, -(item.daysBefore ?? 0)));
  const past = ideal.map((d, i) => (daysBetween(today, d) < 0 ? i : -1)).filter((i) => i >= 0);
  const room = Math.max(1, left - 1);
  const window = (d: Day) => daysBetween(today, d) >= 0 && daysBetween(d, start) >= 2;
  const load = new Map<Day, number>();
  ideal.forEach((d, i) => { if (!past.includes(i) && window(d)) load.set(d, (load.get(d) ?? 0) + 1); });
  const perDay = Math.max(PER_DAY, Math.ceil((past.length + [...load.values()].reduce((a, b) => a + b, 0)) / room));
  const moved = new Map<number, Day>();
  for (const i of past) {
    // The first day from today with room, else the lightest one.
    const days = Array.from({ length: room }, (_, n) => addDays(today, n));
    const day = days.find((d) => (load.get(d) ?? 0) < perDay) ?? days.reduce((a, b) => ((load.get(b) ?? 0) < (load.get(a) ?? 0) ? b : a));
    load.set(day, (load.get(day) ?? 0) + 1);
    moved.set(i, day);
  }
  return {
    status: past.length ? 'tight' : 'ahead',
    start,
    daysLeft: left,
    lines: items.map((_, i) => (moved.has(i) ? line(i, moved.get(i)!, true) : line(i, ideal[i]))),
  };
}

/** The start the countdown counts back from: the one she picked, else the family's. */
export const basisStart = (s: CountdownState) => s.starts.find((x) => x.id === s.basis) ?? s.starts[0];

/** What "Use the suggested dates" would change: her own dates that differ from the suggestion. */
export function resetChanges(items: readonly CountdownItem[], plan: CountdownPlan) {
  return plan.lines
    .map((l, i) => ({ text: items[i].text, from: l.edited ? l.date : null, to: l.suggested }))
    .filter((c) => c.from !== null && c.from !== c.to);
}

/** Saved JSON → state for `lines` lines, dropping anything malformed. */
export function readCountdown(json: unknown, lines: number): CountdownState {
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]) : []);
  const starts: SchoolStart[] = [];
  for (const x of arr('starts')) {
    const s = x as Partial<SchoolStart> | null;
    if (!s || typeof s.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(s.id) || starts.some((y) => y.id === s.id) || starts.length >= MAX_STARTS) continue;
    starts.push({
      id: s.id,
      label: typeof s.label === 'string' && s.label.trim() ? s.label.replace(/\s+/g, ' ').trim().slice(0, 30) : 'Everyone',
      ...(typeof s.childId === 'string' ? { childId: s.childId } : {}),
      date: isDay(s.date) ? s.date : '',
    });
  }
  if (!starts.some((s) => s.id === FAMILY_START)) starts.unshift({ id: FAMILY_START, label: 'Everyone', date: '' });
  const basis = typeof o.basis === 'string' && starts.some((s) => s.id === o.basis) ? o.basis : FAMILY_START;
  return {
    done: Array.from({ length: lines }, (_, i) => arr('done')[i] === true),
    helpers: Array.from({ length: lines }, (_, i) => {
      const h = arr('helpers')[i];
      return typeof h === 'string' ? h.replace(/\s+/g, ' ').slice(0, MAX_NOTE) : '';
    }),
    dates: Array.from({ length: lines }, (_, i) => (isDay(arr('dates')[i]) ? (arr('dates')[i] as Day) : null)),
    texts: Array.from({ length: lines }, (_, i) => {
      const t = arr('texts')[i];
      const clean = typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '';
      return clean || null;
    }),
    starts,
    basis,
    focus: readFocus(o.focus),
  };
}

function readFocus(json: unknown): FocusState {
  const f = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const line = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').slice(0, max) : '');
  return {
    area: typeof f.area === 'string' && /^[a-z0-9-]{1,40}$/.test(f.area) ? f.area : null,
    text: line(f.text, MAX_FOCUS),
    plan: line(f.plan, MAX_PLAN),
    start: isDay(f.start) ? f.start : '',
  };
}

/** The check-in: a week after the start, when the seven days of practice are done. */
export const checkInFor = (start: Day | '') => (start ? addDays(start, 7) : '');

/** The one thing, its plan and its days, as lines for her copied text (empty when she hasn't filled any). */
export function focusLines(label: string, f: FocusState): string[] {
  const out = [
    ...(f.text.trim() ? [`${label}: ${f.text.trim()}`] : []),
    ...(f.plan.trim() ? [`Our plan: ${f.plan.trim()}`] : []),
    ...(f.start ? [`We start: ${longLabel(f.start)} · We check in: ${longLabel(checkInFor(f.start))}`] : []),
  ];
  return out.length ? [...out, ''] : [];
}

/** A line's words: hers when she changed them, else the kit's. */
export const lineText = (items: readonly CountdownItem[], s: CountdownState, i: number) => s.texts[i] ?? items[i].text;
/** The line's detail sentence, unless she's reworded the line (her words replace both). */
export const lineDetail = (items: readonly CountdownItem[], s: CountdownState, i: number) => (s.texts[i] === null ? items[i].detail : undefined);

/** The countdown (or checklist) as plain text, to paste into a note or a message. */
export function countdownText(title: string, items: readonly CountdownItem[], plan: CountdownPlan, s: CountdownState): string {
  const head = [title, ...(plan.start ? [`First day of school: ${longLabel(plan.start)}`] : []), ''];
  const rows = items.map((item, i) => {
    const l = plan.lines[i];
    const when = l.date ? `${shortLabel(l.date)}: ` : l.later ? 'When you can: ' : '';
    const who = s.helpers[i].trim() ? ` (${s.helpers[i].trim()})` : '';
    const detail = lineDetail(items, s, i);
    return `${s.done[i] ? '[x]' : '[ ]'} ${when}${lineText(items, s, i)}${detail ? ` ${detail}` : ''}${who}`;
  });
  return [...head, ...rows].join('\n');
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Lines longer than 75 octets continue on the next line after a space (RFC 5545 §3.1). */
const fold = (line: string) => {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
    }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
};

/**
 * A calendar file with one all-day event per dated line, plus the first day, for importing into a phone or computer
 * calendar. No account, no sync: a file she opens once. `stamp` is the creation time ('YYYYMMDDTHHMMSSZ').
 */
export function countdownIcs(slug: string, title: string, items: readonly CountdownItem[], plan: CountdownPlan, s: CountdownState, stamp: string): string {
  const compact = (d: Day) => d.replace(/-/g, '');
  const event = (uid: string, d: Day, summary: string) => [
    'BEGIN:VEVENT',
    `UID:${uid}@organizedmomcollective.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(d)}`,
    `DTEND;VALUE=DATE:${compact(addDays(d, 1))}`,
    `SUMMARY:${icsText(summary)}`,
    `DESCRIPTION:${icsText(title)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Organized Mom Collective//Organized Family Club//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(plan.start ? event(`${slug}-first-day-${compact(plan.start)}`, plan.start, 'First day of school') : []),
    ...items.flatMap((item, i) => {
      const d = plan.lines[i].date;
      if (!d) return [];
      const who = s.helpers[i].trim() ? ` (${s.helpers[i].trim()})` : '';
      return event(`${slug}-${i + 1}-${compact(d)}`, d, `${lineText(items, s, i).replace(/\.$/, '')}${who}`);
    }),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
