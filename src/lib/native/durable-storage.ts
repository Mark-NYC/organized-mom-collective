/**
 * iPhone app only: a durable copy of what the website keeps in localStorage (docs/ios/OMC_APP_ROADMAP.md → 2.2).
 *
 * iOS can clear a web view's localStorage under storage pressure. Every write of an `omc:` key is mirrored to
 * native storage (Capacitor Preferences → UserDefaults), and on launch any mirrored key missing from
 * localStorage is put back. localStorage stays the synchronous read path, so storage.ts, account.ts and every
 * tool keep working unchanged.
 *
 * Never mirrored: the sign-in session and account sync state (`omc:account:*`; UserDefaults isn't encrypted,
 * so a cleared session means signing in again with a code, not a token on disk).
 *
 * The core is pure (a `Mirror` interface) so tests run without Capacitor.
 */

export interface Mirror {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export interface LocalStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Mirrored keys: progress, saved tools and Club device flags. Not the session. */
export function mirrored(key: string): boolean {
  return key.startsWith('omc:') && !/^omc:account(:|$)/.test(key) && key.length <= 200;
}

/** Put back every mirrored key that localStorage lost. Never overwrites what's there. Returns how many came back. */
export async function restore(store: LocalStore, mirror: Mirror): Promise<number> {
  let restored = 0;
  for (const key of await mirror.keys()) {
    if (!mirrored(key) || store.getItem(key) !== null) continue;
    const value = await mirror.get(key);
    if (value === null) continue;
    try {
      store.setItem(key, value);
      restored++;
    } catch {
      break; // storage blocked or full: keep the mirror, try again next launch
    }
  }
  return restored;
}

/** Copy existing keys into the mirror once (first launch after an update, or first launch at all). */
export async function seed(store: Pick<Storage, 'length' | 'key' | 'getItem'>, mirror: Mirror): Promise<number> {
  const have = new Set(await mirror.keys());
  let n = 0;
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !mirrored(key) || have.has(key)) continue;
    const value = store.getItem(key);
    if (value !== null) {
      await mirror.set(key, value);
      n++;
    }
  }
  return n;
}

/**
 * Wrap the store's setItem/removeItem so writes reach the mirror too. Mirror failures never break a write.
 * Returns an undo function (tests).
 */
export function mirrorWrites(store: LocalStore, mirror: Mirror): () => void {
  const set = store.setItem.bind(store);
  const remove = store.removeItem.bind(store);
  store.setItem = (key: string, value: string) => {
    set(key, value);
    if (mirrored(key)) void mirror.set(key, String(value)).catch(() => {});
  };
  store.removeItem = (key: string) => {
    remove(key);
    if (mirrored(key)) void mirror.remove(key).catch(() => {});
  };
  return () => {
    store.setItem = set;
    store.removeItem = remove;
  };
}
