/**
 * Fetching a subscribed feed safely: no private hosts (each redirect hop is checked, and the host's DNS answers when a
 * resolver is available), 15-second timeout, 5 MB cap, conditional GET (ETag / Last-Modified) so an unchanged school
 * calendar costs one tiny request.
 */
import { privateHost } from './feed-url.ts';

export type FeedFetch =
  | { kind: 'ok'; text: string; etag: string | null; lastModified: string | null }
  | { kind: 'unchanged' }
  | { kind: 'error'; trouble: 'gone' | 'retry'; error: string };

const MAX_BYTES = 5 * 1024 * 1024;

export async function fetchFeed(
  url: string,
  o: { fetch: typeof fetch; etag?: string | null; lastModified?: string | null; resolves?: (host: string) => Promise<string[]> },
): Promise<FeedFetch> {
  let at = url;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(at);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || privateHost(u.hostname) || u.username || u.password) return { kind: 'error', trouble: 'gone', error: 'blocked_host' };
    if (o.resolves) {
      try {
        const ips = await o.resolves(u.hostname);
        if (ips.some((ip) => privateHost(ip))) return { kind: 'error', trouble: 'gone', error: 'blocked_host' };
      } catch { /* resolution trouble: let the fetch report it */ }
    }
    const headers: Record<string, string> = { Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5', 'User-Agent': 'OrganizedFamily-Calendar/1.0' };
    if (hop === 0 && o.etag) headers['If-None-Match'] = o.etag;
    if (hop === 0 && o.lastModified) headers['If-Modified-Since'] = o.lastModified;
    let res: Response;
    try {
      res = await o.fetch(at, { headers, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    } catch {
      return { kind: 'error', trouble: 'retry', error: 'unreachable' };
    }
    if (res.status >= 300 && res.status < 400 && res.status !== 304) {
      const next = res.headers.get('location');
      if (!next) return { kind: 'error', trouble: 'retry', error: `http_${res.status}` };
      at = new URL(next, at).toString();
      continue;
    }
    if (res.status === 304) return { kind: 'unchanged' };
    if (res.status === 404 || res.status === 410) return { kind: 'error', trouble: 'gone', error: `http_${res.status}` };
    if (res.status === 401 || res.status === 403) return { kind: 'error', trouble: 'gone', error: 'feed_refused' };
    if (!res.ok) return { kind: 'error', trouble: 'retry', error: `http_${res.status}` };
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) return { kind: 'error', trouble: 'gone', error: 'too_large' };
    const reader = res.body?.getReader();
    if (!reader) return { kind: 'error', trouble: 'retry', error: 'empty' };
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel(); return { kind: 'error', trouble: 'gone', error: 'too_large' }; }
      chunks.push(value);
    }
    const buf = new Uint8Array(size);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }
    return { kind: 'ok', text: new TextDecoder().decode(buf), etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') };
  }
  return { kind: 'error', trouble: 'retry', error: 'too_many_redirects' };
}
