/** The calendar-feeds Edge Function (supabase/functions/_shared/handlers/calendar-feeds.ts) with a fake database and network. */
import { describe, expect, it, vi } from 'vitest';
import { createCalendarFeedsHandler, privateHost, syncFeed } from '../supabase/functions/_shared/handlers/calendar-feeds';

const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a@school\r\nSUMMARY:Picture day\r\nDTSTART;VALUE=DATE:20261120\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
const NOW = Date.UTC(2026, 10, 18);
const feed = { id: '11111111-1111-1111-1111-111111111111', url: 'https://school.example.org/cal.ics', etag: '"v1"', last_modified: null, timezone: 'America/New_York' };

function deps(responses: Array<() => Response>, claimed = [feed]) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const fetchFn = vi.fn(async () => (responses.shift() ?? (() => new Response('', { status: 500 })))());
  return {
    calls, fetchFn,
    d: {
      db: { rpc: async <T,>(name: string, args: Record<string, unknown> = {}) => { calls.push({ name, args }); return (name === 'calendar_feed_claim' ? claimed : 1) as T; } },
      getUser: async (t: string) => (t === 'good' ? { id: 'user-1' } : null),
      fetch: fetchFn as unknown as typeof fetch, now: () => NOW, cronSecret: 'cron-secret',
    },
  };
}
const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://x/functions/v1/calendar-feeds', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('calendar-feeds function', () => {
  it('Refresh now: only for the signed-in owner, stores the events', async () => {
    const t = deps([() => new Response(ICS, { status: 200, headers: { etag: '"v2"' } })]);
    const h = createCalendarFeedsHandler(t.d);
    expect((await h(post({ feed_id: feed.id }))).status).toBe(401);
    expect((await h(post({ feed_id: feed.id }, { Authorization: 'Bearer bad' }))).status).toBe(401);
    const res = await h(post({ feed_id: feed.id }, { Authorization: 'Bearer good' }));
    expect(res.status).toBe(200);
    expect(t.calls[0]).toEqual({ name: 'calendar_feed_claim', args: { p_limit: 1, p_feed: feed.id, p_owner: 'user-1' } });
    const store = t.calls.find((c) => c.name === 'calendar_feed_store')!;
    expect(store.args.p).toMatchObject({ result: 'ok', etag: '"v2"' });
    expect((store.args.p as { events: unknown[] }).events).toHaveLength(1);
    // It asked conditionally, with what it had last time.
    expect((t.fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ 'If-None-Match': '"v1"' });
  });

  it('a feed that isn’t yours is not found', async () => {
    const t = deps([], []);
    expect((await createCalendarFeedsHandler(t.d)(post({ feed_id: feed.id }, { Authorization: 'Bearer good' }))).status).toBe(404);
  });

  it('the scheduled refresh needs its secret and refreshes every due feed', async () => {
    const t = deps([() => new Response(ICS), () => new Response(null, { status: 304 })], [feed, { ...feed, id: '22222222-2222-2222-2222-222222222222' }]);
    const h = createCalendarFeedsHandler(t.d);
    expect((await h(post({ mode: 'due' }, { 'x-calendar-cron': 'wrong' }))).status).toBe(401);
    const res = await h(post({ mode: 'due' }, { 'x-calendar-cron': 'cron-secret' }));
    expect(await res.json()).toEqual({ refreshed: 2 });
    expect(t.calls.filter((c) => c.name === 'calendar_feed_store').map((c) => (c.args.p as { result: string }).result).sort()).toEqual(['not_modified', 'ok']);
  });

  it('what each answer means', async () => {
    const run = async (r: () => Response) => syncFeed(feed, deps([r]).d);
    expect((await run(() => new Response(null, { status: 304 }))).result).toBe('not_modified');
    expect(await run(() => new Response('', { status: 404 }))).toMatchObject({ result: 'gone' });
    expect(await run(() => new Response('', { status: 403 }))).toMatchObject({ result: 'gone' });
    expect(await run(() => new Response('', { status: 503 }))).toMatchObject({ result: 'error' });
    expect((await run(() => new Response('<html>Please sign in</html>'))).error).toMatch(/didn’t return a calendar/);
  });

  it('never reads private addresses, even through a redirect', async () => {
    for (const h of ['localhost', '127.0.0.1', '10.0.0.5', '169.254.169.254', '192.168.1.2', '172.20.0.1', '[::1]', 'metadata.google.internal']) expect(privateHost(h.replace(/^\[|\]$/g, ''))).toBe(true);
    expect(privateHost('calendar.google.com')).toBe(false);
    const direct = deps([]);
    expect(await syncFeed({ ...feed, url: 'http://169.254.169.254/latest/meta-data' }, direct.d)).toMatchObject({ result: 'gone' });
    expect(direct.fetchFn).not.toHaveBeenCalled();
    const redirected = deps([() => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:8080/secret' } })]);
    expect(await syncFeed(feed, redirected.d)).toMatchObject({ result: 'gone' });
    expect(redirected.fetchFn).toHaveBeenCalledTimes(1);
  });
});
