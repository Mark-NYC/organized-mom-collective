/**
 * The calendar-google Edge Function: "Connect Google Calendar" (docs/calendar/GOOGLE_CALENDAR.md).
 *
 *   POST { action: "start", return: "web" | "app", origin }   signed-in adult → { url } of Google's consent screen
 *   GET  /calendar-google/callback?code&state                Google's redirect → back to the app (no tokens in the URL)
 *   POST { action: "callback", code, state, error }          the same, relayed by /app/google-callback on our own
 *                                                           domain (production: Google's verification needs the
 *                                                           redirect on a domain we own) → { location }
 *   POST { action: "calendars", account_id }                 her Google calendars, to choose from
 *   POST { action: "disconnect", account_id }                revoke at Google, then delete the account, its token,
 *                                                           its calendars and their imported events
 *
 * Security:
 * - Authorization code flow with PKCE (S256) and a one-time `state` (32 random bytes; only its SHA-256 is stored, for
 *   10 minutes, bound to the adult who pressed Connect). The callback takes the state once; a replayed, forged or
 *   expired state connects nothing.
 * - The code is exchanged server-side with the client secret; the refresh token goes straight to Vault. Neither
 *   token is ever returned to the app, put in a URL or logged. The app gets an account id and calendar names only.
 * - Redirects go only to allowlisted origins (no open redirect).
 * - She must grant both calendar permissions (Google lets her untick them); otherwise the grant is revoked at once.
 * - Read-only scopes only; nothing here can change her Google calendars.
 */
import {
  type GoogleConfig, GoogleError, authorizeUrl, exchangeCode, listCalendars, randomToken, refreshAccessToken, revokeToken, sha256Hex,
} from '../calendar/google.ts';

export interface CalendarGoogleDeps {
  db: { rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> };
  getUser(token: string): Promise<{ id: string } | null>;
  fetch: typeof fetch;
  /** Null until the owner configures the OAuth client (Google is then reported as not set up). */
  google: GoogleConfig | null;
  /** Where the browser may be sent back to; the first is the default (the production website). */
  returnOrigins: string[];
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where to send her back: the app's calendar (website) or a small "connected, tap Done" page (iPhone app). */
function back(origin: string, returnTo: string, result: string, account?: string): Response {
  const page = returnTo === 'app' ? '/app/google-connected/' : '/app/family-calendar/';
  const u = new URL(page, origin);
  u.searchParams.set('google', result);
  if (account) u.searchParams.set('account', account);
  return new Response(null, { status: 302, headers: { Location: u.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

export function createCalendarGoogleHandler(deps: CalendarGoogleDeps) {
  const origin = (asked: unknown) => (typeof asked === 'string' && deps.returnOrigins.includes(asked) ? asked : deps.returnOrigins[0]);

  async function user(req: Request) {
    const token = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
    return token ? deps.getUser(token) : null;
  }

  async function callback(url: URL): Promise<Response> {
    const fallback = deps.returnOrigins[0];
    const state = url.searchParams.get('state') ?? '';
    if (state.length > 200) return back(fallback, 'web', 'error');
    if (!state || state.length > 200) return back(fallback, 'web', 'error');
    const s = await deps.db.rpc<{ user_id: string; code_verifier: string; return_to: string; return_origin: string } | null>('calendar_google_state_take', { p_state_hash: await sha256Hex(state) });
    if (!s) return back(fallback, 'web', 'expired');
    const to = origin(s.return_origin);
    const error = url.searchParams.get('error');
    if (error) return back(to, s.return_to, error === 'access_denied' ? 'cancelled' : 'error');
    const code = url.searchParams.get('code');
    if (!code || !deps.google) return back(to, s.return_to, 'error');
    try {
      const got = await exchangeCode(deps.google, deps.fetch, code, s.code_verifier);
      const id = await deps.db.rpc<string>('calendar_google_account_save', { p_user: s.user_id, p_sub: got.sub, p_email: got.email, p_refresh_token: got.refreshToken, p_scopes: got.scopes });
      return back(to, s.return_to, 'connected', id);
    } catch (e) {
      if (e instanceof GoogleError && e.kind === 'scopes') {
        // She unticked a calendar permission: don't keep a grant we can't use.
        const t = (e as GoogleError & { refresh?: string | null; access?: string | null });
        if (t.refresh || t.access) await revokeToken(deps.google, deps.fetch, (t.refresh ?? t.access)!);
        return back(to, s.return_to, 'permissions');
      }
      if (e instanceof GoogleError && e.kind === 'invalid_grant') return back(to, s.return_to, 'expired');
      return back(to, s.return_to, 'error');
    }
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    // Whatever goes wrong on Google's redirect (database or network down), she lands back in the app with a plain
    // message, never on an error page; nothing about the failure is put in the URL.
    if (req.method === 'GET' && url.pathname.endsWith('/callback')) return callback(url).catch(() => back(deps.returnOrigins[0], 'web', 'error'));
    if (req.method !== 'POST') return json(405, { error: 'method' });

    let body: { action?: string; account_id?: string; return?: string; origin?: string; code?: string; state?: string; error?: string } = {};
    try { body = await req.json(); } catch { /* empty */ }
    // The relay page on our own domain hands Google's redirect over (no sign-in: the state binds it to her).
    if (body.action === 'callback') {
      const q = new URL('https://relay.invalid/');
      for (const k of ['code', 'state', 'error'] as const) if (typeof body[k] === 'string' && body[k]!.length <= 2048) q.searchParams.set(k, body[k]!);
      const r = await callback(q).catch(() => back(deps.returnOrigins[0], 'web', 'error'));
      return json(200, { location: r.headers.get('location') });
    }
    const u = await user(req).catch(() => null);
    if (!u) return json(401, { error: 'not_signed_in' });

    try {
      return await act(body, u);
    } catch {
      return json(500, { error: 'unavailable' });
    }
  };

  async function act(body: { action?: string; account_id?: string; return?: string; origin?: string }, u: { id: string }): Promise<Response> {
    if (!deps.google) return json(503, { error: 'not_configured' });
    if (body.action === 'start') {
      const state = randomToken(32);
      const verifier = randomToken(48);
      try {
        await deps.db.rpc('calendar_google_state_save', {
          p_state_hash: await sha256Hex(state), p_user: u.id, p_verifier: verifier,
          p_return_to: body.return === 'app' ? 'app' : 'web', p_origin: origin(body.origin),
        });
      } catch (e) {
        const m = (e as Error).message;
        return json(m === 'not_enabled' ? 403 : m === 'too_many' ? 429 : 400, { error: /^[a-z_]+$/.test(m) ? m : 'invalid' });
      }
      return json(200, { url: await authorizeUrl(deps.google, state, verifier) });
    }

    if (body.action === 'calendars' || body.action === 'disconnect') {
      if (!body.account_id || !UUID.test(body.account_id)) return json(400, { error: 'invalid' });
      const acc = await deps.db.rpc<{ id: string; refresh_token: string; status: string; imported: { google_calendar_id: string; feed_id: string; visibility: string; member_id: string | null; name: string }[] } | null>(
        'calendar_google_account_token', { p_account: body.account_id, p_owner: u.id });
      if (!acc) return json(404, { error: 'not_found' });

      if (body.action === 'disconnect') {
        const revoked = await revokeToken(deps.google, deps.fetch, acc.refresh_token);
        await deps.db.rpc('calendar_google_forget', { p_account: acc.id, p_owner: u.id });
        return json(200, { ok: true, revoked });
      }

      try {
        const { accessToken } = await refreshAccessToken(deps.google, deps.fetch, acc.refresh_token);
        const cals = await listCalendars(deps.google, deps.fetch, accessToken);
        const imported = new Map(acc.imported.map((i) => [i.google_calendar_id, i]));
        return json(200, {
          calendars: cals.map((c) => {
            const i = imported.get(c.id);
            return { ...c, imported: Boolean(i), feed_id: i?.feed_id ?? null, visibility: i?.visibility ?? 'private', member_id: i?.member_id ?? null };
          }),
          // Imported calendars no longer in her Google list (deleted, or unshared from her).
          missing: acc.imported.filter((i) => !cals.some((c) => c.id === i.google_calendar_id)).map((i) => ({ id: i.google_calendar_id, name: i.name, feed_id: i.feed_id })),
        });
      } catch (e) {
        if (e instanceof GoogleError && e.kind === 'invalid_grant') {
          await deps.db.rpc('calendar_google_account_status', { p_account: acc.id, p_status: 'reconnect', p_error: 'Google stopped accepting this connection. Reconnect it to keep your calendars up to date.' });
          return json(409, { error: 'reconnect' });
        }
        return json(502, { error: e instanceof GoogleError && e.kind === 'rate_limited' ? 'busy' : 'unavailable' });
      }
    }
    return json(400, { error: 'invalid' });
  }
}
