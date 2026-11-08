/**
 * March 2027, Our Family Rhythm: one family, two or three shared moments, everyone owns their part.
 * (Printable and desktop editor: src/components/club/MarchFamilyRhythm.astro; phone screen and reference view:
 * MarchPlanMobile.astro; editor: src/lib/club/march-rhythm-editor.ts; docs/club/PLAN_ARCHITECTURE.md → March.)
 * Pure functions only, so the sheet, the rail and the phone read one plan. Built on the shared personalization
 * foundation (../personalize/), like January.
 *
 * The model is cue → action → finish:
 * - Cue: a moment the family already shares (after breakfast, after dinner, coming home…), never a clock time. One
 *   moment starts several people's parts, so Mom isn't the reminder for each of them.
 * - Action: a small, concrete, observable job. A household job has one owner (or several working together, only when
 *   she says so); an individual job ("Put my dirty clothes in the hamper") can belong to several people, each doing
 *   their own. Every job belongs to a moment it can actually follow: nothing that has to happen before the cue.
 * - Finish: what "done" looks like, written from the jobs actually on that moment, every time it's drawn.
 *
 * Recommendations (deterministic; ties by stable hash, never random):
 * 1. Moments first: two from her priority and challenges, a third offered but off.
 * 2. Whoever already takes care of an area keeps that job, as established context (never a new habit).
 * 3. Each child gets one part a moment: a job she wished for them, else the moment's most needed household job they
 *    can do, else their own individual job. At most four household jobs go to children; the rest share an individual
 *    job's row. Nobody gets filler: a moment holds only the jobs its routine needs (MAX_ROWS at most).
 * 4. Grown-ups: the moment's grown-up job where it has one, and an essential job nobody else could take. No grown-up
 *    part is invented for a moment that doesn't need one (bedtime), and no family is evened out for its own sake.
 * 5. One or two NEW habits: a wished job first, else the most meaningful new job; never one someone already owns.
 * `validatePlan` checks every plan (prepared or edited) for duplicates, impossible or orphaned jobs, unintended
 * sharing, long labels and stale habits. No points, rewards, streaks, percentages or tracking.
 */
import type { PlanResource } from '../plan/resource';
import { HOLDER_LEAN, taskAge } from '../personalize/assign';
import { colorFor, type MemberColor } from '../personalize/colors';
import { familyContext, isFamilySnapshot, wishedFor, type ContextMember, type ContextPrefs, type FamilyContext, type FamilySnapshot, type Person } from '../personalize/family';
import { stableHash } from '../hash';
import type { MarchIcon } from '../../../data/club/march-chore-icons';

export const KIT_MONTH = '2027-03';
export const MAX_ROWS = 5;
export const MAX_MOMENTS = 3;
export const TITLE_LIMIT = 40;
export const LABEL_LIMIT = 32;
export const MAX_HABITS = 2;
/** Household jobs that go to children in one moment; more children share an individual job instead. */
const KID_HOUSEHOLD = 4;

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
  { id: 'd-leftovers', anchor: 'dinner', title: 'Put leftovers away', icon: 'clean-fridge', minAge: 12, adult: true, finish: 'leftovers are away', areas: ['meals'] },
  // After brushing teeth: individual wind-down jobs; the kitchen is done by now.
  { id: 't-clothes', anchor: 'teeth', title: 'Put dirty clothes in the hamper', icon: 'clothes-away', minAge: 3, own: true, core: true, finish: 'dirty clothes are in the hamper', wishes: ['put-away-laundry', 'bedtime-routine'] },
  { id: 't-bathroom', anchor: 'teeth', title: 'Put my toothbrush and cup away', icon: 'wipe-sink', minAge: 3, own: true, finish: 'the bathroom counter is clear', wishes: ['bedtime-routine'] },
  { id: 't-bag', anchor: 'teeth', title: 'Pack my backpack for tomorrow', icon: 'tidy-desk', minAge: 6, own: true, finish: 'backpacks are packed', wishes: ['pack-school-bag'] },
  { id: 't-outfit', anchor: 'teeth', title: 'Lay out tomorrow’s clothes', icon: 'clothes-away', minAge: 5, own: true, finish: 'clothes are laid out', wishes: ['morning-routine'] },
  { id: 't-toys', anchor: 'teeth', title: 'Put my toys away', icon: 'toys-away', minAge: 2, own: true, finish: 'toys are put away', wishes: ['tidy-room'] },
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
  /** A household job she chose to give several people, done together (not each their own). */
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
}
export interface RhythmMember extends ContextMember { kind: 'adult' | 'child'; role?: string }

export const freshState = (): RhythmState => ({ v: 3 });

const ctxOf = (members: readonly RhythmMember[], prefs: ContextPrefs | undefined, snapshot?: FamilySnapshot): FamilyContext =>
  familyContext(members, prefs, KIT_MONTH, snapshot);

/** An individual job (each does their own): a library `own` job, or one she typed in the first person. */
export const isIndividual = (r: Pick<Row, 'job' | 'title'>) => {
  const j = r.job ? jobById(r.job) : undefined;
  return j ? Boolean(j.own) : /\b(my|mine)\b/i.test(r.title);
};

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
 * The prepared rows for one moment, in four passes (see the header): established, children, grown-ups, essentials.
 * `load` counts each person's parts across the plan so far, so a busy person isn't picked first.
 */
export function prepareMoment(ctx: FamilyContext, momentId: string, anchor: AnchorId, load: Map<string, number>): Row[] {
  const jobs = JOBS.filter((j) => j.anchor === anchor && (!j.pets || ctx.pets));
  const rows: Row[] = [];
  const taken = new Set<string>();
  const busy = new Set<string>();
  const give = (id: string) => { busy.add(id); load.set(id, (load.get(id) ?? 0) + 1); };
  const add = (j: Job, owners: string[], established = false) => {
    rows.push({ id: `${momentId}:${j.id}`, moment: momentId, job: j.id, title: j.title, owners, ...(established ? { established: true } : {}) });
    taken.add(j.id);
    owners.forEach(give);
  };
  const others = ctx.adults.some((a) => !a.holder);
  const score = (p: Person, salt: string) => (load.get(p.id) ?? 0) + (p.holder && others ? HOLDER_LEAN : 0) + stableHash(`march:${salt}:${p.id}`) / 2 ** 32 / 100;
  const pick = (people: Person[], salt: string) => [...people].sort((a, b) => score(a, salt) - score(b, salt))[0];

  // 1. What someone already takes care of keeps its owner (household jobs only; the least busy owner).
  for (const j of jobs) {
    if (j.own) continue;
    const who = ctx.people.filter((p) => !busy.has(p.id) && fits(j, p, ctx) && alreadyOwns(ctx, j, p.id));
    // A child's existing area (pets) is specific enough; a grown-up's (meals) only for the grown-up job itself.
    const sure = who.filter((p) => p.kind === 'child' || j.adult || j.pets);
    if (sure.length) add(j, [pick(sure, j.id).id], true);
  }
  // 2. Children: one part each. First the jobs she wished for them; then each household job the moment needs, in
  //    order of need, goes to the free child with the fewest parts so far, then the YOUNGEST who can do it (so the older
  //    ones are left for the harder jobs, nobody ends up with a token job beside a sibling's real one, and in a large
  //    family nobody is left out of every moment); then whoever is left does their own individual job.
  const kids = ctx.children.filter((c) => !busy.has(c.id)).sort((a, b) => ageOf(a) - ageOf(b) || a.id.localeCompare(b.id));
  const kidChores = () => rows.filter((r) => !jobById(r.job!)!.own && r.owners.some((o) => ctx.children.some((c) => c.id === o))).length;
  const room = () => kidChores() < KID_HOUSEHOLD && rows.length < MAX_ROWS;
  const ownRow = (j: Job, id: string) => { const same = rows.find((r) => r.job === j.id); if (same) { same.owners.push(id); give(id); } else if (rows.length < MAX_ROWS) add(j, [id]); };
  for (const kid of kids) {
    const wished = jobs.filter((j) => !j.adult && fits(j, kid, ctx) && (j.own || !taken.has(j.id)) && wishedOf(ctx, j, kid.id) && (j.own || room()));
    if (wished[0]) { if (wished[0].own) ownRow(wished[0], kid.id); else add(wished[0], [kid.id]); }
  }
  const toKids = (list: Job[]) => {
    for (const j of list) {
      if (!room() || taken.has(j.id)) continue;
      // Whoever has the fewest parts so far in the plan, then the youngest who can do it.
      const who = kids.filter((k) => !busy.has(k.id) && fits(j, k, ctx)).sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || ageOf(a) - ageOf(b))[0];
      if (who) add(j, [who.id]);
    }
  };
  const chores = jobs.filter((j) => !j.own && !j.adult);
  // The jobs the moment needs come first; the grown-ups' parts claim their place before any optional job.
  toKids(chores.filter((j) => j.core));
  // 3. Grown-ups: the moment's grown-up job, to the least busy grown-up (the account holder leans last).
  const freeAdults = () => ctx.adults.filter((a) => !busy.has(a.id));
  for (const j of jobs.filter((x) => x.adult && !taken.has(x.id))) {
    if (rows.length >= MAX_ROWS || !freeAdults().length) break;
    add(j, [pick(freeAdults(), j.id).id]);
  }
  // 4. Essentials nobody has yet (no child old enough, or no children): a free grown-up takes them. A family without
  //    children shares up to two, one each; that's all a two-person kitchen reset needs.
  // Household jobs only: a grown-up isn't given "Clear my breakfast dishes" or "Put on my shoes".
  const essentials = jobs.filter((j) => j.core && !j.own && !taken.has(j.id));
  const noKids = !ctx.children.length;
  for (const j of essentials.slice(0, noKids ? 2 : 1)) {
    // Without children, a grown-up who already has a part here can take a second (a one-person kitchen reset).
    const free = freeAdults().length ? freeAdults() : noKids ? ctx.adults.filter((a) => rows.filter((r) => r.owners.includes(a.id)).length < 2) : [];
    if (rows.length >= MAX_ROWS || !free.length) break;
    add(j, [pick(free, j.id).id]);
  }
  // Then optional household jobs for children still free, while there's room.
  toKids(chores.filter((j) => !j.core));
  // Their own job: the one a sibling already does (one row, each their own), else the moment's essential one. Dinner's
  // own plate only when nobody is clearing the table.
  for (const kid of kids.filter((k) => !busy.has(k.id))) {
    const mine = jobs.filter((j) => j.own && fits(j, kid, ctx) && !(j.id === 'd-plate' && taken.has('d-clear')));
    const pick = mine.find((j) => taken.has(j.id)) ?? mine.find((j) => j.core) ?? mine[0];
    if (pick) ownRow(pick, kid.id);
  }
  // In the order the work happens (clear, load, wipe…), the moment's list order.
  const at = (r: Row) => JOBS.findIndex((j) => j.id === r.job);
  return rows.sort((a, b) => at(a) - at(b));
}

/** The one or two new habits: a job she wished a child would take on, else the most meaningful new job. */
export function suggestedHabits(ctx: FamilyContext, rows: readonly Row[], moments: readonly Moment[]): string[] {
  const on = new Set(moments.filter((m) => m.enabled).map((m) => m.id));
  // A job far below its owner's age isn't something to practice ("Put dirty clothes in the hamper" for a teenager).
  const kidAge = (id: string) => { const p = ctx.children.find((x) => x.id === id); return p ? ageOf(p) : null; };
  const trivial = (r: Row) => { const j = jobById(r.job ?? ''); return Boolean(j) && r.owners.every((o) => { const a = kidAge(o); return a !== null && a - j!.minAge > 7; }); };
  // One or two people learning it; a row the whole family does each night isn't a focus.
  const open = rows.filter((r) => on.has(r.moment) && !r.established && r.owners.length <= 2 && !trivial(r) && !r.owners.some((o) => alreadyOwns(ctx, jobById(r.job ?? ''), o)));
  // The children's new jobs; a family without children practices a grown-up one.
  const kids = open.filter((r) => r.owners.some((o) => ctx.children.some((c) => c.id === o)));
  const fresh = kids.length ? kids : open;
  const wished = fresh.filter((r) => {
    const j = r.job ? jobById(r.job) : undefined;
    return j?.wishes?.length && r.owners.some((o) => wishedFor(ctx, j.wishes!).ids.includes(o) || wishedFor(ctx, j.wishes!).anyone);
  });
  // Meaningful: a household job the family relies on over a personal one, harder over easier.
  const weight = (r: Row) => { const j = jobById(r.job ?? ''); return (j?.minAge ?? 0) + (j?.own ? 0 : 3) + (j?.core ? 1 : 0); };
  const ranked = [...wished, ...[...fresh].sort((a, b) => weight(b) - weight(a) || a.id.localeCompare(b.id))].filter((r, i, a) => a.indexOf(r) === i);
  // Prefer two different people in two different moments; settle for less overlap only when there's no choice.
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
  id: string; job?: string; title: string; icon: MarchIcon | null; established: boolean; habit: boolean;
  owners: { id: string; name: string; color: MemberColor; adult: boolean }[];
  /** One owner; several each doing their own; or several working together. */
  mode: RowMode;
  /** A job that has to happen before this moment's cue (warned in the editor; can't be saved that way). */
  misfit: boolean;
}
export interface MomentView { id: string; anchor: AnchorId; title: string; cue: string; reset: string; when: string; enabled: boolean; rows: RowView[]; finish: string }

export function rhythmView(s: RhythmState, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const ctx = ctxOf(members, prefs, s.profile);
  const plan = s.plan ? cleanPlan(s.plan, ctx) : preparedPlan(ctx);
  const person = (id: string) => ctx.people.find((p) => p.id === id);
  const moments: MomentView[] = plan.moments.map((m) => {
    const a = anchorById(m.anchor);
    const mine = plan.rows.filter((r) => r.moment === m.id);
    const rows: RowView[] = mine.map((r) => {
      const j = r.job ? jobById(r.job) : undefined;
      const owners = r.owners.map(person).filter((p): p is Person => Boolean(p)).map((p) => ({ id: p.id, name: p.name, color: colorFor(ctx.colors, p.id), adult: p.kind === 'adult' }));
      return {
        id: r.id, ...(r.job ? { job: r.job } : {}), title: r.title, icon: j?.icon ?? null, established: Boolean(r.established), habit: plan.habits.includes(r.id), owners,
        mode: owners.length < 2 ? 'one' : isIndividual(r) ? 'each' : 'together',
        misfit: !fitsCue(m.anchor, r.title),
      };
    });
    // Always from the rows as they are now: an edit can never leave a stale finish line.
    return { id: m.id, anchor: m.anchor, title: m.label?.trim() || a.title, cue: a.cue, reset: a.reset, when: whenOf(m), enabled: m.enabled, rows, finish: finishLine(mine) };
  });
  // Only moments with someone's part print: never an empty section.
  const printed = moments.filter((m) => m.enabled && m.rows.length);
  const habits = printed.flatMap((m) => m.rows.filter((r) => r.habit).map((r) => ({ ...r, moment: m.title, sentence: habitSentence(r.owners.map((o) => o.name), r.title, m.when) })));
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

export interface PlanIssue { kind: 'duplicate' | 'misfit' | 'owner' | 'moment' | 'shared' | 'long' | 'habit' | 'empty' | 'crowded'; rowId?: string; text: string }
/**
 * Everything that would make a plan wrong on paper. The prepared plan for any family returns none (tested across
 * families); edits that would add one are refused or flagged in the editor.
 */
export function validatePlan(plan: RhythmPlan, ctx: FamilyContext): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const ids = new Set(ctx.people.map((p) => p.id));
  const on = plan.moments.filter((m) => m.enabled);
  if (!on.length) issues.push({ kind: 'moment', text: 'No shared moment is on.' });
  for (const m of plan.moments) {
    const rows = plan.rows.filter((r) => r.moment === m.id);
    if (rows.length > MAX_ROWS) issues.push({ kind: 'crowded', text: `${m.label ?? anchorById(m.anchor).title} has more than ${MAX_ROWS} jobs.` });
    const seen = new Map<string, string>();
    for (const r of rows) {
      const key = jobKey(r.title);
      if (seen.has(key)) issues.push({ kind: 'duplicate', rowId: r.id, text: `“${r.title}” is already in this moment.` });
      seen.set(key, r.id);
      if (!fitsCue(m.anchor, r.title)) issues.push({ kind: 'misfit', rowId: r.id, text: `“${r.title}” has to happen before ${anchorById(m.anchor).when}.` });
    }
  }
  for (const r of plan.rows) {
    if (!plan.moments.some((m) => m.id === r.moment)) issues.push({ kind: 'moment', rowId: r.id, text: `“${r.title}” isn’t in a moment.` });
    if (!r.owners.length || r.owners.some((o) => !ids.has(o))) issues.push({ kind: 'owner', rowId: r.id, text: `“${r.title}” needs someone in the family.` });
    if (new Set(r.owners).size !== r.owners.length) issues.push({ kind: 'owner', rowId: r.id, text: `“${r.title}” lists someone twice.` });
    if (r.owners.length > 1 && !isIndividual(r) && !r.together) issues.push({ kind: 'shared', rowId: r.id, text: `“${r.title}” has several owners but isn’t marked as done together.` });
    if (!r.title.trim()) issues.push({ kind: 'empty', rowId: r.id, text: 'A job has no words.' });
    if (r.title.length > TITLE_LIMIT) issues.push({ kind: 'long', rowId: r.id, text: `“${r.title}” is too long for the chart.` });
  }
  if (plan.habits.length > MAX_HABITS) issues.push({ kind: 'habit', text: 'More than two new habits.' });
  for (const h of plan.habits) {
    const r = plan.rows.find((x) => x.id === h);
    if (!r || !on.some((m) => m.id === r.moment)) issues.push({ kind: 'habit', rowId: h, text: 'A new habit points at a job that isn’t on the chart.' });
    else if (r.established) issues.push({ kind: 'habit', rowId: h, text: `“${r.title}” is already theirs, not a new habit.` });
  }
  return issues;
}

/** A row in this moment that already says the same job (her typing "Wipe counters 2"), if any. */
export function duplicateIn(plan: Pick<RhythmPlan, 'rows'>, momentId: string, title: string, except?: string) {
  const key = jobKey(title);
  return plan.rows.find((r) => r.moment === momentId && r.id !== except && jobKey(r.title) === key);
}

// ------------------------------------------------------------------ edits (each changes `s` in place and returns it)

/** Her plan to edit: the saved one, or the prepared one written down the first time she changes anything. */
const own = (s: RhythmState, members: readonly RhythmMember[], prefs?: ContextPrefs) => (s.plan ??= preparedPlan(ctxOf(members, prefs, s.profile)));
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
    const ctx = ctxOf(members, prefs, s.profile);
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
/**
 * Apply her edit to one responsibility (or add a new one when `rowId` is missing). Refused, with the reason, when it
 * would duplicate a job already in that moment, can't follow the moment's cue, has nobody, is too long, or the moment
 * is full. Several owners on a household job means they do it together.
 */
export function saveRow(s: RhythmState, rowId: string | undefined, d: RowDraft, members: readonly RhythmMember[], prefs?: ContextPrefs): DraftResult {
  const plan = own(s, members, prefs);
  const ctx = ctxOf(members, prefs, s.profile);
  const lib = d.job ? jobById(d.job) : undefined;
  const title = tidy(lib?.title ?? d.title, TITLE_LIMIT);
  const m = plan.moments.find((x) => x.id === d.moment);
  const owners = [...new Set(d.owners)].filter((o) => ctx.people.some((p) => p.id === o));
  if (!m) return { ok: false, text: 'Choose a moment.' };
  if (!title) return { ok: false, text: 'Say what the job is.' };
  if (!owners.length) return { ok: false, text: 'Choose who owns it.' };
  if (!fitsCue(m.anchor, title)) return { ok: false, text: `“${title}” has to happen before ${anchorById(m.anchor).when}. Choose a moment it can follow.` };
  const dup = duplicateIn(plan, m.id, title, rowId);
  if (dup) return { ok: false, text: `“${dup.title}” is already ${anchorById(m.anchor).when}. Add a person to that one instead.` };
  const current = rowId ? plan.rows.find((r) => r.id === rowId) : undefined;
  if (rowId && !current) return { ok: false, text: 'That job is no longer on the chart.' };
  if ((!current || current.moment !== m.id) && plan.rows.filter((r) => r.moment === m.id).length >= MAX_ROWS) return { ok: false, text: `${m.label ?? anchorById(m.anchor).title} already has ${MAX_ROWS} jobs. Remove one first.` };
  const job = lib && lib.anchor === m.anchor ? lib.id : current?.job && jobById(current.job)?.title === title && jobById(current.job)?.anchor === m.anchor ? current.job : undefined;
  const row: Row = current ?? { id: `${m.id}:${job ?? 'own'}:${stableHash(`${title}:${owners.join(',')}:${plan.rows.length}`).toString(36)}`, moment: m.id, title, owners };
  row.title = title;
  row.moment = m.id;
  row.owners = owners;
  if (job) row.job = job; else delete row.job;
  if (owners.length > 1 && !isIndividual(row)) row.together = true; else delete row.together;
  // Her change makes it hers: an established job she edits stays established only if the same person still has it.
  if (row.established && !(job && owners.every((o) => alreadyOwns(ctx, jobById(job), o)))) delete row.established;
  if (!current) plan.rows.push(row);
  dropHabit(plan, row.id);
  if (d.habit && !row.established) plan.habits = [...plan.habits, row.id].slice(-MAX_HABITS);
  return { ok: true, rowId: row.id };
}

export function setRowTitle(s: RhythmState, rowId: string, title: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const r = own(s, members, prefs).rows.find((x) => x.id === rowId);
  if (r) saveRow(s, rowId, { title, owners: r.owners, moment: r.moment, habit: s.plan!.habits.includes(rowId) }, members, prefs);
  return s;
}
/** Who owns a row: one person, or several (each their own, or together). Never nobody. */
export function setRowOwners(s: RhythmState, rowId: string, owners: readonly string[], members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const r = own(s, members, prefs).rows.find((x) => x.id === rowId);
  if (r) saveRow(s, rowId, { title: r.title, job: r.job, owners: [...owners], moment: r.moment, habit: s.plan!.habits.includes(rowId) }, members, prefs);
  return s;
}
export function moveRow(s: RhythmState, rowId: string, momentId: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const r = own(s, members, prefs).rows.find((x) => x.id === rowId);
  if (r) saveRow(s, rowId, { title: r.title, owners: r.owners, moment: momentId, habit: s.plan!.habits.includes(rowId) }, members, prefs);
  return s;
}
/** Add a job to a moment: one from the moment's list (by id) or her own words. Duplicates are refused. */
export function addRow(s: RhythmState, momentId: string, owner: string, members: readonly RhythmMember[], prefs?: ContextPrefs, jobId?: string, title?: string) {
  saveRow(s, undefined, { title: title ?? '', job: jobId, owners: [owner], moment: momentId, habit: false }, members, prefs);
  return s;
}
export function removeRow(s: RhythmState, rowId: string, members: readonly RhythmMember[], prefs?: ContextPrefs) {
  const plan = own(s, members, prefs);
  plan.rows = plan.rows.filter((r) => r.id !== rowId);
  dropHabit(plan, rowId);
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
/** Back to the prepared plan; the profile snapshot goes too, so it's prepared from her newest answers. */
export const restorePlan = (s: RhythmState) => { delete s.plan; delete s.profile; return s; };

/**
 * Her plan, kept to this family: people who left drop out; a row with nobody left is removed; a numbered or reworded
 * copy of a job already in the same moment is merged into it (owners kept); at most five jobs a moment, two habits.
 */
export function cleanPlan(plan: RhythmPlan, ctx: FamilyContext): RhythmPlan {
  const ids = new Set(ctx.people.map((p) => p.id));
  const rows: Row[] = [];
  for (const r0 of plan.rows) {
    const r = { ...r0, owners: [...new Set(r0.owners.filter((o) => ids.has(o)))] };
    if (!r.owners.length || !r.title.trim()) continue;
    const dup = duplicateIn({ rows }, r.moment, r.title);
    if (dup) { dup.owners = [...new Set([...dup.owners, ...r.owners])]; if (dup.owners.length > 1 && !isIndividual(dup)) dup.together = true; continue; }
    if (rows.filter((x) => x.moment === r.moment).length >= MAX_ROWS) continue;
    rows.push(r);
  }
  return { moments: plan.moments, rows, habits: plan.habits.filter((h) => rows.some((r) => r.id === h && !r.established)).slice(0, MAX_HABITS) };
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
  /** The desktop editor, open at a section (and a moment's jobs) if given. */
  openEditor: (section?: 'moments' | 'owners' | 'habits', momentId?: string) => void;
}
