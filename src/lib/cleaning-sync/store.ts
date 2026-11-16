/**
 * Shared cleaning progress: both grown-ups see the same checkmarks (supabase/migrations/20261201000000_household_cleaning_progress.sql).
 *
 * The cleaning companion keeps its checkmarks on the device (src/lib/storage.ts, omc:v1:<list>:<period> → ids). This
 * adds the household on top, without changing that:
 *
 * - Every check or uncheck made here becomes a mark {list, period, item, done, at} in an outbox kept on the phone, so
 *   it survives no signal and the app being closed.
 * - sync(): sends the outbox, then pulls what changed in the household and applies it to the device's lists.
 * - No conflicts to resolve by hand: each item is its own record, so two people checking different things never
 *   collide, and for the same item the latest tap wins (by the time it was tapped, so something done offline on Monday
 *   doesn't undo Tuesday's). A mark still waiting here is never overwritten by the pull before it is sent.
 * - "Try again later" failures keep everything (../sync-errors.ts). A mark the household refuses is dropped: there is
 *   nothing to ask her about a checkbox, and the pull shows the household's state.
 *
 * Pure state functions (tests/cleaning-sync.test.ts); the browser wrapper is ./client.ts.
 */
import { retryLater } from '../sync-errors';

export type CleaningList = 'daily' | 'focus' | 'weekend' | 'monthly' | 'active';
export interface Mark { list: CleaningList; period: string; item: string; done: boolean; at: string }
export interface CleaningSyncState {
  /** The household these marks go to; 'none' before one is known. */
  scope: string;
  outbox: Mark[];
  /** Server time of the last pull. */
  since: string | null;
}
export interface CleaningApi {
  push(marks: Mark[]): Promise<unknown>;
  changes(since: string | null): Promise<{ now: string; marks: Mark[] }>;
}

export const emptyCleaningSync = (scope = 'none'): CleaningSyncState => ({ scope, outbox: [], since: null });
const same = (a: Mark, b: Mark) => a.list === b.list && a.period === b.period && a.item === b.item;
const KEY = /^omc:v1:(daily|focus|weekend|monthly|active):(\d{4}-\d{2}(?:-\d{2})?)$/;
/** "omc:v1:daily:2026-11-15" → { list: 'daily', period: '2026-11-15' }; null for anything that isn't a checklist. */
export function parseKey(key: string): { list: CleaningList; period: string } | null {
  const m = KEY.exec(key);
  return m ? { list: m[1] as CleaningList, period: m[2] } : null;
}
export const keyOf = (m: Pick<Mark, 'list' | 'period'>) => `omc:v1:${m.list}:${m.period}`;
const okItem = (item: string) => item.length > 0 && item.length <= 120 && item !== 'legacy';

/** A check or uncheck made here; the newest tap for an item replaces an older one still waiting. */
export function queue(s: CleaningSyncState, marks: Mark[]): CleaningSyncState {
  let outbox = s.outbox;
  for (const m of marks) {
    if (!okItem(m.item)) continue;
    outbox = [...outbox.filter((o) => !same(o, m)), m];
  }
  return { ...s, outbox };
}

/** The marks for one device change (storage.ts → onListChange). */
export function marksFor(key: string, added: string[], removed: string[], at: string): Mark[] {
  const k = parseKey(key);
  if (!k) return [];
  return [...added.map((item) => ({ ...k, item, done: true, at })), ...removed.map((item) => ({ ...k, item, done: false, at }))];
}

/**
 * This phone joins a household's shared progress. What's already checked here is offered once, dated at the epoch:
 * the household takes it only where it has no record of that item, so it never undoes the other grown-up.
 * A different household (another account on this phone): start clean, nothing of the old one is sent.
 */
export function adoptCleaning(s: CleaningSyncState, scope: string, local: [string, string[]][]): CleaningSyncState {
  if (s.scope === scope) return s;
  if (s.scope !== 'none') return emptyCleaningSync(scope);
  const seed = local.flatMap(([key, ids]) => marksFor(key, ids, [], new Date(0).toISOString()));
  // Taps already waiting (made before the household was known) keep their own time and go after the seed.
  return queue({ scope, outbox: [], since: null }, [...seed, ...s.outbox]);
}

/** The household's marks to apply on this device: all except items with a tap still waiting here. */
export function toApply(s: CleaningSyncState, remote: Mark[]): Mark[] {
  return remote.filter((r) => okItem(r.item) && !s.outbox.some((o) => same(o, r)));
}

export interface CleaningSyncResult { state: CleaningSyncState; apply: Mark[]; pushed: number; offline: boolean }
const BATCH = 200;

export async function syncCleaning(start: CleaningSyncState, api: CleaningApi): Promise<CleaningSyncResult> {
  let s = start;
  if (s.scope === 'none') return { state: s, apply: [], pushed: 0, offline: false };
  let pushed = 0;
  while (s.outbox.length) {
    const batch = s.outbox.slice(0, BATCH);
    try {
      await api.push(batch);
    } catch (e) {
      if (retryLater(e)) return { state: s, apply: [], pushed, offline: true };
      // Refused outright: these marks will never be taken. Drop them; the pull shows what the household has.
    }
    s = { ...s, outbox: s.outbox.filter((o) => !batch.includes(o)) };
    pushed += batch.length;
  }
  try {
    // 5-minute overlap: a mark being saved while we asked last time isn't missed. Applying one twice is harmless.
    const since = s.since ? new Date(Date.parse(s.since) - 5 * 60_000).toISOString() : null;
    const r = await api.changes(since);
    return { state: { ...s, since: r.now }, apply: toApply(s, r.marks), pushed, offline: false };
  } catch {
    return { state: s, apply: [], pushed, offline: true };
  }
}
