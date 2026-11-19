/** The pinned HTTP/1.1 client (supabase/functions/_shared/calendar/pinned-http.ts) over a fake connection. */
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { httpGet, type ByteConn } from '../supabase/functions/_shared/calendar/pinned-http';
import { createCalendarFeedsHandler, syncFeed } from '../supabase/functions/_shared/handlers/calendar-feeds';

/** A connection that records what was written and answers with `reply`, in small pieces. */
function conn(reply: Uint8Array | string): ByteConn & { sent: () => string } {
  const data = typeof reply === 'string' ? new TextEncoder().encode(reply) : reply;
  let off = 0;
  let sent = '';
  return {
    async write(p) { sent += new TextDecoder().decode(p); return p.length; },
    async read(p) { if (off >= data.length) return null; const n = Math.min(7, p.length, data.length - off); p.set(data.subarray(off, off + n)); off += n; return n; },
    close() {},
    sent: () => sent,
  };
}
const url = new URL('https://school.example.org/cal.ics?token=abc');
const ICS = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n';

describe('pinned HTTP client', () => {
  it('sends one clean GET with the real Host, and reads a Content-Length body', async () => {
    const c = conn(`HTTP/1.1 200 OK\r\nContent-Type: text/calendar\r\nETag: "v1"\r\nContent-Length: ${ICS.length}\r\n\r\n${ICS}`);
    const r = await httpGet(c, url, { 'If-None-Match': '"v0"\r\nX-Injected: 1', Host: 'evil.example' }, 1e6);
    expect(r.status).toBe(200);
    expect(await r.text()).toBe(ICS);
    expect(r.headers.get('etag')).toBe('"v1"');
    expect(c.sent()).toMatch(/^GET \/cal\.ics\?token=abc HTTP\/1\.1\r\nHost: school\.example\.org\r\n/);
    expect(c.sent()).not.toMatch(/evil|\r\nX-Injected/); // no header injection, Host can't be overridden
    expect(c.sent()).toMatch(/Connection: close\r\n\r\n$/);
  });

  it('chunked, gzip, interim 100, 304 and redirects', async () => {
    const chunked = await httpGet(conn(`HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n6\r\nBEGIN:\r\n${(ICS.length - 6).toString(16)}\r\n${ICS.slice(6)}\r\n0\r\n\r\n`), url, {}, 1e6);
    expect(await chunked.text()).toBe(ICS);
    const gz = gzipSync(Buffer.from(ICS));
    const head = new TextEncoder().encode(`HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Length: ${gz.length}\r\n\r\n`);
    const both = new Uint8Array(head.length + gz.length); both.set(head); both.set(gz, head.length);
    expect(await (await httpGet(conn(both), url, {}, 1e6)).text()).toBe(ICS);
    expect((await httpGet(conn('HTTP/1.1 304 Not Modified\r\nETag: "v1"\r\n\r\n'), url, {}, 1e6)).status).toBe(304);
    const moved = await httpGet(conn('HTTP/1.1 302 Found\r\nLocation: https://other.example.org/x.ics\r\n\r\n'), url, {}, 1e6);
    expect([moved.status, moved.headers.get('location')]).toEqual([302, 'https://other.example.org/x.ics']);
  });

  it('refuses what is too big, cut off, or not HTTP', async () => {
    await expect(httpGet(conn(`HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\nBEGIN`), url, {}, 1e6)).rejects.toThrow('incomplete');
    await expect(httpGet(conn(`HTTP/1.1 200 OK\r\n\r\n${'x'.repeat(5000)}`), url, {}, 1000)).rejects.toThrow('too_big');
    const bomb = gzipSync(Buffer.alloc(200_000, 65));
    const head = new TextEncoder().encode(`HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\n`);
    const both = new Uint8Array(head.length + bomb.length); both.set(head); both.set(bomb, head.length);
    await expect(httpGet(conn(both), url, {}, 50_000)).rejects.toThrow('too_big'); // a small download that inflates past the limit
    await expect(httpGet(conn('SSH-2.0-OpenSSH\r\n\r\n'), url, {}, 1e6)).rejects.toThrow('bad_response');
    await expect(httpGet(conn(''), url, {}, 1e6)).rejects.toThrow('incomplete');
  });
});

describe('DNS rebinding', () => {
  const feed = { id: '1', url: 'https://rebind.example/cal.ics', etag: null, last_modified: null, timezone: 'UTC', content_hash: null };
  const deps = (resolve: (h: string) => Promise<string[]>) => {
    const pinned = vi.fn(async (_u: URL, _ip: string) => new Response(`BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n`));
    const fetchFn = vi.fn();
    return { pinned, fetchFn, d: { db: { rpc: async () => null as never }, getUser: async () => null, fetch: fetchFn as never, resolve, pinnedFetch: pinned, now: Date.now, cronSecret: null } };
  };

  it('connects to exactly the address that was checked; the name is resolved once per hop', async () => {
    const answers = [['93.184.216.34'], ['127.0.0.1']]; // public for the check, private if asked again
    const resolve = vi.fn(async () => answers.shift()!);
    const t = deps(resolve);
    expect((await syncFeed(feed, t.d)).result).toBe('ok');
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(t.pinned.mock.calls[0][1]).toBe('93.184.216.34');
    expect(t.fetchFn).not.toHaveBeenCalled(); // never a second, unpinned lookup by fetch
  });

  it('with pinning on, an unresolvable name is never fetched (fails closed)', async () => {
    const t = deps(async () => { throw new Error('NXDOMAIN'); });
    expect(await syncFeed(feed, t.d)).toMatchObject({ result: 'error' });
    expect(t.pinned).not.toHaveBeenCalled();
    const noResolver = deps(async () => []);
    expect(await syncFeed(feed, { ...noResolver.d, resolve: undefined })).toMatchObject({ result: 'error' });
    expect(noResolver.pinned).not.toHaveBeenCalled();
  });

  it('the self-test needs the secret and reports pinning, refusals and the public calendar', async () => {
    const t = deps(async (h) => (h.includes('10.0.0.1') ? ['10.0.0.1'] : ['142.250.80.46']));
    const h = createCalendarFeedsHandler({ ...t.d, cronSecret: 's3cret', resolverName: () => 'deno' });
    const post = (headers: Record<string, string>) => new Request('https://x/', { method: 'POST', headers, body: JSON.stringify({ mode: 'selftest' }) });
    expect((await h(post({}))).status).toBe(401);
    expect(await (await h(post({ 'x-calendar-cron': 's3cret' }))).json()).toMatchObject({ pinned: true, resolver: 'deno', public_calendar: { result: 'ok' }, private_name_refused: true, private_address_refused: true });
  });
});
