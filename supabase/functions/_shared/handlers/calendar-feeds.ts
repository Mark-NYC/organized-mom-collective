/**
 * The calendar-feeds Edge Function: fetches iCal subscriptions and stores their events (docs/calendar/CALENDAR_INTEGRATION.md).
 *
 *   POST { feed_id }            with the adult's sign-in (Authorization: Bearer …): "Refresh now" for one of THEIR feeds.
 *   POST { mode: "due" }        with x-calendar-cron: <CALENDAR_CRON_SECRET>: the scheduled refresh (pg_cron).
 *
 * Safety (docs/calendar/SECURITY_REVIEW.md):
 * - Only http(s). Never a private, loopback, link-local, carrier-grade NAT, multicast or metadata address: checked on
 *   the URL's host AND on every address the host resolves to, before the first request and again on every redirect
 *   (at most 3). If the name can't be resolved, nothing is fetched.
 * - 15 s timeout, 5 MB limit, and a calendar cut off mid-download is never stored.
 * - Conditional requests (ETag / Last-Modified) and a content hash, so an unchanged calendar is neither re-parsed nor
 *   rewritten.
 * - The scheduled run stays inside the Edge Function limits (2 s CPU, 150 s wall clock on the Free plan): it claims
 *   one feed at a time and stops at a parse-time and wall-clock budget; whatever is left waits for the next run.
 * - It reads the source calendar and writes only calendar_feed_events (through calendar_feed_store); the family's
 *   own events are never touched. The feed URL is never logged or returned.
 */
import { parseIcs } from '../calendar/ics.ts';

export interface CalendarFeedsDeps {
  /** Service-role database calls. */
  db: { rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> };
  /** The signed-in adult for a bearer token, or null. */
  getUser(token: string): Promise<{ id: string } | null>;
  fetch: typeof fetch;
  /** Every IP address a host name resolves to (A and AAAA). Throws if it can't be resolved. */
  resolve?(host: string): Promise<string[]>;
  now(): number;
  cronSecret: string | null;
  /** Tests only: let fixtures on 127.0.0.1 through. */
  allowPrivateHosts?: boolean;
  /** Scheduled run budget (defaults: 900 ms of parsing, 90 s wall clock, 25 feeds). */
  budget?: { parseMs?: number; wallMs?: number; feeds?: number };
}

interface ClaimedFeed { id: string; url: string; etag: string | null; last_modified: string | null; timezone: string; content_hash: string | null; recent?: boolean; event_count?: number }
type StoreResult = { result: 'ok' | 'not_modified' | 'error' | 'gone'; error?: string; etag?: string | null; last_modified?: string | null; content_hash?: string; events?: unknown[]; parse_ms?: number };

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const DAY = 86_400_000;

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

/** Same answer in the same time whatever the guess (the cron secret). */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Addresses and names a calendar link may never reach (this server's network, cloud metadata, the local machine). */
export function privateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.home.arpa') || h === 'metadata.google.internal') return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b, c] = [+v4[1], +v4[2], +v4[3]];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || a >= 224;
  }
  if (h.includes(':')) {
    if (h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('ff') || h.startsWith('2001:db8') || h.startsWith('64:ff9b')) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h);
    if (mapped) return privateHost(mapped[1]);
    return h.startsWith('::ffff:') || h.startsWith('::');
  }
  return false;
}

const isIp = (h: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');

/** null = fine; otherwise why this URL may not be fetched. */
async function blocked(url: URL, deps: CalendarFeedsDeps): Promise<StoreResult | null> {
  if (!/^https?:$/.test(url.protocol)) return { result: 'gone', error: 'That calendar link isn’t a web address.' };
  if (url.username || url.password) return { result: 'gone', error: 'Calendar links with a user name or password aren’t supported.' };
  if (deps.allowPrivateHosts) return null;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (privateHost(host)) return { result: 'gone', error: 'That calendar link points somewhere we can’t read.' };
  if (isIp(host) || !deps.resolve) return null;
  let addrs: string[];
  try { addrs = await deps.resolve(host); } catch { return { result: 'error', error: 'We couldn’t find that calendar’s website. We’ll try again later.' }; }
  if (!addrs.length) return { result: 'error', error: 'We couldn’t find that calendar’s website. We’ll try again later.' };
  if (addrs.some(privateHost)) return { result: 'gone', error: 'That calendar link points somewhere we can’t read.' };
  return null;
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

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
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
      const stop = await blocked(url, deps);
      if (stop) return stop;
      res = await deps.fetch(url.toString(), { headers, redirect: 'manual', signal: ctl.signal });
      if (res.status >= 300 && res.status < 400 && res.status !== 304) {
        const loc = res.headers.get('location');
        await res.body?.cancel();
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
    // Same calendar as last time (servers without ETag, like Google and many school sites): nothing to parse or rewrite.
    // DTSTAMP is when the file was generated (Google stamps every download), not part of any event, so it's left out.
    const hash = await sha256(text.replace(/^DTSTAMP[;:].*$/gim, ''));
    if (feed.content_hash && hash === feed.content_hash) return { result: 'not_modified', etag: res.headers.get('etag'), last_modified: res.headers.get('last-modified') };
    const now = deps.now();
    const t0 = performance.now();
    const parsed = parseIcs(text, { fromMs: now - 30 * DAY, toMs: now + 365 * DAY, householdTz: feed.timezone });
    return { result: 'ok', etag: res.headers.get('etag'), last_modified: res.headers.get('last-modified'), content_hash: hash, events: parsed.instances, parse_ms: performance.now() - t0 };
  } catch (e) {
    const m = (e as Error).message;
    if (m === 'not_ical') return { result: 'error', error: 'That link didn’t return a calendar. Check it’s the iCal (.ics) link.' };
    if (m === 'incomplete') return { result: 'error', error: 'The calendar didn’t finish downloading. We’ll try again later.' };
    if (m === 'too_big') return { result: 'error', error: 'This calendar is too big to import.' };
    return { result: 'error', error: 'The calendar didn’t answer. We’ll try again later.' };
  } finally {
    clearTimeout(timer);
  }
}

async function refreshOne(f: ClaimedFeed, deps: CalendarFeedsDeps) {
  const r = await syncFeed(f, deps);
  const { parse_ms: parseMs = 0, ...stored } = r;
  const count = await deps.db.rpc<number>('calendar_feed_store', { p_feed: f.id, p: stored });
  return { id: f.id, result: r.result, count, parseMs, ...(r.error ? { error: r.error } : {}) };
}

export function createCalendarFeedsHandler(deps: CalendarFeedsDeps) {
  const budget = { parseMs: 900, wallMs: 90_000, feeds: 25, ...deps.budget };
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json(405, { error: 'method' });
    let body: { feed_id?: string; mode?: string } = {};
    try { body = await req.json(); } catch { /* empty */ }

    if (body.mode === 'due') {
      const secret = req.headers.get('x-calendar-cron') ?? '';
      if (!deps.cronSecret || !safeEqual(secret, deps.cronSecret)) return json(401, { error: 'unauthorized' });
      // One feed at a time until the budget is spent: never claims more than it can finish.
      const started = deps.now();
      let parsed = 0;
      let refreshed = 0;
      while (refreshed < budget.feeds && parsed < budget.parseMs && deps.now() - started < budget.wallMs) {
        const [f] = await deps.db.rpc<ClaimedFeed[]>('calendar_feed_claim', { p_limit: 1 });
        if (!f) break;
        const r = await refreshOne(f, deps);
        parsed += r.parseMs;
        refreshed++;
      }
      return json(200, { refreshed });
    }

    const token = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
    const user = token ? await deps.getUser(token) : null;
    if (!user) return json(401, { error: 'not_signed_in' });
    if (!body.feed_id || !/^[0-9a-f-]{36}$/i.test(body.feed_id)) return json(400, { error: 'invalid' });
    const [f] = await deps.db.rpc<ClaimedFeed[]>('calendar_feed_claim', { p_limit: 1, p_feed: body.feed_id, p_owner: user.id });
    if (!f) return json(404, { error: 'not_found' });
    // Refreshed moments ago (a double tap): answer with what's there instead of fetching again.
    if (f.recent) return json(200, { id: f.id, result: 'not_modified', count: f.event_count ?? 0 });
    const { parseMs: _p, ...r } = await refreshOne(f, deps);
    return json(200, r);
  };
}
