/**
 * V18 · C. Household memory. What the family has told us (confirmed) or what has happened enough times to be worth
 * mentioning as a possibility (inferred). Rules:
 *   - Never from a single occurrence: an inference needs MIN_EVIDENCE consistent observations and no contradiction.
 *   - Inferred memory only ever phrases a possibility ("Luis usually drives"), never assigns.
 *   - Confirmed memory comes only from an explicit family action ("Not needed for us", "Mateo makes his own").
 *   - Every memory is correctable: forget() removes it, and a forgotten inference is not re-learned from the same
 *     evidence (it would need new observations after the forget date).
 */
import type { EventKind } from './playbooks';

export const MIN_EVIDENCE = 3;

export interface Observation {
  /** 'YYYY-MM-DD' the event happened. */
  date: string;
  eventKind: EventKind;
  need: string;
  /** Who did it (a completed, agreed part). */
  ownerId: string;
}

export interface Memory {
  id: string;
  kind: 'confirmed' | 'inferred';
  eventKind: EventKind;
  need: string;
  /** owner: this person usually has it · not-needed: this family doesn't need it for this kind of activity. */
  effect: 'owner' | 'not-needed';
  memberId?: string;
  /** Dates (inferred) or the day the family said so (confirmed). */
  evidence: string[];
  since: string;
}

export interface MemoryState {
  confirmed: Memory[];
  observations: Observation[];
  /** memory id → date forgotten. */
  forgotten: Record<string, string>;
}

export const emptyMemory = (): MemoryState => ({ confirmed: [], observations: [], forgotten: {} });

const idOf = (m: Pick<Memory, 'eventKind' | 'need' | 'effect' | 'memberId'>) => `${m.effect}:${m.eventKind}:${m.need}:${m.memberId ?? '-'}`;

/** Inferred owners from repeated, consistent observations. */
export function inferred(mem: MemoryState): Memory[] {
  const groups = new Map<string, Observation[]>();
  for (const o of mem.observations) {
    const k = `${o.eventKind}:${o.need}`;
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  const out: Memory[] = [];
  for (const obs of groups.values()) {
    const owners = new Set(obs.map((o) => o.ownerId));
    if (owners.size !== 1) continue; // contradicting evidence: say nothing
    const { eventKind, need, ownerId } = obs[0];
    const m = { eventKind, need, effect: 'owner' as const, memberId: ownerId };
    const id = idOf(m);
    const after = mem.forgotten[id];
    const evidence = obs.map((o) => o.date).filter((d) => !after || d > after).sort();
    if (evidence.length < MIN_EVIDENCE) continue;
    out.push({ id, kind: 'inferred', ...m, evidence, since: evidence[0] });
  }
  return out;
}

export function allMemory(mem: MemoryState): Memory[] {
  const confirmed = mem.confirmed.filter((m) => !mem.forgotten[m.id] || mem.forgotten[m.id] < m.since);
  const conf = new Set(confirmed.map((m) => `${m.eventKind}:${m.need}`));
  // A confirmed memory always wins over an inference about the same need.
  return [...confirmed, ...inferred(mem).filter((m) => !conf.has(`${m.eventKind}:${m.need}`))];
}

export function confirm(mem: MemoryState, m: Omit<Memory, 'id' | 'kind' | 'evidence' | 'since'>, today: string): MemoryState {
  const id = idOf(m);
  const rest = mem.confirmed.filter((x) => x.id !== id && !(x.eventKind === m.eventKind && x.need === m.need));
  return { ...mem, confirmed: [...rest, { ...m, id, kind: 'confirmed', evidence: [today], since: today }], forgotten: omit(mem.forgotten, id) };
}

export function forget(mem: MemoryState, id: string, today: string): MemoryState {
  return { ...mem, confirmed: mem.confirmed.filter((x) => x.id !== id), forgotten: { ...mem.forgotten, [id]: today } };
}

/** Kinds that share habits: whoever drives to practice is a fair guess for the game. */
const FAMILY: Partial<Record<EventKind, string>> = { 'sports-game': 'sports', 'sports-practice': 'sports', party: 'party', 'birthday-party': 'party' };
export const sameFamily = (a: EventKind, b: EventKind) => a === b || (FAMILY[a] !== undefined && FAMILY[a] === FAMILY[b]);

/** Exact kind first, then the same family of kinds. */
export function memoryFor(mem: MemoryState, eventKind: EventKind, need: string): Memory | null {
  const all = allMemory(mem).filter((m) => m.need === need);
  return all.find((m) => m.eventKind === eventKind) ?? all.find((m) => sameFamily(m.eventKind, eventKind)) ?? null;
}

function omit<T extends Record<string, unknown>>(o: T, k: string): T { const c = { ...o }; delete c[k]; return c; }
