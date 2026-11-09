/**
 * Our Family Rhythm: one family, two or three shared moments, everyone owns their part. The one engine for every place
 * the Family Rhythm appears: March 2027 (/app/club/march, through ./march-family-rhythm.ts) and, from Phase 2b, the
 * permanent Welcome resource (docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md).
 * (Printable and desktop editor: src/components/club/MarchFamilyRhythm.astro; phone screen and reference view:
 * MarchPlanMobile.astro; editor: src/lib/club/march-rhythm-editor.ts; docs/club/PLAN_ARCHITECTURE.md → March.)
 *
 * Ages are taken on the first day of the plan's month (`RhythmState.month`, saved with the plan like the profile
 * snapshot, so a saved plan never shifts as children grow). A plan without one is March 2027's (`KIT_MONTH`).
 * Pure functions only, so the sheet, the rail and the phone read one plan. Built on the shared personalization
 * foundation (../personalize/), like January.
 *
 * The model is cue → action → finish:
 * - Cue: a moment the family already shares (after breakfast, after dinner, coming home…), never a clock time. Sharing
 *   a moment is not sharing a job: everyone can act after dinner while each owns something different.
 * - Action: a small, concrete, observable job with clear ownership (`ownershipOf`):
 *     individual           one person owns it (one row, one owner);
 *     parallel_individual  a personal job several people each do for themselves ("Lay out tomorrow's clothes"):
 *                          stored as one row PER PERSON, so each is edited, removed or made a habit on its own; the
 *                          sheet may show them on one line, marked "each their own";
 *     joint                one shared outcome several people work on together ("Put the shared toys away together"):
 *                          one row, several owners, `share: 'joint'`. Only when she chooses it (or the job is made for
 *                          it); never inferred from two people having the same title or the same moment.
 * - Finish: what "done" looks like, written from the jobs actually on that moment, every time it's drawn.
 *
 * Recommendations: the smallest set of meaningful jobs that shares the work. Deterministic (ties by stable hash).
 * 1. Moments first: two from her priority and challenges, a third offered but off.
 * 2. Each moment holds only as many household jobs as the people who can take part call for (`householdBudget`: one
 *    for a one-person home, four at most), never one per person. Order of claim: what someone already takes care of
 *    (leaving room for the jobs the moment can't do without), jobs she wished a child would take on, the moment's
 *    essential jobs (to the child with the fewest parts so far, then the youngest who can), grown-ups for what's left
 *    or what only a grown-up does, and optional jobs only if room remains.
 * 3. A personal routine job (the bedtime hamper, clearing your own breakfast plate) for children ten and under who
 *    have no part in that moment, or anyone she wished it for. Not for teenagers as filler.
 * 4. One new habit by default: a job she named for a particular child first, else the most meaningful new job. A
 *    second only when she named it for a different child too. Never something already theirs.
 * `validatePlan` checks every plan; edits that would break it are refused with the reason. No points, rewards, streaks,
 * percentages or tracking.
 */
import type { PlanResource } from '../plan/resource';
import { HOLDER_LEAN, taskAge } from '../personalize/assign';
import { colorFor, type MemberColor } from '../personalize/colors';
import { familyContext, isFamilySnapshot, wishedFor, type ContextMember, type ContextPrefs, type FamilyContext, type FamilySnapshot, type Person } from '../personalize/family';
import { stableHash } from '../hash';
import type { MarchIcon } from '../../../data/club/march-chore-icons';

/** March 2027: the month a plan without its own `month` is prepared for (every March plan). */
export const KIT_MONTH = '2027-03';
export const MAX_ROWS = 5;
export const MAX_MOMENTS = 3;
export const TITLE_LIMIT = 40;
export const LABEL_LIMIT = 32;
export const MAX_HABITS = 2;
/** Personal routine jobs are recommended to children this age and under (older ones only when she wished it). */
const ROUTINE_AGE = 10;

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
  /** How a sentence says when ("after dinner"). */
  when: string;
}
/** Shared moments families already have, in the order of the day. */
export const ANCHORS: readonly Anchor[] = [
  { id: 'breakfast', title: 'After Breakfast', cue: 'Breakfast finishes', reset: 'Our morning reset', when: 'after breakfast' },
  { id: 'leave', title: 'Before We Head Out', cue: 'Shoes go on', reset: 'Our out-the-door check', when: 'before we head out' },
  { id: 'home', title: 'When We Get Home', cue: 'We walk in the door', reset: 'Our coming-home reset', when: 'when we get home' },
  { id: 'dinner', title: 'After Dinner', cue: 'Dinner finishes', reset: 'Our kitchen reset', when: 'after dinner' },
  { id: 'teeth', title: 'After Brushing Teeth', cue: 'Teeth are brushed', reset: 'Our bedtime wind-down', when: 'after brushing teeth' },
];
export const anchorById = (id: AnchorId) => ANCHORS.find((a) => a.id === id)!;

// ------------------------------------------------------------------ the jobs

/**
 * A job a moment can hold.
 * - `own`: an individual job, each person doing their own (their plate, their shoes); several people share its row.
 *   Otherwise a household job: one owner.
 * - `core`: the moment needs it done (clearing after dinner); a grown-up takes it when no child can. Other jobs are
 *   offered only when there's someone for them.
 * - `finish`: how the finish line says it's done. `areas` / `wishes`: profile answers (step 3 / step 4) that point
 *   at its owner. `adult`: a grown-up job (a teen of `minAge` may take it).
 */
export interface Job {
  id: string; anchor: AnchorId; title: string; icon: MarchIcon | null; minAge: number; finish: string;
  own?: boolean; core?: boolean; adult?: boolean; pets?: boolean; areas?: string[]; wishes?: string[];
  /** A shared outcome made for several people working together (joint ownership when more than one owns it). Offered
   *  in the editor; never recommended without her choosing it, since the family page doesn't say what's shared. */
  joint?: boolean;
}
export const JOBS: readonly Job[] = [
  // After breakfast
  { id: 'b-dishes', anchor: 'breakfast', title: 'Clear my breakfast dishes', icon: 'clear-dishes', minAge: 3, own: true, core: true, finish: 'plates are cleared', wishes: ['help-with-meals'] },
  { id: 'b-table', anchor: 'breakfast', title: 'Wipe the breakfast table', icon: 'wipe-surface', minAge: 6, core: true, finish: 'the table is wiped', areas: ['cleaning'] },
  { id: 'b-pets', anchor: 'breakfast', title: 'Feed the pets', icon: 'feed-pets', minAge: 4, pets: true, finish: 'the pets are fed', areas: ['pet-care'], wishes: ['pet-care'] },
  { id: 'b-food', anchor: 'breakfast', title: 'Put breakfast food away', icon: null, minAge: 6, finish: 'food is put away', areas: ['meals'] },
  { id: 'b-dishwasher', anchor: 'breakfast', title: 'Empty the dishwasher', icon: 'empty-dishwasher', minAge: 8, finish: 'the dishwasher is empty', areas: ['meals'] },
  { id: 'b-bed', anchor: 'breakfast', title: 'Make my bed', icon: 'make-bed', minAge: 4, own: true, finish: 'beds are made', wishes: ['tidy-room'] },
  { id: 'b-load', anchor: 'breakfast', title: 'Load the breakfast dishes', icon: 'empty-dishwasher', minAge: 12, adult: true, finish: 'dishes are loaded', areas: ['meals'] },
  // Before we head out
  { id: 'l-shoes', anchor: 'leave', title: 'Put on my shoes and coat', icon: 'shoes-away', minAge: 3, own: true, core: true, finish: 'shoes and coats are on' },
  { id: 'l-bag', anchor: 'leave', title: 'Grab my backpack', icon: null, minAge: 4, own: true, finish: 'backpacks are in hand', wishes: ['pack-school-bag', 'own-belongings'] },
  { id: 'l-lights', anchor: 'leave', title: 'Turn off the lights', icon: null, minAge: 6, finish: 'the lights are off' },
  { id: 'l-door', anchor: 'leave', title: 'Lock the door', icon: null, minAge: 16, adult: true, finish: 'the door is locked', areas: ['transportation'] },
  // When we get home
  { id: 'h-shoes', anchor: 'home', title: 'Put my shoes and coat away', icon: 'shoes-away', minAge: 3, own: true, core: true, finish: 'shoes and coats are away', wishes: ['own-belongings'] },
  { id: 'h-backpack', anchor: 'home', title: 'Hang up my backpack', icon: null, minAge: 4, own: true, finish: 'backpacks are hung up', wishes: ['own-belongings', 'pack-school-bag'] },
  { id: 'h-lunchbox', anchor: 'home', title: 'Empty my lunch box', icon: 'clear-dishes', minAge: 5, own: true, finish: 'lunch boxes are empty', wishes: ['help-with-meals'] },
  { id: 'h-papers', anchor: 'home', title: 'Go through school papers', icon: 'tidy-desk', minAge: 16, adult: true, finish: 'school papers are sorted', areas: ['school-prep', 'homework'] },
  // After dinner
  { id: 'd-clear', anchor: 'dinner', title: 'Clear the dinner table', icon: 'clear-dishes', minAge: 4, core: true, finish: 'the table is clear', areas: ['meals'], wishes: ['help-with-meals'] },
  { id: 'd-load', anchor: 'dinner', title: 'Load the dishwasher', icon: 'empty-dishwasher', minAge: 9, core: true, finish: 'dishes are loaded', areas: ['meals'], wishes: ['help-with-meals'] },
  { id: 'd-wipe', anchor: 'dinner', title: 'Wipe the counters', icon: 'wipe-surface', minAge: 6, finish: 'counters are wiped', areas: ['cleaning'], wishes: ['help-with-meals'] },
  { id: 'd-sweep', anchor: 'dinner', title: 'Sweep under the table', icon: 'clean-floor', minAge: 7, finish: 'the floor is swept', areas: ['cleaning'] },
  { id: 'd-pets', anchor: 'dinner', title: 'Feed the pets', icon: 'feed-pets', minAge: 4, pets: true, finish: 'the pets are fed', areas: ['pet-care'], wishes: ['pet-care'] },
  { id: 'd-trash', anchor: 'dinner', title: 'Take out the trash', icon: 'take-out-trash', minAge: 10, finish: 'the trash is out', areas: ['cleaning'] },
  { id: 'd-plate', anchor: 'dinner', title: 'Clear my own plate', icon: 'clear-dishes', minAge: 3, own: true, finish: 'plates are cleared', wishes: ['help-with-meals'] },
  { id: 'd-leftovers', anchor: 'dinner', title: 'Put leftovers away', icon: 'clean-fridge', minAge: 10, finish: 'leftovers are away', areas: ['meals'] },
  // After brushing teeth: individual wind-down jobs; the kitchen is done by now.
  { id: 't-clothes', anchor: 'teeth', title: 'Put dirty clothes in the hamper', icon: 'clothes-away', minAge: 3, own: true, core: true, finish: 'dirty clothes are in the hamper', wishes: ['put-away-laundry', 'bedtime-routine'] },
  { id: 't-bathroom', anchor: 'teeth', title: 'Put my toothbrush and cup away', icon: 'wipe-sink', minAge: 3, own: true, finish: 'the bathroom counter is clear', wishes: ['bedtime-routine'] },
  { id: 't-bag', anchor: 'teeth', title: 'Pack my backpack for tomorrow', icon: 'tidy-desk', minAge: 6, own: true, finish: 'backpacks are packed', wishes: ['pack-school-bag'] },
  { id: 't-outfit', anchor: 'teeth', title: 'Lay out tomorrow’s clothes', icon: 'clothes-away', minAge: 5, own: true, finish: 'clothes are laid out', wishes: ['morning-routine'] },
  { id: 't-toys', anchor: 'teeth', title: 'Put my toys away', icon: 'toys-away', minAge: 2, own: true, finish: 'toys are put away', wishes: ['tidy-room'] },
  // Together jobs: one shared outcome.
  { id: 't-shared-toys', anchor: 'teeth', title: 'Put the shared toys away together', icon: 'toys-away', minAge: 3, joint: true, finish: 'the shared toys are put away' },
  { id: 'h-entry', anchor: 'home', title: 'Reset the entryway together', icon: 'shoes-away', minAge: 4, joint: true, finish: 'the entryway is clear' },
];
export const jobById = (id: string) => JOBS.find((j) => j.id === id);

/**
 * A job that can't follow its moment's cue: anything that must happen before it (making or setting up the meal after
 * the meal, getting ready for bed after bedtime, leaving prep after coming home). Checked for every job, library or
 * typed; the library never fails it.
 */
const BEFORE_CUE: Partial<Record<AnchorId, RegExp>> = {
  breakfast: /\b(make|cook|prepare|set)\b.*\bbreakfast\b|\bset the table\b|\bwake\b/i,
  leave: /\b(eat|make)\b.*\bbreakfast\b|\bwake\b/i,
  home: /\b(pack|grab)\b.*\b(backpack|bag)\b.*\b(school|out)\b/i,
  dinner: /\b(make|cook|prepare|start|help (make|cook))\b.*\b(dinner|supper)\b|\bset the table\b/i,
  teeth: /\bbrush\b.*\bteeth\b|\b(load|start|run)\b.*\bdishwasher\b|\b(clear|wipe)\b.*\btable\b|\bdinner\b/i,
};
export const fitsCue = (anchor: AnchorId, title: string) => !BEFORE_CUE[anchor]?.test(title);

/**
 * A job's identity for duplicate checks: words lowercased, "my/the/a/our" and trailing numbers or punctuation
 * dropped ("Put away every library book and game 2" = "… game 0"; "Wipe the counters" = "wipe counters").
 */
export const jobKey = (title: string) => title.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\b(my|the|a|an|our|your|every|all)\b/g, ' ').replace(/(\s+\d+)+\s*$/, '').replace(/\s+/g, ' ').trim();

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
  /** Several owners working on one shared outcome (joint ownership). Without it a row has one owner. */
  share?: 'joint';
  /** Earlier saves (before `share`): the same meaning. Read on load, never written. */
  together?: boolean;
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
  /**
   * The month (YYYY-MM) ages are taken from. Absent: March 2027 (`KIT_MONTH`), so March plans are read exactly as
   * before. Set once by a context that isn't March (the Welcome resource) and kept, like `profile`.
   */
  month?: string;
  /**
   * Where the plan is used. 'welcome': the permanent Welcome resource, whose default new habit comes from the moment
   * she most wants to stop managing (her step-6 priority) when she named no job for a child. Absent: March, unchanged.
   */
  context?: 'welcome';
}
export interface RhythmMember extends ContextMember { kind: 'adult' | 'child'; role?: string }

export const freshState = (): RhythmState => ({ v: 3 });

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** This month in New York (YYYY-MM): the month a new Welcome plan takes its ages from. */
export const welcomeMonth = (now: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${parts.find((x) => x.type === 'year')!.value}-${parts.find((x) => x.type === 'month')!.value}`;
};
/** The month a plan's ages are taken from. */
export const monthOf = (s: Pick<RhythmState, 'month'>) => (s.month && MONTH_RE.test(s.month) ? s.month : KIT_MONTH);
const ctxOf = (members: readonly RhythmMember[], prefs: ContextPrefs | undefined, s: Pick<RhythmState, 'profile' | 'month'>): FamilyContext =>
  familyContext(members, prefs, monthOf(s), s.profile);
/** The family as a plan sees it: its people, ages in the plan's month, colors and profile snapshot. */
export const rhythmContext = ctxOf;

/** A personal job (each does their own): a library `own` job, or one she typed in the first person. */
export const isIndividual = (r: Pick<Row, 'job' | 'title'>) => {
  const j = r.job ? jobById(r.job) : undefined;
  return j ? Boolean(j.own) : /\b(my|mine)\b/i.test(r.title);
};
export type Ownership = 'individual' | 'parallel_individual' | 'joint';
/** How a row is owned: joint (one shared outcome), parallel (the same personal job, each their own) or individual. */
export function ownershipOf(r: Row, plan: Pick<RhythmPlan, 'rows'>): Ownership {
  if (r.owners.length > 1) return 'joint';
  if (!isIndividual(r)) return 'individual';
  const key = jobKey(r.title);
  return plan.rows.some((x) => x !== r && x.moment === r.moment && isIndividual(x) && jobKey(x.title) === key) ? 'parallel_individual' : 'individual';
}

// ------------------------------------------------------------------ recommendations

/** The two moments that fit her answers best, then the one offered as a third. */
export function suggestedAnchors(ctx: FamilyContext): [AnchorId, AnchorId, AnchorId] {
  const p = ctx.snapshot?.priority;
  const hard = (c: string) => Boolean(ctx.snapshot?.challenges?.includes(c));
  const has = (cat: string) => Boolean(ctx.snapshot?.responsibilities.some((r) => r.category === cat));
  if (p === 'bedtime') return ['teeth', 'dinner', 'breakfast'];
  if (p === 'evenings' || p === 'tidying') return ['dinner', 'teeth', 'breakfast'];
  if (p === 'school-stuff') return ['home', 'dinner', 'teeth'];
  if (p === 'mornings' || (!p && hard('routines'))) return ['breakfast', 'dinner', 'leave'];
  if (has('school-prep') || has('homework')) return ['breakfast', 'dinner', 'home'];
  // No children: the two kitchen resets are the moments a grown-up household shares.
  if (!ctx.children.length) return ['breakfast', 'dinner', 'leave'];
  return ['breakfast', 'dinner', 'teeth'];
}

const ageOf = (p: Person) => (p.kind === 'adult' ? 99 : taskAge(p) ?? 6);
const fits = (j: Job, p: Person, ctx: FamilyContext) =>
  (!j.pets || ctx.pets) && (p.kind === 'adult' ? !j.own || !ctx.children.length : ageOf(p) >= j.minAge);

/** Someone already takes care of this kind of job (step 3): it's theirs, as context, never a habit to practice. */
export function alreadyOwns(ctx: FamilyContext, job: Job | undefined, personId: string) {
  if (!job) return false;
  const keys = new Set([...(job.areas ?? []), ...(job.wishes ?? [])]);
  return Boolean(ctx.snapshot?.responsibilities.some((r) => r.status === 'existing' && r.ownerIds.includes(personId) && (keys.has(r.category) || (r.item && keys.has(r.item)))));
}
const wishedOf = (ctx: FamilyContext, j: Job, id: string) => Boolean(j.wishes?.length && wishedFor(ctx, j.wishes).ids.includes(id));

/**
 * How many household jobs a moment holds: from the people who can take part in it (grown-ups and the children old
 * enough for one of its household jobs), not one per person. One for a one-person home, four at most.
 */
export function householdBudget(participants: number) {
  return participants <= 1 ? 1 : participants <= 3 ? 2 : participants <= 6 ? 3 : 4;
}

/**
 * The prepared rows for one moment (see the header). `load` counts each person's parts across the plan so far, so a
 * busy person isn't picked first. Personal jobs are one row per person.
 */
export function prepareMoment(ctx: FamilyContext, momentId: string, anchor: AnchorId, load: Map<string, number>): Row[] {
  const jobs = JOBS.filter((j) => j.anchor === anchor && (!j.pets || ctx.pets) && !j.joint);
  const household = jobs.filter((j) => !j.own);
  const rows: Row[] = [];
  const taken = new Set<string>();
  const busy = new Set<string>();
  const give = (id: string) => { busy.add(id); load.set(id, (load.get(id) ?? 0) + 1); };
  const add = (j: Job, owner: string, established = false) => {
    rows.push({ id: j.own ? `${momentId}:${j.id}:${owner}` : `${momentId}:${j.id}`, moment: momentId, job: j.id, title: j.title, owners: [owner], ...(established ? { established: true } : {}) });
    taken.add(j.id);
    give(owner);
  };
  const others = ctx.adults.some((a) => !a.holder);
  const score = (p: Person, salt: string) => (load.get(p.id) ?? 0) + (p.holder && others ? HOLDER_LEAN : 0) + stableHash(`march:${salt}:${p.id}`) / 2 ** 32 / 100;
  const pick = (people: Person[], salt: string) => [...people].sort((a, b) => score(a, salt) - score(b, salt))[0];
  const kids = ctx.children.filter((c) => ageOf(c) >= 2);
  const able = kids.filter((k) => household.some((j) => !j.adult && fits(j, k, ctx)));
  const budget = householdBudget(ctx.adults.length + able.length);
  const chores = () => rows.filter((r) => !jobById(r.job!)!.own).length;
  const room = () => chores() < budget;
  const uncoveredCore = () => household.filter((j) => j.core && !taken.has(j.id)).length;

  // 1. What someone already takes care of keeps its owner, leaving room for the jobs the moment can't do without.
  for (const j of household) {
    if (taken.has(j.id) || (!j.core && budget - chores() <= Math.min(uncoveredCore(), ctx.people.length - busy.size))) continue;
    const who = ctx.people.filter((p) => !busy.has(p.id) && fits(j, p, ctx) && alreadyOwns(ctx, j, p.id));
    // A child's existing area (pets) is specific enough; a grown-up's broad one (meals) only for the grown-up job itself.
    const sure = who.filter((p) => p.kind === 'child' || j.adult || j.pets);
    if (sure.length && room()) add(j, pick(sure, j.id).id, true);
  }
  // 2. A job she wished a child would take on (a personal one doesn't use the moment's household room).
  for (const kid of kids) {
    if (busy.has(kid.id)) continue;
    const w = jobs.find((j) => !j.adult && fits(j, kid, ctx) && !taken.has(j.id) && wishedOf(ctx, j, kid.id) && (j.own || room()));
    if (w) add(w, kid.id);
  }
  // 3. The moment's essential jobs: the free child with the fewest parts so far, then the youngest who can do it.
  const toKid = (j: Job) => {
    const who = kids.filter((k) => !busy.has(k.id) && fits(j, k, ctx)).sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || ageOf(a) - ageOf(b) || a.id.localeCompare(b.id))[0];
    if (who) add(j, who.id);
  };
  for (const j of household.filter((x) => x.core && !x.adult)) if (room() && !taken.has(j.id)) toKid(j);
  // 4. Grown-ups: an essential job no child could take, or the moment's grown-up job; the harder first. Someone who
  //    already does it keeps it. Without children, one grown-up's share is the moment's main job.
  const adultJobs = household.filter((j) => !taken.has(j.id) && (j.adult || j.core)).sort((a, b) => b.minAge - a.minAge);
  for (const j of adultJobs) {
    if (!room()) break;
    const free = ctx.adults.filter((a) => !busy.has(a.id));
    if (!free.length) break;
    const mine = free.filter((a) => alreadyOwns(ctx, j, a.id));
    add(j, pick(mine.length ? mine : free, j.id).id, mine.length > 0);
  }
  // 5. Optional household jobs, only while there's room.
  for (const j of household.filter((x) => !x.core && !x.adult)) if (room() && !taken.has(j.id)) toKid(j);
  // 6. A personal routine job for young children with no part here (each their own row).
  const routine = jobs.find((j) => j.own && j.core);
  if (routine) {
    for (const kid of kids) {
      if (busy.has(kid.id) || !fits(routine, kid, ctx) || ageOf(kid) > ROUTINE_AGE) continue;
      if (routine.id === 'd-plate' && taken.has('d-clear')) continue;
      rows.push({ id: `${momentId}:${routine.id}:${kid.id}`, moment: momentId, job: routine.id, title: routine.title, owners: [kid.id] });
      give(kid.id);
    }
  }
  // A moment she turned on never comes up empty: with only older children here, its routine job is everyone's own.
  if (!rows.length && routine) for (const kid of kids) if (fits(routine, kid, ctx)) { rows.push({ id: `${momentId}:${routine.id}:${kid.id}`, moment: momentId, job: routine.id, title: routine.title, owners: [kid.id] }); give(kid.id); }
  // In the order the work happens (clear, load, wipe…), the moment's list order; people in household order.
  const at = (r: Row) => JOBS.findIndex((j) => j.id === r.job) * 100 + ctx.people.findIndex((p) => p.id === r.owners[0]);
  return rows.sort((a, b) => at(a) - at(b));
}

/**
 * The new habits: ONE by default. First a job she named for a particular child (step 4); else, when she named a job
 * for anyone, the youngest who has it; else the most meaningful new job. A second only when she named a job for a
 * different child too, so the family practices both because she asked, not for variety. Never something already
 * theirs, a job far below a child's age, or a grown-up's job when there are children.
 */
export function suggestedHabits(ctx: FamilyContext, rows: readonly Row[], moments: readonly Moment[], opts: PrepareOptions = {}): string[] {
  const on = new Set(moments.filter((m) => m.enabled).map((m) => m.id));
  const kidAge = (id: string) => { const p = ctx.children.find((x) => x.id === id); return p ? ageOf(p) : null; };
  // A personal routine far below a child's age isn't something to practice (the hamper for a teenager); a household
  // job is real ownership at any age.
  const trivial = (r: Row) => { const j = jobById(r.job ?? ''); const a = kidAge(r.owners[0]); return Boolean(j?.own) && a !== null && a - j!.minAge > 7; };
  const open = rows.filter((r) => on.has(r.moment) && !r.established && r.owners.length === 1 && !trivial(r) && !alreadyOwns(ctx, jobById(r.job ?? ''), r.owners[0]));
  const kids = open.filter((r) => ctx.children.some((c) => c.id === r.owners[0]));
  const pool = kids.length ? kids : ctx.children.length ? [] : open;
  const named = (r: Row) => { const j = jobById(r.job ?? ''); return Boolean(j?.wishes?.length && wishedFor(ctx, j!.wishes!).ids.includes(r.owners[0])); };
  const anyone = (r: Row) => { const j = jobById(r.job ?? ''); return Boolean(j?.wishes?.length && wishedFor(ctx, j!.wishes!).anyone); };
  const weight = (r: Row) => { const j = jobById(r.job ?? ''); return (j?.minAge ?? 0) + (j?.own ? 0 : 3) + (j?.core ? 1 : 0); };
  const byWeight = [...pool].sort((a, b) => weight(b) - weight(a) || a.id.localeCompare(b.id));
  // Welcome: with a priority and no job named for anyone, the habit is practiced in her priority's moment (the first
  // moment, see suggestedAnchors) when that moment has a job to practice.
  const lead = opts.lead && ctx.snapshot?.priority && moments[0] ? byWeight.find((r) => r.moment === moments[0].id) : undefined;
  const first = pool.find(named) ?? [...pool.filter(anyone)].sort((a, b) => (kidAge(a.owners[0]) ?? 0) - (kidAge(b.owners[0]) ?? 0))[0] ?? lead ?? byWeight[0];
  if (!first) return [];
  const second = pool.find((r) => r !== first && named(r) && named(first) && r.owners[0] !== first.owners[0]);
  return second ? [first.id, second.id] : [first.id];
}

export interface PrepareOptions {
  /** Lead with her priority (the Welcome resource): see `suggestedHabits`. */
  lead?: boolean;
}
/** How a plan in this state is prepared. */
export const prepareOptions = (s: Pick<RhythmState, 'context'>): PrepareOptions => (s.context === 'welcome' ? { lead: true } : {});

/** The whole prepared plan for this family: two moments on, a third offered; jobs; one or two new habits. */
export function preparedPlan(ctx: FamilyContext, opts: PrepareOptions = {}): RhythmPlan {
  const [a, b, c] = suggestedAnchors(ctx);
  const moments: Moment[] = [{ id: 'm1', anchor: a, enabled: true }, { id: 'm2', anchor: b, enabled: true }, { id: 'm3', anchor: c, enabled: false }];
  const load = new Map<string, number>();
  const rows = moments.flatMap((m) => prepareMoment(ctx, m.id, m.anchor, load));
  return { moments, rows, habits: suggestedHabits(ctx, rows, moments, opts) };
}

// ------------------------------------------------------------------ words: finish lines and habit sentences

const PARTICIPLE: Record<string, string> = {
  put: 'put', clear: 'cleared', wipe: 'wiped', sweep: 'swept', load: 'loaded', empty: 'emptied', take: 'taken', feed: 'fed',
  hang: 'hung', pack: 'packed', make: 'made', lay: 'laid', fold: 'folded', water: 'watered', tidy: 'tidied', wash: 'washed',
  vacuum: 'vacuumed', dust: 'dusted', sort: 'sorted', lock: 'locked', turn: 'turned', start: 'started', check: 'checked',
  pick: 'picked', bring: 'brought', set: 'set', fill: 'filled', unpack: 'unpacked', clean: 'cleaned', change: 'changed',
};
const GERUND: Record<string, string> = { put: 'putting', set: 'setting', get: 'getting', run: 'running', grab: 'grabbing', hang: 'hanging', lay: 'laying', go: 'going', empty: 'emptying', tidy: 'tidying' };
const ing = (verb: string) => GERUND[verb] ?? (/[^e]e$/.test(verb) ? `${verb.slice(0, -1)}ing` : `${verb}ing`);
const lowerFirst = (t: string) => `${t.charAt(0).toLowerCase()}${t.slice(1)}`;
const upperFirst = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;

/**
 * "Put my library books away" → "library books are put away"; "Wipe the window" → "the window is wiped". A job she
 * typed gets an observable finish from its own words; when the words aren't a job ("Library time"), its title.
 */
export function finishOf(title: string): string {
  const words = title.replace(/[.!]+$/, '').trim().split(/\s+/);
  const verb = words[0]?.toLowerCase() ?? '';
  const done = PARTICIPLE[verb];
  if (!done || words.length < 2) return `${lowerFirst(title.replace(/[.!]+$/, ''))} is done`;
  let rest = words.slice(1).join(' ').replace(/\bmy\b/gi, 'their');
  // Particles go after the participle: "put away the toys" → "the toys are put away".
  const particle = rest.match(/^(away|up|out|off|in)\b\s*/i);
  let tail = '';
  if (particle) { tail = ` ${particle[1].toLowerCase()}`; rest = rest.slice(particle[0].length); }
  else {
    const end = rest.match(/\s+(away|up|out|off)$/i);
    if (end) { tail = ` ${end[1].toLowerCase()}`; rest = rest.slice(0, -end[0].length); }
  }
  const head = rest.split(/\s+(?:in|on|into|under|for|to|from)\s+/i)[0];
  const plural = /s$/i.test(head) && !/ss$/i.test(head);
  const after = rest.slice(head.length);
  return `${lowerFirst(head)} ${plural ? 'are' : 'is'} ${done}${tail}${after}`.replace(/\s+/g, ' ').trim();
}
const joinList = (parts: readonly string[]) => (parts.length <= 1 ? parts[0] ?? '' : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);

/** What "finished" looks like for these rows: every job, observable, short; never a job that isn't there. */
export function finishLine(rows: readonly Pick<Row, 'job' | 'title'>[]): string {
  const parts = [...new Set(rows.map((r) => { const j = r.job ? jobById(r.job) : undefined; return j && j.title === r.title ? j.finish : finishOf(r.title); }))];
  return parts.length ? `${upperFirst(joinList(parts))}.` : '';
}

/** "Mateo practices sweeping under the table after dinner." Neutral wording: "my" becomes "their". */
export function habitSentence(names: readonly string[], title: string, when: string): string {
  const who = joinList(names);
  const verb = names.length > 1 ? 'practice' : 'practices';
  const [first, ...rest] = title.replace(/[.!]+$/, '').trim().split(/\s+/);
  const known = PARTICIPLE[first?.toLowerCase() ?? ''];
  const what = known ? `${ing(first.toLowerCase())} ${rest.join(' ').replace(/\bmy\b/gi, 'their')}`.trim() : `“${title}”`;
  return `${who} ${verb} ${what} ${when}.`.replace(/\s+/g, ' ');
}
const whenOf = (m: Moment) => {
  const label = m.label?.trim();
  if (!label) return anchorById(m.anchor).when;
  return /^(after|before|when|at|on|during)\b/i.test(label) ? lowerFirst(label) : `at “${label}”`;
};

// ------------------------------------------------------------------ the view

export type RowMode = 'one' | 'each' | 'together';
export interface RowView {
  /** The row (for a line grouping several people's own jobs: the first person's row; `ids` has them all). */
  id: string; ids: string[]; job?: string; title: string; icon: MarchIcon | null; established: boolean; habit: boolean;
  owners: { id: string; name: string; color: MemberColor; adult: boolean }[];
  /** One owner; several each doing their own (parallel rows shown on one line); or several working together. */
  mode: RowMode;
  ownership: Ownership;
  /** A job that has to happen before this moment's cue (warned in the editor; can't be saved that way). */
  misfit: boolean;
}
export interface MomentView {
  id: string; anchor: AnchorId; title: string; cue: string; reset: string; when: string; enabled: boolean;
  /** As printed: people doing the same personal job share a line ("each their own"); a habit keeps its own line. */
  rows: RowView[];
  /** Every assignment on its own (one per row in the plan): what the editor and the habit picker work with. */
  parts: RowView[];
  finish: string;
}

export function rhythmView(s: RhythmState, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const ctx = ctxOf(members, prefs, s);
  const plan = s.plan ? cleanPlan(s.plan, ctx) : preparedPlan(ctx, prepareOptions(s));
  const person = (id: string) => ctx.people.find((p) => p.id === id);
  const viewOf = (r: Row, anchor: AnchorId): RowView => {
    const j = r.job ? jobById(r.job) : undefined;
    const owners = r.owners.map(person).filter((p): p is Person => Boolean(p)).map((p) => ({ id: p.id, name: p.name, color: colorFor(ctx.colors, p.id), adult: p.kind === 'adult' }));
    const ownership = ownershipOf(r, plan);
    return {
      id: r.id, ids: [r.id], ...(r.job ? { job: r.job } : {}), title: r.title, icon: j?.icon ?? null, established: Boolean(r.established), habit: plan.habits.includes(r.id), owners,
      mode: ownership === 'joint' ? 'together' : 'one', ownership, misfit: !fitsCue(anchor, r.title),
    };
  };
  const moments: MomentView[] = plan.moments.map((m) => {
    const a = anchorById(m.anchor);
    const mine = plan.rows.filter((r) => r.moment === m.id);
    const parts = mine.map((r) => viewOf(r, m.anchor));
    // Printed lines: parallel personal jobs on one line (each their own), unless one of them is a habit or established.
    const rows: RowView[] = [];
    for (const p of parts) {
      const line = p.ownership === 'parallel_individual' && !p.habit && !p.established
        ? rows.find((x) => x.ownership === 'parallel_individual' && !x.habit && !x.established && jobKey(x.title) === jobKey(p.title)) : undefined;
      if (line) { line.ids.push(p.id); line.owners.push(...p.owners); line.mode = 'each'; } else rows.push({ ...p, ids: [...p.ids], owners: [...p.owners] });
    }
    // Always from the rows as they are now: an edit can never leave a stale finish line.
    return { id: m.id, anchor: m.anchor, title: m.label?.trim() || a.title, cue: a.cue, reset: a.reset, when: whenOf(m), enabled: m.enabled, rows, parts, finish: finishLine(mine) };
  });
  // Only moments with someone's part print: never an empty section.
  const printed = moments.filter((m) => m.enabled && m.rows.length);
  const habits = printed.flatMap((m) => m.parts.filter((r) => r.habit).map((r) => ({ ...r, moment: m.title, sentence: habitSentence(r.owners.map((o) => o.name), r.title, m.when) })));
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
  return JSON.stringify(v.printed.map((m) => [m.title, m.cue, m.finish, m.rows.map((r) => [r.title, r.icon, r.habit, r.established, r.mode, r.owners.map((o) => [o.name, o.color.id])])]));
};

// ------------------------------------------------------------------ validation

export interface PlanIssue { kind: 'duplicate' | 'misfit' | 'owner' | 'moment' | 'shared' | 'long' | 'habit' | 'empty' | 'crowded' | 'supervise'; rowId?: string; text: string }
/** A job that makes someone the supervisor or reminder of everyone else's work, which this plan exists to avoid. */
const SUPERVISE = /\b(remind|supervise|make sure|check (that|on|everyone)|keep track of (everyone|the kids)|help (everyone|the kids))\b/i;
/** Printed lines in a moment: parallel personal jobs share one. */
const linesIn = (rows: readonly Row[], momentId: string) => new Set(rows.filter((r) => r.moment === momentId).map((r) => (isIndividual(r) && r.owners.length === 1 ? `p:${jobKey(r.title)}` : `r:${r.id}`))).size;
/**
 * Everything that would make a plan wrong. The prepared plan for any family returns none (tested across families);
 * edits that would add one are refused in `saveRow`.
 */
export function validatePlan(plan: RhythmPlan, ctx: FamilyContext): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const ids = new Set(ctx.people.map((p) => p.id));
  const on = plan.moments.filter((m) => m.enabled);
  if (!on.length) issues.push({ kind: 'moment', text: 'No shared moment is on.' });
  for (const m of plan.moments) {
    if (linesIn(plan.rows, m.id) > MAX_ROWS) issues.push({ kind: 'crowded', text: `${m.label ?? anchorById(m.anchor).title} has more than ${MAX_ROWS} lines.` });
    const seen = new Map<string, Row>();
    for (const r of plan.rows.filter((x) => x.moment === m.id)) {
      // The same household job twice, or the same person's personal job twice.
      const key = isIndividual(r) && r.owners.length === 1 ? `${jobKey(r.title)}|${r.owners[0]}` : jobKey(r.title);
      const clash = seen.get(key) ?? (!isIndividual(r) ? [...seen.values()].find((x) => jobKey(x.title) === jobKey(r.title)) : undefined);
      if (clash) issues.push({ kind: 'duplicate', rowId: r.id, text: `“${r.title}” is already in this moment.` });
      seen.set(key, r);
      if (!fitsCue(m.anchor, r.title)) issues.push({ kind: 'misfit', rowId: r.id, text: `“${r.title}” has to happen before ${anchorById(m.anchor).when}.` });
    }
  }
  for (const r of plan.rows) {
    if (!plan.moments.some((m) => m.id === r.moment)) issues.push({ kind: 'moment', rowId: r.id, text: `“${r.title}” isn’t in a moment.` });
    if (!r.owners.length || r.owners.some((o) => !ids.has(o))) issues.push({ kind: 'owner', rowId: r.id, text: `“${r.title}” needs someone in the family.` });
    if (new Set(r.owners).size !== r.owners.length) issues.push({ kind: 'owner', rowId: r.id, text: `“${r.title}” lists someone twice.` });
    if (r.owners.length > 1 && isIndividual(r)) issues.push({ kind: 'shared', rowId: r.id, text: `“${r.title}” is a personal job: each person needs their own.` });
    if (r.owners.length > 1 && r.share !== 'joint') issues.push({ kind: 'shared', rowId: r.id, text: `“${r.title}” has several owners but isn’t a shared job.` });
    if (r.share === 'joint' && r.owners.length < 2) issues.push({ kind: 'shared', rowId: r.id, text: `“${r.title}” is marked shared with one owner.` });
    if (!r.title.trim()) issues.push({ kind: 'empty', rowId: r.id, text: 'A job has no words.' });
    if (r.title.length > TITLE_LIMIT) issues.push({ kind: 'long', rowId: r.id, text: `“${r.title}” is too long for the chart.` });
    if (SUPERVISE.test(r.title)) issues.push({ kind: 'supervise', rowId: r.id, text: `“${r.title}” makes someone everyone else’s reminder. Give each person their own part instead.` });
  }
  if (plan.habits.length > MAX_HABITS) issues.push({ kind: 'habit', text: 'More than two new habits.' });
  for (const h of plan.habits) {
    const r = plan.rows.find((x) => x.id === h);
    if (!r || !on.some((m) => m.id === r.moment)) issues.push({ kind: 'habit', rowId: h, text: 'A new habit points at a job that isn’t on the chart.' });
    else if (r.established) issues.push({ kind: 'habit', rowId: h, text: `“${r.title}” is already theirs, not a new habit.` });
  }
  return issues;
}

/**
 * A row in this moment that already is this job: the same household job (anyone), or, for a personal job, the same
 * person's (another child having their own is not a duplicate).
 */
export function duplicateIn(plan: Pick<RhythmPlan, 'rows'>, momentId: string, title: string, except?: string, owner?: string, personal = isIndividual({ title })) {
  const key = jobKey(title);
  return plan.rows.find((r) => r.moment === momentId && r.id !== except && jobKey(r.title) === key
    && (!(personal || isIndividual(r)) || !owner || r.owners.includes(owner)));
}

// ------------------------------------------------------------------ edits (each changes `s` in place and returns it)

/** Her plan to edit: the saved one, or the prepared one written down the first time she changes anything. */
const own = (s: RhythmState, members: readonly RhythmMember[], prefs?: ContextPrefs) => (s.plan ??= preparedPlan(ctxOf(members, prefs, s), prepareOptions(s)));
const tidy = (t: string, max: number) => t.replace(/\s+/g, ' ').trim().slice(0, max);
const dropHabit = (plan: RhythmPlan, rowId: string) => { plan.habits = plan.habits.filter((h) => h !== rowId); };

/**
 * Change a moment to another shared moment. Its jobs are prepared again for the new moment (a job has to fit its cue:
 * clearing breakfast dishes can't follow dinner), with the load of the other moments in mind.
 */
export function setAnchor(s: RhythmState, momentId: string, anchor: AnchorId, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  const m = plan.moments.find((x) => x.id === momentId);
  if (!m || m.anchor === anchor || plan.moments.some((x) => x.id !== momentId && x.anchor === anchor && x.enabled)) return s;
  m.anchor = anchor;
  delete m.label;
  const ctx = ctxOf(members, prefs, s);
  const load = new Map<string, number>();
  for (const r of plan.rows) if (r.moment !== momentId) r.owners.forEach((o) => load.set(o, (load.get(o) ?? 0) + 1));
  plan.rows = [...plan.rows.filter((r) => r.moment !== momentId), ...prepareMoment(ctx, momentId, anchor, load)];
  plan.habits = plan.habits.filter((h) => plan.rows.some((r) => r.id === h));
  if (!plan.habits.length) plan.habits = suggestedHabits(ctx, plan.rows, plan.moments, prepareOptions(s));
  return s;
}
export function setMomentLabel(s: RhythmState, momentId: string, label: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const m = own(s, members, prefs).moments.find((x) => x.id === momentId);
  if (!m) return s;
  const clean = tidy(label, LABEL_LIMIT);
  if (clean && clean !== anchorById(m.anchor).title) m.label = clean; else delete m.label;
  return s;
}
/**
 * Turn a moment on (prepared with jobs if it has none) or off. Any moment can go, as long as one stays; its jobs stay
 * in her plan (off the chart) so turning it back on brings them back. Its habits come off the chart with it.
 */
export function setMomentOn(s: RhythmState, momentId: string, on: boolean, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  const m = plan.moments.find((x) => x.id === momentId);
  if (!m || m.enabled === on) return s;
  if (!on && plan.moments.filter((x) => x.enabled).length <= 1) return s;
  if (on && plan.moments.some((x) => x.id !== momentId && x.enabled && x.anchor === m.anchor)) return s;
  m.enabled = on;
  if (on && !plan.rows.some((r) => r.moment === m.id)) {
    const ctx = ctxOf(members, prefs, s);
    const load = new Map<string, number>();
    for (const r of plan.rows) r.owners.forEach((o) => load.set(o, (load.get(o) ?? 0) + 1));
    plan.rows.push(...prepareMoment(ctx, m.id, m.anchor, load));
  }
  if (!on) plan.habits = plan.habits.filter((h) => plan.rows.find((r) => r.id === h)?.moment !== m.id);
  return s;
}

/** One responsibility as the single-job editor changes it: words, owners, moment and habit together, applied at Done. */
export interface RowDraft { title: string; job?: string; owners: string[]; moment: string; habit: boolean }
export type DraftResult = { ok: true; rowId: string } | { ok: false; text: string };
const freshId = (plan: RhythmPlan, base: string) => { let id = base; for (let n = 2; plan.rows.some((r) => r.id === id); n++) id = `${base}~${n}`; return id; };
/**
 * Apply her edit to one assignment (or add a new one when `rowId` is missing). Refused, with the reason, when it would
 * duplicate a job already in that moment, can't follow the moment's cue, has nobody, is too long, or the moment is full.
 * Ownership follows the job:
 * - a personal job: this row stays ONE person's; other people she ticks get their own rows (each their own), and
 *   nobody else's row changes;
 * - a household job with several people: one row they share (joint, done together). One person: individual.
 */
export function saveRow(s: RhythmState, rowId: string | undefined, d: RowDraft, members: readonly RhythmMember[], prefs?: ContextPrefs): DraftResult {
  const plan = own(s, members, prefs);
  const ctx = ctxOf(members, prefs, s);
  const lib = d.job ? jobById(d.job) : undefined;
  const title = tidy(lib?.title ?? d.title, TITLE_LIMIT);
  const m = plan.moments.find((x) => x.id === d.moment);
  const owners = [...new Set(d.owners)].filter((o) => ctx.people.some((p) => p.id === o));
  if (!m) return { ok: false, text: 'Choose a moment.' };
  if (!title) return { ok: false, text: 'Say what the job is.' };
  if (!owners.length) return { ok: false, text: 'Choose who owns it.' };
  if (!fitsCue(m.anchor, title)) return { ok: false, text: `“${title}” has to happen before ${anchorById(m.anchor).when}. Choose a moment it can follow.` };
  if (SUPERVISE.test(title)) return { ok: false, text: `“${title}” would make someone everyone else’s reminder. Give each person their own part instead.` };
  const current = rowId ? plan.rows.find((r) => r.id === rowId) : undefined;
  if (rowId && !current) return { ok: false, text: 'That job is no longer on the chart.' };
  const job = lib && lib.anchor === m.anchor ? lib.id : current?.job && jobById(current.job)?.title === title && jobById(current.job)?.anchor === m.anchor ? current.job : undefined;
  const personal = isIndividual({ job, title });
  // This row's person: the one it already belongs to if still ticked, else the first ticked.
  const mine = personal ? [current && owners.includes(current.owners[0]) ? current.owners[0] : owners[0]] : owners;
  const extra = personal ? owners.filter((o) => o !== mine[0]) : [];
  const dup = duplicateIn(plan, m.id, title, rowId, mine[0], personal);
  if (dup && (!personal || dup.owners.includes(mine[0]))) return { ok: false, text: personal ? `${ctx.people.find((p) => p.id === mine[0])?.name ?? 'They'} already ${dup.title.toLowerCase().startsWith('put') ? 'have' : 'do'} “${dup.title}” ${anchorById(m.anchor).when}.` : `“${dup.title}” is already ${anchorById(m.anchor).when}. Add a person to that one instead.` };
  // Room: printed lines in the target moment after the change.
  const trial = plan.rows.filter((r) => r.id !== rowId).concat([{ id: rowId ?? '_new', moment: m.id, title, owners: mine, ...(job ? { job } : {}) }]);
  if (linesIn(trial, m.id) > MAX_ROWS && (!current || current.moment !== m.id || linesIn(plan.rows, m.id) < linesIn(trial, m.id))) return { ok: false, text: `${m.label ?? anchorById(m.anchor).title} already has ${MAX_ROWS} jobs. Remove one first.` };
  const row: Row = current ?? { id: freshId(plan, `${m.id}:${job ?? 'own'}:${personal ? mine[0] : stableHash(`${title}:${plan.rows.length}`).toString(36)}`), moment: m.id, title, owners: mine };
  row.title = title;
  row.moment = m.id;
  row.owners = mine;
  if (job) row.job = job; else delete row.job;
  delete row.together;
  if (!personal && mine.length > 1) row.share = 'joint'; else delete row.share;
  // Her change makes it hers: an established job she edits stays established only if the same person still has it.
  if (row.established && !(job && row.owners.every((o) => alreadyOwns(ctx, jobById(job), o)))) delete row.established;
  if (!current) plan.rows.push(row);
  // Others she ticked for a personal job: each their own row, unless they already have it here.
  for (const o of extra) {
    if (duplicateIn(plan, m.id, title, undefined, o, true)) continue;
    plan.rows.push({ id: freshId(plan, `${m.id}:${job ?? 'own'}:${o}`), moment: m.id, title, owners: [o], ...(job ? { job } : {}) });
  }
  dropHabit(plan, row.id);
  if (d.habit && !row.established) plan.habits = [...plan.habits, row.id].slice(-MAX_HABITS);
  return { ok: true, rowId: row.id };
}

export function setRowTitle(s: RhythmState, rowId: string, title: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const r = own(s, members, prefs).rows.find((x) => x.id === rowId);
  if (r) saveRow(s, rowId, { title, owners: r.owners, moment: r.moment, habit: s.plan!.habits.includes(rowId) }, members, prefs);
  return s;
}
/** Who owns a row. A personal job keeps one owner per row (others get their own rows); a household job with several
 *  owners is done together. Never nobody. */
export function setRowOwners(s: RhythmState, rowId: string, owners: readonly string[], members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const r = own(s, members, prefs).rows.find((x) => x.id === rowId);
  if (r) saveRow(s, rowId, { title: r.title, job: r.job, owners: [...owners], moment: r.moment, habit: s.plan!.habits.includes(rowId) }, members, prefs);
  return s;
}
export function moveRow(s: RhythmState, rowId: string, momentId: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const r = own(s, members, prefs).rows.find((x) => x.id === rowId);
  if (r) saveRow(s, rowId, { title: r.title, job: r.job, owners: r.owners, moment: momentId, habit: s.plan!.habits.includes(rowId) }, members, prefs);
  return s;
}
/** Add a job to a moment: one from the moment's list (by id) or her own words. Duplicates are refused. */
export function addRow(s: RhythmState, momentId: string, owner: string, members: readonly RhythmMember[], prefs?: ContextPrefs, jobId?: string, title?: string) {
  saveRow(s, undefined, { title: title ?? '', job: jobId, owners: [owner], moment: momentId, habit: false }, members, prefs);
  return s;
}
/** Remove one assignment. Other people's own copies of a personal job are separate rows and stay. */
export function removeRow(s: RhythmState, rowId: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  plan.rows = plan.rows.filter((r) => r.id !== rowId);
  dropHabit(plan, rowId);
  return s;
}
/** Take one person off a job: their own row for a personal job; their place in a shared job (the others keep it). */
export function removeOwner(s: RhythmState, rowId: string, memberId: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  const r = plan.rows.find((x) => x.id === rowId);
  if (!r || !r.owners.includes(memberId)) return s;
  if (r.owners.length === 1) return removeRow(s, rowId, members, prefs);
  r.owners = r.owners.filter((o) => o !== memberId);
  if (r.owners.length < 2) delete r.share;
  return s;
}
/** Mark a row as one of the new habits (at most two; the newest replaces the oldest), or not. Never an established job. */
export function setHabit(s: RhythmState, rowId: string, on: boolean, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  const r = plan.rows.find((x) => x.id === rowId);
  if (!r) return s;
  dropHabit(plan, rowId);
  if (on && !r.established) plan.habits = [...plan.habits, rowId].slice(-MAX_HABITS);
  return s;
}
/**
 * Back to the prepared plan; the profile snapshot goes too, so it's prepared from her newest answers. The month goes
 * with them: a context that sets one sets it again (today's), a March plan has none.
 */
export const restorePlan = (s: RhythmState) => { delete s.plan; delete s.profile; delete s.month; return s; };

/**
 * Her plan, kept to this family and read in today's terms, without losing anything she chose:
 * - people who left drop out; a row with nobody left is removed;
 * - an earlier `together` is `share: 'joint'`; several owners on a household job she saved is kept as joint (that's
 *   what she chose), never split up or merged into something else;
 * - several owners on a PERSONAL job (earlier saves grouped them) becomes one row per person, the first keeping the
 *   row's id (and a habit on it), so each can be changed on their own; nobody's assignment is dropped;
 * - a copy of the same job in the same moment (a numbered or reworded duplicate) is folded into the first: the same
 *   person's personal job, or the same household job (its people kept, together).
 */
export function cleanPlan(plan: RhythmPlan, ctx: FamilyContext): RhythmPlan {
  const ids = new Set(ctx.people.map((p) => p.id));
  const rows: Row[] = [];
  const habits = [...plan.habits];
  for (const r0 of plan.rows) {
    const owners = [...new Set(r0.owners.filter((o) => ids.has(o)))];
    if (!owners.length || !r0.title.trim()) continue;
    const { together, ...rest } = r0;
    const r: Row = { ...rest, owners };
    if (together && owners.length > 1) r.share = 'joint';
    const personal = isIndividual(r);
    const people = personal ? owners : [owners];
    people.forEach((who, i) => {
      const one: Row = personal ? { ...r, id: i ? `${r.id}~${who}` : r.id, owners: [who as string] } : { ...r, owners: who as string[] };
      if (personal) delete one.share;
      else if (one.owners.length > 1) one.share = 'joint'; else delete one.share;
      const dup = duplicateIn({ rows }, one.moment, one.title, undefined, one.owners[0], personal);
      if (dup && (!personal || dup.owners.includes(one.owners[0]))) {
        if (!personal) { dup.owners = [...new Set([...dup.owners, ...one.owners])]; if (dup.owners.length > 1) dup.share = 'joint'; }
        const h = habits.indexOf(one.id);
        if (h >= 0) habits[h] = dup.id;
        return;
      }
      rows.push(one);
    });
  }
  return { moments: plan.moments, rows, habits: [...new Set(habits)].filter((h) => rows.some((r) => r.id === h && !r.established)).slice(0, MAX_HABITS) };
}
export const applyFamily = (s: RhythmState, members: readonly RhythmMember[], prefs?: ContextPrefs) => {
  if (s.plan) s.plan = cleanPlan(s.plan, ctxOf(members, prefs, s));
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
  if (s.month !== undefined && (typeof s.month !== 'string' || !MONTH_RE.test(s.month))) return false;
  if (s.context !== undefined && s.context !== 'welcome') return false;
  if (s.plan === undefined) return true;
  const p = s.plan;
  return Array.isArray(p.moments) && p.moments.length <= MAX_MOMENTS && p.moments.every((m) => m && typeof m.id === 'string' && ANCHORS.some((a) => a.id === m.anchor) && typeof m.enabled === 'boolean')
    && Array.isArray(p.rows) && p.rows.length <= MAX_ROWS * MAX_MOMENTS * 2 && p.rows.every(isRow)
    && Array.isArray(p.habits) && p.habits.every((h) => typeof h === 'string');
}

/**
 * The earlier March page saved per-person chore charts here ({ palette, kids: { [memberId]: { daily, weekly } } }).
 * A family that changed those charts keeps who-does-what where a chore matches a rhythm job: it becomes an
 * established part of the prepared plan's matching moment. Everything else starts from the prepared plan.
 */
const LEGACY: Record<string, string> = {
  'make-my-bed': 'b-bed', 'feed-pets': 'b-pets', 'clear-the-table': 'd-clear', 'wipe-the-counters': 'd-wipe', 'take-out-the-trash': 'd-trash',
  dishwasher: 'd-load', 'put-clothes-away': 't-clothes', 'put-toys-away': 't-toys', 'tidy-my-desk': 't-bag',
};
export function fromLegacy(x: unknown, members: readonly RhythmMember[], prefs?: ContextPrefs, snapshot?: FamilySnapshot): RhythmState | null {
  const old = x as { palette?: unknown; kids?: Record<string, { daily?: { id?: string }[] }> } | null;
  if (!old || typeof old !== 'object' || (old as { v?: unknown }).v === 3 || !old.kids || typeof old.kids !== 'object') return null;
  const s: RhythmState = { v: 3, ...(snapshot ? { profile: snapshot } : {}) };
  const edited = Object.entries(old.kids).filter(([, k]) => Array.isArray(k?.daily));
  if (!edited.length) return s;
  const plan = own(s, members, prefs);
  const ctx = ctxOf(members, prefs, s);
  for (const [memberId, k] of edited) {
    if (!ctx.people.some((p) => p.id === memberId)) continue;
    for (const d of k.daily ?? []) {
      const job = d.id ? jobById(LEGACY[d.id] ?? '') : undefined;
      const m = job && plan.moments.find((mm) => mm.anchor === job.anchor && mm.enabled);
      if (!job || !m) continue;
      // A personal job is that person's own row; a household job has one owner (the one who did it on their chart).
      const row = plan.rows.find((r) => r.moment === m.id && r.job === job.id && (!job.own || r.owners.includes(memberId)));
      if (row) { row.owners = [memberId]; row.established = true; }
      else if (linesIn(plan.rows.concat([{ id: '_', moment: m.id, job: job.id, title: job.title, owners: [memberId] }]), m.id) <= MAX_ROWS) {
        plan.rows.push({ id: job.own ? `${m.id}:${job.id}:${memberId}` : `${m.id}:${job.id}`, moment: m.id, job: job.id, title: job.title, owners: [memberId], established: true });
      }
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
  /** The desktop editor, open at a section (and a moment's jobs) if given. */
  openEditor: (section?: 'moments' | 'owners' | 'habits', momentId?: string) => void;
}
