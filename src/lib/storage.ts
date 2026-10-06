/**
 * Small localStorage layer. All keys live under one prefix so we can
 * reset or migrate cleanly later.
 *
 *   omc:v1:onboarded              "1" once onboarding is finished
 *   omc:v1:daily:YYYY-MM-DD       checked daily essentials for that day
 *   omc:v1:focus:YYYY-MM-DD       checked Mon–Thu focus tasks for that day
 *   omc:v1:weekend:YYYY-MM-DD     weekend-only choices, keyed by that weekend's Friday
 *   omc:v1:monthly:YYYY-MM        checked monthly deep-clean tasks for that month
 */

export const PREFIX = 'omc:v1:';
const ONBOARDED = `${PREFIX}onboarded`;

export const keys = {
  daily: (date: string) => `${PREFIX}daily:${date}`,
  focus: (date: string) => `${PREFIX}focus:${date}`,
  weekend: (friday: string) => `${PREFIX}weekend:${friday}`,
  monthly: (month: string) => `${PREFIX}monthly:${month}`,
};

/** Day-scoped entries older than this are pruned so storage doesn't grow forever. */
const KEEP_DAYS = 60;

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // private mode / blocked storage
  }
}

export function readList(key: string): string[] {
  try {
    const raw = store()?.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function writeList(key: string, ids: string[]): void {
  try {
    const s = store();
    if (!s) return;
    if (ids.length === 0) s.removeItem(key);
    else s.setItem(key, JSON.stringify(ids));
  } catch {
    /* storage full or blocked — progress just won't persist */
  }
}

export function isOnboarded(): boolean {
  try {
    return store()?.getItem(ONBOARDED) === '1';
  } catch {
    return false;
  }
}

export function setOnboarded(done: boolean): void {
  try {
    if (done) store()?.setItem(ONBOARDED, '1');
    else store()?.removeItem(ONBOARDED);
  } catch {
    /* ignore */
  }
}

function progressKeys(): string[] {
  const s = store();
  if (!s) return [];
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith(PREFIX) && k !== ONBOARDED) out.push(k);
  }
  return out;
}

export function resetDay(date: string, weekendFriday?: string): void {
  writeList(keys.daily(date), []);
  writeList(keys.focus(date), []);
  if (weekendFriday) writeList(keys.weekend(weekendFriday), []);
}

/** Clears every checkbox everywhere. Keeps the onboarding flag. */
export function resetAllProgress(): void {
  const s = store();
  if (!s) return;
  for (const k of progressKeys()) s.removeItem(k);
}

/** Removes old day-scoped entries. Monthly entries are kept. */
export function pruneOld(today: Date): void {
  const s = store();
  if (!s) return;
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - KEEP_DAYS);
  const pattern = /^omc:v1:(daily|focus|weekend):(\d{4})-(\d{2})-(\d{2})$/;
  for (const k of progressKeys()) {
    const m = pattern.exec(k);
    if (!m) continue;
    const d = new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4]));
    if (d < cutoff) s.removeItem(k);
  }
}
