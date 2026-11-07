/**
 * May 2027, Our Summer Day: the rules behind the one-page rhythm (src/components/club/MaySummerRhythm.astro). Pure
 * functions only, so the printable, the desktop rail and the mobile plan screen (MayPlanMobile.astro) read one plan.
 * Built on the shared personalization foundation (../personalize/, docs/club/PERSONALIZATION_FOUNDATION.md).
 *
 * A reusable day of anchors, not an hourly schedule: Morning Start, Move & Play, Lunch & Reset, Quiet Time, a
 * flexible afternoon, Snack & Reset and Evening Reset (Create & Explore on camp days), with suggested times she can
 * turn off. Prepared from the family:
 * - Quiet time by the children's ages (rest for under-fives, an independent recharge when everyone is 12 or older).
 * - Independent activities from the children's interests (the sports, lessons and clubs on her family page, by name).
 * - Shared family responsibilities on the anchors they belong to (beds, lunch, the table, snack cleanup, dinner,
 *   the dishes, pets), each child's own jobs by age and the shared ones spread out, grown-ups' too; the account
 *   holder is never the default. She can change who, the wording, or leave one off.
 * Saved means settled: the profile snapshot used is kept with the plan.
 */
import type { PlanResource } from '../plan/resource';
import { activitiesOf, familyContext, isFamilySnapshot, type ContextMember, type FamilyContext, type FamilySnapshot } from '../personalize/family';
import { assignTasks, type PlanTask } from '../personalize/assign';
import { isTaskEdits, pruneTaskEdits, withEdits, type PlannedTask, type TaskEdits } from '../personalize/edits';

export const KIT_MONTH = '2027-05';
export type MayKey = 'morning' | 'move' | 'create' | 'lunch' | 'quiet' | 'free' | 'snack' | 'evening';
export const MAY_KEYS: readonly MayKey[] = ['morning', 'move', 'create', 'lunch', 'quiet', 'free', 'snack', 'evening'];
export type MayEdit = { title?: string; desc?: string; time?: string };
export interface MayOptions {
  start: number;
  quiet: 'independent' | 'rest' | 'older';
  play: 'outdoors' | 'active' | 'creative' | 'mixed';
  structure: 'relaxed' | 'balanced' | 'structured';
  days: 'home' | 'mixed' | 'camp';
  snack: boolean;
}
export const TITLE_LIMIT = 38;
export const DESC_LIMIT = 78;
export const START_TIMES = [7, 7.5, 8, 8.5, 9, 9.5] as const;
export const DEFAULT_OPTIONS: MayOptions = { start: 8, quiet: 'independent', play: 'outdoors', structure: 'balanced', days: 'home', snack: true };
export const LABELS: Record<MayKey, string> = { morning: 'Morning Start', move: 'Move & Play', create: 'Create & Explore', lunch: 'Lunch & Reset', quiet: 'Quiet Time', free: 'Flexible Afternoon', snack: 'Snack & Reset', evening: 'Evening Reset' };
export const BASE_DESC: Record<MayKey, string> = {
  morning: 'Breakfast · Get dressed · Make beds',
  move: 'Outside · Bikes · Park · Backyard',
  create: 'Read · Build · Draw · Make',
  lunch: 'Eat · Clear dishes · Tidy up',
  quiet: 'Read · Puzzles · Quiet play',
  free: 'Friends · Park · Outing · Home play',
  snack: 'Have a snack · Put things away · Reset your space',
  evening: 'Pick up · Wash up · Wind down',
};
/** The anchor's own color before it's timed (the printable tints timed rows by the time of day). */
export const TINTS: Record<MayKey, string> = { morning: '#F8E8B5', move: '#F4DEA3', create: '#F0D493', lunch: '#DDEBDB', quiet: '#D1E5D6', free: '#C3DDCF', snack: '#E4E9D5', evening: '#D1D7EA' };

export interface MayMember extends ContextMember { kind: 'adult' | 'child' }
export interface MayRow { key: MayKey; title: string; desc: string; time: string; parts: PlannedTask[] }
export interface MayState {
  options: MayOptions;
  edits: Partial<Record<MayKey, MayEdit>>;
  order: MayKey[];
  removed: MayKey[];
  /** What prints, in order (derived; kept in the state for the plan screen). */
  rows: MayRow[];
  familyLabel: string;
  /** Her changes to who does the family jobs, by part id. */
  parts?: TaskEdits;
  /** The profile answers the rhythm was prepared from (saved means settled). */
  snapshot?: FamilySnapshot;
}

const hhmm = (n: number) => { const v = (n + 24) % 24; const h = Math.floor(v); const m = Math.round((v - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
export const clock = (time: string) => {
  if (!time) return 'Evening';
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? ' AM' : ' PM'}`;
};
export const startClock = (start: number) => clock(hhmm(start));

export const mayContext = (members: readonly MayMember[], prefs: { pets?: boolean } | undefined, snapshot?: FamilySnapshot): FamilyContext =>
  familyContext(members, prefs, KIT_MONTH, snapshot);

const ages = (ctx: FamilyContext) => ctx.children.map((c) => c.age).filter((a): a is number => a !== null);

/** Interests from her family page: the children's sports, lessons and clubs, by name. */
export function interestsOf(ctx: FamilyContext) {
  const of = (cat: string) => [...new Set(ctx.children.flatMap((c) => activitiesOf(ctx, c.id, cat).map((a) => a.name?.trim()).filter((n): n is string => Boolean(n))))];
  return { sports: of('sports'), lessons: of('lessons'), clubs: of('clubs'), any: ctx.children.some((c) => ['sports', 'lessons', 'clubs'].some((cat) => activitiesOf(ctx, c.id, cat).length)) };
}

/** The prepared day for this family: quiet time by ages, play by interests. */
export function familyDefaults(ctx: FamilyContext): MayOptions {
  const a = ages(ctx);
  const quiet: MayOptions['quiet'] = a.length && Math.min(...a) < 5 ? 'rest' : a.length && Math.min(...a) > 11 ? 'older' : 'independent';
  const i = interestsOf(ctx);
  const sporty = i.sports.length > 0, making = i.lessons.length + i.clubs.length > 0;
  const play: MayOptions['play'] = sporty && making ? 'mixed' : sporty ? 'active' : making ? 'creative' : 'outdoors';
  return { ...DEFAULT_OPTIONS, quiet, play };
}

const join = (xs: string[]) => xs.filter(Boolean).join(' · ');
const fit = (desc: string) => {
  if (desc.length <= DESC_LIMIT) return desc;
  const parts = desc.split(' · ');
  while (parts.length > 2 && parts.join(' · ').length > DESC_LIMIT) parts.pop();
  return parts.join(' · ').slice(0, DESC_LIMIT);
};

/** An anchor as prepared for the options and the family (her edits go on top). */
export function starter(key: MayKey, o: MayOptions, ctx?: FamilyContext): Required<MayEdit> {
  let title = LABELS[key], desc = BASE_DESC[key];
  const idx = MAY_KEYS.indexOf(key);
  let time = key === 'evening' ? '' : hhmm(o.start + [0, 1, 2.5, 4, 5, 6, 8, 10][idx]);
  const i = ctx ? interestsOf(ctx) : { sports: [], lessons: [], clubs: [], any: false };
  const kids = ctx?.children ?? [];
  const young = kids.filter((c) => c.age !== null && c.age < 5);
  const older = kids.filter((c) => c.age === null || c.age >= 5);
  if (o.days === 'camp') {
    const names: Partial<Record<MayKey, [string, string]>> = {
      move: ['Pack & Head Out', 'Pack bag · Water bottle · Shoes'],
      create: ['Camp or Program', 'Play · Learn · Explore · Friends'],
      lunch: ['Lunch & Reset', 'Lunch · Pack things · Tidy up'],
      quiet: ['Recharge', 'Snack · Quiet time · Rest'],
      free: ['Free Time', 'Friends · Outside · Home play'],
      snack: ['Home & Snack', 'Have a snack · Unpack · Reset your space'],
    };
    if (names[key]) [title, desc] = names[key]!;
    time = key === 'evening' ? '' : hhmm(o.start + [0, 0.5, 1, 4, 7.5, 8.5, 9, 10][idx]);
  } else {
    if (o.days === 'mixed') {
      const mixed: Partial<Record<MayKey, [string, string]>> = { move: ['Home Play or Outing', 'Outside · Park · Friends · Home play'], create: ['Choose & Explore', 'Read · Build · Draw · Make'], free: ['Flexible Afternoon', 'Friends · Park · Outing · Home play'] };
      if (mixed[key]) [title, desc] = mixed[key]!;
    }
    if (key === 'quiet') {
      desc = o.quiet === 'rest' ? 'Nap · Rest · Quiet books' : o.quiet === 'older' ? 'Read · Recharge · Independent time' : 'Read · Puzzles · Quiet play';
      // Mixed ages: the little ones rest while the older ones choose a quiet activity of their own.
      if (o.quiet === 'rest' && young.length && older.length) desc = `${young.map((c) => c.name).join(' & ')} ${young.length > 1 ? 'rest' : 'rests'} · Books, puzzles, quiet play`;
    }
    if (key === 'move') {
      desc = o.play === 'active' ? 'Ball games · Movement · Outdoors' : o.play === 'creative' ? 'Explore · Move · Make something' : o.play === 'mixed' ? 'Get moving · Choose how to play' : BASE_DESC.move;
      if (i.sports.length) desc = join(['Outside', ...i.sports.slice(0, 2).map((s) => `${s} practice`), 'Bikes']);
    }
    if (key === 'create' && (i.lessons.length || i.clubs.length)) desc = join(['Read · Build', ...i.lessons.slice(0, 1).map((s) => `${s} practice`), ...i.clubs.slice(0, 1).map((s) => `${s} project`), 'Draw']);
    if (key === 'free' && o.days === 'home') desc = o.play === 'creative' ? 'Art · Make · Friends · Home play' : o.play === 'active' ? 'Friends · Sports · Park · Home play' : BASE_DESC.free;
    // Free time leans on what they already love doing.
    if (key === 'free' && (i.lessons.length || i.clubs.length) && o.days !== 'mixed') desc = join(['Friends', ...i.lessons.slice(0, 1).map((s) => `${s} for fun`), 'Park', 'Home play']);
  }
  return { title, desc: fit(desc), time };
}

/** Which anchors show: Snack & Reset is optional; relaxed days drop the activity blocks; camp days swap lunch and quiet for the program. */
export const visibleKeys = (order: readonly MayKey[], o: MayOptions) =>
  order.filter((k) => (o.snack || k !== 'snack') && (o.structure !== 'relaxed' || (k !== 'create' && k !== 'move')) && (o.days === 'camp' ? k !== 'lunch' && k !== 'quiet' : k !== 'create'));

// ------------------------------------------------------------------ shared family responsibilities

export type MayPart = PlanTask & { block: MayKey };
/** The family jobs that belong to the day's anchors. Children's own jobs are 'each'; the shared ones one owner each. */
export const MAY_PARTS: readonly MayPart[] = [
  { block: 'morning', id: 'beds', title: 'Make my bed', mode: 'each', who: 'child', minAge: 4, wishes: ['tidy-room'] },
  { block: 'morning', id: 'pets', title: 'Feed the pets', mode: 'one', who: 'child', minAge: 4, areas: ['pet-care'], wishes: ['pet-care'] },
  { block: 'morning', id: 'breakfast', title: 'Breakfast', mode: 'one', who: 'any', minAge: 12, prefer: 'adult', areas: ['meals'] },
  { block: 'lunch', id: 'make-lunch', title: 'Make lunch', mode: 'one', who: 'any', minAge: 11, areas: ['meals'], wishes: ['help-with-meals'] },
  { block: 'lunch', id: 'set-table', title: 'Set the table', mode: 'one', who: 'child', minAge: 4, wishes: ['help-with-meals'] },
  { block: 'lunch', id: 'clear', title: 'Clear the dishes', mode: 'one', who: 'child', minAge: 4, wishes: ['help-with-meals'] },
  { block: 'snack', id: 'snack-away', title: 'Put my snack things away', mode: 'each', who: 'child', minAge: 3 },
  { block: 'evening', id: 'dinner', title: 'Make dinner', mode: 'one', who: 'any', minAge: 14, prefer: 'adult', areas: ['meals'] },
  { block: 'evening', id: 'dishes', title: 'Do the dishes', mode: 'one', who: 'any', minAge: 12, prefer: 'adult', areas: ['meals', 'cleaning'] },
  { block: 'evening', id: 'pickup', title: 'Pick up my things', mode: 'each', who: 'child', minAge: 2, wishes: ['tidy-room'] },
];
export const partRules = Object.fromEntries(MAY_PARTS.map((p) => [p.id, { who: p.who, minAge: p.minAge, maxAge: p.maxAge }]));
const PART_BLOCK = new Map(MAY_PARTS.map((p) => [p.id, p.block]));

/** Every prepared family job with her changes, in order. Jobs nobody can do yet (or pets without pets) aren't listed. */
export function mayParts(ctx: FamilyContext, edits?: TaskEdits): (PlannedTask & { block: MayKey })[] {
  const tasks = MAY_PARTS.filter((p) => p.id !== 'pets' || ctx.pets);
  const prepared = assignTasks(tasks, ctx, { seed: 'may' }).filter((a) => a.ownerIds.length);
  return withEdits(prepared, edits, ctx).map((t) => ({ ...t, block: PART_BLOCK.get(t.id)! }));
}

/** What prints, in order, with each anchor's family jobs. */
export function mayRows(s: Pick<MayState, 'options' | 'edits' | 'order' | 'parts'>, ctx?: FamilyContext): MayRow[] {
  const parts = ctx ? mayParts(ctx, s.parts) : [];
  return visibleKeys(s.order, s.options).map((key) => ({
    key, ...starter(key, s.options, ctx), ...(s.edits[key] ?? {}),
    parts: parts.filter((p) => p.block === key && !p.skipped),
  }));
}

/** Everything that prints, as a stable string: what approval is checked against. */
export const mayFingerprint = (s: Pick<MayState, 'options' | 'edits' | 'order' | 'parts' | 'familyLabel'>, ctx?: FamilyContext) =>
  JSON.stringify({ familyLabel: s.familyLabel, days: s.options.days, structure: s.options.structure, rows: mayRows(s, ctx).map((r) => ({ key: r.key, title: r.title, desc: r.desc, time: r.time, parts: r.parts.map((p) => [p.label, p.who]) })) });

/** Her saved plan's parts and snapshot, checked; anything malformed is dropped. */
export function readSaved(stored: { parts?: unknown; snapshot?: unknown }): Pick<MayState, 'parts' | 'snapshot'> {
  return {
    ...(isTaskEdits(stored.parts) ? { parts: stored.parts } : {}),
    ...(isFamilySnapshot(stored.snapshot) ? { snapshot: stored.snapshot } : {}),
  };
}
export const keepToFamily = (parts: TaskEdits | undefined, ctx: FamilyContext) => (parts ? pruneTaskEdits(parts, ctx) : parts);

export interface MayPlan extends PlanResource<MayState> {
  /** Past the editing cutoff: the sheet stops taking edits and the editor stays closed. */
  setLocked: (on: boolean) => void;
  /** The desktop editor for the day. */
  openEditor: () => void;
  /** The family for the shared owner editor (names, ages). */
  context: () => FamilyContext | null;
}
