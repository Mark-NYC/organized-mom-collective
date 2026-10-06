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
 *   omc:v1:weekend:YYYY-MM-DD     weekend-only choices, keyed by that weekend's Friday
 *   omc:v1:monthly:YYYY-MM        checked monthly deep-clean tasks for that month
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
  weekend: (friday: string) => `${PREFIX}weekend:${friday}`,
  monthly: (month: string) => `${PREFIX}monthly:${month}`,
};

/** Day-scoped entries older than this are pruned so storage doesn't grow forever. */
const KEEP_DAYS = 60;

/**
 * The storage backend. Today: the browser's localStorage. A future synced
 * backend only needs to provide these four operations.
 */
interface Backend {
  get(key: string): string | null;
  set(key: string, value: string): void;
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
        s()?.setItem(k, v);
      } catch {
        /* storage full or blocked — progress just won't persist */
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

const backend: Backend = webStorage(() => window.localStorage);
const session: Backend = webStorage(() => window.sessionStorage);

export function readList(key: string): string[] {
  try {
    const raw = backend.get(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function writeList(key: string, ids: string[]): void {
  if (ids.length === 0) backend.remove(key);
  else backend.set(key, JSON.stringify(ids));
}

export function isOnboarded(): boolean {
  return backend.get(ONBOARDED_KEY) === '1';
}

export function setOnboarded(done: boolean): void {
  if (done) backend.set(ONBOARDED_KEY, '1');
  else backend.remove(ONBOARDED_KEY);
}

function progressKeys(): string[] {
  return backend.keys().filter((k) => k.startsWith(PREFIX) && k !== ONBOARDED_KEY);
}

export function resetDay(date: string, weekendFriday?: string): void {
  writeList(keys.daily(date), []);
  writeList(keys.focus(date), []);
  if (weekendFriday) writeList(keys.weekend(weekendFriday), []);
}

/** Clears every checkbox everywhere. Keeps the onboarding flag. */
export function resetAllProgress(): void {
  for (const k of progressKeys()) backend.remove(k);
}

/** Removes old day-scoped entries. Monthly entries are kept. */
export function pruneOld(today: Date): void {
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - KEEP_DAYS);
  const pattern = /^omc:v1:(daily|focus|weekend):(\d{4})-(\d{2})-(\d{2})$/;
  for (const k of progressKeys()) {
    const m = pattern.exec(k);
    if (!m) continue;
    const d = new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4]));
    if (d < cutoff) backend.remove(k);
  }
}

/** Remembers how this visit arrived (e.g. "calendar" from the printed QR) for later analytics. */
export function setEntrySource(source: string): void {
  session.set(ENTRY_SOURCE_KEY, source);
}

/** How this browser session arrived, or null if unknown. */
export function getEntrySource(): string | null {
  return session.get(ENTRY_SOURCE_KEY);
}
