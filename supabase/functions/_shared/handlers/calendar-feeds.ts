/**
 * The calendar-feeds Edge Function: fetches iCal subscriptions and stores their events (docs/calendar/CALENDAR_INTEGRATION.md).
 *
 *   POST { feed_id }            with the adult's sign-in (Authorization: Bearer …): "Refresh now" for one of THEIR feeds.
 *   POST { mode: "due" }        with x-calendar-cron: <CALENDAR_CRON_SECRET>: the scheduled refresh (pg_cron every 30 min).
 *
 * Safety: only http(s); no private, loopback or link-local hosts (checked again on every redirect, at most 3);
 * 15 s timeout; 5 MB limit; conditional requests (ETag / Last-Modified) so an unchanged calendar isn't re-read. It
 * reads the source calendar and writes only calendar_feed_events (through calendar_feed_store); the family's own
 * events are never touched. The feed URL is never logged or returned.
 */
import { parseIcs } from '../calendar/ics.ts';

export interface CalendarFeedsDeps {
  /** Service-role database calls. */
  db: { rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> };
  /** The signed-in adult for a bearer token, or null. */
  getUser(token: string): Promise<{ id: string } | null>;
  fetch: typeof fetch;
  now(): number;
  cronSecret: string | null;
  /** Tests only: let fixtures on 127.0.0.1 through. */
  allowPrivateHosts?: boolean;
}

interface ClaimedFeed { id: string; url: string; etag: string | null; last_modified: string | null; timezone: string }
type StoreResult = { result: 'ok' | 'not_modified' | 'error' | 'gone'; error?: string; etag?: string | null; last_modified?: string | null; events?: unknown[] };

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const DAY = 86_400_000;

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

/** Hosts a calendar link may never point at (this server's network, the cloud metadata service, the local machine). */
export function privateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h === 'metadata.google.internal') return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [+v4[1], +v4[2]];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(':')) return h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:');
  return false;
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('too_big'); }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.byteLength; }
  return new TextDecoder('utf-8').decode(all);
}

/** Fetch one feed and turn the answer into what calendar_feed_store records. Never throws. */
export async function syncFeed(feed: ClaimedFeed, deps: CalendarFeedsDeps): Promise<StoreResult> {
  let url: URL;
  try { url = new URL(feed.url); } catch { return { result: 'gone', error: 'That calendar link isn’t valid.' }; }
  const headers: Record<string, string> = { 'User-Agent': 'OrganizedFamily-Calendar/1.0 (+https://organizedmomcollective.com)', Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' };
  if (feed.etag) headers['If-None-Match'] = feed.etag;
  if (feed.last_modified) headers['If-Modified-Since'] = feed.last_modified;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= 3; hop++) {
      if (!/^https?:$/.test(url.protocol)) return { result: 'gone', error: 'That calendar link isn’t a web address.' };
      if (!deps.allowPrivateHosts && privateHost(url.hostname)) return { result: 'gone', error: 'That calendar link points somewhere we can’t read.' };
      res = await deps.fetch(url.toString(), { headers, redirect: 'manual', signal: ctl.signal });
      if (res.status >= 300 && res.status < 400 && res.status !== 304) {
        const loc = res.headers.get('location');
        if (!loc || hop === 3) return { result: 'error', error: 'The calendar kept redirecting.' };
        url = new URL(loc, url);
        continue;
      }
      break;
    }
    if (!res) return { result: 'error', error: 'The calendar didn’t answer.' };
    if (res.status === 304) return { result: 'not_modified' };
    if (res.status === 404 || res.status === 410) return { result: 'gone', error: 'This calendar no longer exists at that link.' };
    if (res.status === 401 || res.status === 403) return { result: 'gone', error: 'This calendar’s link stopped working. Copy a new link from where it came from.' };
    if (!res.ok) return { result: 'error', error: `The calendar answered with an error (${res.status}). We’ll try again later.` };
    const text = await readLimited(res);
    const now = deps.now();
    const parsed = parseIcs(text, { fromMs: now - 30 * DAY, toMs: now + 365 * DAY, householdTz: feed.timezone });
    return { result: 'ok', etag: res.headers.get('etag'), last_modified: res.headers.get('last-modified'), events: parsed.instances };
  } catch (e) {
    const m = (e as Error).message;
    if (m === 'not_ical') return { result: 'error', error: 'That link didn’t return a calendar. Check it’s the iCal (.ics) link.' };
    if (m === 'too_big') return { result: 'error', error: 'This calendar is too big to import.' };
    return { result: 'error', error: 'The calendar didn’t answer. We’ll try again later.' };
  } finally {
    clearTimeout(timer);
  }
}

export function createCalendarFeedsHandler(deps: CalendarFeedsDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json(405, { error: 'method' });
    let body: { feed_id?: string; mode?: string } = {};
    try { body = await req.json(); } catch { /* empty */ }

    let feeds: ClaimedFeed[];
    if (body.mode === 'due') {
      const secret = req.headers.get('x-calendar-cron');
      if (!deps.cronSecret || secret !== deps.cronSecret) return json(401, { error: 'unauthorized' });
      feeds = await deps.db.rpc<ClaimedFeed[]>('calendar_feed_claim', { p_limit: 20 });
    } else {
      const token = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
      const user = token ? await deps.getUser(token) : null;
      if (!user) return json(401, { error: 'not_signed_in' });
      if (!body.feed_id || !/^[0-9a-f-]{36}$/i.test(body.feed_id)) return json(400, { error: 'invalid' });
      feeds = await deps.db.rpc<ClaimedFeed[]>('calendar_feed_claim', { p_limit: 1, p_feed: body.feed_id, p_owner: user.id });
      if (!feeds.length) return json(404, { error: 'not_found' });
    }

    const results: { id: string; result: string; count: number; error?: string }[] = [];
    // A few at a time: kind to the calendars' servers and to the function's time limit.
    for (let i = 0; i < feeds.length; i += 4) {
      await Promise.all(feeds.slice(i, i + 4).map(async (f) => {
        const r = await syncFeed(f, deps);
        const count = await deps.db.rpc<number>('calendar_feed_store', { p_feed: f.id, p: r });
        results.push({ id: f.id, result: r.result, count, ...(r.error ? { error: r.error } : {}) });
      }));
    }
    return json(200, body.mode === 'due' ? { refreshed: results.length } : results[0]);
  };
}
