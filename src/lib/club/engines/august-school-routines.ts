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
 * - The family's "Morning Routine" and "After-School Routine", one page each, shared by all the school-aged children
 *   (3 to 18 in August 2027; rules: ./august-routine-chart.ts): steps with an optional time and an optional habit
 *   trigger, timed back from the school start, a step only some children do naming them. Steps can be renamed,
 *   retimed, reordered, removed (and restored), added or given to some children; triggers and times can be edited or
 *   turned off. Three pages a family, never a page per child.
 * Children are by member ID. Saved means settled: the profile snapshot used is kept with the plan.
 */
import { ageInMonth } from '../profile';
import {
  BANNERS, CHOICES, DEFAULT_LEAVE, DEFAULT_TAGLINE, HEADERS, ICONS, LEGACY_CUES, SHORTER_HIDES, childFacts, clock, clockParts, cueOf,
  hhmm, minutes, preparedFamilyRoutine, preparedRoutine as prepareFor, shown, stepIssues, swapKeepingTimes, timeBetween, validTime, type Group, type Routine, type Step,
} from './august-routine-chart';
export { CHOICES, DEFAULT_LEAVE, ICONS, SHORTER_HIDES, clock, shown, stepIssues, validTime, cueOf, type Group, type Routine, type Step };
import type { PlanResource } from '../plan/resource';
import { familyContext, isFamilySnapshot, schoolStartFor, type ContextMember, type ContextPrefs, type FamilyContext, type FamilySnapshot } from '../personalize/family';
import { colorFor, type MemberColor } from '../personalize/colors';
import { assignTasks, type PlanTask } from '../personalize/assign';
import { CUE } from '../personalize/cues';
import { isTaskEdits, pruneTaskEdits, withEdits, type PlannedTask, type TaskEdits } from '../personalize/edits';

export const KIT_MONTH = '2027-08';
export const GROUPS: readonly Group[] = ['morning', 'after'];
export const GROUP_INFO: Record<Group, { title: string; tab: string }> = { morning: { title: 'Morning Routine', tab: 'Morning' }, after: { title: 'After-School Routine', tab: 'After school' } };
export const LABEL_LIMIT = 40;
export const CUE_TEXT_LIMIT = 36;
export const FOOTER_LIMIT = 60;
/** The line under each chart's header. Routines saved with the earlier sheet's default line get the new one. */
export const DEFAULT_FOOTER = DEFAULT_TAGLINE;
const OLD_FOOTER = "Check my routine. Do my part. Then I'm ready!";
/** A chart holds up to eight steps on one page. */
export const MAX_STEPS = 8;

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
/** Out the door this long before school starts. */
export const LEAVE_BEFORE = 20;
/** When to be out the door for a school that starts at `start`. */
export const leaveFor = (start?: string) => (start && validTime(start) ? hhmm(minutes(start) - LEAVE_BEFORE) : DEFAULT_LEAVE);

/** A child's two routines for their age, timed back from `leave` (./august-routine-chart.ts). */
export const preparedRoutine = (age: number, leave: string = DEFAULT_LEAVE, facts: Parameters<typeof prepareFor>[2] = {}): Routine => prepareFor(age, leave, facts);
/** The family's routines are one board, kept under this key (the state's per-child boards are from the earlier sheet). */
export const FAMILY = 'family';
export const freshState = (_members: readonly AugMember[] = []): AugState => ({ child: FAMILY, boards: {} });
const ctxOf = (s: Pick<AugState, 'profile'>, members: readonly AugMember[], prefs: ContextPrefs = {}): FamilyContext => familyContext(members as readonly ContextMember[], prefs, KIT_MONTH, s.profile);
/** A child's out-the-door time from their school start (her answers); otherwise the family's, or the prepared time. */
export const leaveOf = (s: Pick<AugState, 'profile'>, child: string, members: readonly AugMember[]) => {
  const ctx = ctxOf(s, members);
  const own = schoolStartFor(ctx, child);
  return own ? leaveFor(own) : knownLeave(ctx, members) ?? DEFAULT_LEAVE;
};
/** The earliest out-the-door time among the children whose school start she gave. */
const knownLeave = (ctx: FamilyContext, members: readonly AugMember[]) =>
  schoolKids(members).map((k) => schoolStartFor(ctx, k.id)).filter((t): t is string => Boolean(t)).map(leaveFor).sort()[0];
/** Whether the morning's times come from her school start, or are the sample default. */
export const leaveKnown = (s: Pick<AugState, 'profile'>, members: readonly AugMember[]) => Boolean(knownLeave(ctxOf(s, members), members));
/** The children the family routine is for: the school-aged ones (all the children when none are). */
export const routineKids = <M extends AugMember>(members: readonly M[]) => (schoolKids(members).length ? schoolKids(members) : []);
const preparedOf = (s: AugState, members: readonly AugMember[]) => {
  const ctx = s.profile ? ctxOf(s, members) : null;
  return preparedFamilyRoutine(routineKids(members).map((k) => childFacts(ctx, k.id, ageFor(k.id, members))), familyLeave(s, members));
};
const boardOf = (s: AugState, members: readonly AugMember[]) => (s.boards[FAMILY] ??= preparedOf(s, members));
export const routineOf = (s: AugState, members: readonly AugMember[]) => boardOf(s, members);
/** The morning's out-the-door time: hers, else from the school start, else the sample. */
export const routineLeave = (s: AugState, members: readonly AugMember[]) => {
  const own = boardOf(s, members).leave;
  return own && validTime(own) ? own : familyLeave(s, members);
};
/** The family is out the door when the earliest school needs them. */
export const familyLeave = (s: Pick<AugState, 'profile'>, members: readonly AugMember[]) => knownLeave(ctxOf(s, members), members) ?? DEFAULT_LEAVE;

// ------------------------------------------------------------------ the family plan

export type PlanSection = 'before' | 'night' | 'morning' | 'after';
/** `done`: the section's completion standard, said once for the panel (DONE WHEN). */
export const PLAN_SECTIONS: readonly { id: PlanSection; title: string; line: string; icon: string; done: string }[] = [
  { id: 'before', title: 'Before the First Day', line: 'Get ready together, not at the last minute.', icon: '/images/club/icon-library/backpack.png', done: 'supplies, forms and dates are ready.' },
  { id: 'night', title: 'The Night Before', line: 'Tomorrow starts tonight.', icon: '/images/club/icon-library/lunch-box.png', done: 'bags are by the door and tomorrow’s clothes are out.' },
  { id: 'morning', title: 'School Mornings', line: 'Everyone knows their part.', icon: '/images/club/icon-library/morning-start.png', done: 'everyone’s out the door on time.' },
  { id: 'after', title: 'After School', line: 'Home, unpack, reset.', icon: '/images/club/icon-library/doing-homework.png', done: 'bags are empty and homework has started.' },
];
export type AugTask = PlanTask & { section: PlanSection };
/**
 * The plan's jobs. Children's are their own ('each', at their age); one-owner jobs go to whoever already takes care
 * of the area, a child she wished it for, or the person with the most room. Grown-up jobs teens can share say so.
 * Recurring jobs carry their habit cue (one-time jobs before the first day don't); ../personalize/cues.ts keeps
 * each cue true to her answers (no school-day cue for a child who isn't in school).
 */
export const PLAN_TASKS: readonly AugTask[] = [
  { section: 'before', id: 'supplies', title: 'Shop the school supply list', mode: 'one', who: 'any', minAge: 15, prefer: 'adult', areas: ['school-prep'] },
  { section: 'before', id: 'forms', title: 'Fill out and return school forms', mode: 'one', who: 'adult', areas: ['school-prep', 'homework'] },
  { section: 'before', id: 'try-on', title: 'Try on school clothes and shoes', mode: 'each', who: 'child', minAge: 3 },
  { section: 'before', id: 'bag-spot', title: 'Give backpacks a home by the door', mode: 'one', who: 'any', minAge: 7, wishes: ['own-belongings', 'pack-school-bag'], areas: ['belongings'] },
  { section: 'before', id: 'calendar', title: 'Add school dates to the wall calendar', mode: 'one', who: 'any', minAge: 12 },
  { section: 'before', id: 'practice', title: 'Practice the new morning once', mode: 'together', who: 'any' },
  { section: 'night', id: 'pack-bag', title: 'Pack my backpack, set it by the door', mode: 'each', who: 'child', minAge: 5, wishes: ['pack-school-bag'], cue: CUE.dinner },
  { section: 'night', id: 'own-lunch', title: 'Pack my own lunch', mode: 'each', who: 'child', minAge: 10, cue: CUE.dinner },
  { section: 'night', id: 'lunches', title: 'Pack lunches for the younger kids', mode: 'one', who: 'any', minAge: 14, prefer: 'adult', areas: ['meals'], cue: CUE.dinner },
  { section: 'night', id: 'clothes-out', title: 'Lay out tomorrow’s clothes', mode: 'each', who: 'child', minAge: 3, maxAge: 12, cue: CUE.bed },
  { section: 'night', id: 'papers', title: 'Read and sign school papers', mode: 'one', who: 'adult', areas: ['school-prep', 'homework'], cue: CUE.dinner },
  { section: 'morning', id: 'routine', title: 'Follow my morning routine', mode: 'each', who: 'child', minAge: 3, cue: CUE.wake },
  { section: 'morning', id: 'breakfast', title: 'Get breakfast on the table', mode: 'one', who: 'any', minAge: 14, prefer: 'adult', areas: ['meals'], cue: CUE.kidsUp },
  { section: 'morning', id: 'dropoff', title: 'School drop-off', mode: 'one', who: 'adult', areas: ['transportation'], cue: CUE.ready },
  { section: 'after', id: 'pickup', title: 'School pickup', mode: 'one', who: 'adult', areas: ['transportation'], cue: CUE.schoolOut },
  { section: 'after', id: 'unpack', title: 'Unpack backpack and lunch box', mode: 'each', who: 'child', minAge: 4, cue: CUE.home },
  { section: 'after', id: 'homework', title: 'Start homework at the homework spot', mode: 'each', who: 'child', minAge: 6, wishes: ['homework-start'], cue: CUE.snack },
  { section: 'after', id: 'rinse', title: 'Rinse the lunch boxes', mode: 'one', who: 'any', minAge: 8, areas: ['meals'], cue: CUE.unpack },
];
const TASK_BY_ID = new Map(PLAN_TASKS.map((t) => [t.id, t]));
export const taskRules = Object.fromEntries(PLAN_TASKS.map((t) => [t.id, { who: t.who, minAge: t.minAge, maxAge: t.maxAge }]));

/** The family plan as prepared, then with her changes. Only school-aged children's jobs; little ones join the practice. */
export function familyPlan(s: AugState, members: readonly AugMember[], prefs: ContextPrefs = {}) {
  const ctx = ctxOf(s, members, prefs);
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
    sections: PLAN_SECTIONS.map((sec) => ({ ...sec, tasks: planned.filter((t) => TASK_BY_ID.get(t.id)?.section === sec.id).map((t) => ({ ...t, role: roleOf(t, ctx) })) })),
    ctx,
  };
}
export type AugFamilyPlan = ReturnType<typeof familyPlan>;
/**
 * What kind of job a row is, printed beside the owners so it isn't told by color alone: each child their own, a job
 * done together, or a grown-up's. A single child's or teen's job needs no label: their name says it.
 */
export function roleOf(t: Pick<PlannedTask, 'id' | 'ownerIds'>, ctx: FamilyContext): 'each' | 'together' | 'grown-up' | null {
  const people = t.ownerIds.map((id) => ctx.people.find((p) => p.id === id)).filter(Boolean);
  if (!people.length) return null;
  if (people.every((p) => p!.kind === 'adult')) return 'grown-up';
  if (people.length > 1) return TASK_BY_ID.get(t.id)?.mode === 'each' ? 'each' : 'together';
  return null;
}
export const ROLE_LABEL = { each: 'Each child', together: 'Together', 'grown-up': 'Grown-up job' } as const;
export type AugPlannedTask = PlannedTask;

export const applyFamily = (s: AugState, members: readonly AugMember[]) => {
  // One family routine: the earlier sheet's per-child boards aren't printed any more, so they aren't kept.
  for (const id of Object.keys(s.boards)) if (id !== FAMILY) delete s.boards[id];
  s.child = FAMILY;
  const kids = new Set(kidsOf(members).map((k) => k.id));
  for (const st of s.boards[FAMILY]?.steps ?? []) {
    if (!st.who) continue;
    st.who = st.who.filter((id) => kids.has(id));
    if (!st.who.length) delete st.who;
  }
  if (s.profile && !isFamilySnapshot(s.profile)) delete s.profile;
  if (s.plan) { pruneTaskEdits(s.plan, ctxOf(s, members)); if (!Object.keys(s.plan).length) delete s.plan; }
  routineOf(s, members);
  return s;
};


const isStep = (x: unknown): x is Step => {
  const s = x as Partial<Step> | null;
  return Boolean(s && typeof s.id === 'string' && typeof s.time === 'string' && typeof s.label === 'string' && typeof s.icon === 'string' && (s.group === 'morning' || s.group === 'after')
    && (s.cue === undefined || typeof s.cue === 'string') && (s.who === undefined || (Array.isArray(s.who) && s.who.every((w) => typeof w === 'string'))) && (s.timeOff === undefined || typeof s.timeOff === 'boolean') && (s.cueOff === undefined || typeof s.cueOff === 'boolean'));
};
const isRoutine = (x: unknown): x is Routine => {
  const r = x as Partial<Routine> | null;
  return Boolean(r && Array.isArray(r.steps) && r.steps.every(isStep) && (r.mode === 'standard' || r.mode === 'simple') && (r.footer === undefined || typeof r.footer === 'string')
    && (r.leave === undefined || (typeof r.leave === 'string' && validTime(r.leave))));
};
export const isAugState = (x: unknown): x is AugState => {
  const s = x as Partial<AugState> | null;
  return Boolean(s && typeof s.child === 'string' && s.boards && typeof s.boards === 'object' && Object.values(s.boards).every(isRoutine)
    && (s.plan === undefined || isTaskEdits(s.plan)) && (s.profile === undefined || isFamilySnapshot(s.profile)));
};

/**
 * One printed chart: a child's morning or after-school routine (the family's when there's no school-aged child). Each
 * step prints its name, its trigger when it adds something (`cueOf`), and its time unless it's off.
 */
export interface ChartStep {
  id: string; label: string; icon: string; cue: string; time: string | null; clock: [string, string] | null;
  /** The children a step is for, when it isn't all of them (their names and colors); empty for everyone. */
  owners: { id: string; name: string; color: MemberColor }[];
}
const chartOf = (s: AugState, group: Group, members: readonly AugMember[], colors: Record<string, MemberColor>) => {
  const r = boardOf(s, members);
  const kids = routineKids(members);
  const leave = routineLeave(s, members);
  const steps: ChartStep[] = shown(r, group).map((x) => {
    const timed = !x.timeOff && validTime(x.time);
    const who = (x.who ?? []).filter((id) => kids.some((k) => k.id === id));
    const some = who.length && who.length < kids.length;
    return {
      id: x.id, label: x.label, icon: ICONS[x.icon] ?? ICONS.bag, cue: cueOf(x), time: timed ? x.time : null, clock: timed ? clockParts(x.time) : null,
      owners: some ? kids.filter((k) => who.includes(k.id)).map((k) => ({ id: k.id, name: k.firstName, color: colorFor(colors, k.id) })) : [],
    };
  });
  // The morning's deadline prints only when the morning is timed (a chart of triggers has no clock to beat).
  const deadline = group === 'morning' && steps.some((x) => x.time) ? clock(leave) : null;
  return {
    group,
    title: HEADERS[group].title,
    subtitle: HEADERS[group].subtitle,
    headerIcon: ICONS[HEADERS[group].icon],
    tagline: r.footer && r.footer !== OLD_FOOTER ? r.footer : DEFAULT_TAGLINE,
    /** Whose chart it is: every child, in their colors (the header's legend). */
    kids: kids.map((k) => ({ id: k.id, name: k.firstName, color: colorFor(colors, k.id) })),
    steps,
    banner: { ...BANNERS[group], icon: ICONS[BANNERS[group].icon], deadline },
    issues: stepIssues(r, group, group === 'morning' ? leave : undefined),
  };
};
export type ChartView = ReturnType<typeof chartOf>;

/** The legacy single-sheet view of the selected routine (the editor and the member's standalone copy). */
const routineSheet = (s: AugState, child: string, members: readonly AugMember[], colors: Record<string, MemberColor>) => {
  const r = boardOf(s, members);
  const kid = kidsOf(members).find((k) => k.id === child);
  return {
    child,
    color: colorFor(colors, kid?.id),
    name: kid?.firstName ?? 'Our family',
    title: kid ? `${kid.firstName}'s morning & after-school routines` : 'Our morning & after-school routines',
    groups: Object.fromEntries(GROUPS.map((g) => [g, shown(r, g).map((x) => ({ ...x, clock: clock(x.time) }))])) as Record<Group, (Step & { clock: string })[]>,
    footer: r.footer && r.footer !== OLD_FOOTER ? r.footer : DEFAULT_FOOTER,
  };
};

export const augView = (s: AugState, members: readonly AugMember[], prefs: ContextPrefs = {}) => {
  const r = routineOf(s, members);
  const kid = kidsOf(members).find((k) => k.id === s.child);
  const school = schoolKids(members);
  const plan = familyPlan(s, members, prefs);
  return {
    /** Everything that prints, in order: the family plan (when someone's in school), then each child's routine. */
    plan,
    routines: [routineSheet(s, FAMILY, members, plan.ctx.colors)],
    /** The family's two charts, after the family plan: the morning, then after school. */
    charts: GROUPS.map((g) => chartOf(s, g, members, plan.ctx.colors)),
    /** Whether the morning's times are the sample default (no school start on her family page, none set here). */
    sampleTimes: !leaveKnown(s, members) && !routineOf(s, members).leave,
    leave: routineLeave(s, members),
    child: s.child,
    childName: kid?.firstName ?? 'Our family',
    title: kid ? `${kid.firstName}'s morning & after-school routines` : 'Our morning & after-school routines',
    age: ageFor(s.child, members),
    groups: Object.fromEntries(GROUPS.map((g) => [g, shown(r, g).map((x) => ({ ...x, clock: clock(x.time) }))])) as Record<Group, (Step & { clock: string })[]>,
    footer: r.footer && r.footer !== OLD_FOOTER ? r.footer : DEFAULT_FOOTER,
    routine: r,
    /** The routines she can edit: every school-aged child, or the family's when there's none. */
    kids: (school.length ? school : []).map((k) => ({ id: k.id, name: k.firstName })),
  };
};
export type AugView = ReturnType<typeof augView>;

export const augFingerprint = (s: AugState, members: readonly AugMember[], prefs: ContextPrefs = {}) => {
  const v = augView(s, members, prefs);
  return JSON.stringify([
    v.plan.active ? [v.plan.leave, v.plan.sections.map((sec) => sec.tasks.filter((t) => !t.skipped).map((t) => [t.label, t.who, t.owners.map((o) => o.color.id), t.cue ?? null]))] : null,
    v.charts.map((c) => [c.group, c.tagline, c.kids.map((k) => [k.name, k.color.id]), c.steps.map((x) => [x.icon, x.label, x.cue, x.time, x.owners.map((o) => [o.name, o.color.id])]), c.banner.deadline]),
  ]);
};

// Edits on the selected routine. Each changes `s` in place and returns it.

/** Kept for saved callers: the family has one routine now, so every child's is the family's. */
export const setChild = (s: AugState, _child: string, members: readonly AugMember[]) => {
  s.child = FAMILY;
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
  if (st && validTime(time)) { st.time = time; delete st.timeOff; }
  return s;
};
/** Her trigger for a step; blank means no trigger. */
export const setCue = (s: AugState, id: string, cue: string, members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  if (st) { st.cue = cue.replace(/\s+/g, ' ').trim().replace(/[.]$/, '').slice(0, CUE_TEXT_LIMIT); delete st.cueOff; }
  return s;
};
/** Show or hide a step's trigger (kept for later). */
export const setCueOff = (s: AugState, id: string, off: boolean, members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  if (st && off) { st.cue ??= LEGACY_CUES[st.id] ?? ''; st.cueOff = true; } else if (st) delete st.cueOff;
  return s;
};
/** Show or hide a step's time (kept for later). */
export const setTimeOff = (s: AugState, id: string, off: boolean, members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  if (st && off) st.timeOff = true; else if (st) delete st.timeOff;
  return s;
};
/** Times on or off for a whole routine (an event-based afternoon, or a timed one). */
export const setTimesOff = (s: AugState, group: Group, off: boolean, members: readonly AugMember[]) => {
  for (const st of routineOf(s, members).steps) if (st.group === group) { if (off) st.timeOff = true; else delete st.timeOff; }
  return s;
};
/** Her out-the-door time for this child's morning ('' goes back to the one from her family page). */
export const setLeave = (s: AugState, time: string, members: readonly AugMember[]) => {
  const r = routineOf(s, members);
  if (validTime(time)) r.leave = time; else delete r.leave;
  return s;
};
/** Who a step is for: some of the children (by id), or everyone (empty or all of them). */
export const setWho = (s: AugState, id: string, who: readonly string[], members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  const kids = routineKids(members).map((k) => k.id);
  const list = [...new Set(who)].filter((w) => kids.includes(w));
  if (!st) return s;
  if (list.length && list.length < kids.length) st.who = list; else delete st.who;
  return s;
};
export const setRemoved = (s: AugState, id: string, removed: boolean, members: readonly AugMember[]) => {
  const st = stepOf(s, id, members);
  // A routine keeps at least one step, and holds at most eight.
  if (st && removed && shown(routineOf(s, members), st.group).length <= 1) return s;
  if (st && !removed && st.removed && shown(routineOf(s, members), st.group).length >= MAX_STEPS) return s;
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
  // The steps change places; the times stay with the slots, so the chart stays in time order.
  if (near) swapKeepingTimes(r, st, near);
  return s;
};
/** Where a new step goes: before the routine's last step (out the door, free play), timed between its neighbors. */
const placeNew = (r: Routine, group: Group, st: Step) => {
  const list = shown(r, group);
  if (list.length >= MAX_STEPS) return false;
  const last = list.at(-1);
  st.time = timeBetween(list.at(-2), last);
  st.timeOff = list.length ? list.every((x) => x.timeOff) : group === 'after';
  if (last) r.steps.splice(r.steps.indexOf(last), 0, st); else r.steps.push(st);
  return true;
};
/** Add a listed step, or bring a removed one back. */
export const addStep = (s: AugState, group: Group, id: string, members: readonly AugMember[]) => {
  const choice = CHOICES[group].find((c) => c.id === id);
  if (!choice) return s;
  const r = routineOf(s, members);
  const prior = r.steps.find((x) => x.id === id && x.group === group);
  if (prior) { if (prior.removed && shown(r, group).length < MAX_STEPS) delete prior.removed; return s; }
  placeNew(r, group, { id, time: '', label: choice.label, icon: choice.icon, group, cue: choice.cue });
  return s;
};
export const addCustom = (s: AugState, group: Group, label: string, id: string, members: readonly AugMember[]) => {
  const r = routineOf(s, members);
  const clean = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT);
  if (clean) placeNew(r, group, { id, time: '', label: clean, icon: group === 'morning' ? 'bag' : 'book', group, cue: '' });
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
const preparedFor = (s: AugState, members: readonly AugMember[]) => preparedOf(s, members);
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
  /** The desktop routine editor, on the morning or after-school chart if given. */
  openEditor: (group?: Group) => void;
  /** The desktop family plan editor. */
  openPlanEditor: () => void;
}
