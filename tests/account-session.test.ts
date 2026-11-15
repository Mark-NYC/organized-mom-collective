import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession, loadSession, signOut, signOutEverywhere, type AccountSession } from '../src/lib/account';

/** Sign-ins are code-only, so a session lost by mistake costs her an email round trip (src/lib/account.ts). */
const KEY = 'omc:account:session';
const store = new Map<string, string>();
const session = (o: Partial<AccountSession> = {}): AccountSession => ({
  access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() + 60_000, email: 'mom@example.com', user_id: 'u1', ...o,
});
const put = (s: AccountSession) => store.set(KEY, JSON.stringify(s));
const fresh = { access_token: 'a2', refresh_token: 'r2', expires_in: 3600, user: { id: 'u1', email: 'mom@example.com' } };
const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('account session', () => {
  it('uses the saved session without a request while it has more than five minutes left', async () => {
    put(session({ expires_at: Date.now() + 30 * 60_000 }));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await getSession())?.access_token).toBe('a1');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('several calls at once make one refresh (a refresh token works once)', async () => {
    put(session());
    const fetch = vi.fn(async () => reply(200, fresh));
    vi.stubGlobal('fetch', fetch);
    const all = await Promise.all([getSession(), getSession(), getSession()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(all.map((s) => s?.access_token)).toEqual(['a2', 'a2', 'a2']);
    expect(loadSession()?.refresh_token).toBe('r2');
  });

  it('a rate limit or server trouble never signs her out', async () => {
    for (const status of [429, 500, 503]) {
      put(session());
      vi.stubGlobal('fetch', vi.fn(async () => reply(status)));
      expect((await getSession())?.access_token, String(status)).toBe('a1'); // still valid for a minute
      expect(loadSession()?.refresh_token, String(status)).toBe('r1');
    }
    // Even with the access token already expired, the sign-in is kept for the next try.
    put(session({ expires_at: Date.now() - 1000 }));
    vi.stubGlobal('fetch', vi.fn(async () => reply(503)));
    expect(await getSession()).toBeNull();
    expect(loadSession()?.refresh_token).toBe('r1');
  });

  it('no signal keeps the sign-in', async () => {
    put(session());
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect((await getSession())?.access_token).toBe('a1');
    expect(loadSession()).not.toBeNull();
  });

  it('a revoked sign-in signs her out', async () => {
    put(session());
    vi.stubGlobal('fetch', vi.fn(async () => reply(400, { error_code: 'refresh_token_not_found' })));
    expect(await getSession()).toBeNull();
    expect(loadSession()).toBeNull();
  });

  it('a token another tab already used: that tab\'s newer session is used, not a sign-out', async () => {
    put(session());
    vi.stubGlobal('fetch', vi.fn(async () => {
      put(session({ access_token: 'a9', refresh_token: 'r9', expires_at: Date.now() + 3_600_000 })); // the other tab finished first
      return reply(400, { error_code: 'refresh_token_already_used' });
    }));
    expect((await getSession())?.access_token).toBe('a9');
    expect(loadSession()?.refresh_token).toBe('r9');
  });

  it('signing out is for this device only', async () => {
    put(session());
    const fetch = vi.fn(async (_url: string) => reply(204, null));
    vi.stubGlobal('fetch', fetch);
    await signOut();
    expect(String(fetch.mock.calls[0][0])).toContain('/auth/v1/logout?scope=local');
    expect(loadSession()).toBeNull();
  });

  it('sign out everywhere ends every device, and only counts when it reached the server', async () => {
    put(session());
    const fetch = vi.fn(async (_url: string) => reply(200, {}));
    vi.stubGlobal('fetch', fetch);
    await signOutEverywhere();
    expect(String(fetch.mock.calls[0][0])).toContain('/auth/v1/logout?scope=global');
    expect(loadSession()).toBeNull();

    put(session());
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(signOutEverywhere()).rejects.toThrow('sign_out_everywhere_failed');
    expect(loadSession()?.refresh_token).toBe('r1'); // still signed in here, so she can try again
  });
});
