/**
 * Saved edits for an engine-filled printable (club_documents.edits): how a family's chart stays theirs.
 *
 * The chart she sees is `accepted` (the engine's suggestions as they were when she took them) plus `added` rows,
 * with her own edits on top. A family change never touches it: re-running the engine only produces *suggestions*
 * (a new child's jobs, an owner for a job that needs one), which she adds or dismisses. Her edits always win, and
 * nothing she changed is ever re-suggested or rewritten.
 *
 * Everything is plain JSON with arrays where order matters (Postgres jsonb doesn't keep object key order), and every
 * operation returns a new object.
 */
import type { ChartSection, Frequency, KitItem, OwnershipLevel } from '../../data/club/types';
import { CHART_SECTIONS, FREQUENCIES, OWNERSHIP_LEVELS } from '../../data/club/types';
import { balanceSuggestions, eligible, generateOwnership, levelFor, type Assignment, type BalanceMove, type GenerateOptions, type PinnedRow } from './engines/responsibilities';
import { planMembers, type Household, type PlannedMember } from './profile';

/** An engine suggestion as she accepted it. Kept whole, so it survives the rules or the family changing. */
export interface AcceptedRow {
  rowId: string;
  itemId: string;
  title: string;
  doneMeans: string;
  section: ChartSection;
  frequency: Frequency;
  ownerId: string | null;
  coachId: string | null;
  /**
   * The ownership level when she accepted it. Kept, so a family change (a partner joining ends the one-adult level
   * boost; a birthday) never quietly changes the chart. Moving a job up a level is her call (setLevel).
   * Missing in saves from before 2026-10-23: worked out from the owner's age then.
   */
  level?: OwnershipLevel | null;
  illustration?: string;
}

/** A row she added herself: typed in, or picked from the kit's library (`itemId`). */
export interface AddedRow {
  rowId: string;
  itemId?: string;
  title: string;
  section: ChartSection;
  frequency: Frequency;
  ownerId: string | null;
  illustration?: string;
}

export interface DocumentEdits {
  accepted: AcceptedRow[];
  added: AddedRow[];
  assign: Record<string, string | null>;
  coach: Record<string, string | null>;
  frequency: Record<string, Frequency>;
  level: Record<string, OwnershipLevel>;
  text: Record<string, string>;
  /** Her wording for what "done" looks like. */
  done: Record<string, string>;
  /** rowId → the library item she swapped in (keeps the row's place and owner). */
  replace: Record<string, string>;
  hidden: string[];
  /** Her row order; rows not listed follow in their saved order. */
  order: string[];
  /** Suggestions she said "Not now" to: never offered again. */
  dismissed: string[];
}

export interface ChartRow {
  rowId: string;
  itemId: string | null;
  title: string;
  doneMeans: string | null;
  section: ChartSection;
  frequency: Frequency;
  ownerId: string | null;
  level: OwnershipLevel | null;
  coachId: string | null;
  illustration?: string;
  /** She changed something on this row (or added it): the engine never touches it. */
  edited: boolean;
  custom: boolean;
  /** No owner, or the owner was removed from the family. */
  needsOwner: boolean;
  /** Owned by someone younger than the job's suggested age (her call; shown gently, never blocked). */
  belowSuggestedAge: boolean;
}

export type Suggestion =
  | { kind: 'add'; row: Assignment }
  | { kind: 'owner'; rowId: string; ownerId: string; title: string }
  /** An optional move that evens out the week (balanceSuggestions). */
  | ({ kind: 'balance'; title: string } & BalanceMove);

/** One id per suggestion, for keys, dismissal and tests. */
export const suggestionId = (s: Suggestion) =>
  s.kind === 'add' ? s.row.rowId : s.kind === 'owner' ? `owner:${s.rowId}` : `balance:${s.rowId}:${s.toId}`;

export interface ResolvedDocument {
  rows: ChartRow[];
  hidden: ChartRow[];
  suggestions: Suggestion[];
}

export const MAX_TITLE = 80;
export const MAX_DONE = 160;
export const MAX_ADDED = 40;

export const emptyEdits = (): DocumentEdits => ({
  accepted: [], added: [], assign: {}, coach: {}, frequency: {}, level: {}, text: {}, done: {}, replace: {}, hidden: [], order: [], dismissed: [],
});

const snapshot = (a: Assignment): AcceptedRow => ({
  rowId: a.rowId,
  itemId: a.itemId,
  title: a.title,
  doneMeans: a.doneMeans,
  section: a.section,
  frequency: a.frequency,
  ownerId: a.ownerId,
  coachId: a.coachId,
  level: a.level,
  ...(a.illustration ? { illustration: a.illustration } : {}),
});

/** The first time she opens a kit: the engine's whole chart becomes hers. */
export function initialEdits(household: Household, items: readonly KitItem[], month: string, options: GenerateOptions = {}): DocumentEdits {
  return { ...emptyEdits(), accepted: generateOwnership(household, items, month, [], options).rows.map(snapshot) };
}

const editedIds = (e: DocumentEdits) =>
  new Set([...Object.keys(e.assign), ...Object.keys(e.coach), ...Object.keys(e.frequency), ...Object.keys(e.level), ...Object.keys(e.text), ...Object.keys(e.done), ...Object.keys(e.replace)]);

const has = <T>(o: Record<string, T>, k: string) => Object.hasOwn(o, k);

/** Each row as it is now: saved snapshot or added row, with her edits applied. */
function currentRows(e: DocumentEdits, items: ReadonlyMap<string, KitItem>) {
  const edited = editedIds(e);
  const base = [
    ...e.accepted.map((a) => ({ ...a, custom: false })),
    ...e.added.map((a) => ({ ...a, doneMeans: (a.itemId && items.get(a.itemId)?.doneMeans) || '', coachId: null as string | null, level: undefined, custom: true })),
  ];
  return base.map((r) => {
    const swap = has(e.replace, r.rowId) ? items.get(e.replace[r.rowId]) : undefined;
    const ownerId = has(e.assign, r.rowId) ? e.assign[r.rowId] : r.ownerId;
    const itemId = swap?.id ?? r.itemId ?? null;
    return {
      rowId: r.rowId,
      itemId,
      title: has(e.text, r.rowId) ? e.text[r.rowId] : swap?.title ?? r.title,
      doneMeans: has(e.done, r.rowId) ? e.done[r.rowId] : swap?.doneMeans ?? (r.doneMeans || null),
      section: swap?.section ?? r.section,
      frequency: has(e.frequency, r.rowId) ? e.frequency[r.rowId] : swap?.frequency ?? r.frequency,
      ownerId,
      coachId: has(e.coach, r.rowId) ? e.coach[r.rowId] : r.coachId,
      illustration: swap ? swap.illustration : r.illustration,
      edited: edited.has(r.rowId) || r.custom,
      custom: r.custom,
      // The accepted level still applies while the job keeps the owner and the job it was accepted with.
      keptLevel: !swap && ownerId === r.ownerId ? r.level : undefined,
    };
  });
}

/** What the page shows: her chart, her hidden rows, and the engine's suggestions for what's changed. */
export function resolveDocument(household: Household, items: readonly KitItem[], month: string, e: DocumentEdits, options: GenerateOptions = {}): ResolvedDocument {
  const people = new Map<string, PlannedMember>(planMembers(household, month).map((p) => [p.id, p]));
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const adults = [...people.values()].filter((p) => p.stage === 'adult').length;
  const hidden = new Set(e.hidden);

  const rows: ChartRow[] = currentRows(e, itemMap).map((r) => {
    const owner = r.ownerId ? people.get(r.ownerId) : undefined;
    const item = r.itemId ? itemMap.get(r.itemId) : undefined;
    const coach = r.coachId && r.coachId !== r.ownerId ? people.get(r.coachId) : undefined;
    const { keptLevel, ...row } = r;
    const level: OwnershipLevel | null = has(e.level, r.rowId) ? e.level[r.rowId]
      : keptLevel ? keptLevel
      : owner && item ? levelFor(item, owner, adults === 1 ? 1 : 0) : owner ? 'owns' : null;
    return {
      ...row,
      level: owner ? level : null,
      coachId: coach && level !== 'owns' ? coach.id : null,
      needsOwner: !owner,
      belowSuggestedAge: Boolean(owner && item && owner.stage !== 'adult' && (owner.age ?? 0) < (item.minAge ?? 0)),
    };
  });

  // Her order first, then the rest as saved.
  const position = new Map(e.order.map((id, n) => [id, n]));
  const saved = new Map(rows.map((r, n) => [r.rowId, n]));
  rows.sort((a, b) => (position.get(a.rowId) ?? Infinity) - (position.get(b.rowId) ?? Infinity) || saved.get(a.rowId)! - saved.get(b.rowId)!);

  // Suggestions: run the engine around everything already on (or hidden from) her chart.
  const pinned: PinnedRow[] = rows
    .filter((r) => r.itemId && itemMap.has(r.itemId))
    .map((r) => ({ rowId: r.rowId, itemId: r.itemId!, ownerId: r.needsOwner ? null : r.ownerId }));
  const known = new Set(rows.map((r) => r.rowId));
  const dismissed = new Set(e.dismissed);
  const suggestions: Suggestion[] = [];
  for (const a of generateOwnership(household, items, month, pinned, options).rows) {
    if (a.pinned || dismissed.has(a.rowId) || hidden.has(a.rowId)) continue;
    if (!known.has(a.rowId)) {
      suggestions.push({ kind: 'add', row: a });
    } else if (a.ownerId) {
      const r = rows.find((x) => x.rowId === a.rowId)!;
      // Not for a job she deliberately left without an owner.
      const leftOpen = has(e.assign, a.rowId) && e.assign[a.rowId] === null;
      if (r.needsOwner && !leftOpen && !dismissed.has(`owner:${a.rowId}`)) suggestions.push({ kind: 'owner', rowId: a.rowId, ownerId: a.ownerId, title: r.title });
    }
  }

  // Workload balance: optional moves on visible rows she didn't assign herself (off for routines: nothing to balance).
  const visible = rows.filter((r) => !hidden.has(r.rowId) && !r.needsOwner);
  const moves = options.balance === false ? [] : balanceSuggestions(household, items, month, visible.map((r) => ({ rowId: r.rowId, itemId: r.itemId, ownerId: r.ownerId, locked: r.custom || has(e.assign, r.rowId) })));
  for (const m of moves) {
    const s: Suggestion = { kind: 'balance', title: visible.find((r) => r.rowId === m.rowId)!.title, ...m };
    if (!dismissed.has(suggestionId(s))) suggestions.push(s);
  }

  return { rows: rows.filter((r) => !hidden.has(r.rowId)), hidden: rows.filter((r) => hidden.has(r.rowId)), suggestions };
}

// ------------------------------------------------------------------ operations (each returns new edits)

export class EditError extends Error {}

const rowIds = (e: DocumentEdits) => new Set([...e.accepted.map((r) => r.rowId), ...e.added.map((r) => r.rowId)]);
const requireRow = (e: DocumentEdits, rowId: string) => {
  if (!rowIds(e).has(rowId)) throw new EditError('unknown_row');
};
const requireMember = (household: Household, memberId: string | null) => {
  if (memberId === null) return;
  const m = household.members.find((x) => x.id === memberId);
  if (!m || m.archived) throw new EditError('unknown_member');
};
const cleanTitle = (title: string) => {
  const t = title.replace(/\s+/g, ' ').trim();
  if (!t || t.length > MAX_TITLE) throw new EditError('invalid_title');
  return t;
};
const withKey = <T>(o: Record<string, T>, k: string, v: T) => ({ ...o, [k]: v });
const withoutKey = <T>(o: Record<string, T>, k: string) => {
  const { [k]: _, ...rest } = o;
  return rest;
};

/** Give a job to someone (or null: "Needs an owner"). */
export function assign(e: DocumentEdits, household: Household, rowId: string, memberId: string | null): DocumentEdits {
  requireRow(e, rowId);
  requireMember(household, memberId);
  return { ...e, assign: withKey(e.assign, rowId, memberId) };
}

export function setCoach(e: DocumentEdits, household: Household, rowId: string, memberId: string | null): DocumentEdits {
  requireRow(e, rowId);
  requireMember(household, memberId);
  return { ...e, coach: withKey(e.coach, rowId, memberId) };
}

export function setFrequency(e: DocumentEdits, rowId: string, frequency: Frequency): DocumentEdits {
  requireRow(e, rowId);
  if (!FREQUENCIES.includes(frequency)) throw new EditError('invalid_frequency');
  return { ...e, frequency: withKey(e.frequency, rowId, frequency) };
}

export function setLevel(e: DocumentEdits, rowId: string, level: OwnershipLevel): DocumentEdits {
  requireRow(e, rowId);
  if (!OWNERSHIP_LEVELS.includes(level)) throw new EditError('invalid_level');
  return { ...e, level: withKey(e.level, rowId, level) };
}

/** Reword a job. An empty title puts the original wording back. */
export function rename(e: DocumentEdits, rowId: string, title: string): DocumentEdits {
  requireRow(e, rowId);
  if (!title.trim()) return { ...e, text: withoutKey(e.text, rowId) };
  return { ...e, text: withKey(e.text, rowId, cleanTitle(title)) };
}

/** Her own words for what "done" looks like. Empty puts the suggested wording back. */
export function setDoneMeans(e: DocumentEdits, rowId: string, text: string): DocumentEdits {
  requireRow(e, rowId);
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return { ...e, done: withoutKey(e.done, rowId) };
  if (t.length > MAX_DONE) throw new EditError('invalid_done');
  return { ...e, done: withKey(e.done, rowId, t) };
}

/** Swap a job for another from the kit's library, keeping its place and owner. */
export function replace(e: DocumentEdits, items: readonly KitItem[], rowId: string, itemId: string): DocumentEdits {
  requireRow(e, rowId);
  if (!items.some((i) => i.id === itemId)) throw new EditError('unknown_item');
  // Her wording belonged to the old job.
  return { ...e, replace: withKey(e.replace, rowId, itemId), text: withoutKey(e.text, rowId), done: withoutKey(e.done, rowId) };
}

/** Take a job off the chart. Engine rows are hidden (and can come back); rows she added are deleted. */
export function remove(e: DocumentEdits, rowId: string): DocumentEdits {
  requireRow(e, rowId);
  if (e.added.some((r) => r.rowId === rowId)) {
    return { ...e, added: e.added.filter((r) => r.rowId !== rowId), order: e.order.filter((id) => id !== rowId) };
  }
  return e.hidden.includes(rowId) ? e : { ...e, hidden: [...e.hidden, rowId] };
}

export function restore(e: DocumentEdits, rowId: string): DocumentEdits {
  return { ...e, hidden: e.hidden.filter((id) => id !== rowId) };
}

/** Add her own job, typed in or picked from the library. */
export function addRow(
  e: DocumentEdits,
  household: Household,
  row: { title: string; section?: ChartSection; frequency?: Frequency; ownerId?: string | null; item?: KitItem },
): DocumentEdits {
  if (e.added.length >= MAX_ADDED) throw new EditError('too_many');
  requireMember(household, row.ownerId ?? null);
  const used = rowIds(e);
  let n = e.added.length + 1;
  while (used.has(`custom-${n}`)) n++;
  const added: AddedRow = {
    rowId: `custom-${n}`,
    ...(row.item ? { itemId: row.item.id } : {}),
    title: cleanTitle(row.title || row.item?.title || ''),
    section: row.section ?? row.item?.section ?? 'family',
    frequency: row.frequency ?? row.item?.frequency ?? 'weekly',
    ownerId: row.ownerId ?? null,
    ...(row.item?.illustration ? { illustration: row.item.illustration } : {}),
  };
  if (!FREQUENCIES.includes(added.frequency)) throw new EditError('invalid_frequency');
  return { ...e, added: [...e.added, added] };
}

/** Move a row to `index` in the visible order she's looking at (`visible`, as resolveDocument returned it). */
export function move(e: DocumentEdits, visible: readonly string[], rowId: string, index: number): DocumentEdits {
  requireRow(e, rowId);
  const order = visible.filter((id) => id !== rowId);
  order.splice(Math.max(0, Math.min(index, order.length)), 0, rowId);
  return { ...e, order };
}

export function acceptSuggestion(e: DocumentEdits, s: Suggestion): DocumentEdits {
  if (s.kind === 'add') {
    if (rowIds(e).has(s.row.rowId)) return e;
    return { ...e, accepted: [...e.accepted, snapshot(s.row)], dismissed: e.dismissed.filter((id) => id !== s.row.rowId) };
  }
  // An owner for a job that needs one, or a balance move: recorded as her choice, like any assignment.
  return { ...e, assign: withKey(e.assign, s.rowId, s.kind === 'owner' ? s.ownerId : s.toId) };
}

export function dismissSuggestion(e: DocumentEdits, s: Suggestion): DocumentEdits {
  // Owner and balance suggestions are remembered per row (and person), so "Not now" never hides the job itself.
  const id = suggestionId(s);
  return e.dismissed.includes(id) ? e : { ...e, dismissed: [...e.dismissed, id] };
}

// ------------------------------------------------------------------ reading saved edits

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNullableStr = (v: unknown): v is string | null => v === null || isStr(v);
const SECTIONS: readonly ChartSection[] = CHART_SECTIONS;
const strMap = <T>(v: unknown, ok: (x: unknown) => x is T): Record<string, T> => {
  const out: Record<string, T> = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k, x] of Object.entries(v)) if (k.length <= 120 && ok(x)) out[k] = x;
  return out;
};
const strList = (v: unknown) => (Array.isArray(v) ? v.filter(isStr).slice(0, 500) : []);
const isFreq = (v: unknown): v is Frequency => FREQUENCIES.includes(v as Frequency);
const isLevel = (v: unknown): v is OwnershipLevel => OWNERSHIP_LEVELS.includes(v as OwnershipLevel);
const isSection = (v: unknown): v is ChartSection => SECTIONS.includes(v as ChartSection);

/** Saved JSON (from club_documents) → edits, dropping anything malformed instead of failing the page. */
export function readEdits(json: unknown): DocumentEdits {
  const o = (json && typeof json === 'object' && !Array.isArray(json) ? json : {}) as Record<string, unknown>;
  const rows = (v: unknown) => (Array.isArray(v) ? v : []).filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object');
  const seen = new Set<string>();
  const unique = (id: unknown) => isStr(id) && !seen.has(id) && Boolean(seen.add(id));
  const accepted: AcceptedRow[] = rows(o.accepted)
    .filter((r) => unique(r.rowId) && isStr(r.itemId) && isStr(r.title) && isSection(r.section) && isFreq(r.frequency) && isNullableStr(r.ownerId))
    .map((r) => ({
      rowId: r.rowId as string, itemId: r.itemId as string, title: r.title as string, doneMeans: isStr(r.doneMeans) ? r.doneMeans : '',
      section: r.section as ChartSection, frequency: r.frequency as Frequency, ownerId: r.ownerId as string | null,
      coachId: isStr(r.coachId) ? r.coachId : null, ...(isLevel(r.level) ? { level: r.level } : {}), ...(isStr(r.illustration) ? { illustration: r.illustration } : {}),
    }));
  const added: AddedRow[] = rows(o.added)
    .filter((r) => unique(r.rowId) && isStr(r.title) && isSection(r.section) && isFreq(r.frequency) && isNullableStr(r.ownerId))
    .slice(0, MAX_ADDED)
    .map((r) => ({
      rowId: r.rowId as string, ...(isStr(r.itemId) ? { itemId: r.itemId } : {}), title: r.title as string, section: r.section as ChartSection,
      frequency: r.frequency as Frequency, ownerId: r.ownerId as string | null, ...(isStr(r.illustration) ? { illustration: r.illustration } : {}),
    }));
  return {
    accepted,
    added,
    assign: strMap(o.assign, isNullableStr),
    coach: strMap(o.coach, isNullableStr),
    frequency: strMap(o.frequency, isFreq),
    level: strMap(o.level, isLevel),
    text: strMap(o.text, (v): v is string => isStr(v) && v.trim().length > 0 && v.length <= MAX_TITLE),
    done: strMap(o.done, (v): v is string => isStr(v) && v.trim().length > 0 && v.length <= MAX_DONE),
    replace: strMap(o.replace, isStr),
    hidden: strList(o.hidden),
    order: strList(o.order),
    dismissed: strList(o.dismissed),
  };
}

/** Is this row's owner someone the job suits? Exported for the picker ("suggested from age 7"). */
export const suits = (item: KitItem, household: Household, month: string, memberId: string) => {
  const p = planMembers(household, month).find((x) => x.id === memberId);
  return Boolean(p && eligible(item, p, household.preferences));
};
