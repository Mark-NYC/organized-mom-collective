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
 * Mirror the store's writes and removals. Mirror failures never break a write. Returns an undo function (tests).
 *
 * A real Storage (localStorage) is hooked on Storage.prototype, filtered to this store, the same way the account sync
 * does it (src/lib/account.ts installStorageHook; the two chain). Never by assigning `localStorage.setItem = …`: on a
 * Storage object that creates a stored item named "setItem", and whether it overrides the method differs by engine
 * (on iOS it didn't: nothing reached the mirror; Simulator run 43659865365).
 */
export function mirrorWrites(store: LocalStore, mirror: Mirror): () => void {
  const StorageCtor = (globalThis as { Storage?: { prototype: Storage } }).Storage;
  const onSet = (key: string, value: string) => { if (mirrored(key)) void mirror.set(key, String(value)).catch(() => {}); };
  const onRemove = (key: string) => { if (mirrored(key)) void mirror.remove(key).catch(() => {}); };
  if (StorageCtor && store instanceof (StorageCtor as unknown as new () => Storage)) {
    const proto = StorageCtor.prototype;
    const set = proto.setItem;
    const remove = proto.removeItem;
    proto.setItem = function (this: Storage, key: string, value: string) {
      set.call(this, key, value);
      if (this === store) onSet(key, value);
    };
    proto.removeItem = function (this: Storage, key: string) {
      remove.call(this, key);
      if (this === store) onRemove(key);
    };
    return () => {
      proto.setItem = set;
      proto.removeItem = remove;
    };
  }
  // A plain object store (tests): wrap its own methods.
  const set = store.setItem.bind(store);
  const remove = store.removeItem.bind(store);
  store.setItem = (key: string, value: string) => { set(key, value); onSet(key, value); };
  store.removeItem = (key: string) => { remove(key); onRemove(key); };
  return () => {
    store.setItem = set;
    store.removeItem = remove;
  };
}
