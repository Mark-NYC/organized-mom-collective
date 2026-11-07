/**
 * Who does what, for any month: a list of the month's tasks → an owner (or owners) for each, from the family
 * (./family.ts). Pure and deterministic, ties broken by a stable hash (never randomness or an AI call), the same
 * rules the November ownership engine keeps (../engines/responsibilities.ts):
 *
 * - Someone who already takes care of an area (profile step 3) keeps it; a child she wished it for (step 4) is next.
 * - Otherwise the job goes to whoever has the most room for it, by age. Children's jobs fit their age.
 * - The account holder is never the default: she leans last when another grown-up could take it (HOLDER_LEAN).
 * - A job nobody in the family can do is honestly "nobody yet" (empty owners), never quietly hers.
 */
import { stableHash } from '../hash';
import { existingFor, wishedFor, type FamilyContext, type Person } from './family';

export interface PlanTask {
  id: string;
  title: string;
  /** 'one': a single owner. 'each': everyone who can, their own copy. 'together': everyone who can, as one job. */
  mode: 'one' | 'each' | 'together';
  /** 'any' lets older children take a grown-up job (with `minAge`). */
  who: 'child' | 'adult' | 'any';
  minAge?: number;
  maxAge?: number;
  /** How much of someone's room it takes (default 1). */
  effort?: number;
  /** Step 3 areas whose current owner keeps the job (meals, transportation, pet-care…). */
  areas?: readonly string[];
  /** Step 4 growth items whose child gets it first (pack-school-bag, help-with-meals…). */
  wishes?: readonly string[];
  /** For 'any': who to try first. Default: children, so the grown-ups aren't the fallback for everything. */
  prefer?: 'child' | 'adult';
}

export interface Assigned {
  id: string;
  title: string;
  ownerIds: string[];
  why: 'existing' | 'wished' | 'room' | 'each' | 'together' | 'none';
}

/** A child with no saved age is planned as a six-year-old: never more than a young child can do. */
export const UNKNOWN_AGE = 6;
export const taskAge = (p: Person) => (p.kind === 'adult' ? null : p.age ?? UNKNOWN_AGE);
/** Leaned against the account holder when another grown-up could take the job. */
export const HOLDER_LEAN = 0.5;
/** How much busier than the lightest-loaded person an owner from her answers may be before the job moves on. */
export const PREFER_MARGIN = 0.5;

export function canDo(task: Pick<PlanTask, 'who' | 'minAge' | 'maxAge'>, p: Person): boolean {
  if (p.kind === 'adult') return task.who !== 'child';
  if (task.who === 'adult') return false;
  const age = taskAge(p)!;
  return age >= (task.minAge ?? 0) && age <= (task.maxAge ?? Infinity);
}

/** Room by age: a young child's job counts for more of their week. */
const room = (p: Person) => {
  if (p.kind === 'adult') return 1;
  const age = taskAge(p)!;
  return age < 6 ? 0.5 : age < 9 ? 0.75 : 1;
};

export interface AssignOptions {
  /** Load already given out (by member id), so a month can assign in several passes. Updated in place. */
  load?: Map<string, number>;
  /** Mixed into tie-breaks, so two months don't make the same choices. */
  seed?: string;
}

export function assignTasks(tasks: readonly PlanTask[], ctx: FamilyContext, opts: AssignOptions = {}): Assigned[] {
  const load = opts.load ?? new Map<string, number>();
  const seed = opts.seed ?? ctx.month;
  const add = (ids: string[], effort: number) => ids.forEach((i) => load.set(i, (load.get(i) ?? 0) + effort));
  return tasks.map((t) => {
    const effort = t.effort ?? 1;
    const able = ctx.people.filter((p) => canDo(t, p));
    if (!able.length) return { id: t.id, title: t.title, ownerIds: [], why: 'none' as const };
    // Everyone's own jobs (their bag, their routine) don't take room from the shared ones.
    if (t.mode === 'each' || t.mode === 'together') return { id: t.id, title: t.title, ownerIds: able.map((p) => p.id), why: t.mode };
    const adults = able.filter((p) => p.kind === 'adult').length;
    const score = (p: Person) => (load.get(p.id) ?? 0) / room(p)
      + (p.holder && adults > 1 ? HOLDER_LEAN : 0)
      + (t.who === 'any' ? ((t.prefer ?? 'child') === 'child' ? (p.kind === 'adult' ? 2 : 0) : (p.kind === 'adult' ? 0 : 2)) : 0)
      + stableHash(`${seed}:${t.id}:${p.id}`) / 2 ** 32 / 100;
    const lightest = (list: Person[]) => [...list].sort((a, b) => score(a) - score(b))[0];
    const areas = (t.areas ?? []).map((a) => existingFor(ctx, a));
    const known = new Set(areas.flatMap((a) => (t.who === 'child' ? [...a.owners, ...a.helpers] : a.owners)));
    const keeping = able.filter((p) => known.has(p.id));
    const wished = t.wishes?.length ? new Set(wishedFor(ctx, t.wishes).ids) : new Set<string>();
    const wanting = able.filter((p) => wished.has(p.id));
    const [pool, preferred] = keeping.length ? [keeping, 'existing' as const] : wanting.length ? [wanting, 'wished' as const] : [able, 'room' as const];
    // Her answers lead, but not to the point of piling one area's every job on one person.
    const first = lightest(pool), open = lightest(able);
    const [owner, why] = score(first) > score(open) + PREFER_MARGIN ? [open, 'room' as const] : [first, preferred];
    add([owner.id], effort);
    return { id: t.id, title: t.title, ownerIds: [owner.id], why };
  });
}
