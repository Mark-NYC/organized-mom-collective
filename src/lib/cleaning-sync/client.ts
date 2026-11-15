/**
 * Shared cleaning progress in the browser / app (./store.ts has the rules). Started once per page by AppLayout for a
 * signed-in grown-up with a household; otherwise the companion stays exactly as it was: on this device only.
 *
 * Near real time: a tap is sent at once; the other phone picks it up when it comes to the front, when the connection
 * returns, and every 15 seconds while a cleaning screen is open.
 */
import { accountRpc, accountsEnabled, getSession } from '../account';
import { householdAccess } from '../household/api';
import { APP_RESUME_EVENT } from '../native/platform';
import { allLists, applyShared, onListChange } from '../storage';
import { adoptCleaning, emptyCleaningSync, keyOf, marksFor, queue, syncCleaning, type CleaningApi, type CleaningSyncState, type Mark } from './store';

const KEY = 'omc:household:cleaning-sync:v1';
export const CLEANING_SYNC_EVENT = 'omc:cleaning:synced';
export type CleaningSyncStatus = 'local' | 'shared' | 'waiting';

const load = (): CleaningSyncState => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as CleaningSyncState | null;
    if (s && typeof s.scope === 'string' && Array.isArray(s.outbox)) return s;
  } catch { /* fall through */ }
  return emptyCleaningSync();
};
const save = (s: CleaningSyncState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this visit only */ } };

const api: CleaningApi = {
  push: (marks) => accountRpc('cleaning_marks_push', { p_marks: marks }),
  changes: (since) => accountRpc<{ now: string; marks: Mark[] }>('cleaning_marks_changes', { p_since: since }),
};

let state: CleaningSyncState = emptyCleaningSync();
let busy = false;
let again = false;
let status: CleaningSyncStatus = 'local';
const announce = (changedKeys: string[] = []) => {
  window.dispatchEvent(new CustomEvent(CLEANING_SYNC_EVENT, { detail: { status, waiting: state.outbox.length } }));
  // The checklists already re-read their list on a storage event (another tab changed it): the same signal fits.
  for (const key of changedKeys) window.dispatchEvent(new StorageEvent('storage', { key }));
};
export const cleaningSyncStatus = () => ({ status, waiting: state.outbox.length });

async function run() {
  if (state.scope === 'none') return;
  if (busy) { again = true; return; }
  busy = true;
  try {
    do {
      again = false;
      const sent = state.outbox;
      const r = await syncCleaning(state, api);
      // Taps made while the request was out stay queued, newest last.
      const during = state.outbox.filter((o) => !sent.includes(o));
      state = queue(r.state, during);
      save(state);
      const changed = new Set<string>();
      for (const m of r.apply) {
        if (state.outbox.some((o) => o.list === m.list && o.period === m.period && o.item === m.item)) continue;
        if (applyShared(keyOf(m), m.item, m.done)) changed.add(keyOf(m));
      }
      status = r.offline || state.outbox.length ? 'waiting' : 'shared';
      announce([...changed]);
    } while (again);
  } finally {
    busy = false;
  }
}

let started = false;
export async function startCleaningSync() {
  if (started || typeof window === 'undefined' || !accountsEnabled()) return;
  started = true;
  state = load();
  // With no household there's nothing to queue: the device's own lists are the record, and joining a household
  // offers them all (adoptCleaning). With one, every tap is queued at once, before the first sync finishes.
  onListChange((key, added, removed) => {
    if (state.scope === 'none') return;
    state = queue(state, marksFor(key, added, removed, new Date().toISOString()));
    save(state);
    status = 'waiting';
    announce();
    void run();
  });
  const connect = async () => {
    if (!(await getSession())) return;
    const access = await householdAccess().catch(() => undefined);
    if (access === undefined) { if (state.scope !== 'none') { status = 'waiting'; announce(); } return; } // couldn't ask: keep what we have
    if (!access) { state = emptyCleaningSync(); save(state); status = 'local'; return announce(); }
    state = adoptCleaning(state, access.householdId, allLists());
    save(state);
    await run();
  };
  // Coming back, or back online: find the household if we don't have one yet, else catch up.
  const tick = () => { if (document.visibilityState === 'visible') void (state.scope === 'none' ? connect().catch(() => undefined) : run()); };
  window.addEventListener(APP_RESUME_EVENT, tick);
  window.addEventListener('online', tick);
  document.addEventListener('visibilitychange', tick);
  window.setInterval(() => { if (document.visibilityState === 'visible' && state.scope !== 'none') void run(); }, 15_000);
  await connect().catch(() => undefined);
}
