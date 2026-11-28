/**
 * Recurrence-aware pattern detection (docs/intelligence/STAGE_B_REPORT.md → Recurrence-aware memory).
 *
 * Given the local days on which something happened, decide whether it recurs and how: daily, weekly (on a weekday),
 * every two weeks, monthly (a day of the month or an nth weekday), seasonal (roughly quarterly, or the same season
 * across years) or annual (the same date across years). Deterministic statistics only; no model. Each cadence has
 * its own minimum evidence and its own review window, so a weekly habit is reconsidered after a month without it,
 * while a birthday is only reconsidered after more than a year.
 */
export type Cadence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'seasonal' | 'annual' | 'irregular';

export interface CadenceResult {
  cadence: Cadence;
  /** weekly / biweekly: weekday 0–6 · monthly: day of month 1–31 or `n:dow` (2nd Tuesday = '2:2') · annual: 'MM-DD' · seasonal: 'Q1'…'Q4' */
  anchor: string | null;
  /** Share of consecutive intervals that match the cadence (0–1). */
  regularity: number;
  /** Distinct days observed. */
  support: number;
  /** Distinct cycles observed (weeks for weekly, months for monthly, years for annual). */
  cycles: number;
  first: string;
  last: string;
  /** The next day it would happen if the pattern holds (null for irregular). */
  next: string | null;
}

const DAY = 86_400_000;
const t = (d: string) => Date.parse(`${d}T12:00:00Z`);
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dow = (d: string) => new Date(t(d)).getUTCDay();
const dom = (d: string) => Number(d.slice(8, 10));
const md = (d: string) => d.slice(5, 10);
const nthDow = (d: string) => `${Math.ceil(dom(d) / 7)}:${dow(d)}`;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const mode = <T,>(xs: T[]): [T | null, number] => {
  const m = new Map<T, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  let best: T | null = null, n = 0; for (const [k, v] of m) if (v > n) { best = k; n = v; }
  return [best, n];
};
const weekOf = (d: string) => Math.floor((t(d) - t('2000-01-03')) / (7 * DAY)); // Monday-based week number
const monthOf = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7));
const quarter = (d: string) => `Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;

/** Minimum distinct days and cycles before a pattern is believed at all. (Seasonal needs three: two sightings a quarter apart
 * are as likely a coincidence as a season.) */
export const MIN_EVIDENCE: Record<Cadence, { support: number; cycles: number }> = {
  daily: { support: 7, cycles: 7 }, weekly: { support: 3, cycles: 3 }, biweekly: { support: 3, cycles: 3 }, monthly: { support: 3, cycles: 3 },
  seasonal: { support: 3, cycles: 3 }, annual: { support: 2, cycles: 2 }, irregular: { support: Infinity, cycles: Infinity },
};

/** How long a pattern may go unseen before it's reconsidered (days). About three to four missed cycles, never fewer than ten days. */
export const REVIEW_DAYS: Record<Cadence, number> = { daily: 10, weekly: 28, biweekly: 42, monthly: 100, seasonal: 200, annual: 400, irregular: 60 };

/** The cadence's period in days (for "the next one" and tolerance). */
const PERIOD: Record<Exclude<Cadence, 'irregular'>, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30.44, seasonal: 91.3, annual: 365.25 };

export function detectCadence(daysIn: string[]): CadenceResult {
  const days = [...new Set(daysIn)].sort();
  const base = { support: days.length, first: days[0] ?? '', last: days[days.length - 1] ?? '' };
  const irregular: CadenceResult = { cadence: 'irregular', anchor: null, regularity: 0, cycles: 0, next: null, ...base };
  if (days.length < 2) return irregular;
  const gaps = days.slice(1).map((d, i) => Math.round((t(d) - t(days[i])) / DAY));
  const m = median(gaps);
  const share = (ok: (g: number) => boolean) => gaps.filter(ok).length / gaps.length;
  const results: CadenceResult[] = [];

  // daily: nearly every day (weekend skips allowed)
  if (m <= 1.5) {
    const reg = share((g) => g <= 3);
    results.push({ cadence: 'daily', anchor: null, regularity: reg, cycles: days.length, next: fmt(t(base.last) + DAY), ...base });
  }
  // weekly / biweekly on a weekday. Judged by the gaps between days on that weekday, as multiples of a week, so missed
  // weeks don't hide a weekly habit: gaps of 7, 14 and 21 days are a weekly activity attended unevenly; gaps of only
  // 14 or 28 are every other week. (Gaps of exactly three weeks and nothing shorter are neither.)
  const [topDow, nTop] = mode(days.map(dow));
  const onDay = days.filter((x) => dow(x) === topDow);
  const g2 = onDay.slice(1).map((x, i) => Math.round((t(x) - t(onDay[i])) / DAY));
  if (g2.length >= 2) {
    const dowShare = nTop / days.length;
    const of = (ok: (g: number) => boolean) => g2.filter(ok).length / g2.length;
    const near = (g: number, k: number) => Math.abs(g - k) <= 1;
    const mult7 = of((g) => g >= 6 && near(g, Math.round(g / 7) * 7));
    const s7 = of((g) => near(g, 7));
    const odd = of((g) => g >= 6 && near(g, Math.round(g / 7) * 7) && Math.round(g / 7) % 2 === 1);
    const weekly = mult7 >= 0.6 && s7 >= 0.2;
    const biweekly = !weekly && mult7 >= 0.6 && odd <= 0.1 && of((g) => near(g, 14) || near(g, 28)) >= 0.6;
    for (const [c, p, ok] of [['weekly', 7, weekly], ['biweekly', 14, biweekly]] as const) {
      if (!ok) continue;
      const reg = Math.min(dowShare, c === 'weekly' ? mult7 : of((g) => near(g, Math.round(g / 14) * 14) && g >= 13));
      const cycles = new Set(days.map((x) => Math.floor(weekOf(x) / (p / 7)))).size;
      let next = t(base.last) + p * DAY;
      while (new Date(next).getUTCDay() !== topDow) next += DAY;
      results.push({ cadence: c, anchor: String(topDow), regularity: reg, cycles, next: fmt(next), ...base });
    }
  }
  // monthly: a day of the month, or an nth weekday. Gaps are judged as multiples of a month (missed months allowed).
  const monthMult = (g: number) => { const k = Math.round(g / PERIOD.monthly); return k >= 1 && k <= 3 && Math.abs(g - k * PERIOD.monthly) <= 5 + k; };
  const oneMonth = share((g) => Math.round(g / PERIOD.monthly) === 1 && monthMult(g));
  if ((m >= 24 && m <= 38) || (share(monthMult) >= 0.75 && oneMonth >= 0.25)) {
    const [byDom, nDom] = mode(days.map(dom));
    const [byNth, nNth] = mode(days.map(nthDow));
    // Anchor on a day of the month (±2 days) unless an nth weekday explains at least as many of the days.
    const domCenter = [...Array(31).keys()].map((k) => k + 1).sort((x, y) => days.filter((d) => Math.abs(dom(d) - y) <= 2).length - days.filter((d) => Math.abs(dom(d) - x) <= 2).length || Math.abs(x - Number(byDom)) - Math.abs(y - Number(byDom)))[0];
    const domClose = days.filter((x) => Math.abs(dom(x) - domCenter) <= 2).length / days.length;
    const useNth = nNth / days.length >= domClose; // on a tie the weekday is the more specific explanation
    const anchor = useNth ? byNth! : String(nDom / days.length >= domClose ? byDom : domCenter);
    const anchorShare = useNth ? nNth / days.length : domClose;
    const reg = Math.min(anchorShare, share(monthMult));
    const cycles = new Set(days.map(monthOf)).size;
    results.push({ cadence: 'monthly', anchor, regularity: reg, cycles, next: fmt(t(base.last) + PERIOD.monthly * DAY), ...base });
  }
  // seasonal: about every three months, or the same season in different years
  if (m >= 70 && m <= 120) {
    const reg = share((g) => g >= 70 && g <= 120);
    results.push({ cadence: 'seasonal', anchor: mode(days.map(quarter))[0], regularity: reg, cycles: days.length, next: fmt(t(base.last) + PERIOD.seasonal * DAY), ...base });
  }
  // annual: the same date (±7 days) in different years
  if (m >= 330) {
    const [a] = mode(days.map(md));
    const close = days.filter((x) => Math.abs(t(`2001-${md(x)}`) - t(`2001-${a}`)) <= 7 * DAY).length / days.length;
    const reg = Math.min(close, share((g) => g >= 350 && g <= 380));
    const cycles = new Set(days.map((x) => x.slice(0, 4))).size;
    results.push({ cadence: 'annual', anchor: a, regularity: reg, cycles, next: `${Number(base.last.slice(0, 4)) + 1}-${a}`, ...base });
  }
  const best = results.sort((a, b) => b.regularity - a.regularity)[0];
  if (!best || best.regularity < 0.6) return { ...irregular, regularity: best?.regularity ?? 0 };
  return best;
}

/** Enough evidence for this cadence to be believed? */
export const meetsEvidence = (r: Pick<CadenceResult, 'cadence' | 'support' | 'cycles'>) =>
  r.cadence !== 'irregular' && r.support >= MIN_EVIDENCE[r.cadence].support && r.cycles >= MIN_EVIDENCE[r.cadence].cycles;

/** Does a new day fit the pattern's anchor (used to count contradicting evidence)? */
export function fitsAnchor(r: Pick<CadenceResult, 'cadence' | 'anchor'>, day: string): boolean {
  switch (r.cadence) {
    case 'daily': return true;
    case 'weekly': case 'biweekly': return String(dow(day)) === r.anchor;
    case 'monthly': return r.anchor?.includes(':') ? nthDow(day) === r.anchor : Math.abs(dom(day) - Number(r.anchor)) <= 2;
    case 'seasonal': return quarter(day) === r.anchor;
    case 'annual': return Math.abs(t(`2001-${md(day)}`) - t(`2001-${r.anchor}`)) <= 7 * DAY;
    default: return false;
  }
}

export const addDays = (d: string, n: number) => fmt(t(d) + n * DAY);
export const daysBetween = (a: string, b: string) => Math.round((t(b) - t(a)) / DAY);
