/**
 * Subscribed calendar feeds (iCalendar / .ics, "webcal" links from schools, leagues, TeamSnap, GameChanger, Google's
 * and Outlook's "secret address") → the occurrences inside a window (docs/ios/CALENDAR_INTEGRATION.md).
 *
 * Handles: line folding and escapes, TZID (IANA, Outlook's Windows names, mozilla-style prefixes), UTC and floating
 * times (floating = the calendar's X-WR-TIMEZONE, else the family's zone), all-day dates (DTEND exclusive), DURATION,
 * RRULE (./rrule.ts), EXDATE, RDATE, moved or cancelled single occurrences (RECURRENCE-ID), cancelled events
 * (STATUS:CANCELLED), duplicate UIDs (highest SEQUENCE wins; same UID on different events is kept apart), and
 * private events (CLASS:PRIVATE/CONFIDENTIAL → the household sees "Busy").
 */
import { addDays, fromDays, toDays } from './dates.ts';
import { expandDates, parseRule } from './rrule.ts';
import { instantToZoned, normalizeZone, zonedToInstant } from './tz.ts';
import { clip, LIMITS, safeLink, type ImportedInstance } from './types.ts';

interface Prop { name: string; params: Record<string, string>; value: string }
interface DT { date: string; time: string | null; utc: boolean; tz: string | null }
interface VEvent {
  uid: string; summary: string | null; location: string | null; description: string | null; url: string | null;
  status: string | null; klass: string | null; sequence: number;
  start: DT; end: DT | null; duration: string | null; rrule: string | null;
  exdates: DT[]; rdates: DT[]; recurrenceId: DT | null;
}

export interface FeedResult {
  name: string | null;
  zone: string | null;
  events: ImportedInstance[];
  /** Feed parsed but contained no VCALENDAR (an HTML login page, an error message). */
  notCalendar: boolean;
}

const unescape = (s: string) => s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

function props(text: string): Prop[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: Prop[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    // name;param=value;param="quoted:value":value
    let i = 0;
    let inQuote = false;
    for (; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuote = !inQuote;
      else if (c === ':' && !inQuote) break;
    }
    if (i >= line.length) continue;
    const head = line.slice(0, i);
    const value = line.slice(i + 1);
    const segs = head.match(/(?:[^;"]|"[^"]*")+/g) ?? [];
    const name = (segs.shift() ?? '').toUpperCase();
    const params: Record<string, string> = {};
    for (const s of segs) {
      const eq = s.indexOf('=');
      if (eq > 0) params[s.slice(0, eq).toUpperCase()] = s.slice(eq + 1).replace(/^"|"$/g, '');
    }
    out.push({ name, params, value });
  }
  return out;
}

function parseDT(value: string, params: Record<string, string>): DT | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (fromDays(toDays(date)) !== date) return null;
  if (!m[4] || params.VALUE === 'DATE') return { date, time: null, utc: false, tz: null };
  return { date, time: `${m[4]}:${m[5]}:${m[6] ?? '00'}`, utc: Boolean(m[7]), tz: m[7] ? null : normalizeZone(params.TZID) };
}

const listDT = (p: Prop) => p.value.split(',').map((v) => parseDT(v, p.params)).filter((d): d is DT => d !== null);

/** ISO 8601 duration → { days, ms } (weeks and days nominal; hours, minutes, seconds exact). */
function parseDuration(s: string): { days: number; ms: number } | null {
  const m = s.trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return { days: sign * ((+(m[2] ?? 0)) * 7 + +(m[3] ?? 0)), ms: sign * ((+(m[4] ?? 0)) * 3600 + (+(m[5] ?? 0)) * 60 + +(m[6] ?? 0)) * 1000 };
}

function events(ps: Prop[]): { name: string | null; zone: string | null; list: VEvent[]; calendar: boolean } {
  let name: string | null = null;
  let zone: string | null = null;
  let calendar = false;
  const list: VEvent[] = [];
  const stack: string[] = [];
  let cur: Partial<VEvent> & { exdates: DT[]; rdates: DT[] } | null = null;
  for (const p of ps) {
    if (p.name === 'BEGIN') {
      const c = p.value.trim().toUpperCase();
      stack.push(c);
      if (c === 'VCALENDAR') calendar = true;
      if (c === 'VEVENT' && stack.length === 2) cur = { exdates: [], rdates: [], sequence: 0 };
      continue;
    }
    if (p.name === 'END') {
      const c = stack.pop();
      if (c === 'VEVENT' && cur) {
        if (cur.uid && cur.start) list.push(cur as VEvent);
        cur = null;
      }
      continue;
    }
    const where = stack[stack.length - 1];
    if (where === 'VCALENDAR') {
      if (p.name === 'X-WR-CALNAME') name = clip(unescape(p.value), 120);
      if (p.name === 'X-WR-TIMEZONE') zone = normalizeZone(p.value);
      continue;
    }
    if (where !== 'VEVENT' || !cur) continue; // VALARM, VTIMEZONE … are not ours
    switch (p.name) {
      case 'UID': cur.uid = clip(p.value, 500) ?? undefined; break;
      case 'SUMMARY': cur.summary = unescape(p.value); break;
      case 'LOCATION': cur.location = unescape(p.value); break;
      case 'DESCRIPTION': cur.description = unescape(p.value); break;
      case 'URL': cur.url = p.value.trim(); break;
      case 'STATUS': cur.status = p.value.trim().toUpperCase(); break;
      case 'CLASS': cur.klass = p.value.trim().toUpperCase(); break;
      case 'SEQUENCE': cur.sequence = parseInt(p.value, 10) || 0; break;
      case 'DTSTART': cur.start = parseDT(p.value, p.params) ?? undefined; break;
      case 'DTEND': cur.end = parseDT(p.value, p.params); break;
      case 'DURATION': cur.duration = p.value; break;
      case 'RRULE': cur.rrule = p.value; break;
      case 'EXDATE': cur.exdates.push(...listDT(p)); break;
      case 'RDATE': if (p.params.VALUE !== 'PERIOD') cur.rdates.push(...listDT(p)); break;
      case 'RECURRENCE-ID': cur.recurrenceId = parseDT(p.value, p.params); break;
    }
  }
  return { name, zone, list, calendar };
}

export interface ExpandOptions {
  /** Window, instants (ms). */
  from: number;
  to: number;
  /** The family's zone: floating times and the window's dates for all-day events. */
  familyZone: string;
}

/** Parse a feed and list every occurrence that touches the window. */
export function expandFeed(text: string, o: ExpandOptions): FeedResult {
  const parsed = events(props(text));
  const zoneOf = (d: DT) => (d.utc ? 'UTC' : d.tz ?? parsed.zone ?? o.familyZone);
  const instant = (d: DT) => zonedToInstant(d.date, d.time ?? '00:00:00', zoneOf(d));
  // Occurrence identity: the instant for timed events, the date for all-day ones (how RECURRENCE-ID names them).
  const keyOf = (d: DT) => (d.time ? new Date(instant(d)).toISOString() : d.date);
  const fromDate = instantToZoned(o.from, o.familyZone).date;
  const toDate = instantToZoned(o.to, o.familyZone).date;

  // Masters and moved/cancelled single occurrences, by UID. Same UID twice: the later SEQUENCE replaces the earlier.
  const masters = new Map<string, VEvent[]>();
  const overrides = new Map<string, Map<string, VEvent>>();
  for (const e of parsed.list) {
    if (e.recurrenceId) {
      const m = overrides.get(e.uid) ?? new Map<string, VEvent>();
      const k = keyOf(e.recurrenceId);
      const prev = m.get(k);
      if (!prev || e.sequence >= prev.sequence) m.set(k, e);
      overrides.set(e.uid, m);
    } else {
      const list = masters.get(e.uid) ?? [];
      const same = list.findIndex((x) => keyOf(x.start) === keyOf(e.start) || (x.rrule && e.rrule));
      if (same >= 0) { if (e.sequence >= list[same].sequence) list[same] = e; } else list.push(e);
      masters.set(e.uid, list);
    }
  }

  const out = new Map<string, ImportedInstance>();
  const emit = (e: VEvent, master: VEvent, start: DT, instanceKey: string, recurring: boolean) => {
    if (e.status === 'CANCELLED') return;
    const allDay = !start.time;
    let inst: ImportedInstance;
    const base = {
      instance_key: instanceKey.slice(0, 600), uid: master.uid,
      title: clip(e.summary, LIMITS.title) ?? '(No title)', location: clip(e.location, LIMITS.location), notes: clip(e.description, LIMITS.notes),
      url: safeLink(e.url), recurring, private: e.klass === 'PRIVATE' || e.klass === 'CONFIDENTIAL',
    };
    if (allDay) {
      // Length from this occurrence's own DTEND/DURATION, else the series'; DTEND is the day after the last day.
      const src = e.end || e.duration ? e : master;
      const span = src.end && !src.end.time ? toDays(src.end.date) - toDays(src.start.date)
        : src.duration ? Math.max(parseDuration(src.duration)?.days ?? 1, 1) : 1;
      const end = addDays(start.date, Math.max(span, 1) - 1);
      if (end < fromDate || start.date > toDate) return;
      inst = { ...base, all_day: true, start_date: start.date, end_date: end, starts_at: null, ends_at: null, timezone: null };
    } else {
      const s = instant(start);
      const src = e.end || e.duration ? e : master;
      let len = 0;
      if (src.end) len = (src.end.time ? instant(src.end) : instant({ ...src.end, time: '00:00:00', tz: src.start.tz, utc: src.start.utc })) - instant(src.start);
      else if (src.duration) { const d = parseDuration(src.duration); len = d ? d.days * 86_400_000 + d.ms : 0; }
      const end = s + Math.max(len, 0);
      if (end < o.from || s > o.to) return;
      inst = { ...base, all_day: false, start_date: null, end_date: null, starts_at: new Date(s).toISOString(), ends_at: len > 0 ? new Date(end).toISOString() : null, timezone: zoneOf(start) === 'UTC' ? null : zoneOf(start) };
    }
    out.set(inst.instance_key, inst);
  };

  for (const [uid, list] of masters) {
    const several = list.length > 1;
    for (const m of list) {
      if (m.status === 'CANCELLED') continue;
      const ov = overrides.get(uid);
      if (!m.rrule && !m.rdates.length) {
        emit(m, m, m.start, several ? `${uid}|${keyOf(m.start)}` : uid, false);
        continue;
      }
      const rule = parseRule(m.rrule ?? 'FREQ=UNSUPPORTED');
      // UNTIL: a date, or a UTC instant (or, from sloppy feeds, a local time in the start's zone).
      let beyond = (_d: string) => false;
      if (rule.until) {
        const u = parseDT(rule.until, {});
        if (u && !m.start.time) beyond = (d) => d > u.date;
        else if (u) {
          const limit = u.time ? zonedToInstant(u.date, u.time, u.utc ? 'UTC' : zoneOf(m.start)) : zonedToInstant(u.date, '23:59:59', zoneOf(m.start));
          beyond = (d) => instant({ ...m.start, date: d }) > limit;
        }
      }
      // Generate through the window's last date (+1 day for zones ahead of the family's).
      const dates = m.rrule ? expandDates(rule, m.start.date, addDays(toDate, 1), beyond) : [m.start.date];
      const starts = new Map<string, DT>();
      for (const d of dates) { const s = { ...m.start, date: d }; starts.set(keyOf(s), s); }
      for (const r of m.rdates) { const s = r.time ? r : { ...m.start, date: r.date }; starts.set(keyOf(s), s); }
      for (const x of m.exdates) {
        starts.delete(keyOf(x));
        if (!x.time) for (const [k, s] of starts) if (s.date === x.date) starts.delete(k); // EXDATE;VALUE=DATE on timed series
      }
      for (const [k, s] of starts) {
        const moved = ov?.get(k);
        if (moved) { ov!.delete(k); emit(moved, m, moved.start, `${uid}|${k}`, true); }
        else emit(m, m, s, `${uid}|${k}`, true);
      }
      if (ov) for (const [k, moved] of ov) if (!starts.has(k) && !m.exdates.some((x) => keyOf(x) === k)) emit(moved, m, moved.start, `${uid}|${k}`, true);
      overrides.delete(uid);
    }
  }
  // Moved occurrences whose series isn't in the feed (some feeds publish only the exceptions in a window).
  for (const [uid, ov] of overrides) for (const [k, e] of ov) emit(e, e, e.start, `${uid}|${k}`, true);

  const sorted = [...out.values()].sort((a, b) => (a.starts_at ?? `${a.start_date}T00`).localeCompare(b.starts_at ?? `${b.start_date}T00`));
  return { name: parsed.name, zone: parsed.zone, events: sorted.slice(0, LIMITS.perCalendar), notCalendar: !parsed.calendar };
}
