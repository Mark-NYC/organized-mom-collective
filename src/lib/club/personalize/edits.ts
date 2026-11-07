/**
 * Her changes to a month's prepared assignments, the same three choices January's review offers (keep, change, skip):
 * a different owner (or owners), her own wording, or off the printed page. Stored by task id inside the month's plan
 * state, so they survive regeneration: the prepared plan underneath can change (new family members, newer answers)
 * and her choices stay on top of it. Owners that leave the family drop out; a task left with nobody goes back to the
 * prepared owner rather than printing blank.
 */
import type { Assigned } from './assign';
import { nameList, namesOf, type FamilyContext } from './family';

export interface TaskEdit {
  owners?: string[];
  title?: string;
  skip?: boolean;
}
export type TaskEdits = Record<string, TaskEdit>;

export const TASK_TITLE_LIMIT = 48;

export interface PlannedTask extends Assigned {
  /** What prints: her words or the prepared title. */
  label: string;
  /** Who it's for, as printed ("Sofia and Mateo", "Everyone"). Empty when nobody in the family can do it yet. */
  who: string;
  skipped: boolean;
  /** She changed it (owner, wording or skip). */
  changed: boolean;
}

/** "Everyone" when it's the whole family (three or more); otherwise their names. */
export function ownerLabel(ctx: FamilyContext, ids: readonly string[]): string {
  if (ids.length >= 3 && ctx.people.every((p) => ids.includes(p.id))) return 'Everyone';
  return nameList(namesOf(ctx, ids));
}

export function withEdits(assigned: readonly Assigned[], edits: TaskEdits | undefined, ctx: FamilyContext): PlannedTask[] {
  const present = new Set(ctx.people.map((p) => p.id));
  return assigned.map((a) => {
    const e = edits?.[a.id];
    const mine = e?.owners?.filter((i) => present.has(i));
    const ownerIds = mine?.length ? mine : a.ownerIds;
    const label = e?.title?.trim() || a.title;
    return { ...a, ownerIds, label, who: ownerLabel(ctx, ownerIds), skipped: Boolean(e?.skip), changed: Boolean(e && (e.skip || e.title || e.owners?.length)) };
  });
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, TASK_TITLE_LIMIT);
const edit = (edits: TaskEdits, id: string) => (edits[id] ??= {});
const prune = (edits: TaskEdits, id: string) => {
  const e = edits[id];
  if (e && !e.skip && !e.title && !e.owners?.length) delete edits[id];
  return edits;
};

/** Each changes `edits` in place and returns it. */
export const setTaskOwners = (edits: TaskEdits, id: string, owners: readonly string[]) => {
  const list = [...new Set(owners)];
  if (list.length) edit(edits, id).owners = list;
  else if (edits[id]) delete edits[id].owners;
  return prune(edits, id);
};
/** Add or take away one person (never the last one). */
export const toggleTaskOwner = (edits: TaskEdits, id: string, current: readonly string[], person: string) => {
  const next = current.includes(person) ? current.filter((i) => i !== person) : [...current, person];
  return next.length ? setTaskOwners(edits, id, next) : edits;
};
export const setTaskTitle = (edits: TaskEdits, id: string, title: string, prepared: string) => {
  const clean = tidy(title);
  if (clean && clean !== prepared) edit(edits, id).title = clean;
  else if (edits[id]) delete edits[id].title;
  return prune(edits, id);
};
export const setTaskSkip = (edits: TaskEdits, id: string, skip: boolean) => {
  if (skip) edit(edits, id).skip = true;
  else if (edits[id]) delete edits[id].skip;
  return prune(edits, id);
};
export const resetTask = (edits: TaskEdits, id: string) => { delete edits[id]; return edits; };

/** Edits for people who are no longer in the family lose those people. */
export function pruneTaskEdits(edits: TaskEdits, ctx: FamilyContext): TaskEdits {
  const present = new Set(ctx.people.map((p) => p.id));
  for (const [id, e] of Object.entries(edits)) {
    if (e.owners) e.owners = e.owners.filter((i) => present.has(i));
    prune(edits, id);
  }
  return edits;
}

export function isTaskEdits(x: unknown): x is TaskEdits {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const entries = Object.entries(x as Record<string, unknown>);
  return entries.length <= 120 && entries.every(([k, v]) => {
    const e = v as TaskEdit | null;
    return k.length <= 80 && Boolean(e) && typeof e === 'object'
      && (e!.owners === undefined || (Array.isArray(e!.owners) && e!.owners.length <= 12 && e!.owners.every((o) => typeof o === 'string')))
      && (e!.title === undefined || (typeof e!.title === 'string' && e!.title.length <= TASK_TITLE_LIMIT))
      && (e!.skip === undefined || typeof e!.skip === 'boolean');
  });
}
