/**
 * August 2027, Back to School Without the Scramble: the rules behind the printable
 * (src/components/club/AugustSchoolRoutines.astro). Pure functions only, so the printable, the desktop rail and the
 * mobile plan screen (AugustPlanMobile.astro) read one plan. Built on the shared personalization foundation
 * (../personalize/, docs/club/PERSONALIZATION_FOUNDATION.md).
 *
 * Two kinds of sheet:
 * - The family plan (first page): who does what before the first day, the night before, on school mornings and
 *   after school, prepared from the family: each child's own jobs by age, the grown-up jobs shared between the
 *   grown-ups (whoever already drives or makes meals keeps it; the account holder is never the default), and the
 *   time to be out the door from the school start she gave. She can change who, the wording, or leave a job off.
 * - "My School Day" for every school-aged child (3 to 18 in August 2027): two picture routines (before school, after
 *   school) of timed steps, prepared for their age and timed back from their school start. Steps can be renamed,
 *   retimed, reordered, removed (and restored) or added from a short list. With no school-aged child, the family
 *   routine sheet alone, as before.
 * Children are by member ID. Saved means settled: the profile snapshot used is kept with the plan.
 */
import { ageInMonth } from '../profile';
import type { PlanResource } from '../plan/resource';
import { familyContext, isFamilySnapshot, schoolStartFor, type ContextMember, type FamilyContext, type FamilySnapshot } from '../personalize/family';
import { assignTasks, type PlanTask } from '../personalize/assign';
import { isTaskEdits, pruneTaskEdits, withEdits, type PlannedTask, type TaskEdits } from '../personalize/edits';

export const KIT_MONTH = '2027-08';
export type Group = 'morning' | 'after';
export const GROUPS: readonly Group[] = ['morning', 'after'];
export const GROUP_INFO: Record<Group, { title: string; tab: string }> = { morning: { title: 'Before School', tab: 'Before school' }, after: { title: 'After School', tab: 'After school' } };
export const LABEL_LIMIT = 55;
export const FOOTER_LIMIT = 120;
export const DEFAULT_FOOTER = "Check my routine. Do my part. Then I'm ready!";
/** Shorter routine: hides these without deleting them. */
export const SHORTER_HIDES: Record<Group, string> = { morning: 'wake', after: 'wash' };

export const ICONS: Record<string, string> = {
  lunch: '/images/club/icon-library/lunch-box.png', water: '/images/club/icon-library/water-bottle.png',
  quiet: '/images/club/icon-library/quiet-time.png', play: '/images/club/icon-library/free-afternoon.png',
  wake: '/images/club/icon-library/morning-start.png', clothes: '/images/club/icon-library/getting-dressed.png',
  breakfast: '/images/club/icon-library/breakfast-bowl.png', teeth: '/images/club/icon-library/toothbrush.png',
  bag: '/images/club/icon-library/backpack.png', shoes: '/images/club/icon-library/sneakers.png',
  hands: '/images/club/icon-library/washing-hands.png', snack: '/images/club/icon-library/yogurt-cup.png',
  book: '/images/club/icon-library/doing-homework.png',
};

export interface Step { id: string; time: string; label: string; icon: string; group: Group; removed?: boolean }
const SEEDS: readonly Step[] = [
  { id: 'wake', time: '07:00', label: 'Wake up & stretch', icon: 'wake', group: 'morning' },
  { id: 'dress', time: '07:15', label: 'Get dressed', icon: 'clothes', group: 'morning' },
  { id: 'eat', time: '07:25', label: 'Eat breakfast', icon: 'breakfast', group: 'morning' },
  { id: 'teeth', time: '07:45', label: 'Brush teeth', icon: 'teeth', group: 'morning' },
  { id: 'lunch', time: '07:48', label: 'Grab My Lunch Box', icon: 'lunch', group: 'morning' },
  { id: 'water', time: '07:49', label: 'Grab My Water Bottle', icon: 'water', group: 'morning' },
  { id: 'backpack', time: '07:50', label: 'Grab backpack & shoes', icon: 'bag', group: 'morning' },
  { id: 'shoes', time: '15:30', label: 'Shoes & coat away', icon: 'shoes', group: 'after' },
  { id: 'unpack', time: '15:35', label: 'Unpack backpack & lunch box', icon: 'bag', group: 'after' },
  { id: 'wash', time: '15:40', label: 'Wash hands', icon: 'hands', group: 'after' },
  { id: 'snack', time: '15:45', label: 'Snack', icon: 'snack', group: 'after' },
  { id: 'homework', time: '16:00', label: 'Homework & reading', icon: 'book', group: 'after' },
];
/** Steps she can add, a short list for each routine. */
export const CHOICES: Record<Group, readonly { id: string; label: string; icon: string }[]> = {
  morning: [
    { id: 'lunch', label: 'Grab My Lunch Box', icon: 'lunch' }, { id: 'pack-lunch', label: 'Pack My Lunch', icon: 'lunch' },
    { id: 'stow-lunch', label: 'Put Lunch Box in Backpack', icon: 'lunch' }, { id: 'water', label: 'Grab My Water Bottle', icon: 'water' },
    { id: 'fill-water', label: 'Fill My Water Bottle', icon: 'water' }, { id: 'stow-water', label: 'Put Water Bottle in Backpack', icon: 'water' },
    { id: 'read-early', label: 'Ready Early? Read or Draw.', icon: 'book' },
  ],
  after: [
    { id: 'put-backpack', label: 'Put My Backpack Away', icon: 'bag' }, { id: 'snack', label: 'Have a Snack', icon: 'snack' },
    { id: 'quiet', label: 'Quiet Time', icon: 'quiet' }, { id: 'free', label: 'Free Time', icon: 'play' },
    { id: 'homework', label: 'Homework', icon: 'book' }, { id: 'snack-free', label: 'Snack & Free Time', icon: 'snack' },
  ],
};
const LUNCH = ['lunch', 'pack-lunch', 'stow-lunch'];
const WATER = ['water', 'fill-water', 'stow-water'];

export interface Routine { steps: Step[]; mode: 'standard' | 'simple'; footer?: string }
export interface AugState {
  /** The routine the editor is showing (every school-aged child's prints). */
  child: string;
  boards: Record<string, Routine>;
  /** Her changes to the family plan (who, wording, left off), by task id. */
  plan?: TaskEdits;
  /** The profile answers the plan was prepared from (saved means settled). */
  profile?: FamilySnapshot;
}
export interface AugMember { id: string; firstName: string; kind: string; role?: string; birthYear?: number; birthMonth?: number; archived?: boolean; isAccountHolder?: boolean }

export const kidsOf = <M extends AugMember>(members: readonly M[]) => members.filter((m) => m.kind === 'child' && !m.archived);
/** Children who go to school or preschool in August 2027 (3 to 18); a child with no age saved counts. */
export const schoolKids = <M extends AugMember>(members: readonly M[]) => kidsOf(members).filter((k) => {
  if (!k.birthYear) return true;
  const age = ageInMonth(k.birthYear, k.birthMonth, KIT_MONTH);
  return age >= 3 && age < 18;
});
/** Age in August 2027, at least 3; the family routine is pitched at 8. */
export const ageFor = (child: string, members: readonly AugMember[]) => {
  const kid = kidsOf(members).find((k) => k.id === child);
  return kid?.birthYear ? Math.max(3, ageInMonth(kid.birthYear, kid.birthMonth, KIT_MONTH)) : 8;
};
/** The prepared out-the-door time, when she hasn't said when school starts. */
export const DEFAULT_LEAVE = '07:50';
/** Out the door this long before school starts. */
export const LEAVE_BEFORE = 20;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
/** When to be out the door for a school that starts at `start`. */
export const leaveFor = (start?: string) => (start && validTime(start) ? hhmm(minutes(start) - LEAVE_BEFORE) : DEFAULT_LEAVE);

/**
 * A child's routine for their age, timed so the morning ends when it's time to leave (`leave`, 'HH:MM'): preschoolers
 * get the shorter routine and picture-book words, older children their own alarm and supplies check.
 */
export const preparedRoutine = (age: number, leave: string = DEFAULT_LEAVE): Routine => {
  const shift = validTime(leave) ? minutes(leave) - minutes(DEFAULT_LEAVE) : 0;
  const steps = SEEDS.map((s) => ({ ...s, time: s.group === 'morning' ? hhmm(minutes(s.time) + shift) : s.time }));
  const set = (id: string, label: string) => { steps.find((s) => s.id === id)!.label = label; };
  if (age <= 5) { set('homework', 'Look at a book'); set('backpack', 'Get my school bag'); }
  if (age >= 11) { set('backpack', 'Check bag & school supplies'); set('homework', 'Homework & study time'); }
  if (age >= 13) set('wake', 'Wake up to my alarm');
  return { steps, mode: age <= 4 ? 'simple' : 'standard' };
};
export const freshState = (members: readonly AugMember[]): AugState => ({ child: schoolKids(members)[0]?.id ?? 'family', boards: {} });
const ctxOf = (s: Pick<AugState, 'profile'>, members: readonly AugMember[]): FamilyContext => familyContext(members as readonly ContextMember[], {}, KIT_MONTH, s.profile);
/** A child's out-the-door time from their school start (her answers); otherwise the family's, or the prepared time. */
export const leaveOf = (s: Pick<AugState, 'profile'>, child: string, members: readonly AugMember[]) => {
  const ctx = ctxOf(s, members);
  const own = schoolStartFor(ctx, child);
  return own ? leaveFor(own) : knownLeave(ctx, members) ?? DEFAULT_LEAVE;
};
/** The earliest out-the-door time among the children whose school start she gave. */
const knownLeave = (ctx: FamilyContext, members: readonly AugMember[]) =>
  schoolKids(members).map((k) => schoolStartFor(ctx, k.id)).filter((t): t is string => Boolean(t)).map(leaveFor).sort()[0];
const boardOf = (s: AugState, child: string, members: readonly AugMember[]) => (s.boards[child] ??= preparedRoutine(ageFor(child, members), child === 'family' ? familyLeave(s, members) : leaveOf(s, child, members)));
export const routineOf = (s: AugState, members: readonly AugMember[]) => boardOf(s, s.child, members);
/** The family is out the door when the earliest school needs them. */
export const familyLeave = (s: Pick<AugState, 'profile'>, members: readonly AugMember[]) => knownLeave(ctxOf(s, members), members) ?? DEFAULT_LEAVE;

// ------------------------------------------------------------------ the family plan

export type PlanSection = 'before' | 'night' | 'morning' | 'after';
export const PLAN_SECTIONS: readonly { id: PlanSection; title: string; line: string; icon: string }[] = [
  { id: 'before', title: 'Before the First Day', line: 'Get ready together, not at the last minute.', icon: '/images/club/icon-library/backpack.png' },
  { id: 'night', title: 'The Night Before', line: 'Tomorrow starts tonight.', icon: '/images/club/icon-library/lunch-box.png' },
  { id: 'morning', title: 'School Mornings', line: 'Everyone knows their part.', icon: '/images/club/icon-library/morning-start.png' },
  { id: 'after', title: 'After School', line: 'Home, unpack, reset.', icon: '/images/club/icon-library/doing-homework.png' },
];
export type AugTask = PlanTask & { section: PlanSection };
/**
 * The plan's jobs. Children's are their own ('each', at their age); one-owner jobs go to whoever already takes care
 * of the area, a child she wished it for, or the person with the most room. Grown-up jobs teens can share say so.
 */
export const PLAN_TASKS: readonly AugTask[] = [
  { section: 'before', id: 'supplies', title: 'Shop the school supply list', mode: 'one', who: 'any', minAge: 15, prefer: 'adult', areas: ['school-prep'] },
  { section: 'before', id: 'forms', title: 'Fill out and return school forms', mode: 'one', who: 'adult', areas: ['school-prep', 'homework'] },
  { section: 'before', id: 'try-on', title: 'Try on school clothes and shoes', mode: 'each', who: 'child', minAge: 3 },
  { section: 'before', id: 'bag-spot', title: 'Give backpacks a home by the door', mode: 'one', who: 'any', minAge: 7, wishes: ['own-belongings', 'pack-school-bag'], areas: ['belongings'] },
  { section: 'before', id: 'calendar', title: 'Add school dates to the wall calendar', mode: 'one', who: 'any', minAge: 12 },
  { section: 'before', id: 'practice', title: 'Practice the new morning once', mode: 'together', who: 'any' },
  { section: 'night', id: 'pack-bag', title: 'Pack my backpack, set it by the door', mode: 'each', who: 'child', minAge: 5, wishes: ['pack-school-bag'] },
  { section: 'night', id: 'own-lunch', title: 'Pack my own lunch', mode: 'each', who: 'child', minAge: 10 },
  { section: 'night', id: 'lunches', title: 'Pack lunches for the younger kids', mode: 'one', who: 'any', minAge: 14, prefer: 'adult', areas: ['meals'] },
  { section: 'night', id: 'clothes-out', title: 'Lay out tomorrow’s clothes', mode: 'each', who: 'child', minAge: 3, maxAge: 12 },
  { section: 'night', id: 'papers', title: 'Read and sign school papers', mode: 'one', who: 'adult', areas: ['school-prep', 'homework'] },
  { section: 'morning', id: 'routine', title: 'Follow my morning routine', mode: 'each', who: 'child', minAge: 3 },
  { section: 'morning', id: 'breakfast', title: 'Get breakfast on the table', mode: 'one', who: 'any', minAge: 14, prefer: 'adult', areas: ['meals'] },
  { section: 'morning', id: 'dropoff', title: 'School drop-off', mode: 'one', who: 'adult', areas: ['transportation'] },
  { section: 'after', id: 'pickup', title: 'School pickup', mode: 'one', who: 'adult', areas: ['transportation'] },
  { section: 'after', id: 'unpack', title: 'Unpack backpack and lunch box', mode: 'each', who: 'child', minAge: 4 },
  { section: 'after', id: 'homework', title: 'Start homework at the homework spot', mode: 'each', who: 'child', minAge: 6, wishes: ['homework-start'] },
  { section: 'after', id: 'rinse', title: 'Rinse the lunch boxes', mode: 'one', who: 'any', minAge: 8, areas: ['meals'] },
];
const TASK_BY_ID = new Map(PLAN_TASKS.map((t) => [t.id, t]));
export const taskRules = Object.fromEntries(PLAN_TASKS.map((t) => [t.id, { who: t.who, minAge: t.minAge, maxAge: t.maxAge }]));

/** The family plan as prepared, then with her changes. Only school-aged children's jobs; little ones join the practice. */
export function familyPlan(s: AugState, members: readonly AugMember[]) {
  const ctx = ctxOf(s, members);
  const school = new Set(schoolKids(members).map((k) => k.id));
  const people = ctx.people.filter((p) => p.kind === 'adult' || school.has(p.id));
  const planCtx: FamilyContext = { ...ctx, people, children: people.filter((p) => p.kind === 'child') };
  const young = planCtx.children.some((c) => (c.age ?? 6) < 10);
  const older = planCtx.children.some((c) => (c.age ?? 6) >= 10);
  // Lunches: children 10 and up pack their own; someone packs the younger ones'.
  const tasks = PLAN_TASKS.filter((t) => t.id !== 'lunches' || young).map((t) => (t.id === 'lunches' && !older ? { ...t, title: 'Pack school lunches' } : t));
  const prepared = assignTasks(tasks, planCtx, { seed: 'august' });
  // Everyone practices together, little ones too.
  const practice = prepared.find((a) => a.id === 'practice');
  if (practice) practice.ownerIds = ctx.people.map((p) => p.id);
  // A job nobody in the family can do yet (no child old enough to pack their own lunch) isn't printed.
  const planned = withEdits(prepared.filter((a) => a.ownerIds.length), s.plan, ctx);
  const leave = familyLeave(s, members);
  return {
    leave,
    leaveClock: clock(leave),
    // A family with nobody in school yet has no school plan to print.
    active: planCtx.children.length > 0,
    sections: PLAN_SECTIONS.map((sec) => ({ ...sec, tasks: planned.filter((t) => TASK_BY_ID.get(t.id)?.section === sec.id) })),
    ctx,
  };
}
export type AugFamilyPlan = ReturnType<typeof familyPlan>;
export type AugPlannedTask = PlannedTask;

export const applyFamily = (s: AugState, members: readonly AugMember[]) => {
  const ids = new Set(kidsOf(members).map((k) => k.id));
  for (const id of Object.keys(s.boards)) if (id !== 'family' && !ids.has(id)) delete s.boards[id];
  if (s.child !== 'family' && !ids.has(s.child)) s.child = schoolKids(members)[0]?.id ?? 'family';
  if (s.profile && !isFamilySnapshot(s.profile)) delete s.profile;
  if (s.plan) { pruneTaskEdits(s.plan, ctxOf(s, members)); if (!Object.keys(s.plan).length) delete s.plan; }
  routineOf(s, members);
  return s;
};

export const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const clock = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` : t;
};
/** The steps that print, in order. */
export const shown = (r: Routine, g: Group) => r.steps.filter((x) => x.group === g && !x.removed && !(r.mode === 'simple' && x.id === SHORTER_HIDES[g]));

const isStep = (x: unknown): x is Step => {
  const s = x as Partial<Step> | null;
  return Boolean(s && typeof s.id === 'string' && typeof s.time === 'string' && typeof s.label === 'string' && typeof s.icon === 'string' && (s.group === 'morning' || s.group === 'after'));
};
const isRoutine = (x: unknown): x is Routine => {
  const r = x as Partial<Routine> | null;
  return Boolean(r && Array.isArray(r.steps) && r.steps.every(isStep) && (r.mode === 'standard' || r.mode === 'simple') && (r.footer === undefined || typeof r.footer === 'string'));
};
export const isAugState = (x: unknown): x is AugState => {
  const s = x as Partial<AugState> | null;
  return Boolean(s && typeof s.child === 'string' && s.boards && typeof s.boards === 'object' && Object.values(s.boards).every(isRoutine)
    && (s.plan === undefined || isTaskEdits(s.plan)) && (s.profile === undefined || isFamilySnapshot(s.profile)));
};

/** One printed routine: a school-aged child's, or the family's when there's no school-aged child. */
const routineSheet = (s: AugState, child: string, members: readonly AugMember[]) => {
  const r = boardOf(s, child, members);
  const kid = kidsOf(members).find((k) => k.id === child);
  return {
    child,
    name: kid?.firstName ?? 'Our family',
    title: kid ? `${kid.firstName}'s morning & after-school routines` : 'Our morning & after-school routines',
    groups: Object.fromEntries(GROUPS.map((g) => [g, shown(r, g).map((x) => ({ ...x, clock: clock(x.time) }))])) as Record<Group, (Step & { clock: string })[]>,
    footer: r.footer ?? DEFAULT_FOOTER,
  };
};

export const augView = (s: AugState, members: readonly AugMember[]) => {
  const r = routineOf(s, members);
  const kid = kidsOf(members).find((k) => k.id === s.child);
  const school = schoolKids(members);
  const plan = familyPlan(s, members);
  return {
    /** Everything that prints, in order: the family plan (when someone's in school), then each child's routine. */
    plan,
    routines: school.length ? school.map((k) => routineSheet(s, k.id, members)) : [routineSheet(s, 'family', members)],
    child: s.child,
    childName: kid?.firstName ?? 'Our family',
    title: kid ? `${kid.firstName}'s morning & after-school routines` : 'Our morning & after-school routines',
    age: ageFor(s.child, members),
    groups: Object.fromEntries(GROUPS.map((g) => [g, shown(r, g).map((x) => ({ ...x, clock: clock(x.time) }))])) as Record<Group, (Step & { clock: string })[]>,
    footer: r.footer ?? DEFAULT_FOOTER,
    routine: r,
    /** The routines she can edit: every school-aged child, or the family's when there's none. */
    kids: (school.length ? school : []).map((k) => ({ id: k.id, name: k.firstName })),
  };
};
export type AugView = ReturnType<typeof augView>;

export const augFingerprint = (s: AugState, members: readonly AugMember[]) => {
  const v = augView(s, members);
  return JSON.stringify([
    v.plan.active ? [v.plan.leave, v.plan.sections.map((sec) => sec.tasks.filter((t) => !t.skipped).map((t) => [t.label, t.who]))] : null,
    v.routines.map((r) => [r.title, GROUPS.map((g) => r.groups[g].map((x) => [x.icon, x.label, x.time])), r.footer]),
  ]);
};

// Edits on the selected routine. Each changes `s` in place and returns it.

export const setChild = (s: AugState, child: string, members: readonly AugMember[]) => {
  if (child === 'family' || kidsOf(members).some((k) => k.id === child)) s.child = child;
  routineOf(s, members);
  return s;
};
const stepOf = (s: AugState, id: string, members: readonly AugMember[]) => routineOf(s, members).steps.find((x) => x.id === id);
export const setLabel = (s: AugState, id: string, label: string, members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  if (st) st.label = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT) || st.label;
  return s;
};
export const setTime = (s: AugState, id: string, time: string, members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  if (st && validTime(time)) st.time = time;
  return s;
};
export const setRemoved = (s: AugState, id: string, removed: boolean, members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  if (st && removed) st.removed = true;
  else if (st) delete st.removed;
  return s;
};
/** Swap with the next shown step in the same routine, earlier (-1) or later (+1). */
export const move = (s: AugState, id: string, dir: -1 | 1, members: readonly AugMember[]) => {
  const r = routineOf(s, members);
  const st = r.steps.find((x) => x.id === id);
  if (!st) return s;
  const list = shown(r, st.group);
  const near = list[list.indexOf(st) + dir];
  if (near) { const a = r.steps.indexOf(st), b = r.steps.indexOf(near); [r.steps[a], r.steps[b]] = [r.steps[b], r.steps[a]]; }
  return s;
};
/** Add a listed step (only one lunch step and one water step at a time) or bring a removed one back. */
export const addStep = (s: AugState, group: Group, id: string, members: readonly AugMember[]) => {
  const choice = CHOICES[group].find((c) => c.id === id);
  if (!choice) return s;
  const r = routineOf(s, members);
  const family = group === 'morning' ? (LUNCH.includes(id) ? LUNCH : WATER.includes(id) ? WATER : []) : [];
  for (const other of r.steps) if (other.group === group && family.includes(other.id) && other.id !== id) other.removed = true;
  const prior = r.steps.find((x) => x.id === id && x.group === group);
  if (prior) { delete prior.removed; prior.label = choice.label; }
  else r.steps.push({ id, time: r.steps.filter((x) => x.group === group).at(-1)?.time ?? (group === 'morning' ? '07:50' : '16:00'), label: choice.label, icon: choice.icon, group });
  return s;
};
export const addCustom = (s: AugState, group: Group, label: string, id: string, members: readonly AugMember[]) => {
  const r = routineOf(s, members);
  const clean = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT);
  if (clean) r.steps.push({ id, time: r.steps.filter((x) => x.group === group).at(-1)?.time ?? (group === 'morning' ? '07:50' : '16:00'), label: clean, icon: group === 'morning' ? 'bag' : 'book', group });
  return s;
};
export const setMode = (s: AugState, simple: boolean, members: readonly AugMember[]) => { routineOf(s, members).mode = simple ? 'simple' : 'standard'; return s; };
export const setFooter = (s: AugState, value: string, members: readonly AugMember[]) => {
  const r = routineOf(s, members);
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, FOOTER_LIMIT);
  if (!clean || clean === DEFAULT_FOOTER) delete r.footer;
  else r.footer = clean;
  return s;
};
const preparedFor = (s: AugState, members: readonly AugMember[]) => preparedRoutine(ageFor(s.child, members), s.child === 'family' ? familyLeave(s, members) : leaveOf(s, s.child, members));
export const restoreRoutine = (s: AugState, members: readonly AugMember[]) => { s.boards[s.child] = preparedFor(s, members); return s; };
export const routineChanged = (s: AugState, members: readonly AugMember[]) => JSON.stringify(routineOf(s, members)) !== JSON.stringify(preparedFor(s, members));
/** Back to the prepared family plan; the profile snapshot goes too, so it's prepared from her newest answers. */
export const restorePlan = (s: AugState) => { delete s.plan; delete s.profile; return s; };
export const planEdited = (s: AugState) => Boolean(s.plan && Object.keys(s.plan).length);

/**
 * The earlier August page kept { profile, boards, active } in localStorage, boards carrying `child` and `footer`.
 * Read once for the same family; the caller removes the localStorage copy.
 */
export const fromLegacy = (raw: string | null, profile: string, members: readonly AugMember[]): AugState | null => {
  try {
    const old = JSON.parse(raw ?? 'null') as { profile?: string; boards?: Record<string, Record<string, unknown>>; active?: unknown } | null;
    if (!old?.boards || old.profile !== profile) return null;
    const s = freshState(members);
    for (const [id, b] of Object.entries(old.boards)) {
      if (!b || !Array.isArray(b.steps) || !(b.steps as unknown[]).every(isStep)) continue;
      const r: Routine = { steps: (b.steps as Step[]).map(({ removed, ...x }) => ({ ...x, label: x.label.slice(0, LABEL_LIMIT), ...(removed ? { removed: true } : {}) })), mode: b.mode === 'simple' ? 'simple' : 'standard' };
      if (typeof b.footer === 'string' && b.footer.trim() && b.footer !== DEFAULT_FOOTER) r.footer = b.footer.slice(0, FOOTER_LIMIT);
      s.boards[id] = r;
    }
    if (typeof old.active === 'string' && old.active in s.boards) s.child = old.active;
    return applyFamily(s, members);
  } catch {
    return null;
  }
};

export interface AugPlan extends PlanResource<AugState> {
  members: () => AugMember[];
  view: () => AugView;
  setLocked: (on: boolean) => void;
  /** The desktop routine editor, on a child's routine if given. */
  openEditor: (child?: string) => void;
  /** The desktop family plan editor. */
  openPlanEditor: () => void;
}
