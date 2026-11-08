/**
 * March 2027, Our Family Rhythm: one family, two or three shared moments, everyone owns their part.
 * (Printable and desktop editor: src/components/club/MarchFamilyRhythm.astro; phone screen and reference view:
 * MarchPlanMobile.astro; docs/club/PLAN_ARCHITECTURE.md → March.) Pure functions only, so the sheet, the rail and the
 * phone read one plan. Built on the shared personalization foundation (../personalize/), like January.
 *
 * The model is cue → action → finish:
 * - Cue: a moment the family already shares (after breakfast, after dinner, coming home…), never a clock time. One
 *   moment starts several people's parts, so Mom isn't the reminder for each of them.
 * - Action: a small, concrete, observable job with an owner (or two siblings sharing one). Every job belongs to a
 *   moment it can actually follow: nothing that has to happen before the cue (making dinner is never "after dinner").
 * - Finish: what "done" looks like, written from the jobs actually on that moment.
 *
 * Recommendations (deterministic; ties by stable hash, never random):
 * - Two moments by default, from her first priority and challenges (mornings → breakfast; evenings → dinner and
 *   bedtime; school papers → coming home); a third is offered, off until she turns it on.
 * - Whoever already takes care of an area keeps that job, shown as established, not as a new habit.
 * - Each child gets age-fitting jobs; not everyone in every moment, and never jobs just to fill space (at most five rows
 *   a moment; siblings doing the same own-job share a row). Grown-ups have a real part; the account holder leans last.
 * - One or two NEW habits are highlighted: what she wished a child would take on (profile step 4) first, otherwise the
 *   most meaningful new job. Established jobs show for context and never compete with them.
 * No points, rewards, streaks, percentages or tracking.
 */
import type { PlanResource } from '../plan/resource';
import { assignTasks, HOLDER_LEAN, taskAge } from '../personalize/assign';
import { colorFor, type MemberColor } from '../personalize/colors';
import { existingFor, familyContext, isFamilySnapshot, wishedFor, type ContextMember, type ContextPrefs, type FamilyContext, type FamilySnapshot, type Person } from '../personalize/family';
import { stableHash } from '../hash';
import type { MarchIcon } from '../../../data/club/march-chore-icons';

export const KIT_MONTH = '2027-03';
export const MAX_ROWS = 5;
export const MAX_MOMENTS = 3;
export const TITLE_LIMIT = 40;
export const LABEL_LIMIT = 32;
export const MAX_HABITS = 2;

// ------------------------------------------------------------------ the moments

export type AnchorId = 'breakfast' | 'leave' | 'home' | 'dinner' | 'teeth';
export interface Anchor {
  id: AnchorId;
  /** The moment, as the sheet's heading. */
  title: string;
  /** The event that starts it, in the family's words. */
  cue: string;
  /** What the moment does for the home. */
  reset: string;
}
/** Shared moments families already have, in the order of the day. */
export const ANCHORS: readonly Anchor[] = [
  { id: 'breakfast', title: 'After Breakfast', cue: 'Breakfast finishes', reset: 'Our morning reset' },
  { id: 'leave', title: 'Before We Head Out', cue: 'Shoes go on', reset: 'Our out-the-door check' },
  { id: 'home', title: 'When We Get Home', cue: 'We walk in the door', reset: 'Our coming-home reset' },
  { id: 'dinner', title: 'After Dinner', cue: 'Dinner finishes', reset: 'Our kitchen reset' },
  { id: 'teeth', title: 'After Brushing Teeth', cue: 'Teeth are brushed', reset: 'Our bedtime wind-down' },
];
export const anchorById = (id: AnchorId) => ANCHORS.find((a) => a.id === id)!;

// ------------------------------------------------------------------ the jobs

/**
 * A job a moment can hold. `own`: each person's own (their bed, their shoes), so siblings doing it share a row;
 * otherwise one owner for the family. `finish`: how the finish line says it's done. `areas` / `wishes`: profile answers
 * that point at its owner. `adult`: a grown-up job (a teen of `minAge` may take it).
 */
export interface Job {
  id: string; anchor: AnchorId; title: string; icon: MarchIcon | null; minAge: number; finish: string;
  own?: boolean; adult?: boolean; pets?: boolean; areas?: string[]; wishes?: string[];
}
export const JOBS: readonly Job[] = [
  // After breakfast
  { id: 'b-dishes', anchor: 'breakfast', title: 'Clear my breakfast dishes', icon: 'clear-dishes', minAge: 3, own: true, finish: 'plates are cleared', wishes: ['help-with-meals'] },
  { id: 'b-bed', anchor: 'breakfast', title: 'Make my bed', icon: 'make-bed', minAge: 4, own: true, finish: 'beds are made', wishes: ['tidy-room'] },
  { id: 'b-pets', anchor: 'breakfast', title: 'Feed the pets', icon: 'feed-pets', minAge: 4, pets: true, finish: 'the pets are fed', areas: ['pet-care'], wishes: ['pet-care'] },
  { id: 'b-table', anchor: 'breakfast', title: 'Wipe the breakfast table', icon: 'wipe-surface', minAge: 6, finish: 'the table is wiped', areas: ['meals', 'cleaning'] },
  { id: 'b-food', anchor: 'breakfast', title: 'Put breakfast food away', icon: null, minAge: 6, finish: 'the food is put away', areas: ['meals'] },
  { id: 'b-dishwasher', anchor: 'breakfast', title: 'Empty the dishwasher', icon: 'empty-dishwasher', minAge: 8, finish: 'the dishwasher is empty', areas: ['meals'] },
  { id: 'b-load', anchor: 'breakfast', title: 'Load the breakfast dishes', icon: 'empty-dishwasher', minAge: 12, adult: true, finish: 'dishes are in the dishwasher', areas: ['meals'] },
  // Before we head out
  { id: 'l-bag', anchor: 'leave', title: 'Grab my backpack', icon: null, minAge: 4, own: true, finish: 'bags are on shoulders', wishes: ['pack-school-bag', 'own-belongings'] },
  { id: 'l-shoes', anchor: 'leave', title: 'Put on my shoes and coat', icon: 'shoes-away', minAge: 3, own: true, finish: 'shoes and coats are on' },
  { id: 'l-lights', anchor: 'leave', title: 'Turn off the lights', icon: null, minAge: 6, finish: 'the lights are off' },
  { id: 'l-door', anchor: 'leave', title: 'Lock the door', icon: null, minAge: 16, adult: true, finish: 'the door is locked', areas: ['transportation'] },
  // When we get home
  { id: 'h-shoes', anchor: 'home', title: 'Put my shoes away', icon: 'shoes-away', minAge: 3, own: true, finish: 'shoes are away', wishes: ['own-belongings'] },
  { id: 'h-lunchbox', anchor: 'home', title: 'Empty my lunch box', icon: 'clear-dishes', minAge: 5, own: true, finish: 'lunch boxes are empty', wishes: ['help-with-meals'] },
  { id: 'h-backpack', anchor: 'home', title: 'Hang up my backpack', icon: null, minAge: 4, own: true, finish: 'backpacks are hung up', wishes: ['own-belongings', 'pack-school-bag'] },
  { id: 'h-papers', anchor: 'home', title: 'Read school papers', icon: 'tidy-desk', minAge: 16, adult: true, finish: 'papers are read', areas: ['school-prep', 'homework'] },
  // After dinner
  { id: 'd-clear', anchor: 'dinner', title: 'Clear the dinner table', icon: 'clear-dishes', minAge: 4, finish: 'the table is cleared', areas: ['meals'], wishes: ['help-with-meals'] },
  { id: 'd-wipe', anchor: 'dinner', title: 'Wipe the counters', icon: 'wipe-surface', minAge: 6, finish: 'the counters are wiped', areas: ['meals', 'cleaning'], wishes: ['help-with-meals'] },
  { id: 'd-sweep', anchor: 'dinner', title: 'Sweep under the table', icon: 'clean-floor', minAge: 7, finish: 'the floor is swept', areas: ['cleaning'] },
  { id: 'd-load', anchor: 'dinner', title: 'Load the dishwasher', icon: 'empty-dishwasher', minAge: 9, finish: 'dishes are in the dishwasher', areas: ['meals'], wishes: ['help-with-meals'] },
  { id: 'd-trash', anchor: 'dinner', title: 'Take out the trash', icon: 'take-out-trash', minAge: 9, finish: 'the trash is out', areas: ['cleaning'] },
  { id: 'd-pets', anchor: 'dinner', title: 'Feed the pets', icon: 'feed-pets', minAge: 4, pets: true, finish: 'the pets are fed', areas: ['pet-care'], wishes: ['pet-care'] },
  { id: 'd-leftovers', anchor: 'dinner', title: 'Put leftovers away', icon: 'clean-fridge', minAge: 12, adult: true, finish: 'leftovers are put away', areas: ['meals'] },
  // After brushing teeth
  { id: 't-clothes', anchor: 'teeth', title: 'Put dirty clothes in the hamper', icon: 'clothes-away', minAge: 3, own: true, finish: 'clothes are in the hamper', wishes: ['put-away-laundry'] },
  { id: 't-toys', anchor: 'teeth', title: 'Put toys away', icon: 'toys-away', minAge: 2, own: true, finish: 'toys are put away', wishes: ['tidy-room'] },
  { id: 't-bag', anchor: 'teeth', title: 'Pack my backpack for tomorrow', icon: 'tidy-desk', minAge: 6, own: true, finish: 'backpacks are packed', wishes: ['pack-school-bag'] },
  { id: 't-dishwasher', anchor: 'teeth', title: 'Start the dishwasher', icon: 'empty-dishwasher', minAge: 12, adult: true, finish: 'the dishwasher is running', areas: ['meals'] },
];
export const jobById = (id: string) => JOBS.find((j) => j.id === id);

/**
 * A job that can't follow its moment's cue: anything that must happen before it (making or setting up the meal
 * after the meal, leaving-prep after coming home). Used for her typed jobs; the library never needs it.
 */
const BEFORE_CUE: Partial<Record<AnchorId, RegExp>> = {
  breakfast: /\b(make|cook|prepare|set)\b.*\bbreakfast\b|\bset the table\b/i,
  dinner: /\b(make|cook|prepare|start)\b.*\b(dinner|supper)\b|\bset the table\b|\bhelp (make|cook)\b/i,
  home: /\b(pack|grab)\b.*\b(backpack|bag)\b.*\b(school|out)\b/i,
  teeth: /\bbrush\b.*\bteeth\b/i,
};
export const fitsCue = (anchor: AnchorId, title: string) => !BEFORE_CUE[anchor]?.test(title);

// ------------------------------------------------------------------ state

export interface Moment {
  id: string;
  anchor: AnchorId;
  /** Her own wording for the moment's heading (defaults to the anchor's title). */
  label?: string;
  enabled: boolean;
}
export interface Row {
  id: string;
  moment: string;
  /** A library job, or her own (`job` missing). */
  job?: string;
  title: string;
  owners: string[];
  /** Someone already takes care of this (from her profile): context, not a habit to practice. */
  established?: boolean;
}
export interface RhythmPlan {
  moments: Moment[];
  rows: Row[];
  /** The one or two rows the family is practicing (row ids). */
  habits: string[];
}
export interface RhythmState {
  v: 3;
  /** Her plan once she changes anything; until then the prepared plan (from the family) prints. */
  plan?: RhythmPlan;
  /** The profile answers it was prepared from (saved means settled). */
  profile?: FamilySnapshot;
}
export interface RhythmMember extends ContextMember { kind: 'adult' | 'child'; role?: string }

export const freshState = (): RhythmState => ({ v: 3 });

const ctxOf = (members: readonly RhythmMember[], prefs: ContextPrefs | undefined, snapshot?: FamilySnapshot): FamilyContext =>
  familyContext(members, prefs, KIT_MONTH, snapshot);

// ------------------------------------------------------------------ recommendations

/** The two moments that fit her answers best, then the one offered as a third. */
export function suggestedAnchors(ctx: FamilyContext): [AnchorId, AnchorId, AnchorId] {
  const p = ctx.snapshot?.priority;
  const hard = (c: string) => Boolean(ctx.snapshot?.challenges?.includes(c));
  const has = (cat: string) => Boolean(ctx.snapshot?.responsibilities.some((r) => r.category === cat));
  if (p === 'evenings' || p === 'tidying') return ['dinner', 'teeth', 'breakfast'];
  if (p === 'school-stuff') return ['home', 'dinner', 'teeth'];
  if (p === 'mornings' || (!p && hard('routines'))) return ['breakfast', 'dinner', 'leave'];
  if (has('school-prep') || has('homework')) return ['breakfast', 'dinner', 'home'];
  return ['breakfast', 'dinner', 'teeth'];
}

const ageOf = (p: Person) => (p.kind === 'adult' ? 99 : taskAge(p) ?? 6);
const fits = (j: Job, p: Person, ctx: FamilyContext) =>
  (!j.pets || ctx.pets) && (p.kind === 'adult' ? !j.own || j.adult : ageOf(p) >= j.minAge && (!j.adult || ageOf(p) >= j.minAge));

/**
 * The prepared rows for one moment. Established jobs first (whoever already does it keeps it), then each child without
 * a part yet gets the best job for their age (siblings doing the same own-job share the row), then a grown-up's part
 * where the moment has one. Never more than MAX_ROWS rows; never a job nobody can do.
 */
export function prepareMoment(ctx: FamilyContext, momentId: string, anchor: AnchorId, load: Map<string, number>): Row[] {
  const jobs = JOBS.filter((j) => j.anchor === anchor && (!j.pets || ctx.pets));
  const rows: Row[] = [];
  const taken = new Set<string>();
  const busy = new Set<string>();
  const add = (j: Job, owners: string[], established = false) => {
    rows.push({ id: `${momentId}:${j.id}`, moment: momentId, job: j.id, title: j.title, owners, ...(established ? { established: true } : {}) });
    taken.add(j.id);
    owners.forEach((o) => { busy.add(o); load.set(o, (load.get(o) ?? 0) + 1); });
  };
  // 1. What someone already takes care of: their job here, shown as established.
  for (const j of jobs) {
    if (!j.areas?.length || j.own) continue;
    const owners = j.areas.flatMap((a) => existingFor(ctx, a).owners).filter((id, i, a) => a.indexOf(id) === i);
    const others = ctx.adults.some((a) => !a.holder);
    const score = (p: Person) => (load.get(p.id) ?? 0) + (p.holder && others ? HOLDER_LEAN : 0);
    const who = ctx.people.filter((p) => owners.includes(p.id) && !busy.has(p.id) && fits(j, p, ctx)).sort((a, b) => score(a) - score(b));
    // Only an owner the profile names specifically for this kind of job (pets → feeding them; meals → the grown-up
    // kitchen job), the least busy first, the account holder last.
    if (who.length && (j.pets || (j.adult && who.every((p) => p.kind === 'adult')))) add(j, [who[0].id], true);
  }
  // 2. Each child without a part here: a wished job first, else the hardest job they can do that's still open.
  //    A large family simplifies: once the rows a moment holds are spoken for (one kept for a grown-up's job), the
  //    youngest join a sibling's own-job row ("Make my bed": Nia & Theo) instead of a row each.
  const kids = ctx.children.filter((c) => !busy.has(c.id)).sort((a, b) => ageOf(b) - ageOf(a));
  const room = MAX_ROWS - (jobs.some((j) => j.adult && !taken.has(j.id)) && ctx.adults.length ? 1 : 0);
  const join = (r: Row, id: string) => { r.owners.push(id); busy.add(id); load.set(id, (load.get(id) ?? 0) + 1); };
  const slots = Math.max(0, room - rows.length);
  // Too many children for a row each: the oldest get their own jobs, the rest share one own-job row.
  const solo = kids.length > slots ? kids.slice(0, Math.max(0, slots - 1)) : kids;
  const group = kids.slice(solo.length);
  for (const kid of solo) {
    const able = jobs.filter((j) => !j.adult && fits(j, kid, ctx));
    const open = able.filter((j) => !taken.has(j.id) || j.own);
    const wished = open.filter((j) => j.wishes?.length && wishedFor(ctx, j.wishes).ids.includes(kid.id));
    const pick = wished[0] ?? [...open.filter((j) => !j.own)].sort((a, b) => b.minAge - a.minAge)[0] ?? open.find((j) => j.own);
    if (!pick) continue;
    const same = pick.own ? rows.find((r) => r.job === pick.id && !r.established) : undefined;
    if (same) join(same, kid.id);
    else add(pick, [kid.id]);
  }
  if (group.length) {
    const own = jobs.filter((j) => j.own && !j.adult);
    const best = [...own].sort((a, b) => group.filter((k) => fits(b, k, ctx)).length - group.filter((k) => fits(a, k, ctx)).length)[0];
    const who = best ? group.filter((k) => fits(best, k, ctx)).map((k) => k.id) : [];
    const same = best && rows.find((r) => r.job === best.id && !r.established);
    if (best && who.length) { if (same) who.forEach((id) => join(same, id)); else add(best, who); }
  }
  // 3. A grown-up's part, where the moment has a grown-up job and nobody has it yet (the one with the least on the
  //    chart; the account holder leans last). A family with no children: the grown-ups share the moment.
  const adultJobs = jobs.filter((j) => j.adult && !taken.has(j.id));
  const adults = ctx.adults.filter((a) => !busy.has(a.id));
  for (const j of adultJobs.slice(0, ctx.children.length ? 1 : 2)) {
    if (rows.length >= MAX_ROWS || !adults.length) break;
    const others = adults.filter((a) => !a.holder).length;
    const score = (p: Person) => (load.get(p.id) ?? 0) + (p.holder && others ? HOLDER_LEAN : 0) + stableHash(`march:${j.id}:${p.id}`) / 2 ** 32 / 100;
    const who = [...adults].sort((a, b) => score(a) - score(b))[0];
    adults.splice(adults.indexOf(who), 1);
    add(j, [who.id]);
  }
  // No children old enough for anything here and no grown-up job: a grown-up takes the simplest shared job.
  if (!rows.length && ctx.adults.length) {
    const j = jobs.find((x) => !x.own);
    if (j) add(j, [ctx.adults.find((a) => !a.holder)?.id ?? ctx.adults[0].id]);
  }
  return rows.slice(0, MAX_ROWS);
}

/** The one or two new habits: a job she wished a child would take on, else the most meaningful new job, one a moment. */
export function suggestedHabits(ctx: FamilyContext, rows: readonly Row[], moments: readonly Moment[]): string[] {
  const on = new Set(moments.filter((m) => m.enabled).map((m) => m.id));
  const open = rows.filter((r) => on.has(r.moment) && !r.established);
  // The children's new jobs; a family without children practices a grown-up one.
  const kids = open.filter((r) => r.owners.some((o) => ctx.children.some((c) => c.id === o)));
  const fresh = kids.length ? kids : open;
  const wished = fresh.filter((r) => {
    const j = r.job ? jobById(r.job) : undefined;
    return j?.wishes?.length && r.owners.some((o) => wishedFor(ctx, j.wishes!).ids.includes(o) || wishedFor(ctx, j.wishes!).anyone);
  });
  const weight = (r: Row) => (r.job ? jobById(r.job)?.minAge ?? 0 : 0) + (jobById(r.job ?? '')?.own ? 0 : 3);
  const ranked = [...wished, ...[...fresh].sort((a, b) => weight(b) - weight(a))].filter((r, i, a) => a.indexOf(r) === i);
  // Prefer two different children in two different moments; settle for less overlap only when there's no choice.
  const out: Row[] = [];
  const clash = (a: Row, b: Row) => a.moment === b.moment || a.owners.some((x) => b.owners.includes(x));
  for (const r of ranked) if (out.length < MAX_HABITS && !out.some((o) => clash(o, r))) out.push(r);
  for (const r of ranked) if (out.length < MAX_HABITS && !out.includes(r) && !out.some((o) => o.owners.some((x) => r.owners.includes(x)))) out.push(r);
  return out.map((r) => r.id);
}

/** The whole prepared plan for this family: two moments on, a third offered; jobs; one or two new habits. */
export function preparedPlan(ctx: FamilyContext): RhythmPlan {
  const [a, b, c] = suggestedAnchors(ctx);
  const moments: Moment[] = [{ id: 'm1', anchor: a, enabled: true }, { id: 'm2', anchor: b, enabled: true }, { id: 'm3', anchor: c, enabled: false }];
  const load = new Map<string, number>();
  const rows = moments.flatMap((m) => prepareMoment(ctx, m.id, m.anchor, load));
  return { moments, rows, habits: suggestedHabits(ctx, rows, moments) };
}

// ------------------------------------------------------------------ the view

export interface RowView {
  id: string; title: string; icon: MarchIcon | null; established: boolean; habit: boolean;
  owners: { id: string; name: string; color: MemberColor; adult: boolean }[];
  /** She typed a job that has to happen before this moment's cue (warned in the editor). */
  misfit: boolean;
}
export interface MomentView { id: string; anchor: AnchorId; title: string; cue: string; reset: string; enabled: boolean; rows: RowView[]; finish: string }

const joinFinish = (parts: string[]) => {
  const list = [...new Set(parts)].slice(0, 3);
  if (!list.length) return '';
  const text = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
};

export function rhythmView(s: RhythmState, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const ctx = ctxOf(members, prefs, s.profile);
  const plan = s.plan ? cleanPlan(s.plan, ctx) : preparedPlan(ctx);
  const person = (id: string) => ctx.people.find((p) => p.id === id);
  const moments: MomentView[] = plan.moments.map((m) => {
    const a = anchorById(m.anchor);
    const rows: RowView[] = plan.rows.filter((r) => r.moment === m.id && r.title.trim() && r.owners.some((o) => person(o))).map((r) => {
      const j = r.job ? jobById(r.job) : undefined;
      return {
        id: r.id, title: r.title, icon: j && j.title === r.title ? j.icon : j?.icon ?? null, established: Boolean(r.established), habit: plan.habits.includes(r.id),
        owners: r.owners.map(person).filter((p): p is Person => Boolean(p)).map((p) => ({ id: p.id, name: p.name, color: colorFor(ctx.colors, p.id), adult: p.kind === 'adult' })),
        misfit: !j && !fitsCue(m.anchor, r.title),
      };
    });
    const finish = joinFinish(plan.rows.filter((r) => r.moment === m.id && rows.some((x) => x.id === r.id)).map((r) => {
      const j = r.job ? jobById(r.job) : undefined;
      return j ? j.finish : '';
    }).filter(Boolean)) || (rows.length ? 'Everyone’s part is done.' : '');
    return { id: m.id, anchor: m.anchor, title: m.label?.trim() || a.title, cue: a.cue, reset: a.reset, enabled: m.enabled, rows, finish };
  });
  // Only moments with someone's part print: never an empty section.
  const printed = moments.filter((m) => m.enabled && m.rows.length);
  const habits = printed.flatMap((m) => m.rows.filter((r) => r.habit).map((r) => ({ ...r, moment: m.title })));
  return {
    moments, printed, habits,
    /** Everyone, in household order, with their January colors (the header legend and the "who" pickers). */
    people: ctx.people.map((p) => ({ id: p.id, name: p.name, color: colorFor(ctx.colors, p.id), adult: p.kind === 'adult', age: p.age })),
    changed: Boolean(s.plan),
    ctx,
  };
}
export type RhythmView = ReturnType<typeof rhythmView>;

export const rhythmFingerprint = (s: RhythmState, members: readonly RhythmMember[], prefs?: ContextPrefs) => {
  const v = rhythmView(s, members, prefs);
  return JSON.stringify(v.printed.map((m) => [m.title, m.cue, m.finish, m.rows.map((r) => [r.title, r.icon, r.habit, r.established, r.owners.map((o) => [o.name, o.color.id])])]));
};

// ------------------------------------------------------------------ edits (each changes `s` in place and returns it)

/** Her plan to edit: the saved one, or the prepared one written down the first time she changes anything. */
const own = (s: RhythmState, members: readonly RhythmMember[], prefs?: ContextPrefs) => (s.plan ??= preparedPlan(ctxOf(members, prefs, s.profile)));
const tidy = (t: string, max: number) => t.replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Change a moment to another shared moment. Its jobs are prepared again for the new moment (a job has to fit its cue:
 * clearing breakfast dishes can't follow dinner), keeping the same people where they can do the new jobs.
 */
export function setAnchor(s: RhythmState, momentId: string, anchor: AnchorId, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  const m = plan.moments.find((x) => x.id === momentId);
  if (!m || m.anchor === anchor || plan.moments.some((x) => x.id !== momentId && x.anchor === anchor && x.enabled)) return s;
  m.anchor = anchor;
  delete m.label;
  const ctx = ctxOf(members, prefs, s.profile);
  const load = new Map<string, number>();
  for (const r of plan.rows) if (r.moment !== momentId) r.owners.forEach((o) => load.set(o, (load.get(o) ?? 0) + 1));
  plan.rows = [...plan.rows.filter((r) => r.moment !== momentId), ...prepareMoment(ctx, momentId, anchor, load)];
  plan.habits = plan.habits.filter((h) => plan.rows.some((r) => r.id === h));
  if (!plan.habits.length) plan.habits = suggestedHabits(ctx, plan.rows, plan.moments);
  return s;
}
export function setMomentLabel(s: RhythmState, momentId: string, label: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const m = own(s, members, prefs).moments.find((x) => x.id === momentId);
  if (!m) return s;
  const clean = tidy(label, LABEL_LIMIT);
  if (clean && clean !== anchorById(m.anchor).title) m.label = clean; else delete m.label;
  return s;
}
/** Turn the optional third moment on (prepared with jobs if it has none) or off. The first two always stay on. */
export function setMomentOn(s: RhythmState, momentId: string, on: boolean, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  const i = plan.moments.findIndex((x) => x.id === momentId);
  if (i < 2) return s;
  const m = plan.moments[i];
  m.enabled = on;
  if (on && !plan.rows.some((r) => r.moment === m.id)) {
    const ctx = ctxOf(members, prefs, s.profile);
    const load = new Map<string, number>();
    for (const r of plan.rows) r.owners.forEach((o) => load.set(o, (load.get(o) ?? 0) + 1));
    plan.rows.push(...prepareMoment(ctx, m.id, m.anchor, load));
  }
  if (!on) plan.habits = plan.habits.filter((h) => plan.rows.find((r) => r.id === h)?.moment !== m.id);
  return s;
}
export function setRowTitle(s: RhythmState, rowId: string, title: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const r = own(s, members, prefs).rows.find((x) => x.id === rowId);
  const clean = tidy(title, TITLE_LIMIT);
  if (r && clean) { r.title = clean; if (r.job && jobById(r.job)?.title !== clean) delete r.job; }
  return s;
}
/** Who owns a row: one person, or siblings sharing it. Never nobody. */
export function setRowOwners(s: RhythmState, rowId: string, owners: readonly string[], members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const r = own(s, members, prefs).rows.find((x) => x.id === rowId);
  const ids = new Set(members.filter((m) => !m.archived).map((m) => m.id));
  const list = [...new Set(owners)].filter((o) => ids.has(o));
  if (r && list.length) r.owners = list;
  return s;
}
export function moveRow(s: RhythmState, rowId: string, momentId: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  const r = plan.rows.find((x) => x.id === rowId);
  if (r && plan.moments.some((m) => m.id === momentId) && plan.rows.filter((x) => x.moment === momentId).length < MAX_ROWS) {
    r.moment = momentId;
    // A library job moved to a moment it doesn't belong to keeps its words, not its library link.
    if (r.job && jobById(r.job)?.anchor !== plan.moments.find((m) => m.id === momentId)!.anchor) delete r.job;
  }
  return s;
}
/** Add a job to a moment: one from the moment's list (by id) or her own words. */
export function addRow(s: RhythmState, momentId: string, owner: string, members: readonly RhythmMember[], prefs?: ContextPrefs, jobId?: string, title?: string) {
  const plan = own(s, members, prefs);
  const m = plan.moments.find((x) => x.id === momentId);
  if (!m || plan.rows.filter((r) => r.moment === momentId).length >= MAX_ROWS) return s;
  const j = jobId ? jobById(jobId) : undefined;
  const text = j?.title ?? tidy(title ?? '', TITLE_LIMIT);
  if (!text) return s;
  const id = `${momentId}:${j?.id ?? 'own'}:${stableHash(`${text}:${owner}:${plan.rows.length}`).toString(36)}`;
  plan.rows.push({ id, moment: momentId, ...(j && j.anchor === m.anchor ? { job: j.id } : {}), title: text, owners: [owner] });
  return s;
}
export function removeRow(s: RhythmState, rowId: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  plan.rows = plan.rows.filter((r) => r.id !== rowId);
  plan.habits = plan.habits.filter((h) => h !== rowId);
  return s;
}
/** Mark a row as one of the new habits (at most two), or not. */
export function setHabit(s: RhythmState, rowId: string, on: boolean, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  if (!plan.rows.some((r) => r.id === rowId)) return s;
  plan.habits = on ? [...plan.habits.filter((h) => h !== rowId), rowId].slice(-MAX_HABITS) : plan.habits.filter((h) => h !== rowId);
  return s;
}
/** Back to the prepared plan; the profile snapshot goes too, so it's prepared from her newest answers. */
export const restorePlan = (s: RhythmState) => { delete s.plan; delete s.profile; return s; };

/** Her plan, kept to this family: people who left drop out; a row with nobody left is removed; at most two habits. */
export function cleanPlan(plan: RhythmPlan, ctx: FamilyContext): RhythmPlan {
  const ids = new Set(ctx.people.map((p) => p.id));
  const rows = plan.rows.map((r) => ({ ...r, owners: r.owners.filter((o) => ids.has(o)) })).filter((r) => r.owners.length);
  return { moments: plan.moments, rows, habits: plan.habits.filter((h) => rows.some((r) => r.id === h)).slice(0, MAX_HABITS) };
}
export const applyFamily = (s: RhythmState, members: readonly RhythmMember[], prefs?: ContextPrefs) => {
  if (s.plan) s.plan = cleanPlan(s.plan, ctxOf(members, prefs, s.profile));
  if (s.profile && !isFamilySnapshot(s.profile)) delete s.profile;
  return s;
};

// ------------------------------------------------------------------ saved state

const isRow = (r: Partial<Row> | null) => Boolean(r && typeof r.id === 'string' && typeof r.moment === 'string' && typeof r.title === 'string' && r.title.length <= 80
  && Array.isArray(r.owners) && r.owners.every((o) => typeof o === 'string') && (r.job === undefined || typeof r.job === 'string'));
export function isRhythmState(x: unknown): x is RhythmState {
  const s = x as Partial<RhythmState> | null;
  if (!s || s.v !== 3) return false;
  if (s.profile !== undefined && !isFamilySnapshot(s.profile)) return false;
  if (s.plan === undefined) return true;
  const p = s.plan;
  return Array.isArray(p.moments) && p.moments.length <= MAX_MOMENTS && p.moments.every((m) => m && typeof m.id === 'string' && ANCHORS.some((a) => a.id === m.anchor) && typeof m.enabled === 'boolean')
    && Array.isArray(p.rows) && p.rows.length <= MAX_ROWS * MAX_MOMENTS && p.rows.every(isRow)
    && Array.isArray(p.habits) && p.habits.every((h) => typeof h === 'string');
}

/**
 * The earlier March page saved per-person chore charts here ({ palette, kids: { [memberId]: { daily, weekly } } }).
 * A family that changed those charts keeps who-does-what where a chore matches a rhythm job: it becomes an
 * established part of the prepared plan's matching moment. Everything else starts from the prepared plan.
 */
const LEGACY: Record<string, string> = {
  'make-my-bed': 'b-bed', 'feed-pets': 'b-pets', 'clear-the-table': 'd-clear', 'wipe-the-counters': 'd-wipe', 'take-out-the-trash': 'd-trash',
  dishwasher: 'b-dishwasher', 'put-clothes-away': 't-clothes', 'put-toys-away': 't-toys', 'tidy-my-desk': 't-bag',
};
export function fromLegacy(x: unknown, members: readonly RhythmMember[], prefs?: ContextPrefs, snapshot?: FamilySnapshot): RhythmState | null {
  const old = x as { palette?: unknown; kids?: Record<string, { daily?: { id?: string }[] }> } | null;
  if (!old || typeof old !== 'object' || (old as { v?: unknown }).v === 3 || !old.kids || typeof old.kids !== 'object') return null;
  const s: RhythmState = { v: 3, ...(snapshot ? { profile: snapshot } : {}) };
  const edited = Object.entries(old.kids).filter(([, k]) => Array.isArray(k?.daily));
  if (!edited.length) return s;
  const plan = own(s, members, prefs);
  const ctx = ctxOf(members, prefs, snapshot);
  for (const [memberId, k] of edited) {
    if (!ctx.people.some((p) => p.id === memberId)) continue;
    for (const d of k.daily ?? []) {
      const job = d.id ? jobById(LEGACY[d.id] ?? '') : undefined;
      const m = job && plan.moments.find((mm) => mm.anchor === job.anchor && mm.enabled);
      if (!job || !m) continue;
      const row = plan.rows.find((r) => r.moment === m.id && r.job === job.id);
      if (row) { if (!row.owners.includes(memberId)) row.owners = job.own ? [...row.owners, memberId] : [memberId]; row.established = true; }
      else if (plan.rows.filter((r) => r.moment === m.id).length < MAX_ROWS) plan.rows.push({ id: `${m.id}:${job.id}`, moment: m.id, job: job.id, title: job.title, owners: [memberId], established: true });
    }
  }
  plan.habits = plan.habits.filter((h) => !plan.rows.find((r) => r.id === h)?.established);
  if (!plan.habits.length) plan.habits = suggestedHabits(ctx, plan.rows, plan.moments);
  return s;
}

export interface RhythmPlanResource extends PlanResource<RhythmState> {
  view: () => RhythmView;
  members: () => RhythmMember[];
  prefs: () => ContextPrefs;
  familyName: () => string;
  setLocked: (on: boolean) => void;
  /** The desktop editor, open at a section if given. */
  openEditor: (section?: 'moments' | 'owners' | 'habits') => void;
}
