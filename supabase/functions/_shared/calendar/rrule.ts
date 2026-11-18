/**
 * RFC 5545 repeat rules, expanded on wall-clock dates (docs/ios/CALENDAR_INTEGRATION.md). Covers what school, sports
 * and family calendars use: DAILY / WEEKLY / MONTHLY / YEARLY, INTERVAL, COUNT, UNTIL, BYDAY (with ordinals like 2MO
 * and -1FR), BYMONTHDAY (negative from the month's end), BYMONTH, BYSETPOS, WKST. Sub-daily rules (HOURLY…) and
 * BYWEEKNO / BYYEARDAY are rare in family calendars: the first occurrence is kept and the rest are not invented.
 */
import { addDays, daysInMonth, weekday, ymd } from './dates.ts';

export interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'UNSUPPORTED';
  interval: number;
  count: number | null;
  /** Raw UNTIL value ('20270612' or '20270612T045959Z'); the caller compares it in the right zone. */
  until: string | null;
  byDay: { ord: number; wd: number }[];
  byMonthDay: number[];
  byMonth: number[];
  bySetPos: number[];
  wkst: number;
}

const WD: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export function parseRule(text: string): Rule {
  const r: Rule = { freq: 'UNSUPPORTED', interval: 1, count: null, until: null, byDay: [], byMonthDay: [], byMonth: [], bySetPos: [], wkst: 1 };
  const ints = (v: string, lo: number, hi: number) => v.split(',').map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n) && n !== 0 && Math.abs(n) >= lo && Math.abs(n) <= hi);
  for (const part of text.replace(/^RRULE:/i, '').split(';')) {
    const [k, v = ''] = part.split('=');
    switch (k.trim().toUpperCase()) {
      case 'FREQ': {
        const f = v.trim().toUpperCase();
        r.freq = f === 'DAILY' || f === 'WEEKLY' || f === 'MONTHLY' || f === 'YEARLY' ? f : 'UNSUPPORTED';
        break;
      }
      case 'INTERVAL': r.interval = Math.min(Math.max(parseInt(v, 10) || 1, 1), 1000); break;
      case 'COUNT': r.count = Math.max(parseInt(v, 10) || 0, 0) || null; break;
      case 'UNTIL': r.until = v.trim() || null; break;
      case 'BYDAY':
        r.byDay = v.toUpperCase().split(',').map((x) => x.trim().match(/^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/)).filter(Boolean)
          .map((m) => ({ ord: m![1] ? parseInt(m![1], 10) : 0, wd: WD[m![2]] }));
        break;
      case 'BYMONTHDAY': r.byMonthDay = ints(v, 1, 31); break;
      case 'BYMONTH': r.byMonth = ints(v, 1, 12).filter((n) => n > 0); break;
      case 'BYSETPOS': r.bySetPos = ints(v, 1, 366); break;
      case 'WKST': r.wkst = WD[v.trim().toUpperCase()] ?? 1; break;
      case 'BYHOUR': case 'BYMINUTE': case 'BYSECOND': case 'BYWEEKNO': case 'BYYEARDAY':
        r.freq = 'UNSUPPORTED'; // would make more occurrences than we can show faithfully: keep only the first
        break;
    }
  }
  return r;
}

/** Days of month m0 of year y with weekday wd; the ord-th one (negative from the end), or all of them. */
function weekdaysInMonth(y: number, m0: number, wd: number, ord: number): string[] {
  const dim = daysInMonth(y, m0);
  const first = weekday(ymd(y, m0, 1));
  const all: string[] = [];
  for (let d = 1 + ((wd - first + 7) % 7); d <= dim; d += 7) all.push(ymd(y, m0, d));
  if (!ord) return all;
  const pick = ord > 0 ? all[ord - 1] : all[all.length + ord];
  return pick ? [pick] : [];
}

function monthCandidates(r: Rule, y: number, m0: number, startDay: number): string[] {
  const dim = daysInMonth(y, m0);
  const mdays = r.byMonthDay.length ? r.byMonthDay.map((d) => (d > 0 ? d : dim + 1 + d)).filter((d) => d >= 1 && d <= dim).map((d) => ymd(y, m0, d)) : null;
  const wdays = r.byDay.length ? r.byDay.flatMap((b) => weekdaysInMonth(y, m0, b.wd, b.ord)) : null;
  if (mdays && wdays) return mdays.filter((d) => wdays.includes(d));
  if (mdays) return mdays;
  if (wdays) return wdays;
  return startDay <= dim ? [ymd(y, m0, startDay)] : []; // the 31st skips short months (RFC 5545)
}

function yearCandidates(r: Rule, y: number, startM0: number, startDay: number): string[] {
  if (r.byDay.length && !r.byMonth.length && !r.byMonthDay.length) {
    // "the 20th Monday of the year" style: ordinals count across the year.
    return r.byDay.flatMap((b) => {
      const all: string[] = [];
      for (let m = 0; m < 12; m++) all.push(...weekdaysInMonth(y, m, b.wd, 0));
      if (!b.ord) return all;
      const pick = b.ord > 0 ? all[b.ord - 1] : all[all.length + b.ord];
      return pick ? [pick] : [];
    });
  }
  const months = r.byMonth.length ? r.byMonth.map((m) => m - 1) : [startM0];
  return months.flatMap((m0) => (r.byDay.length || r.byMonthDay.length ? monthCandidates(r, y, m0, startDay) : startDay <= daysInMonth(y, m0) ? [ymd(y, m0, startDay)] : []));
}

/**
 * Dates the rule makes, starting with `start` itself (always the first occurrence), up to `last` (inclusive), stopping
 * at COUNT and wherever `beyondUntil(date)` says the date is past UNTIL. `cap` bounds the work on hostile feeds.
 */
export function expandDates(r: Rule, start: string, last: string, beyondUntil: (date: string) => boolean, cap = 20_000): string[] {
  const out: string[] = [start];
  if (r.freq === 'UNSUPPORTED' || start > last) return start > last ? [] : out;
  let count = 1;
  if (r.count !== null && count >= r.count) return out;
  const n = r.interval;
  const [y0, m00, d0] = [+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10)];
  const filter = (d: string) =>
    (!r.byMonth.length || r.byMonth.includes(+d.slice(5, 7))) &&
    (r.freq !== 'DAILY' || !r.byDay.length || r.byDay.some((b) => b.wd === weekday(d))) &&
    (r.freq !== 'DAILY' || !r.byMonthDay.length || r.byMonthDay.some((md) => {
      const dim = daysInMonth(+d.slice(0, 4), +d.slice(5, 7) - 1);
      return (md > 0 ? md : dim + 1 + md) === +d.slice(8, 10);
    }));
  const weekBase = addDays(start, -((weekday(start) - r.wkst + 7) % 7));
  for (let p = 0, guard = 0; guard < cap; p += n, guard++) {
    let periodStart: string;
    let cands: string[];
    switch (r.freq) {
      case 'DAILY':
        periodStart = addDays(start, p);
        cands = [periodStart];
        break;
      case 'WEEKLY': {
        periodStart = addDays(weekBase, 7 * p);
        const days = r.byDay.length ? [...new Set(r.byDay.map((b) => b.wd))] : [weekday(start)];
        cands = days.map((wd) => addDays(periodStart, (wd - r.wkst + 7) % 7));
        break;
      }
      case 'MONTHLY': {
        const mi = m00 + p;
        const [y, m0] = [y0 + Math.floor(mi / 12), mi % 12];
        periodStart = ymd(y, m0, 1);
        cands = monthCandidates(r, y, m0, d0);
        break;
      }
      case 'YEARLY':
        periodStart = ymd(y0 + p, 0, 1);
        cands = yearCandidates(r, y0 + p, m00, d0);
        break;
    }
    if (periodStart! > last) break;
    cands = [...new Set(cands!.filter(filter))].sort();
    if (r.bySetPos.length) {
      const all = cands;
      cands = [...new Set(r.bySetPos.map((i) => (i > 0 ? all[i - 1] : all[all.length + i])).filter(Boolean))].sort();
    }
    for (const d of cands) {
      if (d <= start) continue;
      if (d > last || beyondUntil(d)) return out;
      out.push(d);
      count++;
      if (r.count !== null && count >= r.count) return out;
    }
  }
  return out;
}

