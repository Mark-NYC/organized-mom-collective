/**
 * March 2027 family chore charts: the free chore chart (/chore-chart, src/components/site/ChoreChart.astro), one per
 * person, in its landscape kid-readable layout (src/components/club/MarchChoreCharts.astro), prepared from the family
 * profile through the shared personalization foundation (../personalize/, docs/club/PERSONALIZATION_FOUNDATION.md).
 * Pure functions only, so the printable, the desktop rail and the mobile plan screen (MarchPlanMobile.astro) read
 * one plan. People by member ID; archived members never print.
 *
 * The family's chores are shared out, not copied onto every chart:
 * - Daily: each child's own jobs (bed, toys, clothes, desk) plus a fair share of the household jobs (table, pets,
 *   trash, dishwasher, dinner), one owner each, by age. Whoever already takes care of an area keeps it (profile step
 *   3) and a child she wished a job for gets it first (step 4). Grown-ups get the jobs no child is old enough for
 *   and the grown-up jobs (dinner, laundry, papers), split between them; the account holder is never the default.
 * - Weekly: one job per weekday from that day's cleaning zone on the wall calendar (src/data/cleaning.ts), the
 *   hardest job going to whoever can do it, so a bathroom isn't cleaned three times while nobody vacuums. The zone
 *   stays in the editor; the chart only says the day and the job.
 * - Grown-ups get a chart too (the family editor can leave one off). Only a person's own jobs print: no blank rows.
 * - No rewards, stars, points or thresholds. Charts saved before rewards were removed keep their chores; the old
 *   reward fields are dropped (`applyFamily`).
 * - Icons: src/data/club/march-chore-icons.ts. A listed chore keeps its icon until it's renamed; typed chores have none.
 * - Saved means settled (January): the profile snapshot used is kept in the plan, so later visits and the owner's
 *   print view prepare the same charts; "Restore the prepared charts" takes her newest answers.
 */
import { weeklySchedule, weekend } from '../../../data/cleaning';
import { marchIconArt, MARCH_CHORE_ICONS } from '../../../data/club/march-chore-icons';
import { responsibilityById } from '../../../data/responsibilities';
import { defaultToolPalette, resolveToolPalette, type ToolPaletteId } from '../../../data/tool-palettes';
import { stableHash } from '../hash';
import { ageInMonth } from '../profile';
import { familyContext, isFamilySnapshot, type ContextMember, type ContextPrefs, type FamilyContext, type FamilySnapshot } from '../personalize/family';
import { assignTasks } from '../personalize/assign';
import { colorFor } from '../personalize/colors';
import { CUE, DEFAULT_CUE, cueFor } from '../personalize/cues';
import { tidyCue } from '../personalize/marks-text';
import type { PlanResource } from '../plan/resource';

export const KIT_MONTH = '2027-03';
/** The most daily chores a chart holds (the free chart's eight rows). */
export const DAILY_MAX = 8;
export const TEXT_LIMIT = 34;
/** Grown-ups can do any chore on the lists. */
const ADULT_AGE = 99;
/** Little children's own jobs, never given to a grown-up by default. */
const LITTLE_ONES = new Set(['put-toys-away', 'shoes', 'my-dishes', 'sock-dust']);
/** Weekly jobs this hard are the grown-ups' first picks. */
const GROWN_UP_SIZED = 12;

/**
 * A job the chart can hold: titled from the responsibility library (`lib`) or a plain line. `share`: one owner in the
 * family ('household'), or each person's own ('own'). `areas`/`wishes`: profile answers that point at its owner.
 */
export interface ChoreDef { id: string; title: string; minAge: number; share?: 'own' | 'household'; areas?: string[]; wishes?: string[] }
const lib = (id: string, more: Partial<ChoreDef> = {}): ChoreDef => {
  const r = responsibilityById(id);
  if (!r) throw new Error(`Unknown responsibility ${id}`);
  return { id, title: r.title, minAge: r.minAge, ...more };
};
const line = (id: string, title: string, minAge: number, more: Partial<ChoreDef> = {}): ChoreDef => ({ id, title, minAge, ...more });

/** Children's daily chores, in the order they're suggested. */
export const DAILY_CHORES: readonly ChoreDef[] = [
  lib('put-toys-away', { share: 'own', wishes: ['tidy-room'] }), lib('make-my-bed', { share: 'own', wishes: ['tidy-room'] }),
  lib('set-the-table', { share: 'household', areas: ['meals'], wishes: ['help-with-meals'] }),
  lib('clear-the-table', { share: 'household', areas: ['meals'], wishes: ['help-with-meals'] }),
  lib('put-clothes-away', { share: 'own', wishes: ['put-away-laundry'] }), lib('tidy-my-desk', { share: 'own', wishes: ['homework-start'] }),
  lib('wipe-the-counters', { share: 'household', areas: ['meals', 'cleaning'] }),
  line('feed-pets', 'Feed the pets', 4, { share: 'household', areas: ['pet-care'], wishes: ['pet-care'] }),
  lib('take-out-the-trash', { share: 'household', areas: ['cleaning'] }),
  line('dishwasher', 'Empty the dishwasher', 8, { share: 'household', areas: ['meals'], wishes: ['help-with-meals'] }),
  line('help-dinner', 'Help make dinner', 10, { share: 'household', areas: ['meals'], wishes: ['help-with-meals'] }),
];
/** Grown-ups' daily jobs, shared between the grown-ups (whoever already owns the area first). */
export const ADULT_DAILY: readonly ChoreDef[] = [
  line('cook-dinner', 'Make dinner', 16, { share: 'household', areas: ['meals'] }),
  line('run-dishwasher', 'Load and run the dishwasher', 12, { share: 'household', areas: ['meals', 'cleaning'] }),
  line('laundry-load', 'Start a load of laundry', 14, { share: 'household', areas: ['laundry'] }),
  line('mail-papers', 'Sort mail and school papers', 14, { share: 'household', areas: ['school-prep', 'homework'] }),
  line('evening-pickup', '10-minute evening pick-up', 10, { share: 'household', areas: ['cleaning'] }),
];
/**
 * Weekly chores by weekday (0 = Sunday … 6 = Saturday), each in that day's calendar zone, easiest first. `own` jobs
 * can be on several charts the same day (everyone puts their own shoes away); household jobs go to one person.
 */
export const ZONE_CHORES: Record<number, readonly ChoreDef[]> = {
  1: [lib('put-toys-away', { share: 'own' }), line('pillows', 'Fluff the pillows', 4), line('dust-living', 'Dust the living room', 7), line('vacuum-living', 'Vacuum the living room', 10), line('living-surfaces', 'Wipe the living room surfaces', 12)],
  2: [lib('put-clothes-away', { share: 'own' }), lib('clean-my-floor', { share: 'own' }), line('sheets', 'Change my sheets', 9, { share: 'own' }), line('wash-sheets', 'Wash the sheets and towels', 16, { areas: ['laundry'] })],
  3: [line('shoes', 'Put shoes away', 2, { share: 'own' }), line('sink', 'Wipe the bathroom sink', 6), line('bath-trash', 'Empty bathroom trash', 7), line('bathroom', 'Clean the bathroom', 12), line('mop-bath', 'Mop the bathroom floor', 16)],
  4: [line('my-dishes', 'Bring my dishes to the sink', 2, { share: 'own' }), lib('wipe-the-counters'), line('sweep-kitchen', 'Sweep the kitchen', 8), line('fridge', 'Clean out the fridge', 12), line('mop-kitchen', 'Mop the kitchen floor', 16)],
  5: [line('sock-dust', 'Dust with a sock', 2, { share: 'own' }), line('dust-room', 'Dust my room', 5, { share: 'own' }), line('vacuum-room', 'Vacuum my room', 9, { share: 'own' }), line('deep-clean', 'Do this month’s deep-clean job', 16)],
  6: [line('project', 'Help with a home project', 2, { share: 'own' }), line('lead-project', 'Lead the home project', 16)],
  0: [lib('put-toys-away', { share: 'own' }), line('catch-up', 'Finish any missed jobs', 5, { share: 'own' }), line('plan-week', 'Plan the week on the calendar', 16)],
};
/** The weekly rows, Monday first, as on the free chart, with the calendar's zone for that day (editor only). */
export const WEEK: readonly { day: number; label: string; zone: string }[] = [...weeklySchedule, ...weekend.days]
  .map((d) => ({ day: d.day, label: d.dayLabel, zone: d.zone }))
  .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));

export interface ChoreMember {
  id: string; firstName: string; kind: string; role?: string; birthYear?: number; birthMonth?: number; archived?: boolean; isAccountHolder?: boolean;
}
export interface ChorePrefs extends ContextPrefs { pets?: boolean }
/** `cue`: her own habit cue for this chore; without one the chart prints the prepared cue (`CHORE_CUES`). */
export interface Job { id: string; title: string; cue?: string }
export interface KidPlan {
  daily?: Job[];
  /** By weekday number (0–6); null = a day off. */
  weekly?: Record<string, Job | null>;
  /** Her cue for the weekly jobs (one for the section: the day changes, the moment doesn't). */
  weeklyCue?: string;
}
/** A person's chart as prepared or edited: their daily chores and a job (or day off) per weekday. */
export interface PreparedChart { daily: Job[]; weekly: Record<string, Job | null>; weeklyCue?: string }
export interface ChoreState {
  palette: ToolPaletteId;
  /** Her changes, by member id (children and grown-ups; the name is from when only children had charts). */
  kids: Record<string, KidPlan>;
  /** Grown-ups whose chart is left off. */
  off?: string[];
  /** The profile answers these charts were prepared from (saved means settled). */
  profile?: FamilySnapshot;
}

export const kidsOf = <M extends ChoreMember>(members: readonly M[]) => members.filter((m) => m.kind === 'child' && !m.archived && m.firstName.trim());
export const adultsOf = <M extends ChoreMember>(members: readonly M[]) => members.filter((m) => m.kind === 'adult' && !m.archived && m.firstName.trim());
/** Everyone with a chart: the children, then the grown-ups she hasn't left off. */
export const chartPeople = <M extends ChoreMember>(s: Pick<ChoreState, 'off'>, members: readonly M[]) =>
  [...kidsOf(members), ...adultsOf(members).filter((a) => !s.off?.includes(a.id))];
/** Age in March 2027 for a child, at least 2; 8 when no birth year is saved; grown-ups can do anything listed. */
export const ageOf = (m: ChoreMember) => (m.kind === 'adult' ? ADULT_AGE : m.birthYear ? Math.max(2, ageInMonth(m.birthYear, m.birthMonth, KIT_MONTH)) : 8);
const toJob = (d: ChoreDef): Job => ({ id: d.id, title: d.title });
const isAdult = (m: ChoreMember) => m.kind === 'adult';

export const freshState = (): ChoreState => ({ palette: defaultToolPalette, kids: {} });

/** How many daily chores suit a child this age: 3 for the youngest, up to 6. */
export const dailyCount = (age: number) => (age <= 3 ? 3 : age <= 5 ? 4 : age <= 9 ? 5 : 6);
/** A grown-up's daily share: the grown-up jobs split between them, at least two each, at most five. */
const adultCount = (adults: number) => Math.min(5, Math.max(2, Math.ceil(ADULT_DAILY.length / Math.max(1, adults)) + 1));

/** Children's own daily jobs for their age (toys only under 9), in the list's order. */
const ownDaily = (age: number) => DAILY_CHORES.filter((d) => d.share === 'own' && d.minAge <= age && !(age >= 9 && d.id === 'put-toys-away'));

/** The family for the shared assigner, with the chart's own ages (a child's age at least 2, 8 when not saved). */
const ctxOf = (members: readonly ChoreMember[], prefs: ChorePrefs, snapshot?: FamilySnapshot): FamilyContext => {
  const ctx = familyContext(members as readonly ContextMember[], prefs, KIT_MONTH, snapshot);
  const byId = new Map(members.map((m) => [m.id, m]));
  const people = ctx.people.map((p) => (p.kind === 'child' ? { ...p, age: ageOf(byId.get(p.id)!) } : p));
  return { ...ctx, people, children: people.filter((p) => p.kind === 'child') };
};

/**
 * The prepared charts for the whole family at once, so household jobs are shared out. Charts she has changed
 * (`pinned`) stay as they are, and the household jobs on them count as taken.
 */
export function preparedFamily(members: readonly ChoreMember[], prefs: ChorePrefs, snapshot?: FamilySnapshot, pinned: Record<string, KidPlan> = {}, off: string[] = []): Record<string, PreparedChart> {
  const ctx = ctxOf(members, prefs, snapshot);
  const people = chartPeople({ off }, members);
  const out: Record<string, PreparedChart> = {};
  const free = people.filter((p) => !pinned[p.id]?.daily);
  const takenDaily = new Set(people.flatMap((p) => pinned[p.id]?.daily?.map((j) => j.id) ?? []));
  const person = (id: string) => ctx.people.find((p) => p.id === id);
  // Daily, children: their own jobs first (leaving room for at least one household job), then the household jobs
  // through the shared assigner, then their remaining own jobs if they still have room.
  const kids = free.filter((m) => !isAdult(m));
  const adults = free.filter(isAdult);
  for (const k of kids) {
    const age = ageOf(k);
    out[k.id] = { daily: ownDaily(age).slice(0, Math.max(1, dailyCount(age) - 2)).map(toJob), weekly: {} };
  }
  const household = DAILY_CHORES.filter((d) => d.share === 'household' && (d.id !== 'feed-pets' || ctx.pets) && !takenDaily.has(d.id));
  const load = new Map<string, number>();
  const kidPeople = ctx.people.filter((p) => kids.some((k) => k.id === p.id));
  const leftover: ChoreDef[] = [];
  for (const d of household) {
    const room = kidPeople.filter((p) => out[p.id].daily.length < dailyCount(ageOf(kids.find((k) => k.id === p.id)!)));
    const [a] = assignTasks([{ id: d.id, title: d.title, mode: 'one', who: 'child', minAge: d.minAge, areas: d.areas, wishes: d.wishes }], { ...ctx, people: room }, { load, seed: 'march' });
    if (a.ownerIds[0]) out[a.ownerIds[0]].daily.push(toJob(d));
    // A learning job (helping with dinner) isn't a grown-up's; the rest go to the grown-ups when no child can.
    else if (d.id !== 'help-dinner') leftover.push(d);
  }
  for (const k of kids) {
    const age = ageOf(k);
    for (const d of ownDaily(age)) if (out[k.id].daily.length < dailyCount(age) && !out[k.id].daily.some((j) => j.id === d.id)) out[k.id].daily.push(toJob(d));
  }
  // Daily, grown-ups: what no child can do yet (feeding a pet the toddler can't reach, the trash) and the grown-up jobs.
  const adultJobs = [...leftover, ...ADULT_DAILY.filter((d) => !takenDaily.has(d.id))];
  const adultCtx: FamilyContext = { ...ctx, people: ctx.people.filter((p) => adults.some((a) => a.id === p.id)) };
  for (const a of adults) out[a.id] = { daily: [], weekly: {} };
  const perAdult = adultCount(adults.length);
  const adultLoad = new Map<string, number>();
  for (const d of adultJobs) {
    const room = adultCtx.people.filter((p) => out[p.id].daily.length < perAdult);
    const [a] = assignTasks([{ id: d.id, title: d.title, mode: 'one', who: 'adult', areas: d.areas }], { ...adultCtx, people: room }, { load: adultLoad, seed: 'march' });
    if (a.ownerIds[0]) out[a.ownerIds[0]].daily.push(toJob(d));
  }
  // Weekly: each day the grown-ups take the grown-up-sized jobs (taking turns at the hardest, the account holder
  // starting last), then the children the hardest job they can do, oldest first, distinct household jobs while there
  // are enough; anyone left takes what remains or their own job (everyone puts their own shoes away).
  const weekFree = people.filter((p) => !pinned[p.id]?.weekly);
  for (const p of weekFree) (out[p.id] ??= { daily: [], weekly: {} }).weekly = {};
  const grownUps = weekFree.filter(isAdult).sort((a, b) => Number(person(a.id)?.holder) - Number(person(b.id)?.holder) || stableHash(a.id) - stableHash(b.id));
  const children = weekFree.filter((p) => !isAdult(p)).sort((a, b) => ageOf(b) - ageOf(a));
  WEEK.forEach((w, i) => {
    const turn = grownUps.length ? [...grownUps.slice(i % grownUps.length), ...grownUps.slice(0, i % grownUps.length)] : [];
    const taken = new Set(people.filter((p) => pinned[p.id]?.weekly).map((p) => pinned[p.id].weekly![String(w.day)]?.id).filter(Boolean) as string[]);
    const list = ZONE_CHORES[w.day];
    const give = (p: ChoreMember, pick: ChoreDef) => { if (pick.share !== 'own') taken.add(pick.id); out[p.id].weekly[String(w.day)] = toJob(pick); };
    const hardest = (p: ChoreMember, from: (d: ChoreDef) => boolean) => [...list].reverse().find((d) => d.minAge <= ageOf(p) && d.share !== 'own' && !taken.has(d.id) && from(d));
    const waiting: ChoreMember[] = [];
    for (const p of turn) { const d = hardest(p, (x) => x.minAge >= GROWN_UP_SIZED); if (d) give(p, d); else waiting.push(p); }
    for (const p of children) {
      const able = list.filter((d) => d.minAge <= ageOf(p));
      give(p, hardest(p, () => true) ?? able.filter((d) => d.share === 'own').at(-1) ?? able.at(-1) ?? list[0]);
    }
    // A grown-up with nothing grown-up-sized left gets what's left, their own room, or an honest day off: never a
    // toddler's job.
    for (const p of waiting) {
      const pick = hardest(p, () => true) ?? list.filter((d) => d.share === 'own' && !LITTLE_ONES.has(d.id)).at(-1);
      if (pick) give(p, pick); else out[p.id].weekly[String(w.day)] = null;
    }
  });
  return out;
}

/** The day's household job a lone child would get (the free chart's rule), used by the tests and the editor hint. */
export const preparedWeekly = (age: number): Record<string, Job | null> =>
  Object.fromEntries(WEEK.map((w) => {
    const able = ZONE_CHORES[w.day].filter((d) => d.minAge <= age);
    return [String(w.day), toJob(able.at(-1) ?? ZONE_CHORES[w.day][0])];
  }));

export const kidChart = (s: ChoreState, kid: ChoreMember, members: readonly ChoreMember[], prefs: ChorePrefs, prepared?: Record<string, PreparedChart>) => {
  const k = s.kids[kid.id] ?? {};
  const p = (prepared ?? preparedFamily(members, prefs, s.profile, s.kids, s.off))[kid.id] ?? { daily: [], weekly: {} };
  return { daily: k.daily ?? p.daily, weekly: k.weekly ?? p.weekly };
};

/**
 * Each listed chore's habit cue: the existing moment it follows (../personalize/cues.ts). A chore she typed gets the
 * shared default, and every cue is hers to change. Never a clock time or a due date.
 */
export const CHORE_CUES: Readonly<Record<string, string>> = {
  'make-my-bed': CUE.dressed, 'put-toys-away': CUE.beforeDinner, 'put-clothes-away': CUE.bed, 'tidy-my-desk': CUE.homework,
  'set-the-table': CUE.beforeDinner, 'clear-the-table': CUE.dinner, 'wipe-the-counters': CUE.dinner, 'feed-pets': CUE.breakfast,
  'take-out-the-trash': CUE.dinner, dishwasher: CUE.breakfast, 'help-dinner': CUE.home,
  'cook-dinner': CUE.everyoneHome, 'run-dishwasher': CUE.dinner, 'laundry-load': CUE.breakfast, 'mail-papers': CUE.dinner, 'evening-pickup': CUE.kidsDown,
};
/** The weekly section's cue: after school for a school-aged child, after lunch at home, after dinner for grown-ups. */
const WEEKLY_CUE = { child: CUE.school, adult: CUE.dinner } as const;

const LISTED = new Map([...DAILY_CHORES, ...ADULT_DAILY, ...Object.values(ZONE_CHORES).flat()].map((d) => [d.id, d]));
/** A listed chore's icon while it still says what the list says; renamed and typed chores have none. */
const iconFor = (j: Job) => {
  const name = MARCH_CHORE_ICONS[j.id];
  return name && LISTED.get(j.id)?.title.toLowerCase() === j.title.toLowerCase() ? marchIconArt(name) : null;
};

const prefsOf = (pets: boolean | ChorePrefs): ChorePrefs => (typeof pets === 'boolean' ? { pets } : pets);

export const choreView = (s: ChoreState, members: readonly ChoreMember[], pets: boolean | ChorePrefs = false) => {
  const prefs = prefsOf(pets);
  const prepared = preparedFamily(members, prefs, s.profile, s.kids, s.off);
  const ctx = ctxOf(members, prefs, s.profile);
  // Her cue, or the chore's prepared cue fitted to this person (no school-day cue for a child who isn't in school).
  const cueOf = (j: Job, id: string) => (j.cue && tidyCue(j.cue)) || cueFor(ctx, CHORE_CUES[j.id] ?? DEFAULT_CUE, id);
  return {
    palette: s.palette,
    charts: chartPeople(s, members).map((person) => {
      const c = kidChart(s, person, members, prefs, prepared);
      return {
        id: person.id,
        name: person.firstName,
        adult: isAdult(person),
        /** Children's age in March 2027; null for grown-ups. */
        age: isAdult(person) ? null : ageOf(person),
        changed: Boolean(s.kids[person.id]),
        /** January's marker color for this person, by member id (neutral when there's none). */
        color: colorFor(ctx.colors, person.id),
        daily: c.daily.map((j) => ({ ...j, icon: iconFor(j), cue: cueOf(j, person.id) })),
        /** The weekly jobs' one cue, and the prepared one (for the editor). */
        weeklyCue: (s.kids[person.id]?.weeklyCue && tidyCue(s.kids[person.id].weeklyCue!)) || cueFor(ctx, isAdult(person) ? WEEKLY_CUE.adult : WEEKLY_CUE.child, person.id),
        preparedWeeklyCue: cueFor(ctx, isAdult(person) ? WEEKLY_CUE.adult : WEEKLY_CUE.child, person.id),
        weekly: WEEK.map((w) => {
          const j = c.weekly[String(w.day)] ?? null;
          return { day: w.day, label: w.label, zone: w.zone, job: j ? { ...j, icon: iconFor(j) } : null };
        }),
      };
    }),
    /** Grown-ups, with whether their chart prints (the family editor). */
    adults: adultsOf(members).map((a) => ({ id: a.id, name: a.firstName, on: !s.off?.includes(a.id) })),
  };
};
export type ChoreView = ReturnType<typeof choreView>;
export type ChartView = ChoreView['charts'][number];

export const choreFingerprint = (s: ChoreState, members: readonly ChoreMember[], pets: boolean | ChorePrefs = false) => {
  const v = choreView(s, members, pets);
  return JSON.stringify([v.palette, v.charts.map((c) => [c.name, c.color.id, c.daily.map((j) => [j.title, j.cue]), c.weeklyCue, c.weekly.map((w) => w.job?.title ?? null)])]);
};

/** The chores someone can add: children by age, grown-ups anything on the lists. */
export const dailyChoices = (person: ChoreMember, pets: boolean) => {
  const age = ageOf(person);
  const list = isAdult(person) ? [...ADULT_DAILY, ...DAILY_CHORES.filter((d) => d.share === 'household')] : DAILY_CHORES;
  return list.filter((d) => d.minAge <= age + 1 && (d.id !== 'feed-pets' || pets));
};
export const weeklyChoices = (person: ChoreMember, day: number) => ZONE_CHORES[day].filter((d) => d.minAge <= ageOf(person) + 1);

// Edits. Each changes `s` in place and returns it.
const own = (s: ChoreState, kidId: string, members: readonly ChoreMember[], pets: boolean | ChorePrefs): PreparedChart | null => {
  const person = chartPeople(s, members).find((k) => k.id === kidId);
  if (!person) return null;
  const c = kidChart(s, person, members, prefsOf(pets));
  const weeklyCue = s.kids[kidId]?.weeklyCue;
  return (s.kids[kidId] = { daily: structuredClone(c.daily), weekly: structuredClone(c.weekly), ...(weeklyCue ? { weeklyCue } : {}) });
};
const tidy = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
export const removeDaily = (s: ChoreState, kidId: string, i: number, members: readonly ChoreMember[], pets: boolean | ChorePrefs = false) => {
  const k = own(s, kidId, members, pets);
  if (k && i >= 0 && i < k.daily.length) k.daily.splice(i, 1);
  return s;
};
/** Add a listed chore, or a typed one (`title` without a known `id`). */
export const addDaily = (s: ChoreState, kidId: string, id: string, members: readonly ChoreMember[], pets: boolean | ChorePrefs = false, title?: string) => {
  const k = own(s, kidId, members, pets);
  if (!k || k.daily.length >= DAILY_MAX) return s;
  const def = [...DAILY_CHORES, ...ADULT_DAILY].find((d) => d.id === id);
  if (def) { if (!k.daily.some((j) => j.id === id)) k.daily.push(toJob(def)); return s; }
  const clean = tidy(title ?? '');
  if (clean) k.daily.push({ id, title: clean });
  return s;
};
export const renameJob = (s: ChoreState, kidId: string, where: { daily: number } | { day: number }, title: string, members: readonly ChoreMember[], pets: boolean | ChorePrefs = false) => {
  const k = own(s, kidId, members, pets);
  const clean = tidy(title);
  if (!k || !clean) return s;
  const j = 'daily' in where ? k.daily[where.daily] : k.weekly[String(where.day)];
  if (j) j.title = clean;
  return s;
};
/** Choose a weekday's chore from that day's list, or none. */
export const setWeekly = (s: ChoreState, kidId: string, day: number, id: string | null, members: readonly ChoreMember[], pets: boolean | ChorePrefs = false) => {
  const k = own(s, kidId, members, pets);
  if (!k || !(day in ZONE_CHORES)) return s;
  const def = id ? ZONE_CHORES[day].find((d) => d.id === id) : null;
  if (id && !def) return s;
  k.weekly[String(day)] = def ? toJob(def) : null;
  return s;
};
/** Her cue for a daily chore; blank (or the prepared cue) goes back to the prepared one. */
export const setDailyCue = (s: ChoreState, kidId: string, i: number, cue: string, members: readonly ChoreMember[], pets: boolean | ChorePrefs = false) => {
  const k = own(s, kidId, members, pets);
  const j = k?.daily[i];
  if (!j) return s;
  const prepared = cueFor(ctxOf(members, prefsOf(pets), s.profile), CHORE_CUES[j.id] ?? DEFAULT_CUE, kidId);
  const clean = tidyCue(cue);
  if (clean && clean !== prepared) j.cue = clean; else delete j.cue;
  return s;
};
/** Her cue for the weekly jobs. */
export const setWeeklyCue = (s: ChoreState, kidId: string, cue: string, members: readonly ChoreMember[], pets: boolean | ChorePrefs = false) => {
  const prepared = choreView(s, members, pets).charts.find((c) => c.id === kidId)?.preparedWeeklyCue;
  const k = own(s, kidId, members, pets);
  if (!k) return s;
  const clean = tidyCue(cue);
  if (clean && clean !== prepared) (k as KidPlan).weeklyCue = clean; else delete (k as KidPlan).weeklyCue;
  return s;
};
export const setPalette = (s: ChoreState, id: string) => { s.palette = resolveToolPalette(id); return s; };
/** Print a grown-up's chart, or leave it off (their jobs go back to the others). */
export const setChartOn = (s: ChoreState, adultId: string, on: boolean, members: readonly ChoreMember[]) => {
  if (!adultsOf(members).some((a) => a.id === adultId)) return s;
  const off = new Set(s.off ?? []);
  if (on) off.delete(adultId); else { off.add(adultId); delete s.kids[adultId]; }
  if (off.size) s.off = [...off]; else delete s.off;
  return s;
};
export const restoreKid = (s: ChoreState, kidId: string) => { delete s.kids[kidId]; return s; };
/** Back to the prepared charts. The profile snapshot goes too, so the printable prepares from her newest answers. */
export const restoreAll = (s: ChoreState) => { const palette = defaultToolPalette; delete s.off; delete s.profile; return Object.assign(s, { palette, kids: {} }); };
export const planChanged = (s: ChoreState) => s.palette !== defaultToolPalette || Object.keys(s.kids).length > 0 || Boolean(s.off?.length);

/** Keep the plan to this family: changes only for people who are here. Also drops the reward fields charts saved
 * before rewards were removed (`rewards` on the plan and on each child), keeping their chores. */
export const applyFamily = (s: ChoreState, members: readonly ChoreMember[]) => {
  const adults = new Set(adultsOf(members).map((a) => a.id));
  if (s.off) { s.off = s.off.filter((i) => adults.has(i)); if (!s.off.length) delete s.off; }
  const ids = new Set(chartPeople(s, members).map((k) => k.id));
  delete (s as { rewards?: unknown }).rewards;
  for (const [id, k] of Object.entries(s.kids)) {
    delete (k as { rewards?: unknown }).rewards;
    if (!ids.has(id) || (!k.daily && !k.weekly)) delete s.kids[id];
  }
  s.palette = resolveToolPalette(s.palette);
  if (s.profile && !isFamilySnapshot(s.profile)) delete s.profile;
  return s;
};

const isJob = (x: unknown): x is Job => {
  const j = x as Partial<Job> | null;
  return Boolean(j && typeof j.id === 'string' && typeof j.title === 'string' && (j.cue === undefined || typeof j.cue === 'string'));
};
export const isChoreState = (x: unknown): x is ChoreState => {
  const s = x as Partial<ChoreState> | null;
  return Boolean(s && typeof s.palette === 'string' && s.kids && typeof s.kids === 'object'
    && (s.off === undefined || (Array.isArray(s.off) && s.off.every((i) => typeof i === 'string')))
    && (s.profile === undefined || isFamilySnapshot(s.profile))
    && Object.values(s.kids).every((k) => (!k.daily || (Array.isArray(k.daily) && k.daily.every(isJob))) && (!k.weekly || Object.values(k.weekly).every((j) => j === null || isJob(j)))));
};


export interface ChorePlan extends PlanResource<ChoreState> {
  members: () => ChoreMember[];
  pets: () => boolean;
  /** The household preferences the charts read (pets, school, January's saved member colors). */
  prefs: () => ChorePrefs;
  view: () => ChoreView;
  setLocked: (on: boolean) => void;
  openEditor: (kidId?: string) => void;
}
