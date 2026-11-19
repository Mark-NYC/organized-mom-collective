/** The calendar-feeds Edge Function (supabase/functions/_shared/handlers/calendar-feeds.ts) with a fake database and network. */
import { describe, expect, it, vi } from 'vitest';
import { createCalendarFeedsHandler, privateHost, safeEqual, syncFeed } from '../supabase/functions/_shared/handlers/calendar-feeds';

const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a@school\r\nSUMMARY:Picture day\r\nDTSTART;VALUE=DATE:20261120\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
const NOW = Date.UTC(2026, 10, 18);
const feed = { id: '11111111-1111-1111-1111-111111111111', url: 'https://school.example.org/cal.ics', etag: '"v1"', last_modified: null, timezone: 'America/New_York', content_hash: null as string | null };

function deps(responses: Array<() => Response>, claimed: Array<Record<string, unknown>> = [feed], resolve?: (h: string) => Promise<string[]>) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const fetchFn = vi.fn(async () => (responses.shift() ?? (() => new Response('', { status: 500 })))());
  const queue = [...claimed];
  return {
    calls, fetchFn,
    d: {
      // Like calendar_feed_claim: each feed is handed out once.
      db: { rpc: async <T,>(name: string, args: Record<string, unknown> = {}) => { calls.push({ name, args }); return (name === 'calendar_feed_claim' ? queue.splice(0, Number(args.p_limit ?? 1)) : 1) as T; } },
      resolve: resolve ?? (async () => ['93.184.216.34']),
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
    expect((store.args.p as { content_hash: string }).content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.args.p).not.toHaveProperty('parse_ms');
    expect(JSON.stringify(await res.clone().json())).not.toContain('school.example.org');
    expect((store.args.p as { events: unknown[] }).events).toHaveLength(1);
    // It asked conditionally, with what it had last time.
    expect((t.fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ 'If-None-Match': '"v1"' });
  });

  it('a double tap answers from what’s stored, without fetching', async () => {
    const t = deps([], [{ id: feed.id, recent: true, event_count: 7 }]);
    const res = await createCalendarFeedsHandler(t.d)(post({ feed_id: feed.id }, { Authorization: 'Bearer good' }));
    expect(await res.json()).toMatchObject({ result: 'not_modified', count: 7 });
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it('the same bytes as last time are neither parsed nor rewritten', async () => {
    const first = await syncFeed(feed, deps([() => new Response(ICS)]).d);
    const again = await syncFeed({ ...feed, content_hash: first.content_hash! }, deps([() => new Response(ICS)]).d);
    expect(again.result).toBe('not_modified');
    expect(again.events).toBeUndefined();
    // Google stamps each download with a new DTSTAMP: still the same calendar.
    const stamped = (t: string) => ICS.replace('UID:a@school', `UID:a@school\r\nDTSTAMP:${t}`);
    const g1 = await syncFeed(feed, deps([() => new Response(stamped('20261118T193202Z'))]).d);
    expect((await syncFeed({ ...feed, content_hash: g1.content_hash! }, deps([() => new Response(stamped('20261118T193212Z'))]).d)).result).toBe('not_modified');
    expect((await syncFeed({ ...feed, content_hash: g1.content_hash! }, deps([() => new Response(stamped('20261118T193212Z').replace('Picture day', 'Picture retakes'))]).d)).result).toBe('ok');
  });

  it('a calendar cut off mid-download is an error, never stored as the whole calendar', async () => {
    expect(await syncFeed(feed, deps([() => new Response(ICS.replace('END:VCALENDAR\r\n', ''))]).d)).toMatchObject({ result: 'error' });
  });

  it('a feed that isn’t yours is not found', async () => {
    const t = deps([], []);
    expect((await createCalendarFeedsHandler(t.d)(post({ feed_id: feed.id }, { Authorization: 'Bearer good' }))).status).toBe(404);
  });

  it('the scheduled refresh needs its secret and refreshes every due feed', async () => {
    const t = deps([() => new Response(ICS), () => new Response(null, { status: 304 })], [feed, { ...feed, id: '22222222-2222-2222-2222-222222222222' }]);
    const h = createCalendarFeedsHandler(t.d);
    expect((await h(post({ mode: 'due' }, { 'x-calendar-cron': 'wrong' }))).status).toBe(401);
    expect((await h(post({ mode: 'due' }))).status).toBe(401);
    expect((await h(post({ mode: 'due' }, { 'x-calendar-cron': 'cron-secre' }))).status).toBe(401);
    const res = await h(post({ mode: 'due' }, { 'x-calendar-cron': 'cron-secret' }));
    expect(await res.json()).toEqual({ refreshed: 2 });
    expect(createCalendarFeedsHandler({ ...t.d, cronSecret: null })).toBeTruthy();
    expect((await createCalendarFeedsHandler({ ...t.d, cronSecret: null })(post({ mode: 'due' }, { 'x-calendar-cron': '' }))).status).toBe(401);
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

  it('the scheduled run stops at its budget and leaves the rest for the next run', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...feed, id: `${i}`.padStart(36, '0') }));
    const t = deps(Array.from({ length: 10 }, () => () => new Response(ICS)), many);
    const res = await createCalendarFeedsHandler({ ...t.d, budget: { feeds: 3 } })(post({ mode: 'due' }, { 'x-calendar-cron': 'cron-secret' }));
    expect(await res.json()).toEqual({ refreshed: 3 });
    expect(t.calls.filter((c) => c.name === 'calendar_feed_claim')).toHaveLength(3); // claimed one at a time: nothing claimed and dropped
  });

  it('host names that resolve to private addresses are never fetched (DNS), and unresolvable ones wait', async () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
      const t = deps([() => new Response(ICS)], [feed], async () => ['93.184.216.34', ip]);
      expect(await syncFeed(feed, t.d)).toMatchObject({ result: 'gone' });
      expect(t.fetchFn).not.toHaveBeenCalled();
    }
    const nx = deps([() => new Response(ICS)], [feed], async () => { throw new Error('NXDOMAIN'); });
    expect(await syncFeed(feed, nx.d)).toMatchObject({ result: 'error' });
    expect(nx.fetchFn).not.toHaveBeenCalled();
    // A redirect to a name that resolves privately is stopped before it's followed.
    const hop = deps([() => new Response(null, { status: 302, headers: { location: 'https://rebind.example/x.ics' } })], [feed],
      async (h) => (h === 'rebind.example' ? ['192.168.0.10'] : ['93.184.216.34']));
    expect(await syncFeed(feed, hop.d)).toMatchObject({ result: 'gone' });
    expect(hop.fetchFn).toHaveBeenCalledTimes(1);
    // Links with credentials in them are refused outright.
    expect(await syncFeed({ ...feed, url: 'https://user:pw@school.example.org/cal.ics' }, deps([]).d)).toMatchObject({ result: 'gone' });
  });

  it('the cron secret is compared without leaking its length or prefix', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', 'a')).toBe(false);
  });

  it('never reads private addresses, even through a redirect', async () => {
    for (const h of ['localhost', '127.0.0.1', '10.0.0.5', '169.254.169.254', '192.168.1.2', '172.20.0.1', '[::1]', 'metadata.google.internal', '100.64.0.1', '0.0.0.0', 'fe80::1', 'printer.local', 'localhost.']) expect(privateHost(h.replace(/^\[|\]$/g, ''))).toBe(true);
    for (const h of ['calendar.google.com', '8.8.8.8', '2606:4700::1111']) expect(privateHost(h)).toBe(false);
    // Numeric tricks normalize to the real address before the check.
    for (const u of ['http://2130706433/x', 'http://0x7f.1/x', 'http://127.1/x']) expect(privateHost(new URL(u).hostname)).toBe(true);
    const direct = deps([]);
    expect(await syncFeed({ ...feed, url: 'http://169.254.169.254/latest/meta-data' }, direct.d)).toMatchObject({ result: 'gone' });
    expect(direct.fetchFn).not.toHaveBeenCalled();
    const redirected = deps([() => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:8080/secret' } })]);
    expect(await syncFeed(feed, redirected.d)).toMatchObject({ result: 'gone' });
    expect(redirected.fetchFn).toHaveBeenCalledTimes(1);
  });
});
