/**
 * March 2027, Spring Clean as a Team: one room, about thirty minutes, everyone has a part
 * (docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md → Phase 3). Pure functions only, so the printable, the desktop rail and
 * the phone view read one plan. Not a recurring chart: one prepared spring-cleaning session.
 *
 * One library: the jobs, ages, minutes, grown-ups-only rules, body limits, supplies, work phases and the side-by-side
 * session planner are the Family Spring Cleaning Builder's (src/data/spring-cleaning.ts). How each job is done (GET
 * READY / DO THE JOB / FINISHED WHEN, safety, icon) is src/data/club/spring-clean-guides.ts. The family, ages (on
 * March 1, 2027), member ids and January's colors come from the shared personalization foundation (../personalize/).
 *
 * How the project is prepared (deterministic, no family special-cased):
 * 1. The room: the one her step-6 priority points at (keeping the house picked up → the living room, laundry → the
 *    laundry area, dinner and evenings → the kitchen, mornings or school stuff → the entryway, bedtime → the
 *    bedrooms), else the living room, the room everyone uses. She can choose any other.
 * 2. The jobs: the room's starting jobs, added one at a time (one per work phase first: clear, clean, floors and
 *    trash), keeping a job only if the whole session still fits about thirty minutes with people working side by
 *    side (the busiest person's time, younger helpers' slower pace included) and the back page can still print it.
 *    Jobs that don't fit wait for another day; nobody gets filler. A room's extra jobs are offered only to someone
 *    who would otherwise have nothing and can do it safely.
 * 3. Who: the builder's planner: grown-ups-only jobs to grown-ups, the rest to whoever can safely do it and has done
 *    least, the account holder leaning last, someone who already takes care of that kind of job (or a child she
 *    wished it for) preferred when about as free. One owner per job; a joint job only when she makes one. A job nobody
 *    here can safely do stays unassigned, with the reason; it never falls to Mom by default.
 */
import type { PlanResource } from '../plan/resource';
import { colorFor } from '../personalize/colors';
import { familyContext, isFamilySnapshot, wishedFor, existingFor, type ContextMember, type ContextPrefs, type FamilyContext, type FamilySnapshot } from '../personalize/family';
import { groupFor, type Helper } from '../../household-helpers';
import {
  OTHER_ROOM, cannotDo, canDo, cleaningRooms, coreJobs, jobById, paceFor, planRoom, roomById, sessionMinutes,
  type CleaningJob, type PlannedJob,
} from '../../../data/spring-cleaning';
import { JOB_GUIDES, ROOM_FINISH, type JobGuide } from '../../../data/club/spring-clean-guides';

export const KIT_MONTH = '2027-03';
/** The session the project is planned for, in minutes. */
export const SESSION = 30 as const;
/** "About thirty minutes": a prepared project never runs longer than this. */
export const MAX_MINUTES = 35;
/** The most job guides the back of the sheet prints legibly (two columns of four). */
export const MAX_JOBS = 8;
/** The fewest jobs a project has when anyone can do them (a real project, not one chore). */
export const MIN_JOBS = 3;
/** The youngest helpers (under six) work about fifteen minutes: one achievable job, not the whole session. */
export const YOUNG_MINUTES = 15;
const capacity = (h: Helper) => (h.group === 'young' ? YOUNG_MINUTES : SESSION);
export const DEFAULT_ROOM = 'living';

// ------------------------------------------------------------------ state

export interface SpringJob {
  /** Unique within the plan (the library job id). */
  key: string;
  jobId: string;
  /** Member ids; empty: nobody here can safely do it yet ("Needs someone"). */
  owners: string[];
  /** Several owners working on one shared outcome, only when she chose it. */
  share?: 'joint';
}
export interface SpringPlan {
  room: string;
  jobs: SpringJob[];
}
export interface SpringState {
  v: 1;
  /** Her plan once she changes anything; until then the prepared project prints. */
  plan?: SpringPlan;
  /** The profile answers it was prepared from (saved means settled, as every month on the foundation). */
  profile?: FamilySnapshot;
}
export interface SpringMember extends ContextMember { kind: 'adult' | 'child'; role?: string }

export const freshState = (): SpringState => ({ v: 1 });

// ------------------------------------------------------------------ the family as helpers

export const springContext = (members: readonly SpringMember[], prefs: ContextPrefs | undefined, snapshot?: FamilySnapshot): FamilyContext =>
  familyContext(members, prefs, KIT_MONTH, snapshot);

/** Everyone as the builder's helpers. A child with no birth year is planned as six (the foundation's rule). */
export const helpersOf = (ctx: FamilyContext): Helper[] => ctx.people.map((p) => {
  if (p.kind === 'adult') return { id: p.id, name: p.name, group: 'adult' as const, age: null, limits: [], ...(p.holder ? { holder: true } : {}) };
  const age = p.age ?? 6;
  return { id: p.id, name: p.name, group: age >= 18 ? 'adult' as const : groupFor(age), age: age >= 18 ? null : age, limits: [] };
});

// ------------------------------------------------------------------ the room

/** Step-6 priority → the room the project starts in. */
const PRIORITY_ROOM: Readonly<Record<string, string>> = {
  tidying: 'living', laundry: 'laundry', evenings: 'kitchen', mornings: 'entry', 'school-stuff': 'entry', bedtime: 'bedroom',
};
export function suggestedRoom(ctx: FamilyContext): { room: string; why: string } {
  const p = ctx.snapshot?.priority;
  const room = p ? PRIORITY_ROOM[p] : undefined;
  if (room) return { room, why: 'It’s the part of home life you said you’d most like to share.' };
  return { room: DEFAULT_ROOM, why: 'The room everyone uses, so everyone has a part.' };
}
export const ROOM_CHOICES = [...cleaningRooms.map((r) => ({ id: r.id, label: r.label })), { id: OTHER_ROOM, label: 'Another space' }];
export const roomLabel = (id: string) => roomById(id)?.label ?? 'Another space';

// ------------------------------------------------------------------ who already takes care of what

const LAUNDRY_JOBS = new Set(['d-linens', 'b-towels', 'b-curtain', 'r-bedding', 'r-light-bedding']);
const PICKUP_JOBS = new Set(['l-stray', 'l-toys-books', 'r-floor-pickup', 'p-bins', 'x-pickup', 'e-shoes-coats']);
/** Profile areas (step 3 "takes care of", step 4 "could take on") a job belongs to. */
export function jobAreas(job: CleaningJob): { areas: string[]; wishes: string[] } {
  const areas: string[] = [];
  const wishes: string[] = [];
  if (job.id.startsWith('k-')) { areas.push('meals'); wishes.push('help-with-meals'); }
  if (job.id.startsWith('la-') || LAUNDRY_JOBS.has(job.id)) { areas.push('laundry'); wishes.push('put-away-laundry'); }
  if (job.id.startsWith('e-') || job.id.startsWith('c-')) { areas.push('belongings'); wishes.push('own-belongings'); }
  if (PICKUP_JOBS.has(job.id)) wishes.push('tidy-room');
  if (job.phase >= 2 && !job.adultOnly) areas.push('cleaning');
  return { areas, wishes };
}
/** She already takes care of this kind of job (step 3), or she wished a child would (step 4). */
export function prefers(ctx: FamilyContext, job: CleaningJob, memberId: string): boolean {
  const { areas, wishes } = jobAreas(job);
  if (areas.some((a) => existingFor(ctx, a).owners.includes(memberId))) return true;
  return Boolean(wishes.length && wishedFor(ctx, wishes).ids.includes(memberId));
}

// ------------------------------------------------------------------ preparing the project

const plannedFor = (jobs: readonly CleaningJob[], helpers: readonly Helper[], ctx: FamilyContext) =>
  planRoom(jobs, helpers, SESSION, { prefer: (job, h) => prefers(ctx, job, h.id), capacity });
/** Everything assignable fits one session, within the time. */
function fits(planned: readonly PlannedJob[], helpers: readonly Helper[]) {
  return planned.every((x) => x.session === 0) && sessionMinutes(planned, helpers, 0) <= MAX_MINUTES;
}

/** The prepared project for a room: its jobs, in work order, each with its owner (or none, with the reason). */
export function preparedProject(ctx: FamilyContext, roomId?: string): SpringPlan {
  const room = roomById(roomId ?? suggestedRoom(ctx).room) ?? roomById(DEFAULT_ROOM)!;
  const helpers = helpersOf(ctx);
  const core = coreJobs(room);
  const doable = (job: CleaningJob) => helpers.some((h) => canDo(job, h));
  // One job from each work phase first (clear, clean, floors and trash), in library order; then the rest of the core.
  const firsts = [1, 2, 3].map((ph) => core.find((x) => x.phase === ph && doable(x))).filter((x): x is CleaningJob => Boolean(x));
  const order = [...firsts, ...core.filter((x) => !firsts.includes(x))];
  let chosen: CleaningJob[] = [];
  const tryAdd = (job: CleaningJob) => {
    if (chosen.length >= MAX_JOBS || chosen.includes(job)) return false;
    const next = [...chosen, job];
    if (doable(job) && !fits(plannedFor(next, helpers, ctx), helpers)) return false;
    chosen = next;
    return true;
  };
  for (const job of order) tryAdd(job);
  // Someone who can help but has nothing yet: a real job from the room's extras, never filler.
  const extras = room.jobs.filter((x) => !x.core && !x.adultOnly);
  for (const h of helpers) {
    const planned = plannedFor(chosen, helpers, ctx);
    if (planned.some((x) => x.owner === h.id)) continue;
    const job = extras.find((x) => !chosen.includes(x) && canDo(x, h));
    if (job) tryAdd(job);
  }
  const planned = plannedFor(chosen, helpers, ctx);
  return { room: room.id, jobs: planned.map((x) => ({ key: x.key, jobId: x.jobId!, owners: x.owner ? [x.owner] : [] })) };
}

// ------------------------------------------------------------------ her edits

const own = (s: SpringState, ctx: FamilyContext) => (s.plan ??= preparedProject(ctx));
const ctxOf = (members: readonly SpringMember[], prefs: ContextPrefs | undefined, s: SpringState) => springContext(members, prefs, s.profile);

export type EditResult = { ok: true } | { ok: false; text: string };
const no = (text: string): EditResult => ({ ok: false, text });
const yes: EditResult = { ok: true };

/** A new room: its prepared project (her earlier jobs were for the other room). */
export function setRoom(s: SpringState, roomId: string, members: readonly SpringMember[], prefs?: ContextPrefs): EditResult {
  if (!roomById(roomId)) return no('Choose one of the rooms.');
  s.plan = preparedProject(ctxOf(members, prefs, s), roomId);
  return yes;
}

/** Why a person can't own a job, in her words, or null. Grown-ups-only work never goes to a child. */
export function ownerProblem(jobId: string, memberId: string, ctx: FamilyContext): string | null {
  const job = jobById(jobId);
  const h = helpersOf(ctx).find((x) => x.id === memberId);
  if (!job || !h) return 'That person isn’t in your family.';
  const why = cannotDo(job, h);
  return why === 'grown-ups only' ? `${h.name} can’t take this one: it’s a grown-ups-only job.` : null;
}
/** A job a child is younger than the suggested age for: allowed (ages are suggestions), but worth a word. */
export function youngFor(jobId: string, memberId: string, ctx: FamilyContext): string | null {
  const job = jobById(jobId);
  const h = helpersOf(ctx).find((x) => x.id === memberId);
  if (!job || !h || h.group === 'adult') return null;
  const why = cannotDo(job, h);
  return why && why.startsWith('suggested') ? `Usually ${why.replace('suggested ', '')}: stay close the first time.` : null;
}

export function setOwners(s: SpringState, key: string, owners: readonly string[], members: readonly SpringMember[], prefs?: ContextPrefs, share?: 'joint'): EditResult {
  const ctx = ctxOf(members, prefs, s);
  const job = own(s, ctx).jobs.find((x) => x.key === key);
  if (!job) return no('That job isn’t on your plan.');
  const ids = [...new Set(owners)];
  for (const id of ids) {
    const problem = ownerProblem(job.jobId, id, ctx);
    if (problem) return no(problem);
  }
  job.owners = ids;
  if (ids.length > 1 && share === 'joint') job.share = 'joint'; else delete job.share;
  return yes;
}

export function removeJob(s: SpringState, key: string, members: readonly SpringMember[], prefs?: ContextPrefs): EditResult {
  const plan = own(s, ctxOf(members, prefs, s));
  if (plan.jobs.length <= 1) return no('Keep at least one job: that’s the project.');
  plan.jobs = plan.jobs.filter((x) => x.key !== key);
  return yes;
}

/** Jobs she can add or swap in: the room's other jobs (and any space's), not already on the plan. */
export function jobChoices(s: SpringState, members: readonly SpringMember[], prefs?: ContextPrefs): CleaningJob[] {
  const plan = s.plan ?? preparedProject(ctxOf(members, prefs, s));
  const room = roomById(plan.room);
  const taken = new Set(plan.jobs.map((x) => x.jobId));
  return (room?.jobs ?? []).filter((x) => !taken.has(x.id));
}

/** Add a job (to whoever can safely do it and has least, unless she names someone). */
export function addJob(s: SpringState, jobId: string, members: readonly SpringMember[], prefs?: ContextPrefs, owner?: string): EditResult {
  const ctx = ctxOf(members, prefs, s);
  const plan = own(s, ctx);
  const job = jobById(jobId);
  if (!job || plan.jobs.some((x) => x.jobId === jobId)) return no('That job is already on your plan.');
  if (plan.jobs.length >= MAX_JOBS) return no(`The plan holds ${MAX_JOBS} jobs so the instructions print clearly. Remove one first.`);
  if (owner) {
    const problem = ownerProblem(jobId, owner, ctx);
    if (problem) return no(problem);
  }
  const helpers = helpersOf(ctx);
  const load = (id: string) => plan.jobs.filter((x) => x.owners.includes(id)).reduce((m, x) => m + (jobById(x.jobId)?.minutes ?? 0), 0);
  const who = owner ?? helpers.filter((h) => canDo(job, h)).sort((a, b) => load(a.id) + (a.holder ? 3 : 0) - load(b.id) - (b.holder ? 3 : 0))[0]?.id;
  plan.jobs.push({ key: jobId, jobId, owners: who ? [who] : [] });
  plan.jobs.sort((a, b) => (jobById(a.jobId)?.phase ?? 2) - (jobById(b.jobId)?.phase ?? 2));
  return yes;
}

/** Swap one job for another; the new one keeps the same people when they can safely do it. */
export function replaceJob(s: SpringState, key: string, jobId: string, members: readonly SpringMember[], prefs?: ContextPrefs): EditResult {
  const ctx = ctxOf(members, prefs, s);
  const plan = own(s, ctx);
  const old = plan.jobs.find((x) => x.key === key);
  if (!old) return no('That job isn’t on your plan.');
  if (plan.jobs.some((x) => x.jobId === jobId)) return no('That job is already on your plan.');
  const keep = old.owners.filter((id) => ownerProblem(jobId, id, ctx) === null && canDoAge(jobId, id, ctx));
  plan.jobs = plan.jobs.filter((x) => x.key !== key);
  return addJob(s, jobId, members, prefs, keep[0]);
}
const canDoAge = (jobId: string, id: string, ctx: FamilyContext) => {
  const job = jobById(jobId);
  const h = helpersOf(ctx).find((x) => x.id === id);
  return Boolean(job && h && canDo(job, h));
};

/** Back to the prepared project; the profile snapshot goes too, so it's prepared from her newest answers. */
export const restoreProject = (s: SpringState) => { delete s.plan; delete s.profile; return s; };

/** Her plan, kept to this family: people who left drop out; unknown jobs drop; nothing else changes. */
export function cleanProject(plan: SpringPlan, ctx: FamilyContext): SpringPlan {
  const ids = new Set(ctx.people.map((p) => p.id));
  const seen = new Set<string>();
  const jobs = plan.jobs.filter((x) => jobById(x.jobId) && !seen.has(x.jobId) && seen.add(x.jobId)).map((x) => {
    const owners = x.owners.filter((o) => ids.has(o));
    const j: SpringJob = { key: x.key, jobId: x.jobId, owners };
    if (owners.length > 1 && x.share === 'joint') j.share = 'joint';
    return j;
  });
  return { room: roomById(plan.room) ? plan.room : DEFAULT_ROOM, jobs };
}

// ------------------------------------------------------------------ what prints

export interface JobView {
  key: string;
  jobId: string;
  title: string;
  phase: 1 | 2 | 3;
  /** About how long it takes its owner (younger helpers' pace included), whole minutes for display. */
  minutes: number;
  /** The same, unrounded: what the session is computed from. */
  effort: number;
  owners: { id: string; name: string; color: ReturnType<typeof colorFor>; adult: boolean }[];
  joint: boolean;
  /** Nobody here can safely do it: why (it stays unassigned). */
  needs: string | null;
  adultOnly: boolean;
  guide: JobGuide;
  supplies?: string;
}

const PHASE_WORDS: Record<1 | 2 | 3, string> = { 1: 'Clear and sort', 2: 'Clean', 3: 'Floors and trash' };

export function springView(s: SpringState, members: readonly SpringMember[], prefs?: ContextPrefs) {
  const ctx = ctxOf(members, prefs, s);
  const plan = s.plan ? cleanProject(s.plan, ctx) : preparedProject(ctx);
  const helpers = helpersOf(ctx);
  const person = (id: string) => ctx.people.find((p) => p.id === id);
  const jobs: JobView[] = plan.jobs.map((x) => {
    const job = jobById(x.jobId)!;
    const owners = x.owners.map(person).filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ id: p.id, name: p.name, color: colorFor(ctx.colors, p.id), adult: p.kind === 'adult' }));
    const pace = Math.max(1, ...x.owners.map((id) => { const h = helpers.find((y) => y.id === id); return h ? paceFor(h) : 1; }));
    const effort = job.minutes * (x.share === 'joint' ? 1 : pace);
    const reasons = helpers.map((h) => cannotDo(job, h)).filter((r): r is string => Boolean(r));
    return {
      key: x.key, jobId: x.jobId, title: job.title, phase: job.phase, minutes: Math.round(effort), effort,
      owners, joint: x.share === 'joint' && owners.length > 1,
      needs: owners.length ? null : reasons.length === helpers.length ? `Nobody here can safely do it yet (${reasons[0]}).` : 'Nobody is on it yet.',
      adultOnly: Boolean(job.adultOnly), guide: JOB_GUIDES[x.jobId], ...(job.supplies ? { supplies: job.supplies } : {}),
    };
  }).sort((a, b) => a.phase - b.phase);
  // The session: everyone works at the same time, so it takes as long as the busiest person's jobs.
  const per = new Map<string, number>();
  // A joint job counts its full time for each person on it (they work together the whole time).
  for (const j of jobs) for (const o of j.owners) per.set(o.id, (per.get(o.id) ?? 0) + j.effort);
  const minutes = Math.round(Math.max(0, ...per.values()));
  const people = ctx.people.map((p) => ({ id: p.id, name: p.name, color: colorFor(ctx.colors, p.id), adult: p.kind === 'adult', age: p.age,
    jobs: jobs.filter((j) => j.owners.some((o) => o.id === p.id)) })).filter((p) => p.jobs.length);
  const phases = [...new Set(jobs.map((j) => j.phase))].sort();
  const sequence = [
    'Gather the supplies together first.',
    ...phases.map((ph, i) => `${i === 0 ? 'Start' : i === phases.length - 1 ? 'Finish' : 'Then'} with ${PHASE_WORDS[ph].toLowerCase()}: ${listNames(jobs.filter((j) => j.phase === ph).flatMap((j) => j.owners.map((o) => o.name)))}.`),
  ];
  const supplies = [...new Set(jobs.map((j) => j.supplies).filter((x): x is string => Boolean(x)))];
  return {
    room: { id: plan.room, label: roomLabel(plan.room) },
    jobs, people, minutes,
    /** The schedule honestly fits about thirty minutes. */
    withinTime: minutes <= MAX_MINUTES,
    supplies, sequence,
    finish: ROOM_FINISH[plan.room] ?? ROOM_FINISH.other,
    /** People with no part this time (never given filler). */
    free: ctx.people.filter((p) => !people.some((x) => x.id === p.id)).map((p) => p.name),
    issues: validateProject(plan, ctx),
    changed: Boolean(s.plan),
    ctx,
  };
}
export type SpringView = ReturnType<typeof springView>;

const listNames = (names: readonly string[]) => {
  const u = [...new Set(names)];
  return u.length <= 1 ? (u[0] ?? 'everyone') : `${u.slice(0, -1).join(', ')} and ${u[u.length - 1]}`;
};

export const springFingerprint = (s: SpringState, members: readonly SpringMember[], prefs?: ContextPrefs) => {
  const v = springView(s, members, prefs);
  return JSON.stringify([v.room.id, v.minutes, v.jobs.map((j) => [j.jobId, j.joint, j.owners.map((o) => [o.name, o.color.id])])]);
};

// ------------------------------------------------------------------ validation

export interface ProjectIssue { kind: 'unsafe' | 'unassigned' | 'long' | 'many' | 'empty' | 'duplicate' | 'guide'; key?: string; text: string }

export function validateProject(plan: SpringPlan, ctx: FamilyContext): ProjectIssue[] {
  const out: ProjectIssue[] = [];
  const helpers = helpersOf(ctx);
  if (!plan.jobs.length) out.push({ kind: 'empty', text: 'The plan has no jobs.' });
  if (plan.jobs.length > MAX_JOBS) out.push({ kind: 'many', text: `More than ${MAX_JOBS} jobs won’t print clearly.` });
  const seen = new Set<string>();
  for (const x of plan.jobs) {
    if (seen.has(x.jobId)) out.push({ kind: 'duplicate', key: x.key, text: 'This job is on the plan twice.' });
    seen.add(x.jobId);
    if (!JOB_GUIDES[x.jobId]) out.push({ kind: 'guide', key: x.key, text: 'This job has no instructions.' });
    for (const o of x.owners) {
      const problem = ownerProblem(x.jobId, o, ctx);
      if (problem) out.push({ kind: 'unsafe', key: x.key, text: problem });
    }
    if (!x.owners.length) out.push({ kind: 'unassigned', key: x.key, text: 'Nobody is on this job yet.' });
  }
  const planned: PlannedJob[] = plan.jobs.flatMap((x) => x.owners.map((o) => ({ key: x.key, jobId: x.jobId, title: '', minutes: jobById(x.jobId)?.minutes ?? 0, owner: o, session: 0 })));
  if (sessionMinutes(planned, helpers, 0) > MAX_MINUTES) out.push({ kind: 'long', text: `This takes longer than about ${SESSION} minutes for someone. Move a job or save one for another day.` });
  return out;
}

// ------------------------------------------------------------------ saved state

export function isSpringState(x: unknown): x is SpringState {
  const s = x as Partial<SpringState> | null;
  if (!s || s.v !== 1) return false;
  if (s.profile !== undefined && !isFamilySnapshot(s.profile)) return false;
  if (s.plan === undefined) return true;
  const p = s.plan;
  return typeof p.room === 'string' && Array.isArray(p.jobs) && p.jobs.length <= MAX_JOBS * 2
    && p.jobs.every((j) => j && typeof j.key === 'string' && typeof j.jobId === 'string' && Array.isArray(j.owners) && j.owners.every((o) => typeof o === 'string')
      && (j.share === undefined || j.share === 'joint'));
}

export interface SpringPlanResource extends PlanResource<SpringState> {
  view: () => SpringView;
  members: () => SpringMember[];
  prefs: () => ContextPrefs;
  familyName: () => string;
  setLocked: (on: boolean) => void;
}
