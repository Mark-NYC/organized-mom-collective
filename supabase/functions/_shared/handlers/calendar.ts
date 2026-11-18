/**
 * /functions/v1/calendar-connect: connected calendars (docs/ios/CALENDAR_INTEGRATION.md). Read-only: nothing is ever
 * written to her Google calendars or to a feed. Imported events never become family-owned events.
 *
 * POST (the website and the app; her access token unless noted):
 *   status                                → { google: boolean } whether Google can be connected here (no token needed)
 *   google_start   { return_to }          → { url } Google's consent page (PKCE, one-time state, 10 minutes)
 *   ical_subscribe { url, zone }          → { connection_id, name, events } a school/sports/other .ics link, fetched at once
 *   google_calendars { connection_id }    → { calendars } re-read her calendar list from Google
 *   refresh        { }                    → { synced } her calendars now (each at most every 2 minutes)
 *   disconnect     { connection_id }      → { removed } her own only; Google access is revoked too
 *   sync_due       (Authorization: Bearer CALENDAR_CRON_SECRET) → { synced, failed } the scheduled sync
 * GET  ?code&state | ?error&state         Google's redirect after consent → back to the calendar (or the app's page)
 *
 * Secrets never leave this function: refresh tokens and feed links are sealed (AES-GCM) before they reach the
 * database, and nothing returned to a browser contains them.
 */
import { corsHeaders, json, readJson, safeEqual, type Handler } from '../http.ts';
import type { CalendarDeps } from '../calendar/deps.ts';
import { checkFeedUrl, feedFingerprint } from '../calendar/feed-url.ts';
import { fetchFeed } from '../calendar/fetch-feed.ts';
import { authUrl, emailFromIdToken, fromGoogle, GOOGLE_API, GOOGLE_REVOKE, GOOGLE_SCOPES, GOOGLE_TOKEN, googleTrouble, sourcesFromList, type GoogleCalendarEntry, type GoogleEvent } from '../calendar/google.ts';
import { expandFeed } from '../calendar/ics.ts';
import { open, pkceChallenge, randomToken, seal } from '../calendar/secrets.ts';
import { validZone } from '../calendar/tz.ts';
import type { ImportedInstance } from '../calendar/types.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;
/** What's copied: a month back (for "what did we miss") to six months ahead (school year planning). */
export const WINDOW = { back: 30 * DAY, ahead: 183 * DAY };
const NEXT = { google: '30 minutes', ical: '2 hours' } as const;

interface Claimed { id: string; connection_id: string; provider: 'google' | 'ical'; external_id: string; timezone: string | null; etag: string | null; last_modified: string | null }
interface Conn { id: string; user_id: string; provider: 'google' | 'ical'; label: string; status: string; sealed: string | null }

class Trouble extends Error {
  constructor(readonly kind: 'reauth' | 'gone' | 'retry', message: string) { super(message); }
}

async function userId(deps: CalendarDeps, req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token === deps.env.anonKey) return null;
  const res = await deps.fetch(`${deps.env.supabaseUrl}/auth/v1/user`, { headers: { apikey: deps.env.anonKey || deps.env.serviceRoleKey, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string };
  return u.id && UUID.test(u.id) ? u.id : null;
}

const googleReady = (deps: CalendarDeps) => Boolean(deps.env.googleClientId && deps.env.googleClientSecret && deps.env.tokenKey);

// ------------------------------------------------------------------ Google

async function googleToken(deps: CalendarDeps, conn: Conn, cache: Map<string, string>): Promise<string> {
  const hit = cache.get(conn.id);
  if (hit) return hit;
  if (!conn.sealed) throw new Trouble('reauth', 'no_token');
  const refresh = await open(deps.env.tokenKey, conn.sealed, conn.id);
  const res = await deps.fetch(GOOGLE_TOKEN, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: deps.env.googleClientId, client_secret: deps.env.googleClientSecret, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!res.ok || !body?.access_token) throw new Trouble(googleTrouble(res.status, body), `token_${body?.error ?? res.status}`);
  cache.set(conn.id, body.access_token);
  return body.access_token;
}

async function googleGet<T>(deps: CalendarDeps, token: string, path: string, q: Record<string, string>): Promise<T> {
  const res = await deps.fetch(`${GOOGLE_API}${path}?${new URLSearchParams(q)}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Trouble(googleTrouble(res.status, body), `google_${res.status}`);
  return body as T;
}

async function googleCalendars(deps: CalendarDeps, token: string) {
  const items: GoogleCalendarEntry[] = [];
  let page: string | undefined;
  for (let i = 0; i < 5; i++) {
    const r = await googleGet<{ items?: GoogleCalendarEntry[]; nextPageToken?: string }>(deps, token, '/users/me/calendarList', { maxResults: '250', ...(page ? { pageToken: page } : {}) });
    items.push(...(r.items ?? []));
    if (!(page = r.nextPageToken)) break;
  }
  return sourcesFromList(items);
}

async function googleEvents(deps: CalendarDeps, token: string, calendarId: string, from: number, to: number, zone: string | null): Promise<ImportedInstance[]> {
  const out: ImportedInstance[] = [];
  let page: string | undefined;
  for (let i = 0; i < 6 && out.length < 3000; i++) {
    const r = await googleGet<{ items?: GoogleEvent[]; nextPageToken?: string; timeZone?: string }>(deps, token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
      singleEvents: 'true', showDeleted: 'false', maxResults: '2500', orderBy: 'startTime',
      timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), ...(page ? { pageToken: page } : {}),
    });
    for (const ev of r.items ?? []) { const x = fromGoogle(ev, r.timeZone ?? zone); if (x) out.push(x); }
    if (!(page = r.nextPageToken)) break;
  }
  return out.slice(0, 3000);
}

// ------------------------------------------------------------------ syncing one calendar

async function syncOne(deps: CalendarDeps, s: Claimed, conns: Map<string, Conn>, tokens: Map<string, string>): Promise<'ok' | 'failed'> {
  const from = deps.now() - WINDOW.back;
  const to = deps.now() + WINDOW.ahead;
  try {
    let conn = conns.get(s.connection_id);
    if (!conn) {
      conn = (await deps.db.rpc<Conn | null>('calendar_connection_for', { p_connection: s.connection_id })) ?? undefined;
      if (!conn) return 'failed';
      conns.set(conn.id, conn);
    }
    if (s.provider === 'google') {
      const token = await googleToken(deps, conn, tokens);
      const events = await googleEvents(deps, token, s.external_id, from, to, s.timezone);
      await apply(deps, s.id, from, to, events, null, null, NEXT.google);
    } else {
      if (!conn.sealed) throw new Trouble('gone', 'no_link');
      const url = await open(deps.env.tokenKey, conn.sealed, conn.id);
      const r = await fetchFeed(url, { fetch: deps.fetch, etag: s.etag, lastModified: s.last_modified, resolves: deps.resolves });
      if (r.kind === 'unchanged') {
        await deps.db.rpc('calendar_sync_unchanged', { p_source: s.id, p_next: NEXT.ical });
        return 'ok';
      }
      if (r.kind === 'error') throw new Trouble(r.trouble, r.error);
      const feed = expandFeed(r.text, { from, to, familyZone: validZone(s.timezone) ? s.timezone : 'America/New_York' });
      if (feed.notCalendar) throw new Trouble('gone', 'not_a_calendar');
      await apply(deps, s.id, from, to, feed.events, r.etag, r.lastModified, NEXT.ical);
    }
    return 'ok';
  } catch (e) {
    const kind = e instanceof Trouble ? e.kind : 'retry';
    const msg = e instanceof Trouble ? e.message : 'sync_failed';
    await deps.db.rpc('calendar_sync_failed', { p_source: s.id, p_kind: kind, p_error: msg }).catch(() => undefined);
    return 'failed';
  }
}

const apply = (deps: CalendarDeps, source: string, from: number, to: number, events: ImportedInstance[], etag: string | null, lastModified: string | null, next: string) =>
  deps.db.rpc('calendar_sync_apply', {
    p_source: source, p_from: new Date(from).toISOString(), p_to: new Date(to).toISOString(), p_events: events,
    p_etag: etag, p_last_modified: lastModified, p_next: next,
  });

async function syncClaimed(deps: CalendarDeps, claimed: Claimed[]) {
  const conns = new Map<string, Conn>();
  const tokens = new Map<string, string>();
  let synced = 0;
  let failed = 0;
  // A few at a time: kind to Google's per-user quota and to the function's time limit.
  for (let i = 0; i < claimed.length; i += 4) {
    const r = await Promise.all(claimed.slice(i, i + 4).map((s) => syncOne(deps, s, conns, tokens)));
    synced += r.filter((x) => x === 'ok').length;
    failed += r.filter((x) => x === 'failed').length;
  }
  return { synced, failed };
}

// ------------------------------------------------------------------ actions

async function googleStart(deps: CalendarDeps, uid: string, body: Record<string, unknown>) {
  if (!googleReady(deps)) return { error: 'google_unavailable' };
  const state = randomToken(32);
  const verifier = randomToken(48);
  await deps.db.rpc('calendar_oauth_begin', { p_user: uid, p_state: state, p_verifier: verifier, p_return_to: body.return_to === 'app' ? 'app' : 'web' });
  return { url: authUrl({ clientId: deps.env.googleClientId, redirectUri: deps.env.redirectUri, state, challenge: await pkceChallenge(verifier) }) };
}

async function icalSubscribe(deps: CalendarDeps, uid: string, body: Record<string, unknown>) {
  if (!deps.env.tokenKey) return { error: 'unavailable' };
  const checked = checkFeedUrl(String(body.url ?? ''));
  if (!checked.ok) return { error: checked.error };
  const zone = typeof body.zone === 'string' && validZone(body.zone) ? body.zone : 'America/New_York';
  // Fetch before saving anything: a link that isn't a calendar is refused with nothing stored.
  const r = await fetchFeed(checked.url, { fetch: deps.fetch, resolves: deps.resolves });
  if (r.kind !== 'ok') return { error: r.kind === 'error' && r.error === 'blocked_host' ? 'private_host' : 'unreachable' };
  const from = deps.now() - WINDOW.back;
  const to = deps.now() + WINDOW.ahead;
  const feed = expandFeed(r.text, { from, to, familyZone: zone });
  if (feed.notCalendar) return { error: 'not_a_calendar' };
  let conn: { id: string };
  try {
    conn = await deps.db.rpc<{ id: string }>('calendar_connection_upsert', { p_user: uid, p_provider: 'ical', p_label: checked.host.slice(0, 254), p_fingerprint: await feedFingerprint(checked.url) });
  } catch (e) {
    const m = (e as Error).message;
    return { error: m === 'duplicate' || m === 'too_many' ? m : 'failed' };
  }
  await deps.db.rpc('calendar_secret_put', { p_connection: conn.id, p_sealed: await seal(deps.env.tokenKey, checked.url, conn.id) });
  const name = (typeof body.name === 'string' && body.name.trim().slice(0, 120)) || feed.name || checked.host;
  const sources = await deps.db.rpc<{ id: string }[]>('calendar_sources_put', {
    p_connection: conn.id, p_sources: [{ external_id: 'feed', name, primary: true, timezone: feed.zone ?? zone }], p_select_new: true,
  });
  await apply(deps, sources[0].id, from, to, feed.events, r.etag, r.lastModified, NEXT.ical);
  return { connection_id: conn.id, name, events: feed.events.length };
}

async function ownConnection(deps: CalendarDeps, uid: string, id: unknown): Promise<Conn | null> {
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  const c = await deps.db.rpc<Conn | null>('calendar_connection_for', { p_connection: id });
  return c && c.user_id === uid ? c : null;
}

async function relistGoogle(deps: CalendarDeps, conn: Conn) {
  const token = await googleToken(deps, conn, new Map());
  const list = await googleCalendars(deps, token);
  await deps.db.rpc('calendar_sources_put', { p_connection: conn.id, p_sources: list, p_select_new: false });
  return list.length;
}

async function disconnect(deps: CalendarDeps, uid: string, conn: Conn) {
  if (conn.provider === 'google' && conn.sealed && googleReady(deps)) {
    // Best effort: stop our access at Google too. Removal here happens either way.
    try {
      const refresh = await open(deps.env.tokenKey, conn.sealed, conn.id);
      await deps.fetch(GOOGLE_REVOKE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refresh }) });
    } catch { /* already revoked, or Google unreachable */ }
  }
  await deps.db.rpc('calendar_connection_remove', { p_user: uid, p_connection: conn.id });
  return { removed: conn.id };
}

// ------------------------------------------------------------------ Google's redirect

async function callback(deps: CalendarDeps, url: URL): Promise<Response> {
  const state = url.searchParams.get('state') ?? '';
  const back = (returnTo: string, result: string) =>
    Response.redirect(returnTo === 'app' ? `${deps.env.siteUrl}/app/calendar-connected?result=${result}` : `${deps.env.siteUrl}/app/family-calendar?calendar=${result}`, 303);
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(state)) return back('web', 'failed');
  const handshake = await deps.db.rpc<{ user_id: string; verifier: string; return_to: string } | null>('calendar_oauth_take', { p_state: state });
  if (!handshake) return back('web', 'expired');
  const to = handshake.return_to;
  if (url.searchParams.get('error')) return back(to, 'denied');
  const code = url.searchParams.get('code');
  if (!code || !googleReady(deps)) return back(to, 'failed');
  const res = await deps.fetch(GOOGLE_TOKEN, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: deps.env.googleClientId, client_secret: deps.env.googleClientSecret, redirect_uri: deps.env.redirectUri, grant_type: 'authorization_code', code_verifier: handshake.verifier }),
  });
  const tok = (await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string; id_token?: string; scope?: string } | null;
  if (!res.ok || !tok?.access_token || !tok.refresh_token) return back(to, 'failed');
  // She can untick calendar access on Google's consent screen: then there's nothing to connect.
  const granted = (tok.scope ?? '').split(' ');
  if (!GOOGLE_SCOPES.filter((s) => s.includes('calendar')).every((s) => granted.includes(s))) return back(to, 'scope');
  const email = emailFromIdToken(tok.id_token) ?? 'Google account';
  const conn = await deps.db.rpc<{ id: string }>('calendar_connection_upsert', { p_user: handshake.user_id, p_provider: 'google', p_label: email, p_fingerprint: null }).catch((e: Error) => e);
  if (conn instanceof Error) return back(to, conn.message === 'too_many' ? 'too_many' : 'failed');
  await deps.db.rpc('calendar_secret_put', { p_connection: conn.id, p_sealed: await seal(deps.env.tokenKey, tok.refresh_token, conn.id) });
  const list = await googleCalendars(deps, tok.access_token).catch(() => []);
  await deps.db.rpc('calendar_sources_put', { p_connection: conn.id, p_sources: list, p_select_new: true });
  // Her primary calendar shows up right away; the rest she turns on in Calendars.
  const claimed = await deps.db.rpc<Claimed[]>('calendar_sync_claim', { p_user: handshake.user_id, p_limit: 10 });
  const cache = new Map([[conn.id, tok.access_token]]);
  await Promise.all(claimed.filter((c) => c.connection_id === conn.id).map((c) => syncOne(deps, c, new Map(), cache)));
  return back(to, 'connected');
}

// ------------------------------------------------------------------ the handler

export function createCalendarHandler(deps: CalendarDeps): Handler {
  return async (req) => {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.searchParams.has('state')) {
      try {
        return await callback(deps, url);
      } catch {
        return Response.redirect(`${deps.env.siteUrl}/app/family-calendar?calendar=failed`, 303);
      }
    }
    const cors = corsHeaders(req, deps.env.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response(null, { status: cors['Access-Control-Allow-Origin'] ? 204 : 403, headers: cors });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    const body = await readJson(req);
    if (!body) return json({ error: 'invalid' }, 400, cors);
    try {
      if (body.action === 'status') return json({ google: googleReady(deps), feeds: Boolean(deps.env.tokenKey) }, 200, cors);
      if (body.action === 'sync_due') {
        const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
        if (!deps.env.cronSecret || !safeEqual(bearer, deps.env.cronSecret)) return json({ error: 'unauthorized' }, 401, cors);
        const claimed = await deps.db.rpc<Claimed[]>('calendar_sync_claim', { p_user: null, p_limit: 60 });
        return json(await syncClaimed(deps, claimed), 200, cors);
      }
      const uid = await userId(deps, req);
      if (!uid) return json({ error: 'not_signed_in' }, 401, cors);
      switch (body.action) {
        case 'google_start':
          return json(await googleStart(deps, uid, body), 200, cors);
        case 'ical_subscribe':
          return json(await icalSubscribe(deps, uid, body), 200, cors);
        case 'refresh': {
          const claimed = await deps.db.rpc<Claimed[]>('calendar_sync_claim', { p_user: uid, p_limit: 20 });
          return json(await syncClaimed(deps, claimed), 200, cors);
        }
        case 'google_calendars': {
          const conn = await ownConnection(deps, uid, body.connection_id);
          if (!conn || conn.provider !== 'google') return json({ error: 'not_found' }, 404, cors);
          try {
            return json({ calendars: await relistGoogle(deps, conn) }, 200, cors);
          } catch (e) {
            return json({ error: e instanceof Trouble && e.kind === 'reauth' ? 'reauth' : 'unavailable' }, 200, cors);
          }
        }
        case 'disconnect': {
          const conn = await ownConnection(deps, uid, body.connection_id);
          if (!conn) return json({ error: 'not_found' }, 404, cors);
          return json(await disconnect(deps, uid, conn), 200, cors);
        }
        default:
          return json({ error: 'unknown_action' }, 400, cors);
      }
    } catch {
      return json({ error: 'failed' }, 500, cors);
    }
  };
}
