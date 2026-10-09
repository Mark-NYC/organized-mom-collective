/**
 * Persistence for the app. The UI only talks to this module (directly or via
 * hooks.ts) — never to localStorage — so the backend can change later
 * (e.g. syncing to a signed-in account) without touching components.
 *
 * Data is anonymous and keyed by stable task ids and dates, so it can be
 * uploaded into an account later instead of discarded. Keys:
 *
 *   omc:v1:onboarded              "1" once onboarding is finished
 *   omc:v1:daily:YYYY-MM-DD       checked daily essentials for that day
 *   omc:v1:focus:YYYY-MM-DD       checked Mon–Thu focus tasks for that day
 *   omc:v1:weekend:YYYY-MM-DD     "Catch up instead" on that Fri/Sat/Sun. Before Oct 2026 this was
 *                                 keyed by the weekend's Friday; those entries now show on Friday only.
 *   omc:v1:monthly:YYYY-MM        checked monthly home project tasks for that month (shared all month)
 *   omc:v1:active:YYYY-MM-DD      monthly project ticks made on that date, e.g. ["monthly:2026-10:oct-shoes"],
 *                                 so the project counts as activity on the day it was done, and only that day.
 *                                 Legacy value "1" (any checkmark that day, never cleared) still counts.
 *
 * A day is "active" (its week dot, its Week row) if anything is checked under that day's own
 * keys: daily, focus, weekend, or a monthly tick credited to it. Unchecking undoes it.
 *   omc:v1:install-invite         "dismissed" once the Add to Home Screen invitation is closed
 *
 * Per-session (sessionStorage), not progress:
 *   omc:v1:entry-source           how this visit arrived, e.g. "calendar" (the printed QR)
 */

export const PREFIX = 'omc:v1:';
export const ONBOARDED_KEY = `${PREFIX}onboarded`;
const ENTRY_SOURCE_KEY = `${PREFIX}entry-source`;

export const keys = {
  daily: (date: string) => `${PREFIX}daily:${date}`,
  focus: (date: string) => `${PREFIX}focus:${date}`,
  weekend: (date: string) => `${PREFIX}weekend:${date}`,
  monthly: (month: string) => `${PREFIX}monthly:${month}`,
  active: (date: string) => `${PREFIX}active:${date}`,
};

/**
 * Day-scoped entries older than this are pruned so storage doesn't grow forever.
 * About a year — the life of a 52-week calendar. A full year is roughly 1,100
 * small keys (~90 KB), far below the ~5 MB browsers allow.
 * Monthly project entries are never pruned (12 tiny keys a year).
 */
export const KEEP_DAYS = 366;

/**
 * The storage backend. Today: the browser's localStorage. A future synced
 * backend only needs to provide these four operations.
 */
interface Backend {
  get(key: string): string | null;
  /** False if the value couldn't be saved (storage blocked or full). */
  set(key: string, value: string): boolean;
  remove(key: string): void;
  keys(): string[];
}

function webStorage(pick: () => Storage): Backend {
  const s = (): Storage | null => {
    try {
      return typeof window !== 'undefined' ? pick() : null;
    } catch {
      return null; // private mode / blocked storage
    }
  };
  return {
    get: (k) => {
      try {
        return s()?.getItem(k) ?? null;
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        const store = s();
        if (!store) return false;
        store.setItem(k, v);
        return true;
      } catch {
        return false; // storage full or blocked
      }
    },
    remove: (k) => {
      try {
        s()?.removeItem(k);
      } catch {
        /* ignore */
      }
    },
    keys: () => {
      const store = s();
      if (!store) return [];
      const out: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k) out.push(k);
      }
      return out;
    },
  };
}

const session: Backend = webStorage(() => window.sessionStorage);

/*
 * When the browser won't save (private mode, storage full, blocked), checkmarks
 * are kept in memory so the app still works for this visit, and the UI is told
 * so it can say progress won't be remembered. Never a crash, never a false "saved".
 */
let saving = true;
const listeners = new Set<() => void>();
const memory = new Map<string, string | null>(); // null = removed in memory

function markUnsaved(): void {
  if (!saving) return;
  saving = false;
  for (const l of listeners) l();
}

function withMemoryFallback(real: Backend): Backend {
  return {
    get: (k) => (memory.has(k) ? memory.get(k)! : real.get(k)),
    set: (k, v) => {
      if (real.set(k, v)) {
        memory.delete(k);
        return true;
      }
      memory.set(k, v);
      markUnsaved();
      return false;
    },
    remove: (k) => {
      real.remove(k);
      // If the removal didn't stick, hide the stale value for this visit.
      if (real.get(k) !== null) memory.set(k, null);
      else memory.delete(k);
    },
    keys: () => {
      const out = new Set(real.keys());
      for (const [k, v] of memory) {
        if (v === null) out.delete(k);
        else out.add(k);
      }
      return [...out];
    },
  };
}

const backend: Backend = withMemoryFallback(webStorage(() => window.localStorage));

const PROBE_KEY = `${PREFIX}probe`;
let probed = false;

/**
 * True while progress is being saved to this device. Checks once with a tiny
 * test write, so a blocked browser is noticed before the first checkmark.
 */
export function isSaving(): boolean {
  if (saving && !probed) {
    probed = true;
    if (backend.set(PROBE_KEY, '1')) backend.remove(PROBE_KEY);
  }
  return saving;
}

/** Subscribe to save-status changes (for useSyncExternalStore). */
export function onSavingChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readList(key: string): string[] {
  try {
    const raw = backend.get(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Returns false if the change couldn't be saved to the device (it's still kept for this visit). */
export function writeList(key: string, ids: string[]): boolean {
  if (ids.length === 0) {
    backend.remove(key);
    return true;
  }
  return backend.set(key, JSON.stringify(ids));
}

export function isOnboarded(): boolean {
  return backend.get(ONBOARDED_KEY) === '1';
}

export function setOnboarded(done: boolean): void {
  if (done) backend.set(ONBOARDED_KEY, '1');
  else backend.remove(ONBOARDED_KEY);
}

function progressKeys(): string[] {
  return backend
    .keys()
    .filter((k) => k.startsWith(PREFIX) && k !== ONBOARDED_KEY && k !== PROBE_KEY && k !== `${PREFIX}install-invite`);
}

/** Clears that day's own checklist (Daily Reset, zone, catch-up) and its activity. Monthly project ticks stay. */
export function resetDay(date: string): void {
  writeList(keys.daily(date), []);
  writeList(keys.focus(date), []);
  writeList(keys.weekend(date), []);
  backend.remove(keys.active(date));
}

/** Clears every checkbox everywhere. Keeps the onboarding flag. */
export function resetAllProgress(): void {
  for (const k of progressKeys()) backend.remove(k);
}

/** Removes old day-scoped entries. Monthly entries are kept. */
export function pruneOld(today: Date): void {
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - KEEP_DAYS);
  const pattern = /^omc:v1:(daily|focus|weekend|active):(\d{4})-(\d{2})-(\d{2})$/;
  for (const k of progressKeys()) {
    const m = pattern.exec(k);
    if (!m) continue;
    const d = new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4]));
    if (d < cutoff) backend.remove(k);
  }
}

/** Monthly project ticks credited to this date. The legacy "1" flag reads as one entry. */
function activityRefs(date: string): string[] {
  return backend.get(keys.active(date)) === '1' ? ['legacy'] : readList(keys.active(date));
}

const monthlyRef = (month: string, id: string) => `monthly:${month}:${id}`;

/** A monthly project task was checked: count it as activity on `date`, the day it was actually done. */
export function creditMonthly(date: string, month: string, id: string): void {
  const refs = activityRefs(date);
  const ref = monthlyRef(month, id);
  if (!refs.includes(ref)) writeList(keys.active(date), [...refs, ref]);
}

/** A monthly project task was unchecked: take the credit back from whichever day it was given to. */
export function uncreditMonthly(month: string, id: string): void {
  const ref = monthlyRef(month, id);
  for (const k of progressKeys()) {
    if (!k.startsWith(`${PREFIX}active:`)) continue;
    const date = k.slice(`${PREFIX}active:`.length);
    const refs = activityRefs(date);
    if (refs.includes(ref)) writeList(k, refs.filter((r) => r !== ref));
  }
}

/**
 * Did she check anything off on this date? Only that day's own lists and the monthly
 * ticks made that day count, so one day's work never lights another day.
 */
export function wasActive(date: string): boolean {
  return (
    activityRefs(date).length > 0 ||
    readList(keys.daily(date)).length > 0 ||
    readList(keys.focus(date)).length > 0 ||
    readList(keys.weekend(date)).length > 0
  );
}

/** Small named settings, e.g. whether the install invitation was dismissed. */
export function readFlag(name: string): string | null {
  return backend.get(`${PREFIX}${name}`);
}

export function writeFlag(name: string, value: string): void {
  backend.set(`${PREFIX}${name}`, value);
}

/** True if anything at all has been saved here (onboarding, checkmarks, settings). */
export function hasAnyProgress(): boolean {
  return backend.keys().some((k) => k.startsWith(PREFIX) && k !== PROBE_KEY);
}

/** Everything this app has saved, for moving into the iPhone Home Screen app. */
export function exportProgress(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of backend.keys()) {
    if (!k.startsWith(PREFIX) || k === PROBE_KEY) continue;
    const v = backend.get(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

/** Adds saved entries that don't exist here yet. Never overwrites. Returns how many were added. */
export function importMissing(data: Record<string, unknown>): number {
  let added = 0;
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(PREFIX) || k === PROBE_KEY || typeof v !== 'string' || backend.get(k) !== null) continue;
    if (backend.set(k, v)) added++;
  }
  return added;
}

/** Remembers how this visit arrived (e.g. "calendar" from the printed QR) for later analytics. */
export function setEntrySource(source: string): void {
  session.set(ENTRY_SOURCE_KEY, source);
}

/** How this browser session arrived, or null if unknown. */
export function getEntrySource(): string | null {
  return session.get(ENTRY_SOURCE_KEY);
}
