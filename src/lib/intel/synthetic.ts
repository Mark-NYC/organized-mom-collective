/**
 * Synthetic households for evaluating the engine (docs/intelligence/STAGE_B_REPORT.md → Synthetic evaluation).
 *
 * 50 made-up families, seeded from the eight sample households (src/data/club/samples.ts) and the scripted V18–V21
 * scenarios: single- and two-parent homes (and one multigenerational), children from toddlers to teens, engaged and
 * sporadic families, 6–12 months of behavior each. Every household gets a handful of SCRIPTED scenarios (a routine
 * that moves, a season that ends, a vacation, a chore the family agreed one way and does another, a confirmed
 * agreement that behavior contradicts, a forgotten memory, consent withdrawal, a private calendar…) plus random noise
 * at the family's engagement level. Each scenario states what the engine SHOULD believe at the end (`expect`), so the
 * evaluation measures the engine against ground truth instead of against itself.
 *
 * Deterministic: the same seed gives the same 50 households, so tests and the Lab agree. No real data, ever.
 */
import { sampleHouseholds } from '../../data/club/samples';
import { REVIEW_DAYS, addDays, daysBetween } from './cadence';
import type { MemoryStatus } from './memory';
import type { Signal, SignalKind, SubjectKind } from './signals';

/** Small, fast, seedable PRNG (sfc32, seeded through splitmix32 so nearby seeds give unrelated streams). */
export function rng(seed: number) {
  let sm = seed >>> 0;
  const split = () => { sm = (sm + 0x9e3779b9) >>> 0; let z = sm; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); return (z ^ (z >>> 16)) >>> 0; };
  let a = split(), b = split(), c = split(), d = split();
  const next = () => {
    const t = (((a + b) >>> 0) + d) >>> 0; d = (d + 1) >>> 0;
    a = b ^ (b >>> 9); b = (c + (c << 3)) >>> 0; c = ((c << 21) | (c >>> 11)) >>> 0; c = (c + t) >>> 0;
    return t / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return { next, int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)), pick: <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)], chance: (p: number) => next() < p };
}
type Rng = ReturnType<typeof rng>;

export type Engagement = 'high' | 'medium' | 'low';
export type ScenarioKind = 'stable-weekly' | 'routine-moves' | 'season-ends' | 'vacation-gap' | 'daily-task' | 'monthly-nth' | 'monthly-dom'
  | 'annual-birthday' | 'biweekly-custody' | 'owner-differs' | 'load-imbalance' | 'confirmed-contradicted' | 'forgotten-stays-forgotten'
  | 'private-calendar' | 'learning-off' | 'dismissals' | 'preference-shift' | 'noise-only';

/** What the engine should believe about one subject once the whole history has been seen. */
export interface Expectation {
  /** Memory identity parts. */
  category: string;
  subject_key: string;
  visible_to?: string | null;
  member_id?: string | null;
  /** Allowed final statuses; `absent` means there must be no such memory (or only retired/forgotten). */
  status: (MemoryStatus | 'absent')[];
  cadence?: string;
  anchor?: string;
  previous_anchor?: string;
  /** Content fields that must match. */
  content?: Record<string, unknown>;
  why: string;
  /** Set when the realized history changed what the script intended (reported, so nothing is hidden). */
  adjusted?: boolean;
}

/** Something the family does in the Lab timeline besides generating signals (confirm, forget, change settings). */
export type FamilyAction =
  | { day: string; type: 'confirm'; category: string; subject_key: string; content: Record<string, unknown>; cadence?: string }
  | { day: string; type: 'forget'; category: string; subject_key: string; visible_to?: string | null }
  | { day: string; type: 'learning'; enabled: boolean }
  | { day: string; type: 'personal-calendars'; user: string; enabled: boolean };

export interface Scenario { kind: ScenarioKind; note: string; expect: Expectation[] }

export interface SyntheticHousehold {
  id: string;
  seededFrom: string;
  shape: 'single-parent' | 'two-parent' | 'multigenerational';
  adults: { id: string; user: string | null }[];
  children: { id: string; age: number }[];
  engagement: Engagement;
  start: string;
  end: string;
  months: number;
  scenarios: Scenario[];
  actions: FamilyAction[];
  agreements: Record<string, string[]>;
  signals: Signal[];
}

const DAY_OF = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
const ENGAGE: Record<Engagement, number> = { high: 0.95, medium: 0.85, low: 0.7 };
const END = '2026-11-27';

/** The shape of the eight samples, reused as starting points (ids and ages, never their names). */
function seeds() {
  return sampleHouseholds.filter((s) => s.household.members.length).map((s) => {
    const members = s.household.members;
    const adults = members.filter((m) => m.kind === 'adult').map((m) => m.id.replace(/^sample-[a-z]+-/, ''));
    const kids = members.filter((m) => m.kind === 'child').map((m) => ({ id: m.id.replace(/^sample-[a-z]+-/, ''), age: 2026 - Number((m as { birthYear?: number }).birthYear ?? 2018) }));
    return { from: s.id, adults, kids };
  });
}

export function generateHouseholds(n = 50, seed = 20261216): SyntheticHousehold[] {
  const r = rng(seed);
  const base = seeds();
  const out: SyntheticHousehold[] = [];
  for (let i = 0; i < n; i++) {
    const s = base[i % base.length];
    // Vary the family: the seed's shape, then flipped to single/two-parent, children added/removed, ages shifted.
    let shape: SyntheticHousehold['shape'] = s.adults.length >= 3 ? 'multigenerational' : s.adults.length === 2 ? 'two-parent' : 'single-parent';
    if (i >= base.length && shape !== 'multigenerational' && r.chance(0.35)) shape = shape === 'two-parent' ? 'single-parent' : 'two-parent';
    const adultCount = shape === 'multigenerational' ? 3 : shape === 'two-parent' ? 2 : 1;
    const adults = Array.from({ length: adultCount }, (_, k) => ({ id: `m-a${k + 1}`, user: k === 2 ? null : `u-${i}-${k + 1}` }));
    const kidCount = Math.max(1, Math.min(5, (s.kids.length || 1) + (i >= base.length ? r.int(-1, 1) : 0)));
    const children = Array.from({ length: kidCount }, (_, k) => ({ id: `m-c${k + 1}`, age: Math.max(1, Math.min(17, (s.kids[k]?.age ?? r.int(2, 15)) + (i >= base.length ? r.int(-2, 2) : 0))) }));
    const engagement: Engagement = r.pick(['high', 'high', 'medium', 'medium', 'low'] as const);
    const months = r.int(6, 12);
    const start = addDays(END, -Math.round(months * 30.44));
    out.push(build(`syn-${String(i + 1).padStart(2, '0')}`, s.from, shape, adults, children, engagement, start, months, r, i));
  }
  return out;
}

function build(id: string, from: string, shape: SyntheticHousehold['shape'], adults: SyntheticHousehold['adults'], children: SyntheticHousehold['children'],
  engagement: Engagement, start: string, months: number, r: Rng, i: number): SyntheticHousehold {
  const signals: Signal[] = [];
  const scenarios: Scenario[] = [];
  const actions: FamilyAction[] = [];
  const agreements: Record<string, string[]> = {};
  const p = ENGAGE[engagement];
  const mom = adults[0];
  let n = 0;
  const push = (day: string, kind: SignalKind, sk: SubjectKind | null, ref: string | null, extra: Partial<Signal> = {}) => {
    if ((day < start && !extra.synthetic) || day > END) return;
    const hour = extra.local_hour ?? r.int(7, 21);
    signals.push({ id: ++n, household_id: id, user_id: mom.user, member_id: null, kind, subject_kind: sk, subject_ref: ref, value: null, visible_to: null,
      at: `${day}T${String(hour).padStart(2, '0')}:${String(r.int(0, 59)).padStart(2, '0')}:00Z`, local_day: day, local_hour: hour, local_dow: DAY_OF(day), synthetic: true, ...extra });
  };
  const days = (from0: string, to: string) => { const xs: string[] = []; for (let d = from0; d <= to; d = addDays(d, 1)) xs.push(d); return xs; };
  const all = days(start, END);
  const onDow = (dow: number, a = start, b = END) => days(a, b).filter((d) => DAY_OF(d) === dow);
  const mid = addDays(start, Math.floor(daysBetween(start, END) / 2));
  const kidOf = () => r.pick(children).id;

  // Every household: background app opens (timing), and random one-off noise that must NOT become patterns.
  for (const a of adults.filter((x) => x.user)) {
    const band = r.int(6, 20);
    for (const d of all.slice(-28)) if (r.chance(p * 0.8)) push(d, 'app_open', null, null, { user_id: a.user, local_hour: (band + (r.chance(0.85) ? r.int(0, 1) : r.int(3, 8))) % 24 });
  }
  for (const d of all) if (r.chance(0.04)) push(d, 'plan_added', null, null);
  for (let k = 0; k < r.int(4, 9); k++) push(r.pick(all), 'event_occurred', 'event', `oneoff-${k}`);

  // Scripted scenarios: a common core plus a rotating set, so all 18 kinds are covered many times across the 50.
  const rotating: ScenarioKind[] = ['routine-moves', 'season-ends', 'vacation-gap', 'monthly-nth', 'monthly-dom', 'annual-birthday', 'biweekly-custody',
    'owner-differs', 'load-imbalance', 'confirmed-contradicted', 'forgotten-stays-forgotten', 'private-calendar', 'dismissals', 'preference-shift'];
  const chosen = new Set<ScenarioKind>(['stable-weekly', 'daily-task', 'noise-only']);
  // Every tenth household turns learning off part-way. Its memory must freeze there, so it carries no scenario whose
  // evidence lands later (that evidence is, correctly, never recorded).
  if (i % 10 === 9) { chosen.add('learning-off'); chosen.add('confirmed-contradicted'); }
  else for (let k = 0; k < 5; k++) chosen.add(rotating[(i * 5 + k) % rotating.length]);
  if (shape === 'single-parent') { chosen.delete('load-imbalance'); if (i % 3 === 0 && i % 10 !== 9) chosen.add('biweekly-custody'); }
  
  for (const kind of chosen) {
    switch (kind) {
      case 'stable-weekly': {
        const dow = r.int(1, 5);
        for (const d of onDow(dow)) if (r.chance(p)) push(d, 'event_occurred', 'series', 'activity-a', { member_id: kidOf() });
        scenarios.push({ kind, note: `a weekly activity every ${dow} (weekday number), missed at the family's engagement rate`, expect: [
          { category: 'occasion', subject_key: 'event-occurred:series:activity-a', status: ['observed'], cadence: 'weekly', anchor: String(dow), why: 'a stable weekly series is learned' }] });
        break;
      }
      case 'routine-moves': {
        const a = r.int(1, 3), b = a + 2;
        const change = addDays(END, -r.int(35, 56));
        for (const d of onDow(a, start, change)) if (r.chance(p)) push(d, 'event_occurred', 'series', 'activity-m');
        for (const d of onDow(b, addDays(change, 1))) if (r.chance(Math.max(p, 0.9))) push(d, 'event_occurred', 'series', 'activity-m');
        scenarios.push({ kind, note: `practice moved from weekday ${a} to ${b} about ${daysBetween(change, END)} days ago`, expect: [
          { category: 'occasion', subject_key: 'event-occurred:series:activity-m', status: ['observed', 'tentative'], cadence: 'weekly', anchor: String(b), why: 'the new day wins once it is consistent' }] });
        break;
      }
      case 'season-ends': {
        const dow = r.int(1, 5), stop = addDays(END, -r.int(45, 80));
        for (const d of onDow(dow, start, stop)) if (r.chance(p)) push(d, 'event_occurred', 'series', 'activity-s');
        scenarios.push({ kind, note: `a season that ended ${daysBetween(stop, END)} days ago`, expect: [
          { category: 'occasion', subject_key: 'event-occurred:series:activity-s', status: ['retired', 'absent'], why: 'unseen past its review window: reconsidered, never "neglected"' }] });
        break;
      }
      case 'vacation-gap': {
        const dow = r.int(1, 5), gapStart = addDays(END, -r.int(24, 30));
        for (const d of onDow(dow)) if (d > addDays(gapStart, 14) || (d < gapStart && r.chance(Math.max(p, 0.9)))) push(d, 'event_occurred', 'series', 'activity-v');
        scenarios.push({ kind, note: 'two weeks away recently; the pattern resumes', expect: [
          { category: 'occasion', subject_key: 'event-occurred:series:activity-v', status: ['observed'], cadence: 'weekly', anchor: String(dow), why: 'absence is not contradicting evidence' }] });
        break;
      }
      case 'daily-task': {
        const owner = children.length && children[0].age >= 6 ? children[0].id : mom.id;
        agreements['a-dishes'] = [owner];
        for (const d of all) if (DAY_OF(d) !== 0 && r.chance(Math.max(p, 0.85))) push(d, 'task_done', 'agreement', 'a-dishes', { member_id: owner });
        scenarios.push({ kind, note: 'a daily agreement, done most weekdays and Saturdays', expect: [
          { category: 'routine', subject_key: 'task-done:agreement:a-dishes', status: ['observed'], cadence: 'daily', why: 'daily routines need 7 of 7 evidence and then hold' },
          { category: 'collaboration', subject_key: 'owner:a-dishes', status: ['observed'], content: { observed_owner: owner, differs_from_agreement: false }, why: 'the agreed owner is the observed owner' }] });
        break;
      }
      case 'monthly-nth': {
        const nth = r.int(1, 3), dow = r.pick([2, 4, 6]);
        for (let m = 0; m <= months; m++) {
          const first = `${addDays(start, m * 31).slice(0, 7)}-01`;
          let d = first; while (DAY_OF(d) !== dow) d = addDays(d, 1);
          d = addDays(d, (nth - 1) * 7);
          if (r.chance(Math.max(p, 0.9))) push(d, 'event_occurred', 'series', 'club-n');
        }
        scenarios.push({ kind, note: `the ${nth}${['', 'st', 'nd', 'rd'][nth]} weekday ${dow} of each month`, expect: [
          { category: 'occasion', subject_key: 'event-occurred:series:club-n', status: ['observed'], cadence: 'monthly', anchor: `${nth}:${dow}`, why: 'nth-weekday monthly anchors are recognized' }] });
        break;
      }
      case 'monthly-dom': {
        const dom = r.int(3, 26);
        let missed = false; // at most one missed month: the scenario is "pays monthly", not "sometimes"
        for (let m = 0; m <= months; m++) {
          const d = `${addDays(start, m * 31).slice(0, 7)}-${String(dom).padStart(2, '0')}`;
          if (!missed && m > 0 && r.chance(1 - p)) { missed = true; continue; }
          push(addDays(d, r.int(-1, 1)), 'task_done', 'agreement', 'a-bills');
        }
        scenarios.push({ kind, note: `bills paid around day ${dom}`, expect: [
          { category: 'routine', subject_key: 'task-done:agreement:a-bills', status: ['observed', 'tentative'], cadence: 'monthly', why: 'a day-of-month routine with ±1 day jitter' }] });
        break;
      }
      case 'annual-birthday': {
        const md = `${String(r.int(1, 12)).padStart(2, '0')}-${String(r.int(1, 28)).padStart(2, '0')}`;
        // Imported calendars reach back, so an annual occasion can have history from before the family joined.
        for (const y of [2024, 2025, 2026]) push(`${y}-${md}`, 'event_occurred', 'person', 'p-1', { synthetic: true });
        const lastY = `2026-${md}` <= END ? 2026 : 2025;
        const fresh = daysBetween(`${lastY}-${md}`, END) <= 400;
        scenarios.push({ kind, note: `a birthday on ${md}, seen in past years`, expect: [
          { category: 'occasion', subject_key: 'event-occurred:person:p-1', status: fresh ? ['observed'] : ['retired'], cadence: 'annual', why: 'an annual occasion survives a year without being seen' }] });
        break;
      }
      case 'biweekly-custody': {
        const dow = 5; let d = start; while (DAY_OF(d) !== dow) d = addDays(d, 1);
        for (; d <= END; d = addDays(d, 14)) if (r.chance(Math.max(p, 0.9))) push(d, 'handoff_covered', 'series', 'handoff-weekend');
        scenarios.push({ kind, note: 'every other Friday handoff', expect: [
          { category: 'collaboration', subject_key: 'handoff-covered:series:handoff-weekend', status: ['observed'], cadence: 'biweekly', anchor: '5', why: 'every-two-weeks is not "weekly with misses"' }] });
        break;
      }
      case 'owner-differs': {
        const agreed = adults.length > 1 ? adults[1].id : children[0].id;
        agreements['a-trash'] = [agreed];
        const actual = mom.id;
        for (const d of onDow(r.int(1, 5), addDays(END, -55))) push(d, 'task_done', 'agreement', 'a-trash', { member_id: r.chance(0.85) ? actual : agreed });
        scenarios.push({ kind, note: 'agreed to one person, done by mom', expect: [
          { category: 'collaboration', subject_key: 'owner:a-trash', status: ['observed', 'tentative'], content: { observed_owner: actual, differs_from_agreement: true }, why: 'observed ≠ agreed is surfaced, never reassigned' }] });
        break;
      }
      case 'load-imbalance': {
        for (const d of all.slice(-28)) for (let k = 0; k < 2; k++) if (r.chance(0.6)) push(d, 'task_done', 'agreement', `a-load-${k}`, { member_id: r.chance(0.9) ? mom.id : adults[1].id });
        scenarios.push({ kind, note: 'one adult does ~90% of recorded work for four weeks', expect: [
          { category: 'collaboration', subject_key: 'load:adults', status: ['observed'], content: { carries_most: mom.id, suggest: 'meeting-question' }, why: 'imbalance becomes a meeting question, not a chore assignment' }] });
        break;
      }
      case 'confirmed-contradicted': {
        const dow = 3;
        actions.push({ day: addDays(start, 20), type: 'confirm', category: 'occasion', subject_key: 'event-occurred:series:activity-c', content: { anchor: String(dow), said: 'family' }, cadence: 'weekly' });
        for (const d of onDow(1, addDays(start, 21))) if (r.chance(p)) push(d, 'event_occurred', 'series', 'activity-c');
        scenarios.push({ kind, note: 'family confirmed Wednesdays; behavior says Mondays', expect: [
          { category: 'occasion', subject_key: 'event-occurred:series:activity-c', status: ['confirmed'], content: { anchor: String(dow) }, why: 'the family\'s word stands over contradicting behavior' }] });
        break;
      }
      case 'forgotten-stays-forgotten': {
        const dow = r.int(1, 5), forget = addDays(END, -40);
        for (const d of onDow(dow, start, forget)) if (r.chance(Math.max(p, 0.9))) push(d, 'event_occurred', 'series', 'activity-f');
        actions.push({ day: addDays(forget, 1), type: 'forget', category: 'occasion', subject_key: 'event-occurred:series:activity-f' });
        // one stray occurrence after forgetting: not enough to bring it back
        push(addDays(forget, 15), 'event_occurred', 'series', 'activity-f');
        scenarios.push({ kind, note: 'the family said "forget this"; one occurrence since', expect: [
          { category: 'occasion', subject_key: 'event-occurred:series:activity-f', status: ['forgotten'], why: 'forgotten memory returns only from enough NEW evidence' }] });
        break;
      }
      case 'private-calendar': {
        const owner = adults.find((a) => a.user)!;
        for (const d of onDow(2)) if (r.chance(Math.max(p, 0.9))) push(d, 'event_occurred', 'series', 'private-1', { user_id: owner.user, visible_to: owner.user });
        scenarios.push({ kind, note: 'a weekly event from one adult\'s personal calendar', expect: [
          { category: 'occasion', subject_key: 'event-occurred:series:private-1', visible_to: owner.user, status: ['observed'], why: 'learned, but visible only to that adult' },
          { category: 'occasion', subject_key: 'event-occurred:series:private-1', visible_to: null, status: ['absent'], why: 'never pooled into household memory' }] });
        break;
      }
      case 'learning-off': {
        const off = addDays(END, -r.int(50, 70));
        actions.push({ day: off, type: 'learning', enabled: false });
        for (const d of onDow(4, off)) if (r.chance(Math.max(p, 0.9))) push(d, 'event_occurred', 'series', 'activity-off');
        scenarios.push({ kind, note: 'learning turned off; a new weekly pattern starts after', expect: [
          { category: 'occasion', subject_key: 'event-occurred:series:activity-off', status: ['absent'], why: 'nothing is recorded or learned while learning is off' }] });
        break;
      }
      case 'dismissals': {
        for (let k = 0; k < 3; k++) push(addDays(END, -60 + k * 15), 'rec_response', 'recommendation', 'rec-groceries', { value: 'dismissed' });
        for (let k = 0; k < 2; k++) push(addDays(END, -40 + k * 10), 'rec_response', 'recommendation', 'rec-permission-slip', { value: 'already-handled' });
        push(addDays(END, -20), 'rec_response', 'recommendation', 'rec-meal-plan', { value: 'later' });
        scenarios.push({ kind, note: 'plain dismissals, "already handled" twice, one "later"', expect: [
          { category: 'preference', subject_key: 'response:rec-groceries', status: ['absent'], why: 'a plain dismiss teaches nothing lasting' },
          { category: 'preference', subject_key: 'response:rec-meal-plan', status: ['absent'], why: '"later" is not "never"' },
          { category: 'preference', subject_key: 'response:rec-permission-slip', status: ['observed'], content: { response: 'already-handled' }, why: 'already handled twice: they have it covered' }] });
        break;
      }
      case 'preference-shift': {
        for (let k = 0; k < 4; k++) push(addDays(start, 10 + k * 20), 'intent_chosen', 'intent', 'meeting-length', { value: 'short' });
        for (let k = 0; k < 3; k++) push(addDays(END, -60 + k * 20), 'intent_chosen', 'intent', 'meeting-length', { value: 'full' });
        scenarios.push({ kind, note: 'chose "short" meetings early, then "full" three times lately', expect: [
          { category: 'preference', subject_key: 'choice:meeting-length', status: ['retired', 'tentative'], why: 'a changed preference is never held at "observed" for the old value' }] });
        break;
      }
      case 'noise-only': {
        scenarios.push({ kind, note: 'one-off events and scattered plans', expect: Array.from({ length: 3 }, (_, k) => (
          { category: 'occasion', subject_key: `event-occurred:event:oneoff-${k}`, status: ['absent'] as Expectation['status'], why: 'one-offs never become patterns' })) });
        break;
      }
    }
  }
  signals.sort((a, b) => a.at.localeCompare(b.at));
  // Ground truth follows what actually happened, not only what was scripted: a pattern the family stopped showing
  // (a low-engagement stretch longer than the cadence's review window) should be reconsidered, not still believed.
  for (const sc of scenarios) for (const e of sc.expect) {
    if (!e.cadence || !e.status.includes('observed') || e.status.includes('confirmed')) continue;
    const ref = e.subject_key.split(':').pop();
    const seen = signals.filter((x) => x.subject_ref === ref && (e.visible_to === undefined || (x.visible_to ?? null) === e.visible_to)).map((x) => x.local_day).sort();
    const last = seen[seen.length - 1];
    if (last && daysBetween(last, END) > REVIEW_DAYS[e.cadence as keyof typeof REVIEW_DAYS]) {
      e.status = ['retired']; e.anchor = undefined; e.why += ` (went quiet for ${daysBetween(last, END)} days in this history: reconsidered)`; e.adjusted = true;
    }
  }
  return { id, seededFrom: from, shape, adults, children, engagement, start, end: END, months, scenarios, actions, agreements, signals };
}
