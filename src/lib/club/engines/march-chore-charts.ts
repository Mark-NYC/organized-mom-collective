/**
 * March 2027 family chore charts: one portrait Letter chart per child (src/components/club/MarchChoreCharts.astro),
 * prepared from the family profile and the free chore chart's library. Pure functions only, so the printable, the
 * desktop rail and the mobile plan screen (MarchPlanMobile.astro) read one plan. Children by member ID; archived
 * children never print; grown-ups have no chart.
 *
 * - Daily jobs: age-right jobs from "My Room" and "Helping at Home" (personal habits belong to January and August).
 * - Weekly jobs follow the wall calendar's cleaning zones (src/data/cleaning.ts): one kid-safe job per weekday in that
 *   day's zone.
 * - Each job has a growth level: learning it, with a check, or I own it. Age suggests it; Mom can change it.
 * - Siblings take turns with family jobs (week by week of the month), printed on every chart that shares the job.
 * - Rewards are optional, three per child (starting from the free chart's age suggestions).
 */
import { choreSets, ageGroupFor } from '../../../data/chore-chart';
import { dailyEssentials, weeklySchedule, weekend } from '../../../data/cleaning';
import { responsibilityById, responsibilityImage, responsibilityColor } from '../../../data/responsibilities';
import { defaultToolPalette, resolveToolPalette, type ToolPaletteId } from '../../../data/tool-palettes';
import { ageInMonth } from '../profile';
import type { PlanResource } from '../plan/resource';

export const KIT_MONTH = '2027-03';
export type Level = 'learning' | 'with-check' | 'owns';
export const LEVELS: readonly Level[] = ['learning', 'with-check', 'owns'];
/** Kid-facing wording on the chart; the editor says the same. */
export const LEVEL_TEXT: Record<Level, string> = { learning: 'Learning it', 'with-check': 'With a check', owns: 'I own it' };
export const DAILY_MAX = 5;
export const TEXT_LIMIT = 40;

/** A job the chart can hold: from the illustrated library (`lib`) or a plain line. */
export interface ChoreDef { id: string; title: string; minAge: number; lib?: string }
const lib = (id: string): ChoreDef => {
  const r = responsibilityById(id);
  if (!r) throw new Error(`Unknown responsibility ${id}`);
  return { id, title: r.title, minAge: r.minAge, lib: id };
};
const line = (id: string, title: string, minAge: number): ChoreDef => ({ id, title, minAge });

/** Daily jobs, in the order they're suggested. */
export const DAILY_CHORES: readonly ChoreDef[] = [
  lib('put-toys-away'), lib('make-my-bed'), lib('set-the-table'), lib('tidy-my-desk'), lib('wipe-the-counters'),
  line('dishwasher', 'Load or unload the dishwasher', 8), line('help-dinner', 'Help make dinner', 10),
  line('kitchen-cleanup', 'Kitchen cleanup after dinner', 12), lib('put-clothes-away'), line('feed-pets', 'Feed the pets', 4),
];
/** Weekly jobs by weekday (0 = Sunday … 6 = Saturday), each in that day's calendar zone, easiest first. */
export const ZONE_CHORES: Record<number, readonly ChoreDef[]> = {
  1: [lib('put-toys-away'), line('pillows', 'Straighten the pillows and blankets', 4), line('dust-living', 'Dust the living room', 7), line('vacuum-living', 'Vacuum the living room', 10)],
  2: [lib('put-toys-away'), lib('put-clothes-away'), lib('clean-my-floor'), line('sheets', 'Change my bed sheets', 9)],
  3: [line('shoes', 'Put my shoes and coat away', 2), line('sink', 'Wipe the bathroom sink', 6), line('bath-trash', 'Empty the bathroom trash', 7), line('bathroom', 'Clean the bathroom', 12)],
  4: [line('my-dishes', 'Bring my dishes to the sink', 2), lib('wipe-the-counters'), line('sweep-kitchen', 'Sweep the kitchen floor', 8), line('fridge', 'Clean out the fridge', 12)],
  5: [line('sock-dust', 'Help dust with a sock', 2), line('dust-room', 'Dust my room', 5), line('switches', 'Wipe light switches and doorknobs', 7), line('vacuum-room', 'Vacuum my room', 9)],
  6: [line('project', 'Help with our home project', 2)],
  0: [lib('put-toys-away'), line('catch-up', 'Finish any jobs I missed this week', 5)],
};
/** Family jobs siblings can take turns with, and who can do them. */
export const SHARED_CHORES: readonly ChoreDef[] = [lib('clear-the-table'), lib('take-out-the-trash'), line('feed-pets', 'Feed the pets', 4)];
/** The weekday each weekly row sits on, Monday first, with the calendar's zone for it. */
export const WEEK: readonly { day: number; label: string; zone: string; icon: string }[] = [
  ...weeklySchedule.map((d) => ({ day: d.day, label: d.dayLabel, zone: d.zone, icon: d.icon })),
  ...weekend.days.filter((d) => d.day !== 0).map((d) => ({ day: d.day, label: d.dayLabel, zone: d.zone, icon: weekend.icon })),
  ...weekend.days.filter((d) => d.day === 0).map((d) => ({ day: d.day, label: d.dayLabel, zone: d.zone, icon: dailyEssentials.icon })),
];
/** Pictures for jobs without a library illustration: the calendar's own zone icons (src/data/cleaning.ts). */
const KITCHEN_ICON = weeklySchedule.find((d) => d.zone.startsWith('Kitchen'))?.icon ?? dailyEssentials.icon;
const LINE_ICONS: Record<string, string> = { dishwasher: KITCHEN_ICON, 'help-dinner': KITCHEN_ICON, 'kitchen-cleanup': KITCHEN_ICON, 'feed-pets': dailyEssentials.icon };

export interface ChoreMember { id: string; firstName: string; kind: string; birthYear?: number; birthMonth?: number; archived?: boolean }
export interface Job { id: string; title: string; level?: Level; lib?: string }
export interface KidPlan {
  daily?: Job[];
  /** By weekday number (0–6); null = no job that day. */
  weekly?: Record<string, Job | null>;
  rewards?: [string, string, string];
}
export interface ChoreState {
  palette: ToolPaletteId;
  rewards: boolean;
  kids: Record<string, KidPlan>;
  /** Shared job id → who takes turns (member IDs, in order); a missing entry is the prepared turns. */
  turns: Record<string, string[] | null>;
}

export const kidsOf = <M extends ChoreMember>(members: readonly M[]) => members.filter((m) => m.kind === 'child' && !m.archived && m.firstName.trim());
/** Age in March 2027, at least 2; 8 when no birth year is saved. */
export const ageOf = (m: ChoreMember) => (m.birthYear ? Math.max(2, ageInMonth(m.birthYear, m.birthMonth, KIT_MONTH)) : 8);
/** How well a child this age usually manages a job: a starting point Mom can change. */
export const suggestedLevel = (age: number, minAge: number): Level => (age - minAge < 1 ? 'learning' : age - minAge < 3 ? 'with-check' : 'owns');
const toJob = (d: ChoreDef, age: number): Job => ({ id: d.id, title: d.title, lib: d.lib, level: suggestedLevel(age, d.minAge) });

export const freshState = (): ChoreState => ({ palette: defaultToolPalette, rewards: true, kids: {}, turns: {} });

/** Who takes turns with a shared job: every child old enough, when at least two are; Mom's choice otherwise. */
export const turnsFor = (s: ChoreState, jobId: string, members: readonly ChoreMember[], pets: boolean) => {
  if (jobId === 'feed-pets' && !pets) return [];
  const def = SHARED_CHORES.find((d) => d.id === jobId);
  if (!def) return [];
  const kids = kidsOf(members);
  const chosen = s.turns[jobId];
  if (chosen === null) return [];
  if (chosen) return chosen.filter((id) => kids.some((k) => k.id === id));
  const able = kids.filter((k) => ageOf(k) >= def.minAge).map((k) => k.id);
  return able.length >= 2 ? able : [];
};
const sharedTaken = (s: ChoreState, members: readonly ChoreMember[], pets: boolean) =>
  new Set(SHARED_CHORES.filter((d) => turnsFor(s, d.id, members, pets).length >= 2).map((d) => d.id));

export const preparedDaily = (age: number, pets: boolean, taken: Set<string>): Job[] => {
  const count = age <= 3 ? 2 : age <= 5 ? 3 : age <= 8 ? 4 : 5;
  const able = DAILY_CHORES.filter((d) => d.minAge <= age && !taken.has(d.id) && (d.id !== 'feed-pets' || pets) && !(age >= 9 && d.id === 'put-toys-away'))
    // Pets first when there are pets (a daily job kids notice); from 12, the bigger kitchen jobs before the small ones.
    .sort((a, b) => Number(b.id === 'feed-pets') - Number(a.id === 'feed-pets')
      || (age >= 12 ? Number(b.id === 'make-my-bed') - Number(a.id === 'make-my-bed') || b.minAge - a.minAge : 0));
  return able.slice(0, count).map((d) => toJob(d, age));
};
/** The hardest job in each day's zone that suits the child. */
export const preparedWeekly = (age: number): Record<string, Job | null> =>
  Object.fromEntries(WEEK.map((w) => {
    const able = ZONE_CHORES[w.day].filter((d) => d.minAge <= age);
    const pick = able.at(-1) ?? ZONE_CHORES[w.day][0];
    return [String(w.day), toJob(pick, age)];
  }));
export const preparedRewards = (age: number): [string, string, string] => [...choreSets[ageGroupFor(age)].rewards];

export const kidChart = (s: ChoreState, kid: ChoreMember, members: readonly ChoreMember[], pets: boolean) => {
  const age = ageOf(kid);
  const k = s.kids[kid.id] ?? {};
  const taken = sharedTaken(s, members, pets);
  return {
    daily: k.daily ?? preparedDaily(age, pets, taken),
    weekly: k.weekly ?? preparedWeekly(age),
    rewards: k.rewards ?? preparedRewards(age),
  };
};

const imageFor = (j: Job, zoneIcon?: string) => {
  const r = j.lib ? responsibilityById(j.lib) : undefined;
  if (r) return { src: responsibilityImage(r, 128), color: responsibilityColor(r), zone: false };
  const icon = LINE_ICONS[j.id] ?? zoneIcon;
  return icon ? { src: icon, color: '', zone: true } : null;
};
const weeksText = (n: number, i: number) => {
  const weeks = [1, 2, 3, 4, 5].filter((w) => (w - 1) % n === i);
  return `${weeks.length === 1 ? 'week' : 'weeks'} ${weeks.join(', ').replace(/, (\d)$/, ' & $1')}`;
};

export const choreView = (s: ChoreState, members: readonly ChoreMember[], pets = false) => {
  const kids = kidsOf(members);
  const shared = SHARED_CHORES.map((d) => ({ def: d, who: turnsFor(s, d.id, members, pets) })).filter((x) => x.who.length >= 2);
  const sharedOptions = SHARED_CHORES.filter((d) => d.id !== 'feed-pets' || pets).map((d) => ({
    id: d.id, title: d.title, who: turnsFor(s, d.id, members, pets), able: kids.filter((k) => ageOf(k) >= d.minAge).map((k) => ({ id: k.id, name: k.firstName })),
  }));
  return {
    palette: s.palette,
    rewards: s.rewards,
    sharedOptions,
    charts: kids.map((kid) => {
      const age = ageOf(kid);
      const c = kidChart(s, kid, members, pets);
      const lvl = (j: Job, minAge: number) => j.level ?? suggestedLevel(age, minAge);
      const minOf = (id: string) => [...DAILY_CHORES, ...Object.values(ZONE_CHORES).flat(), ...SHARED_CHORES].find((d) => d.id === id)?.minAge ?? 0;
      return {
        id: kid.id,
        name: kid.firstName,
        age,
        changed: Boolean(s.kids[kid.id]),
        daily: c.daily.map((j) => ({ ...j, level: lvl(j, minOf(j.id)), image: imageFor(j) })),
        weekly: WEEK.map((w) => {
          const j = c.weekly[String(w.day)] ?? null;
          return { day: w.day, label: w.label, zone: w.zone, job: j ? { ...j, level: lvl(j, minOf(j.id)), image: imageFor(j, w.icon) } : null };
        }),
        turns: shared.filter((x) => x.who.includes(kid.id)).map((x) => ({
          id: x.def.id,
          title: x.def.title,
          image: imageFor({ id: x.def.id, title: x.def.title, lib: x.def.lib }),
          line: x.who.map((id, i) => `${kids.find((k) => k.id === id)?.firstName}: ${weeksText(x.who.length, i)}`).join(' · '),
        })),
        rewardLines: c.rewards,
      };
    }),
  };
};
export type ChoreView = ReturnType<typeof choreView>;
export type ChartView = ChoreView['charts'][number];

export const choreFingerprint = (s: ChoreState, members: readonly ChoreMember[], pets = false) => {
  const v = choreView(s, members, pets);
  return JSON.stringify([v.palette, v.rewards, v.charts.map((c) => [c.name, c.daily.map((j) => [j.title, j.level]), c.weekly.map((w) => w.job && [w.job.title, w.job.level]), c.turns.map((t) => t.line), v.rewards && c.rewardLines])]);
};

// Edits. Each changes `s` in place and returns it.
const own = (s: ChoreState, kidId: string, members: readonly ChoreMember[], pets: boolean): Required<KidPlan> | null => {
  const kid = kidsOf(members).find((k) => k.id === kidId);
  if (!kid) return null;
  const c = kidChart(s, kid, members, pets);
  const k = (s.kids[kidId] = { daily: structuredClone(c.daily), weekly: structuredClone(c.weekly), rewards: [...c.rewards] as [string, string, string] });
  return k;
};
export const setDailyLevel = (s: ChoreState, kidId: string, i: number, level: Level, members: readonly ChoreMember[], pets = false) => {
  const k = own(s, kidId, members, pets);
  if (k?.daily[i] && LEVELS.includes(level)) k.daily[i].level = level;
  return s;
};
export const setWeeklyLevel = (s: ChoreState, kidId: string, day: number, level: Level, members: readonly ChoreMember[], pets = false) => {
  const k = own(s, kidId, members, pets);
  const j = k?.weekly[String(day)];
  if (j && LEVELS.includes(level)) j.level = level;
  return s;
};
export const removeDaily = (s: ChoreState, kidId: string, i: number, members: readonly ChoreMember[], pets = false) => {
  const k = own(s, kidId, members, pets);
  if (k && i >= 0 && i < k.daily.length) k.daily.splice(i, 1);
  return s;
};
/** Add a library or listed job, or a typed one (`title` without a known `id`). */
export const addDaily = (s: ChoreState, kidId: string, id: string, members: readonly ChoreMember[], pets = false, title?: string) => {
  const k = own(s, kidId, members, pets);
  const kid = kidsOf(members).find((m) => m.id === kidId);
  if (!k || !kid || k.daily.length >= DAILY_MAX) return s;
  const def = DAILY_CHORES.find((d) => d.id === id);
  if (def) { if (!k.daily.some((j) => j.id === id)) k.daily.push(toJob(def, ageOf(kid))); return s; }
  const clean = (title ?? '').replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
  if (clean) k.daily.push({ id, title: clean, level: 'learning' });
  return s;
};
export const renameJob = (s: ChoreState, kidId: string, where: { daily: number } | { day: number }, title: string, members: readonly ChoreMember[], pets = false) => {
  const k = own(s, kidId, members, pets);
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
  if (!k || !clean) return s;
  const j = 'daily' in where ? k.daily[where.daily] : k.weekly[String(where.day)];
  if (j) { j.title = clean; if (j.lib && responsibilityById(j.lib)?.title !== clean) delete j.lib; }
  return s;
};
/** Choose a weekday's job from that day's zone list, or none. */
export const setWeekly = (s: ChoreState, kidId: string, day: number, id: string | null, members: readonly ChoreMember[], pets = false) => {
  const k = own(s, kidId, members, pets);
  const kid = kidsOf(members).find((m) => m.id === kidId);
  if (!k || !kid || !(day in ZONE_CHORES)) return s;
  const def = id ? ZONE_CHORES[day].find((d) => d.id === id) : null;
  if (id && !def) return s;
  k.weekly[String(day)] = def ? toJob(def, ageOf(kid)) : null;
  return s;
};
export const setReward = (s: ChoreState, kidId: string, i: number, text: string, members: readonly ChoreMember[], pets = false) => {
  const k = own(s, kidId, members, pets);
  if (k && i >= 0 && i < 3) k.rewards[i] = text.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
  return s;
};
export const setRewards = (s: ChoreState, on: boolean) => { s.rewards = on; return s; };
export const setPalette = (s: ChoreState, id: string) => { s.palette = resolveToolPalette(id); return s; };
/** Take a child in or out of a shared job's turns; fewer than two turns it off. */
export const toggleTurn = (s: ChoreState, jobId: string, kidId: string, members: readonly ChoreMember[], pets = false) => {
  const def = SHARED_CHORES.find((d) => d.id === jobId);
  const kid = kidsOf(members).find((k) => k.id === kidId);
  if (!def || !kid || ageOf(kid) < def.minAge) return s;
  const now = turnsFor(s, jobId, members, pets);
  const next = now.includes(kidId) ? now.filter((id) => id !== kidId) : kidsOf(members).map((k) => k.id).filter((id) => id === kidId || now.includes(id));
  s.turns[jobId] = next.length ? next : null;
  return s;
};
export const restoreKid = (s: ChoreState, kidId: string) => { delete s.kids[kidId]; return s; };
export const restoreAll = (s: ChoreState) => Object.assign(s, freshState());
export const planChanged = (s: ChoreState) => JSON.stringify(s) !== JSON.stringify(freshState());

/** Keep the plan to this family: charts and turns only for children who are here. */
export const applyFamily = (s: ChoreState, members: readonly ChoreMember[]) => {
  const ids = new Set(kidsOf(members).map((k) => k.id));
  for (const id of Object.keys(s.kids)) if (!ids.has(id)) delete s.kids[id];
  for (const [job, who] of Object.entries(s.turns)) if (who) s.turns[job] = who.filter((id) => ids.has(id));
  s.palette = resolveToolPalette(s.palette);
  return s;
};

const isJob = (x: unknown): x is Job => {
  const j = x as Partial<Job> | null;
  return Boolean(j && typeof j.id === 'string' && typeof j.title === 'string' && (j.level === undefined || LEVELS.includes(j.level)));
};
export const isChoreState = (x: unknown): x is ChoreState => {
  const s = x as Partial<ChoreState> | null;
  return Boolean(s && typeof s.palette === 'string' && typeof s.rewards === 'boolean' && s.kids && typeof s.kids === 'object' && s.turns && typeof s.turns === 'object'
    && Object.values(s.kids).every((k) => (!k.daily || (Array.isArray(k.daily) && k.daily.every(isJob))) && (!k.weekly || Object.values(k.weekly).every((j) => j === null || isJob(j)))));
};

export interface ChorePlan extends PlanResource<ChoreState> {
  members: () => ChoreMember[];
  pets: () => boolean;
  view: () => ChoreView;
  setLocked: (on: boolean) => void;
  openEditor: (kidId?: string) => void;
}
