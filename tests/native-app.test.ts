import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyLink, inShell } from '../src/lib/native/links';
import { mirrored, mirrorWrites, restore, seed, type Mirror } from '../src/lib/native/durable-storage';
import { APP_FEATURES, visibleFeatures } from '../src/data/app/features';

const HERE = 'capacitor://localhost/app';

describe('app bundle allowlist (src/data/app/shell-routes.json)', () => {
  it('bundles the member experience', () => {
    for (const p of ['/app', '/app/', '/app/cleaning', '/app/family-calendar', '/club/invite', '/app/week', '/app/settings', '/app/account', '/app/calendar', '/app/calendar/week', '/app/club', '/app/club/january', '/app/club/march/spring-prep', '/club/login', '/club/welcome', '/club/welcome-kit', '/club/family', '/club/resources/2027-01-fresh-start-together', '/club/tools/routine-chart'])
      expect(inShell(p), p).toBe(true);
  });
  it('never bundles shopping, billing, admin or public pages', () => {
    for (const p of ['/', '/calendar', '/shop', '/checkout', '/checkout/complete', '/club', '/club/dashboard', '/club/join', '/club/may-preview', '/club-2', '/admin', '/admin/club', '/app/reorder', '/app/calendar/reorder', '/download', '/resources', '/support', '/weekly-reset', '/chore-chart'])
      expect(inShell(p), p).toBe(false);
  });
});

describe('classifyLink', () => {
  it('lets in-app pages, hashes and mail links behave normally', () => {
    expect(classifyLink('/app/cleaning', HERE)).toEqual({ kind: 'default' });
    expect(classifyLink('/club/family?step=2', HERE)).toEqual({ kind: 'default' });
    expect(classifyLink('#monthly-focus', HERE)).toEqual({ kind: 'default' });
    expect(classifyLink('mailto:hello@example.com', HERE)).toEqual({ kind: 'default' });
    expect(classifyLink('', HERE)).toEqual({ kind: 'default' });
  });
  it('opens our other pages on the website, keeping query and hash', () => {
    expect(classifyLink('/shop', HERE)).toEqual({ kind: 'website', url: 'https://www.organizedmomcollective.com/shop' });
    // Billing isn't linked from the app (no in-app purchase or payment redirect): the Club's account page is Account.
    expect(classifyLink('/club/dashboard', HERE)).toEqual({ kind: 'in-app', href: '/app/account' });
    expect(classifyLink('/calendar#buy', HERE)).toEqual({ kind: 'website', url: 'https://www.organizedmomcollective.com/calendar#buy' });
    expect(classifyLink('/support/', HERE)).toEqual({ kind: 'website', url: 'https://www.organizedmomcollective.com/support' });
  });
  it('keeps a full website link to a bundled page inside the app', () => {
    expect(classifyLink('https://www.organizedmomcollective.com/app/club/may?view=meeting', HERE)).toEqual({ kind: 'in-app', href: '/app/club/may?view=meeting' });
    expect(classifyLink('https://organizedmomcollective.com/club/login', HERE)).toEqual({ kind: 'in-app', href: '/club/login' });
  });
  it('sends a member back to Club Home, never to the Club sales page', () => {
    expect(classifyLink('/club', HERE)).toEqual({ kind: 'in-app', href: '/app/club' });
    expect(classifyLink('/club/', HERE)).toEqual({ kind: 'in-app', href: '/app/club' });
    expect(classifyLink('https://www.organizedmomcollective.com/club#offer', HERE)).toEqual({ kind: 'in-app', href: '/app/club#offer' });
    expect(classifyLink('/club/dashboard', HERE)).toEqual({ kind: 'in-app', href: '/app/account' });
  });
  it('sends other sites out', () => {
    expect(classifyLink('https://www.etsy.com/listing/1', HERE)).toEqual({ kind: 'external', url: 'https://www.etsy.com/listing/1' });
  });
});

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
  };
}
function memoryMirror(initial: Record<string, string> = {}): Mirror & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k),
    keys: async () => [...data.keys()],
  };
}

describe('durable storage', () => {
  it('mirrors progress and tools, never the sign-in session', () => {
    expect(mirrored('omc:v1:daily:2026-11-14')).toBe(true);
    expect(mirrored('omc:planner:v1')).toBe(true);
    expect(mirrored('omc:account:session')).toBe(false);
    expect(mirrored('omc:account')).toBe(false);
    expect(mirrored('meta:seeded')).toBe(false);
    expect(mirrored('other')).toBe(false);
  });
  it('restores what iOS cleared, never overwrites what is there', async () => {
    const store = memoryStore({ 'omc:v1:daily:2026-11-14': '["a"]' });
    const mirror = memoryMirror({ 'omc:v1:daily:2026-11-14': '["old"]', 'omc:v1:monthly:2026-11': '["x"]', 'omc:account:session': 'token', 'meta:seeded': '1' });
    expect(await restore(store, mirror)).toBe(1);
    expect(store.getItem('omc:v1:daily:2026-11-14')).toBe('["a"]');
    expect(store.getItem('omc:v1:monthly:2026-11')).toBe('["x"]');
    expect(store.getItem('omc:account:session')).toBeNull();
  });
  it('mirrors writes and removals, and seeds existing keys once', async () => {
    const store = memoryStore({ 'omc:v1:onboarded': '1', 'omc:account:session': 's' });
    const mirror = memoryMirror();
    expect(await seed(store, mirror)).toBe(1);
    const undo = mirrorWrites(store, mirror);
    store.setItem('omc:v1:focus:2026-11-16', '["t"]');
    store.setItem('omc:account:session', 'new');
    await Promise.resolve();
    expect(mirror.data.get('omc:v1:focus:2026-11-16')).toBe('["t"]');
    expect(mirror.data.has('omc:account:session')).toBe(false);
    store.removeItem('omc:v1:onboarded');
    await Promise.resolve();
    expect(mirror.data.has('omc:v1:onboarded')).toBe(false);
    undo();
  });
  it('a failing mirror never breaks a write', async () => {
    const store = memoryStore();
    const broken: Mirror = { get: async () => null, set: () => Promise.reject(new Error('x')), remove: () => Promise.reject(new Error('x')), keys: async () => [] };
    mirrorWrites(store, broken);
    expect(() => store.setItem('omc:v1:onboarded', '1')).not.toThrow();
    expect(store.getItem('omc:v1:onboarded')).toBe('1');
  });
});

describe('durable storage on a real Storage object', () => {
  it('hooks Storage.prototype, never stores a "setItem" item, and only mirrors this store', async () => {
    // A minimal Storage with the browser's named-property behavior: assigning an unknown property stores an item.
    class FakeStorage {
      data = new Map<string, string>();
      getItem(k: string) { return this.data.get(k) ?? null; }
      setItem(k: string, v: string) { this.data.set(k, String(v)); }
      removeItem(k: string) { this.data.delete(k); }
    }
    const g = globalThis as { Storage?: unknown };
    const before = g.Storage;
    g.Storage = FakeStorage;
    try {
      const store = new FakeStorage();
      const other = new FakeStorage();
      const mirror = memoryMirror();
      const undo = mirrorWrites(store as unknown as Storage, mirror);
      store.setItem('omc:v1:onboarded', '1');
      other.setItem('omc:v1:other', 'x');
      await Promise.resolve();
      expect(mirror.data.get('omc:v1:onboarded')).toBe('1');
      expect(mirror.data.has('omc:v1:other')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(store, 'setItem')).toBe(false); // no instance override
      expect([...store.data.keys()]).toEqual(['omc:v1:onboarded']); // no stray "setItem" item
      store.removeItem('omc:v1:onboarded');
      await Promise.resolve();
      expect(mirror.data.has('omc:v1:onboarded')).toBe(false);
      undo();
    } finally {
      g.Storage = before;
    }
  });
});

describe('app features', () => {
  it('shows only live areas; the Inbox stays hidden until its milestone', () => {
    const live = visibleFeatures().map((f) => f.id);
    expect(live).toEqual(['today', 'cleaning', 'club', 'family', 'account', 'calendar']);
    // Google Calendar import and the AI Family Inbox are future milestones: registered, never shown.
    for (const id of ['inbox']) expect(APP_FEATURES.find((f) => f.id === id)?.status).toBe('planned');
  });
  it('planned areas never reuse the printed QR route /app/calendar', () => {
    for (const f of APP_FEATURES) expect(f.href.startsWith('/app/calendar')).toBe(false);
  });
});

describe('iOS project wiring', () => {
  it('the scene uses our bridge (folder-page router), not Capacitor\'s single-page one', () => {
    // Capacitor 8's template builds the window in SceneDelegate, not from the storyboard. With CAPBridgeViewController
    // every page address got the root index.html: a blank, endlessly reloading app (Simulator run 43656624368).
    const scene = readFileSync('ios/App/App/SceneDelegate.swift', 'utf8');
    expect(scene).toMatch(/rootViewController = OMCBridgeViewController\(\)/);
    expect(scene).not.toMatch(/rootViewController = CAPBridgeViewController\(\)/);
  });
  it('the app opens on Today', () => {
    expect(readFileSync('capacitor.config.ts', 'utf8')).toMatch(/appStartPath: 'app'/);
  });
});

describe('no "Add to Home Screen" inside the iPhone app', () => {
  it('the app counts as already installed', async () => {
    const g = globalThis as { Capacitor?: unknown; window?: unknown };
    const before = g.Capacitor;
    g.Capacitor = { isNativePlatform: () => true };
    try {
      const { isStandalone } = await import('../src/lib/install');
      expect(isStandalone()).toBe(true);
    } finally {
      g.Capacitor = before;
    }
  });
});
