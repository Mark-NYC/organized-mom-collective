/**
 * March 2027 family chore charts: the free chore chart (/chore-chart, src/components/site/ChoreChart.astro), one per
 * child, in its landscape kid-readable layout (src/components/club/MarchChoreCharts.astro), prepared from the family
 * profile. Pure functions only, so the printable, the desktop rail and the mobile plan screen (MarchPlanMobile.astro)
 * read one plan. Children by member ID; archived children never print; grown-ups have no chart.
 *
 * - Daily chores: age-right jobs, a few more as the child grows, up to eight. Only the child's own jobs print: no blank
 *   rows.
 * - Weekly chores: one per weekday, chosen from the job that suits that day's cleaning zone on the wall calendar
 *   (src/data/cleaning.ts), or a day off. The zone stays in the editor; the chart only says the day and the job.
 * - No rewards, stars, points or thresholds: the chart is the child's own jobs, done start to finish. Charts saved
 *   before rewards were removed keep their chores; the old reward fields are dropped (`applyFamily`).
 * - Icons: src/data/club/march-chore-icons.ts. A listed chore keeps its icon until it's renamed; typed chores have none.
 */
import { weeklySchedule, weekend } from '../../../data/cleaning';
import { marchIconArt, MARCH_CHORE_ICONS } from '../../../data/club/march-chore-icons';
import { responsibilityById } from '../../../data/responsibilities';
import { defaultToolPalette, resolveToolPalette, type ToolPaletteId } from '../../../data/tool-palettes';
import { ageInMonth } from '../profile';
import type { PlanResource } from '../plan/resource';

export const KIT_MONTH = '2027-03';
/** The most daily chores a chart holds (the free chart's eight rows). */
export const DAILY_MAX = 8;
export const TEXT_LIMIT = 34;

/** A job the chart can hold: titled from the responsibility library (`lib`) or a plain line. */
export interface ChoreDef { id: string; title: string; minAge: number }
const lib = (id: string): ChoreDef => {
  const r = responsibilityById(id);
  if (!r) throw new Error(`Unknown responsibility ${id}`);
  return { id, title: r.title, minAge: r.minAge };
};
const line = (id: string, title: string, minAge: number): ChoreDef => ({ id, title, minAge });

/** Daily chores, in the order they're suggested. */
export const DAILY_CHORES: readonly ChoreDef[] = [
  lib('put-toys-away'), lib('make-my-bed'), lib('set-the-table'), lib('clear-the-table'), lib('put-clothes-away'),
  lib('tidy-my-desk'), lib('wipe-the-counters'), line('feed-pets', 'Feed the pets', 4), lib('take-out-the-trash'),
  line('dishwasher', 'Empty the dishwasher', 8), line('help-dinner', 'Help make dinner', 10),
];
/** Weekly chores by weekday (0 = Sunday … 6 = Saturday), each in that day's calendar zone, easiest first. */
export const ZONE_CHORES: Record<number, readonly ChoreDef[]> = {
  1: [lib('put-toys-away'), line('pillows', 'Fluff the pillows', 4), line('dust-living', 'Dust the living room', 7), line('vacuum-living', 'Vacuum the living room', 10)],
  2: [lib('put-clothes-away'), lib('clean-my-floor'), line('sheets', 'Change my sheets', 9)],
  3: [line('shoes', 'Put shoes away', 2), line('sink', 'Wipe the bathroom sink', 6), line('bath-trash', 'Empty bathroom trash', 7), line('bathroom', 'Clean the bathroom', 12)],
  4: [line('my-dishes', 'Bring my dishes to the sink', 2), lib('wipe-the-counters'), line('sweep-kitchen', 'Sweep the kitchen', 8), line('fridge', 'Clean out the fridge', 12)],
  5: [line('sock-dust', 'Dust with a sock', 2), line('dust-room', 'Dust my room', 5), line('vacuum-room', 'Vacuum my room', 9)],
  6: [line('project', 'Help with a home project', 2)],
  0: [lib('put-toys-away'), line('catch-up', 'Finish any missed jobs', 5)],
};
/** The weekly rows, Monday first, as on the free chart, with the calendar's zone for that day (editor only). */
export const WEEK: readonly { day: number; label: string; zone: string }[] = [...weeklySchedule, ...weekend.days]
  .map((d) => ({ day: d.day, label: d.dayLabel, zone: d.zone }))
  .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));

export interface ChoreMember { id: string; firstName: string; kind: string; birthYear?: number; birthMonth?: number; archived?: boolean }
export interface Job { id: string; title: string }
export interface KidPlan {
  daily?: Job[];
  /** By weekday number (0–6); null = a day off. */
  weekly?: Record<string, Job | null>;
}
export interface ChoreState { palette: ToolPaletteId; kids: Record<string, KidPlan> }

export const kidsOf = <M extends ChoreMember>(members: readonly M[]) => members.filter((m) => m.kind === 'child' && !m.archived && m.firstName.trim());
/** Age in March 2027, at least 2; 8 when no birth year is saved. */
export const ageOf = (m: ChoreMember) => (m.birthYear ? Math.max(2, ageInMonth(m.birthYear, m.birthMonth, KIT_MONTH)) : 8);
const toJob = (d: ChoreDef): Job => ({ id: d.id, title: d.title });

export const freshState = (): ChoreState => ({ palette: defaultToolPalette, kids: {} });

/** A few daily chores a child this age can do: 3 for the youngest, up to 6; pets first when the family has them. */
export const preparedDaily = (age: number, pets: boolean): Job[] => {
  const count = age <= 3 ? 3 : age <= 5 ? 4 : age <= 9 ? 5 : 6;
  return DAILY_CHORES
    .filter((d) => d.minAge <= age && (d.id !== 'feed-pets' || pets) && !(age >= 9 && d.id === 'put-toys-away'))
    .sort((a, b) => Number(b.id === 'feed-pets') - Number(a.id === 'feed-pets'))
    .slice(0, count).map(toJob);
};
/** The hardest job in each day's zone that suits the child. */
export const preparedWeekly = (age: number): Record<string, Job | null> =>
  Object.fromEntries(WEEK.map((w) => {
    const able = ZONE_CHORES[w.day].filter((d) => d.minAge <= age);
    return [String(w.day), toJob(able.at(-1) ?? ZONE_CHORES[w.day][0])];
  }));

export const kidChart = (s: ChoreState, kid: ChoreMember, pets: boolean) => {
  const age = ageOf(kid);
  const k = s.kids[kid.id] ?? {};
  return { daily: k.daily ?? preparedDaily(age, pets), weekly: k.weekly ?? preparedWeekly(age) };
};

const LISTED = new Map([...DAILY_CHORES, ...Object.values(ZONE_CHORES).flat()].map((d) => [d.id, d]));
/** A listed chore's icon while it still says what the list says; renamed and typed chores have none. */
const iconFor = (j: Job) => {
  const name = MARCH_CHORE_ICONS[j.id];
  return name && LISTED.get(j.id)?.title.toLowerCase() === j.title.toLowerCase() ? marchIconArt(name) : null;
};

export const choreView = (s: ChoreState, members: readonly ChoreMember[], pets = false) => ({
  palette: s.palette,
  charts: kidsOf(members).map((kid) => {
    const c = kidChart(s, kid, pets);
    return {
      id: kid.id,
      name: kid.firstName,
      age: ageOf(kid),
      changed: Boolean(s.kids[kid.id]),
      daily: c.daily.map((j) => ({ ...j, icon: iconFor(j) })),
      weekly: WEEK.map((w) => {
        const j = c.weekly[String(w.day)] ?? null;
        return { day: w.day, label: w.label, zone: w.zone, job: j ? { ...j, icon: iconFor(j) } : null };
      }),
    };
  }),
});
export type ChoreView = ReturnType<typeof choreView>;
export type ChartView = ChoreView['charts'][number];

export const choreFingerprint = (s: ChoreState, members: readonly ChoreMember[], pets = false) => {
  const v = choreView(s, members, pets);
  return JSON.stringify([v.palette, v.charts.map((c) => [c.name, c.daily.map((j) => j.title), c.weekly.map((w) => w.job?.title ?? null)])]);
};

// Edits. Each changes `s` in place and returns it.
const own = (s: ChoreState, kidId: string, members: readonly ChoreMember[], pets: boolean): Required<KidPlan> | null => {
  const kid = kidsOf(members).find((k) => k.id === kidId);
  if (!kid) return null;
  const c = kidChart(s, kid, pets);
  return (s.kids[kidId] = { daily: structuredClone(c.daily), weekly: structuredClone(c.weekly) });
};
const tidy = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
export const removeDaily = (s: ChoreState, kidId: string, i: number, members: readonly ChoreMember[], pets = false) => {
  const k = own(s, kidId, members, pets);
  if (k && i >= 0 && i < k.daily.length) k.daily.splice(i, 1);
  return s;
};
/** Add a listed chore, or a typed one (`title` without a known `id`). */
export const addDaily = (s: ChoreState, kidId: string, id: string, members: readonly ChoreMember[], pets = false, title?: string) => {
  const k = own(s, kidId, members, pets);
  if (!k || k.daily.length >= DAILY_MAX) return s;
  const def = DAILY_CHORES.find((d) => d.id === id);
  if (def) { if (!k.daily.some((j) => j.id === id)) k.daily.push(toJob(def)); return s; }
  const clean = tidy(title ?? '');
  if (clean) k.daily.push({ id, title: clean });
  return s;
};
export const renameJob = (s: ChoreState, kidId: string, where: { daily: number } | { day: number }, title: string, members: readonly ChoreMember[], pets = false) => {
  const k = own(s, kidId, members, pets);
  const clean = tidy(title);
  if (!k || !clean) return s;
  const j = 'daily' in where ? k.daily[where.daily] : k.weekly[String(where.day)];
  if (j) j.title = clean;
  return s;
};
/** Choose a weekday's chore from that day's list, or none. */
export const setWeekly = (s: ChoreState, kidId: string, day: number, id: string | null, members: readonly ChoreMember[], pets = false) => {
  const k = own(s, kidId, members, pets);
  if (!k || !(day in ZONE_CHORES)) return s;
  const def = id ? ZONE_CHORES[day].find((d) => d.id === id) : null;
  if (id && !def) return s;
  k.weekly[String(day)] = def ? toJob(def) : null;
  return s;
};
export const setPalette = (s: ChoreState, id: string) => { s.palette = resolveToolPalette(id); return s; };
export const restoreKid = (s: ChoreState, kidId: string) => { delete s.kids[kidId]; return s; };
export const restoreAll = (s: ChoreState) => Object.assign(s, freshState());
export const planChanged = (s: ChoreState) => JSON.stringify(s) !== JSON.stringify(freshState());

/** Keep the plan to this family: charts only for children who are here. Also drops the reward fields charts saved
 * before rewards were removed (`rewards` on the plan and on each child), keeping their chores. */
export const applyFamily = (s: ChoreState, members: readonly ChoreMember[]) => {
  const ids = new Set(kidsOf(members).map((k) => k.id));
  delete (s as { rewards?: unknown }).rewards;
  for (const [id, k] of Object.entries(s.kids)) {
    delete (k as { rewards?: unknown }).rewards;
    if (!ids.has(id) || (!k.daily && !k.weekly)) delete s.kids[id];
  }
  s.palette = resolveToolPalette(s.palette);
  return s;
};

const isJob = (x: unknown): x is Job => {
  const j = x as Partial<Job> | null;
  return Boolean(j && typeof j.id === 'string' && typeof j.title === 'string');
};
export const isChoreState = (x: unknown): x is ChoreState => {
  const s = x as Partial<ChoreState> | null;
  return Boolean(s && typeof s.palette === 'string' && s.kids && typeof s.kids === 'object'
    && Object.values(s.kids).every((k) => (!k.daily || (Array.isArray(k.daily) && k.daily.every(isJob))) && (!k.weekly || Object.values(k.weekly).every((j) => j === null || isJob(j)))));
};

export interface ChorePlan extends PlanResource<ChoreState> {
  members: () => ChoreMember[];
  pets: () => boolean;
  view: () => ChoreView;
  setLocked: (on: boolean) => void;
  openEditor: (kidId?: string) => void;
}
