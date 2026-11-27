import { beforeEach, expect, it, vi } from 'vitest';
import { feedsApi, loadExternalEvents } from '../src/lib/calendar/feeds';

const auth = vi.hoisted(() => ({ adult: 'first' as string | null }));
vi.mock('../src/lib/account', () => ({
  loadSession: () => auth.adult && { user_id: auth.adult },
  getSession: async () => auth.adult && { user_id: auth.adult },
  SESSION_STORAGE_KEY: 'session',
  accountRpc: vi.fn(), accountFunction: vi.fn(),
}));
const cache = new Map<string, string>();
beforeEach(() => {
  vi.restoreAllMocks();
  auth.adult = 'first';
  cache.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => cache.get(key) ?? null,
    setItem: (key: string, value: string) => cache.set(key, value),
    removeItem: (key: string) => cache.delete(key),
  });
});
const feed = { id: 'calendar', name: 'Work', mine: true, kind: 'ical', visibility: 'private', member_id: null, url_host: null, status: 'ok', last_error: null, event_count: 1, last_success_at: null } as const;
const event = { feed_id: feed.id, uid: 'event', instance_key: '', title: 'Client meeting', location: null, all_day: true, starts_at: null, ends_at: null, start_date: '2026-11-26', end_date: null, status: 'confirmed' } as const;

it('serves the private offline copy only to the adult who downloaded it', async () => {
  const list = vi.spyOn(feedsApi, 'list').mockResolvedValue([feed]);
  vi.spyOn(feedsApi, 'events').mockResolvedValue([event]);
  expect(await loadExternalEvents('family', 'mine')).toHaveLength(1);
  list.mockRejectedValue(new Error('offline'));
  expect(await loadExternalEvents('family', 'mine')).toHaveLength(1);
  expect(await loadExternalEvents('different-family', 'mine')).toEqual([]);
  const cached = vi.fn();
  for (const other of ['second', null]) {
    auth.adult = other;
    expect(await loadExternalEvents('family', 'mine', cached)).toEqual([]);
  }
  expect(cached).not.toHaveBeenCalled();
});

it('discards a private response if the signed-in adult changed during the request', async () => {
  vi.spyOn(feedsApi, 'list').mockResolvedValue([feed]);
  vi.spyOn(feedsApi, 'events').mockImplementation(async () => {
    auth.adult = 'second';
    return [event];
  });
  expect(await loadExternalEvents('family', 'mine')).toEqual([]);
  expect(cache.size).toBe(0);
});

it('keeps private source metadata out of the shared meeting cache', async () => {
  vi.spyOn(feedsApi, 'list').mockResolvedValue([feed]);
  const events = vi.spyOn(feedsApi, 'events');
  expect(await loadExternalEvents('family', 'household')).toEqual([]);
  expect(events).not.toHaveBeenCalled();
  expect([...cache.values()].join('')).not.toContain('Work');
});
