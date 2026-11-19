/**
 * iCalendar (RFC 5545) feeds → the event instances Organized Family shows (docs/calendar/CALENDAR_INTEGRATION.md).
 * Pure, dependency-free, runs in Deno (the calendar-feeds Edge Function) and Node (the tests). It never trusts a feed:
 * every value is length-limited, unknown properties are ignored, expansion is capped.
 *
 * What it handles, because school and sports calendars use it:
 *   - folded lines, escaped text, CRLF or LF;
 *   - all-day events (VALUE=DATE, DTEND exclusive) and timed events: UTC ("Z"), with a TZID (IANA, or the common
 *     Windows names Outlook/Exchange publish), or floating (read in the calendar's X-WR-TIMEZONE, else the household's);
 *   - DTEND or DURATION;
 *   - RRULE: DAILY, WEEKLY, MONTHLY, YEARLY with INTERVAL, COUNT, UNTIL, BYDAY (with ordinals like 2TU, -1FR for
 *     monthly/yearly), BYMONTHDAY (incl. negative), BYMONTH, WKST; expanded in the event's own wall time so "4:30 PM
 *     every Tuesday" stays 4:30 across daylight-saving changes;
 *   - EXDATE and RDATE; RECURRENCE-ID overrides (a moved or renamed practice); STATUS:CANCELLED on an event or on one
 *     occurrence (a cancelled game disappears).
 * Out: one instance per occurrence inside the window, keyed by UID + the occurrence's original start, so a refresh
 * replaces instead of duplicating.
 */

export interface IcsInstance {
  uid: string;
  /** The occurrence's original start (stable key across edits of that one occurrence). */
  instance_key: string;
  title: string;
  location: string | null;
  all_day: boolean;
  /** Timed: UTC instants (ISO). */
  starts_at: string | null;
  ends_at: string | null;
  /** All-day: local dates, end inclusive. */
  start_date: string | null;
  end_date: string | null;
  status: 'confirmed' | 'tentative';
}

export interface IcsResult {
  name: string | null;
  timezone: string | null;
  instances: IcsInstance[];
  /** Events skipped because they couldn't be read (bad dates, unsupported rules), for the feed's status line. */
  skipped: number;
}

const MAX_TEXT = { title: 120, location: 160, uid: 255 } as const;
const MAX_INSTANCES = 5000;
const MAX_ITERATIONS = 20000;

// ------------------------------------------------------------------ lines and properties

interface Prop { name: string; params: Record<string, string>; value: string }

function unfold(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n').filter((l) => l.length > 0);
}

function parseLine(line: string): Prop | null {
  // NAME;PARAM=VALUE;PARAM="quoted:value":VALUE: the first colon outside quotes ends the name and params.
  let inQuote = false;
  let cut = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ':' && !inQuote) { cut = i; break; }
  }
  if (cut < 1) return null;
  const head = line.slice(0, cut);
  const value = line.slice(cut + 1);
  const parts = head.split(';');
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: parts[0].toUpperCase(), params, value };
}

const unescapeText = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').replace(/\s+/g, ' ').trim();
const clip = (v: string, n: number) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);

// ------------------------------------------------------------------ time zones

/** Windows zone names that Outlook/Exchange calendars publish, mapped to IANA. */
const WINDOWS_ZONES: Record<string, string> = {
  'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver', 'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles', 'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu', 'Atlantic Standard Time': 'America/Halifax',
  'GMT Standard Time': 'Europe/London', 'W. Europe Standard Time': 'Europe/Berlin', 'UTC': 'UTC',
};

// Building an Intl formatter is slow (much slower than using one): zones are checked once and offsets cached, so a
// large calendar parses within an Edge Function's CPU budget (docs/calendar/CALENDAR_INTEGRATION.md → Usage).
const zoneCache = new Map<string, string | null>();
function validZone(tz: string | undefined | null): string | null {
  if (!tz) return null;
  let v = zoneCache.get(tz);
  if (v !== undefined) return v;
  const name = WINDOWS_ZONES[tz] ?? tz.replace(/^\/[^/]+\/[^/]+\//, ''); // strip "/mozilla.org/20050126_1/" style prefixes
  try {
    zoneFormat(name);
    v = name;
  } catch {
    v = null;
  }
  if (zoneCache.size < 500) zoneCache.set(tz, v);
  return v;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function zoneFormat(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  return f;
}
/** The zone's offset from UTC at an instant, in ms. */
const offsetCache = new Map<string, number>();
const QUARTER_HOUR = 900_000;
function zoneOffset(ms: number, tz: string): number {
  // Zone offsets only change on quarter-hour boundaries, so one lookup per zone and quarter hour is exact.
  const key = `${tz}|${Math.floor(ms / QUARTER_HOUR)}`;
  let off = offsetCache.get(key);
  if (off === undefined) {
    off = zoneOffsetUncached(Math.floor(ms / QUARTER_HOUR) * QUARTER_HOUR, tz);
    if (offsetCache.size > 50_000) offsetCache.clear();
    offsetCache.set(key, off);
  }
  return off;
}
function zoneOffsetUncached(ms: number, tz: string): number {
  const parts = Object.fromEntries(zoneFormat(tz).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

interface Wall { y: number; m: number; d: number; hh: number; mm: number; ss: number }
const wallMs = (w: Wall) => Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, w.ss);
/** Wall time in a zone → the UTC instant (ms). A time skipped by a spring-forward change moves an hour later. */
function zonedToUtc(w: Wall, tz: string): number {
  const guess = wallMs(w);
  const first = guess - zoneOffset(guess, tz);
  const second = guess - zoneOffset(first, tz);
  return second;
}

// ------------------------------------------------------------------ dates

interface DateValue { allDay: boolean; wall: Wall; utc: boolean; tz: string | null }

function parseDate(prop: Prop, fallbackTz: string): DateValue | null {
  const v = prop.value.trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m || prop.params.VALUE === 'DATE') {
    if (!m) m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    return { allDay: true, wall: { y: +m[1], m: +m[2], d: +m[3], hh: 0, mm: 0, ss: 0 }, utc: false, tz: null };
  }
  const t = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!t) return null;
  const wall = { y: +t[1], m: +t[2], d: +t[3], hh: +t[4], mm: +t[5], ss: t[6] ? +t[6] : 0 };
  if (wall.m < 1 || wall.m > 12 || wall.d < 1 || wall.d > 31 || wall.hh > 23 || wall.mm > 59) return null;
  if (t[7]) return { allDay: false, wall, utc: true, tz: 'UTC' };
  return { allDay: false, wall, utc: false, tz: validZone(prop.params.TZID) ?? fallbackTz };
}

const toMs = (dv: DateValue) => (dv.utc ? wallMs(dv.wall) : zonedToUtc(dv.wall, dv.tz ?? 'UTC'));
const dateStr = (w: Pick<Wall, 'y' | 'm' | 'd'>) => `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
const DAYMS = 86_400_000;
function addDaysWall(w: Wall, n: number): Wall {
  const d = new Date(Date.UTC(w.y, w.m - 1, w.d) + n * DAYMS);
  return { ...w, y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
const weekdayOf = (w: Pick<Wall, 'y' | 'm' | 'd'>) => new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** ISO 8601 duration (P1D, PT1H30M, P1W) in ms; null if unreadable. */
function durationMs(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const ms = ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 24 * 3600 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000;
  return m[1] === '-' ? -ms : ms;
}

// ------------------------------------------------------------------ recurrence

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count: number | null;
  until: DateValue | null;
  byDay: { n: number; day: number }[];
  byMonthDay: number[];
  byMonth: number[];
  wkst: number;
}

function parseRule(v: string, fallbackTz: string): Rule | null {
  const kv = Object.fromEntries(v.split(';').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, x]) => [k.toUpperCase(), x]));
  const freq = kv.FREQ as Rule['freq'];
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;
  // Rules we don't expand (BYSETPOS, BYWEEKNO, BYYEARDAY, BYHOUR…) are refused, never guessed.
  if (['BYSETPOS', 'BYWEEKNO', 'BYYEARDAY', 'BYHOUR', 'BYMINUTE', 'BYSECOND'].some((k) => k in kv)) return null;
  const byDay = (kv.BYDAY ?? '').split(',').filter(Boolean).map((t) => {
    const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(t.toUpperCase());
    return m ? { n: m[1] ? +m[1] : 0, day: DAY_CODES.indexOf(m[2]) } : null;
  });
  if (byDay.some((x) => !x)) return null;
  const nums = (s?: string) => (s ?? '').split(',').filter(Boolean).map(Number);
  const until = kv.UNTIL ? parseDate({ name: 'UNTIL', params: {}, value: kv.UNTIL }, fallbackTz) : null;
  return {
    freq, interval: Math.min(Math.max(+(kv.INTERVAL ?? 1) || 1, 1), 1000), count: kv.COUNT ? Math.min(+kv.COUNT, MAX_ITERATIONS) : null,
    until, byDay: byDay as Rule['byDay'], byMonthDay: nums(kv.BYMONTHDAY), byMonth: nums(kv.BYMONTH), wkst: Math.max(DAY_CODES.indexOf(kv.WKST ?? 'MO'), 0),
  };
}

/** The candidate dates of one period (a day, week, month or year starting at `p`), in order. */
function periodDates(rule: Rule, p: Wall, start: Wall): Wall[] {
  if (rule.freq === 'DAILY') return [p];
  if (rule.freq === 'WEEKLY') {
    const days = rule.byDay.length ? rule.byDay.map((b) => b.day) : [weekdayOf(start)];
    const out: Wall[] = [];
    for (let i = 0; i < 7; i++) { const d = addDaysWall(p, i); if (days.includes(weekdayOf(d))) out.push(d); }
    return out;
  }
  const monthDates = (y: number, m: number): Wall[] => {
    const n = daysIn(y, m);
    const at = (d: number): Wall => ({ ...start, y, m, d });
    if (rule.byMonthDay.length) return rule.byMonthDay.map((x) => (x > 0 ? x : n + x + 1)).filter((x) => x >= 1 && x <= n).sort((a, b) => a - b).map(at);
    if (rule.byDay.length) {
      const out: number[] = [];
      for (const b of rule.byDay) {
        const all = Array.from({ length: n }, (_, i) => i + 1).filter((d) => weekdayOf({ y, m, d }) === b.day);
        if (!b.n) out.push(...all);
        else { const pick = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (pick) out.push(pick); }
      }
      return [...new Set(out)].sort((a, b) => a - b).map(at);
    }
    return start.d <= n ? [at(start.d)] : [];
  };
  if (rule.freq === 'MONTHLY') return rule.byMonth.length && !rule.byMonth.includes(p.m) ? [] : monthDates(p.y, p.m);
  // YEARLY
  const months = rule.byMonth.length ? rule.byMonth : [start.m];
  if (!rule.byMonthDay.length && !rule.byDay.length) return months.map((m) => (start.d <= daysIn(p.y, m) ? { ...start, y: p.y, m, d: start.d } : null)).filter(Boolean) as Wall[];
  return months.flatMap((m) => monthDates(p.y, m));
}

function nextPeriod(rule: Rule, p: Wall): Wall {
  switch (rule.freq) {
    case 'DAILY': return addDaysWall(p, rule.interval);
    case 'WEEKLY': return addDaysWall(p, 7 * rule.interval);
    case 'MONTHLY': { const t = p.m - 1 + rule.interval; return { ...p, y: p.y + Math.floor(t / 12), m: (t % 12) + 1, d: 1 }; }
    default: return { ...p, y: p.y + rule.interval, m: 1, d: 1 };
  }
}

/** Every occurrence start (wall time, in the event's zone) up to `toMs`, honouring COUNT and UNTIL. */
function expand(rule: Rule, dt: DateValue, toMs: number): Wall[] {
  const start = dt.wall;
  let period: Wall = rule.freq === 'WEEKLY' ? addDaysWall(start, -((weekdayOf(start) - rule.wkst + 7) % 7))
    : rule.freq === 'MONTHLY' ? { ...start, d: 1 } : rule.freq === 'YEARLY' ? { ...start, m: 1, d: 1 } : start;
  const startMs = wallMs(start);
  const untilMs = rule.until ? (rule.until.allDay ? wallMs({ ...rule.until.wall, hh: 23, mm: 59, ss: 59 }) : toMsLike(rule.until, dt)) : Infinity;
  const out: Wall[] = [];
  let n = 0;
  for (let it = 0; it < MAX_ITERATIONS; it++) {
    for (const d of periodDates(rule, period, start)) {
      const w = { ...d, hh: start.hh, mm: start.mm, ss: start.ss };
      if (wallMs(w) < startMs) continue;
      const ms = dt.allDay ? wallMs(w) : (dt.utc ? wallMs(w) : zonedToUtc(w, dt.tz ?? 'UTC'));
      if (ms > untilMs) return out;
      if (rule.count !== null && n >= rule.count) return out;
      n++;
      if (ms > toMs) return out;
      out.push(w);
      if (out.length >= MAX_INSTANCES) return out;
    }
    period = nextPeriod(rule, period);
    if (wallMs(period) - DAYMS * 400 > toMs) return out;
  }
  return out;
}
// UNTIL is UTC when it has a Z; otherwise in the event's own zone.
function toMsLike(u: DateValue, dt: DateValue): number {
  return u.utc ? wallMs(u.wall) : (dt.allDay ? wallMs(u.wall) : zonedToUtc(u.wall, dt.tz ?? 'UTC'));
}

// ------------------------------------------------------------------ events

interface RawEvent { props: Prop[] }
const first = (e: RawEvent, name: string) => e.props.find((p) => p.name === name) ?? null;
const all = (e: RawEvent, name: string) => e.props.filter((p) => p.name === name);

/** Keys of a list of date values (EXDATE/RDATE), comparable with an occurrence's key. */
function dateKeys(props: Prop[], fallbackTz: string): Set<string> {
  const out = new Set<string>();
  for (const p of props) for (const value of p.value.split(',')) {
    const dv = parseDate({ ...p, value }, fallbackTz);
    if (dv) out.add(dv.allDay ? dateStr(dv.wall) : new Date(toMs(dv)).toISOString());
  }
  return out;
}

/**
 * Parse a feed and return the instances that overlap [fromMs, toMs]. `householdTz` reads floating times when the
 * feed doesn't name its own zone.
 */
export function parseIcs(text: string, opts: { fromMs: number; toMs: number; householdTz: string }): IcsResult {
  const lines = unfold(text);
  if (!lines.some((l) => /^BEGIN:VCALENDAR/i.test(l))) throw new Error('not_ical');
  // Cut off mid-download (a dropped connection): never store half a calendar in place of the whole one.
  if (!lines.some((l) => /^END:VCALENDAR/i.test(l))) throw new Error('incomplete');
  let name: string | null = null;
  let calTz: string | null = null;
  const events: RawEvent[] = [];
  let cur: RawEvent | null = null;
  let depth = 0; // nested components inside VEVENT (VALARM) are ignored
  for (const line of lines) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') {
      if (p.value.toUpperCase() === 'VEVENT' && !cur) { cur = { props: [] }; depth = 0; }
      else if (cur) depth++;
      continue;
    }
    if (p.name === 'END') {
      if (cur && depth > 0) depth--;
      else if (cur && p.value.toUpperCase() === 'VEVENT') { events.push(cur); cur = null; }
      continue;
    }
    if (cur && depth === 0) { if (cur.props.length < 200) cur.props.push(p); }
    else if (!cur) {
      if (p.name === 'X-WR-CALNAME') name = clip(unescapeText(p.value), 80);
      if (p.name === 'X-WR-TIMEZONE') calTz = validZone(p.value.trim());
    }
  }
  const tz = calTz ?? validZone(opts.householdTz) ?? 'UTC';

  // Overrides (RECURRENCE-ID) by UID and the original start they replace.
  const overrides = new Map<string, Map<string, RawEvent>>();
  const masters: RawEvent[] = [];
  for (const e of events) {
    const uid = first(e, 'UID')?.value.trim();
    if (!uid) continue;
    const rid = first(e, 'RECURRENCE-ID');
    if (rid) {
      const dv = parseDate(rid, tz);
      if (!dv) continue;
      const key = dv.allDay ? dateStr(dv.wall) : new Date(toMs(dv)).toISOString();
      (overrides.get(uid) ?? overrides.set(uid, new Map()).get(uid)!).set(key, e);
    } else masters.push(e);
  }

  const instances: IcsInstance[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  const emit = (e: RawEvent, uid: string, key: string, startDv: DateValue, startWall: Wall) => {
    if ((first(e, 'STATUS')?.value ?? '').toUpperCase() === 'CANCELLED') return;
    const title = clip(unescapeText(first(e, 'SUMMARY')?.value ?? '') || 'Busy', MAX_TEXT.title);
    const locRaw = first(e, 'LOCATION')?.value;
    const location = locRaw ? clip(unescapeText(locRaw), MAX_TEXT.location) || null : null;
    const status = (first(e, 'STATUS')?.value ?? '').toUpperCase() === 'TENTATIVE' ? 'tentative' : 'confirmed';
    const endProp = first(e, 'DTEND');
    const durProp = first(e, 'DURATION');
    const masterDtStart = parseDate(first(e, 'DTSTART')!, tz)!;
    const endDv = endProp ? parseDate(endProp, tz) : null;
    if (startDv.allDay) {
      const s = dateStr(startWall);
      let days = 1;
      if (endDv && endDv.allDay) days = Math.max(1, Math.round((wallMs(endDv.wall) - wallMs(masterDtStart.wall)) / DAYMS));
      else if (durProp) { const d = durationMs(durProp.value); if (d && d > 0) days = Math.max(1, Math.round(d / DAYMS)); }
      days = Math.min(days, 60);
      const startMs = wallMs(startWall);
      const endMs = startMs + days * DAYMS - 1;
      if (endMs < opts.fromMs - DAYMS || startMs > opts.toMs) return;
      const k = `${uid}|${key}`;
      if (seen.has(k)) return;
      seen.add(k);
      instances.push({ uid, instance_key: key, title, location, all_day: true, starts_at: null, ends_at: null, start_date: s, end_date: dateStr(addDaysWall(startWall, days - 1)), status });
      return;
    }
    const startMs = startDv.utc ? wallMs(startWall) : zonedToUtc(startWall, startDv.tz ?? tz);
    let len = 3_600_000;
    if (endDv && !endDv.allDay) len = toMs(endDv) - toMs(masterDtStart);
    else if (durProp) { const d = durationMs(durProp.value); if (d !== null) len = d; }
    len = Math.min(Math.max(len, 0), 14 * DAYMS);
    if (startMs + len < opts.fromMs || startMs > opts.toMs) return;
    const k = `${uid}|${key}`;
    if (seen.has(k)) return;
    seen.add(k);
    instances.push({ uid, instance_key: key, title, location, all_day: false, starts_at: new Date(startMs).toISOString(), ends_at: new Date(startMs + len).toISOString(), start_date: null, end_date: null, status });
  };

  for (const e of masters) {
    try {
      const uid = clip(first(e, 'UID')!.value.trim(), MAX_TEXT.uid);
      const dtProp = first(e, 'DTSTART');
      const dt = dtProp ? parseDate(dtProp, tz) : null;
      if (!dt) { skipped++; continue; }
      const own = overrides.get(uid) ?? new Map<string, RawEvent>();
      const keyOf = (w: Wall) => (dt.allDay ? dateStr(w) : new Date(dt.utc ? wallMs(w) : zonedToUtc(w, dt.tz ?? tz)).toISOString());
      const rruleProp = first(e, 'RRULE');
      let starts: Wall[];
      if (rruleProp) {
        const rule = parseRule(rruleProp.value, tz);
        if (!rule) { skipped++; continue; }
        starts = expand(rule, dt, opts.toMs + DAYMS);
      } else starts = [dt.wall];
      // RDATEs add occurrences at the same time of day.
      for (const r of all(e, 'RDATE')) for (const value of r.value.split(',')) {
        const dv = parseDate({ ...r, value }, tz);
        if (dv) starts.push(dt.allDay ? { ...dv.wall, hh: 0, mm: 0, ss: 0 } : dv.wall);
      }
      const ex = dateKeys(all(e, 'EXDATE'), tz);
      for (const w of starts) {
        const key = keyOf(w);
        if (ex.has(key)) continue;
        const o = own.get(key);
        if (o) {
          const odv = parseDate(first(o, 'DTSTART') ?? dtProp!, tz);
          if (!odv) continue;
          emit(o, uid, key, odv, odv.wall);
          own.delete(key);
        } else emit(e, uid, key, dt, w);
      }
      // Overrides whose original slot fell outside what we expanded (moved into the window) still count.
      for (const [key, o] of own) {
        const odv = parseDate(first(o, 'DTSTART')!, tz);
        if (odv) emit(o, uid, key, odv, odv.wall);
      }
    } catch {
      skipped++;
    }
  }
  instances.sort((a, b) => (a.starts_at ?? `${a.start_date}T00`).localeCompare(b.starts_at ?? `${b.start_date}T00`));
  return { name, timezone: calTz, instances: instances.slice(0, MAX_INSTANCES), skipped };
}
