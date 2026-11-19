/**
 * Google Calendar, read-only (docs/calendar/GOOGLE_CALENDAR.md): OAuth 2.0 authorization code flow with PKCE, token
 * refresh and revocation, the calendar list, and events turned into the same instances iCal links produce, so the
 * store, privacy rules and app views are shared.
 *
 * Scopes (the minimum for "pick calendars, see their events"; nothing can write, delete or share):
 *   calendar.calendarlist.readonly  the list of calendars (names, colors, time zones)
 *   calendar.events.readonly        events on those calendars, including ones shared with her
 *   openid email                    which Google account it is (to bind and to show "you@gmail.com")
 *
 * All Google endpoints are fixed hosts (no user-supplied URLs here). Tokens are passed in and out only between the
 * functions and the database (Vault); nothing here logs them.
 */
import type { IcsInstance } from './ics.ts';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];
const REQUIRED = GOOGLE_SCOPES.filter((s) => s.includes('calendar'));

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  revokeUrl?: string;
  apiBase?: string;
}
const ep = (c: GoogleConfig) => ({
  authorize: c.authorizeUrl ?? 'https://accounts.google.com/o/oauth2/v2/auth',
  token: c.tokenUrl ?? 'https://oauth2.googleapis.com/token',
  revoke: c.revokeUrl ?? 'https://oauth2.googleapis.com/revoke',
  api: c.apiBase ?? 'https://www.googleapis.com/calendar/v3',
});

/** Thrown for Google answers the callers turn into user-facing states. */
export type GoogleErrorKind = 'invalid_grant' | 'gone' | 'rate_limited' | 'unavailable' | 'scopes' | 'bad_response';
export class GoogleError extends Error {
  readonly kind: GoogleErrorKind;
  constructor(kind: GoogleErrorKind, message: string = kind) {
    super(message);
    this.kind = kind;
  }
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

/** Google's consent screen: account chooser, read-only scopes, a refresh token, one-time state, PKCE. */
export async function authorizeUrl(c: GoogleConfig, state: string, verifier: string): Promise<string> {
  const u = new URL(ep(c).authorize);
  u.search = new URLSearchParams({
    client_id: c.clientId, redirect_uri: c.redirectUri, response_type: 'code', scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'false', state,
    code_challenge: await pkceChallenge(verifier), code_challenge_method: 'S256',
  }).toString();
  return u.toString();
}

async function tokenCall(c: GoogleConfig, f: typeof fetch, body: Record<string, string>) {
  const res = await f(ep(c).token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
  let j: Record<string, unknown> = {};
  try { j = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) {
    if (j.error === 'invalid_grant' || j.error === 'unauthorized_client') throw new GoogleError('invalid_grant');
    if (res.status === 429) throw new GoogleError('rate_limited');
    throw new GoogleError('unavailable');
  }
  return j;
}

/** The id_token's claims. It comes straight from Google's token endpoint over TLS, so its signature needn't be checked
 *  (Google's OpenID Connect guide); its audience and issuer are. */
function idClaims(c: GoogleConfig, idToken: unknown): { sub: string; email: string | null } {
  if (typeof idToken !== 'string') throw new GoogleError('bad_response');
  const part = idToken.split('.')[1];
  if (!part) throw new GoogleError('bad_response');
  let claims: Record<string, unknown>;
  try { claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))); } catch { throw new GoogleError('bad_response'); }
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(c.clientId)) throw new GoogleError('bad_response', 'wrong_audience');
  if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') throw new GoogleError('bad_response', 'wrong_issuer');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new GoogleError('bad_response');
  return { sub: claims.sub, email: typeof claims.email === 'string' && claims.email_verified !== false ? claims.email : null };
}

/** Exchange the one-time code. Refuses (and the caller revokes) if she unticked a calendar permission. */
export async function exchangeCode(c: GoogleConfig, f: typeof fetch, code: string, verifier: string) {
  const j = await tokenCall(c, f, { code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: c.redirectUri, grant_type: 'authorization_code', code_verifier: verifier });
  const scopes = String(j.scope ?? '').split(/\s+/);
  const refresh = typeof j.refresh_token === 'string' ? j.refresh_token : null;
  const access = typeof j.access_token === 'string' ? j.access_token : null;
  if (!REQUIRED.every((s) => scopes.includes(s))) throw Object.assign(new GoogleError('scopes'), { refresh, access });
  if (!refresh) throw Object.assign(new GoogleError('bad_response', 'no_refresh_token'), { access });
  const who = idClaims(c, j.id_token);
  return { refreshToken: refresh, accessToken: access, scopes: scopes.join(' '), ...who };
}

export async function refreshAccessToken(c: GoogleConfig, f: typeof fetch, refreshToken: string): Promise<{ accessToken: string; refreshToken: string | null }> {
  const j = await tokenCall(c, f, { refresh_token: refreshToken, client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'refresh_token' });
  if (typeof j.access_token !== 'string') throw new GoogleError('bad_response');
  return { accessToken: j.access_token, refreshToken: typeof j.refresh_token === 'string' ? j.refresh_token : null };
}

/** Revoke at Google (Disconnect, or a connection refused for missing permissions). Best effort: true when Google
 *  confirmed or already didn't know the token. */
export async function revokeToken(c: GoogleConfig, f: typeof fetch, token: string): Promise<boolean> {
  try {
    const res = await f(ep(c).revoke, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }).toString() });
    return res.ok || res.status === 400; // 400 invalid_token: already revoked or expired
  } catch {
    return false;
  }
}

async function apiGet(c: GoogleConfig, f: typeof fetch, accessToken: string, path: string, params: Record<string, string>) {
  const u = new URL(`${ep(c).api}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await f(u.toString(), { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  if (res.status === 401) throw new GoogleError('invalid_grant');
  if (res.status === 404 || res.status === 410) throw new GoogleError('gone');
  if (res.status === 429) throw new GoogleError('rate_limited');
  if (res.status === 403) {
    let reason = '';
    try { reason = JSON.stringify(await res.json()); } catch { /* none */ }
    // Quota or rate: try later. Anything else 403 (no longer shared with her, API disabled): it's gone for her.
    throw new GoogleError(/rateLimit|usageLimit|quota/i.test(reason) ? 'rate_limited' : 'gone');
  }
  if (!res.ok) throw new GoogleError('unavailable');
  return res.json() as Promise<Record<string, unknown>>;
}

export interface GoogleCalendar { id: string; name: string; color: string | null; time_zone: string | null; primary: boolean; access_role: string }

/** Her calendar list (only calendars she can read events on). */
export async function listCalendars(c: GoogleConfig, f: typeof fetch, accessToken: string): Promise<GoogleCalendar[]> {
  const out: GoogleCalendar[] = [];
  let pageToken = '';
  for (let page = 0; page < 10; page++) {
    const j = await apiGet(c, f, accessToken, '/users/me/calendarList', { minAccessRole: 'reader', maxResults: '250', ...(pageToken ? { pageToken } : {}) });
    for (const it of (j.items as Record<string, unknown>[] | undefined) ?? []) {
      if (it.deleted || typeof it.id !== 'string') continue;
      out.push({
        id: it.id, name: String(it.summaryOverride ?? it.summary ?? it.id).slice(0, 80),
        color: typeof it.backgroundColor === 'string' ? it.backgroundColor : null,
        time_zone: typeof it.timeZone === 'string' ? it.timeZone : null, primary: it.primary === true, access_role: String(it.accessRole ?? 'reader'),
      });
    }
    pageToken = typeof j.nextPageToken === 'string' ? j.nextPageToken : '';
    if (!pageToken) break;
  }
  return out.sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
}

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const instant = (v: unknown) => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/** Google events (recurrences already expanded by Google: singleEvents=true) → the shared instance shape.
 *  The key is the iCal UID plus the occurrence's ORIGINAL start, exactly like iCal links, so the same event imported
 *  through Google and through an iCal link shows once, and a moved occurrence keeps its identity. */
export function toInstances(items: Record<string, unknown>[]): IcsInstance[] {
  const out: IcsInstance[] = [];
  const seen = new Set<string>();
  for (const e of items) {
    if (e.status === 'cancelled') continue;
    const start = (e.start ?? {}) as Record<string, string>;
    const end = (e.end ?? {}) as Record<string, string>;
    const orig = (e.originalStartTime ?? {}) as Record<string, string>;
    const uid = String(e.iCalUID ?? e.id ?? '').slice(0, 255);
    if (!uid) continue;
    const base = { uid, title: String(e.summary ?? '').trim().slice(0, 120) || 'Busy', location: typeof e.location === 'string' ? e.location.slice(0, 160) : null,
      status: (e.status === 'tentative' ? 'tentative' : 'confirmed') as IcsInstance['status'] };
    let inst: IcsInstance | null = null;
    if (start.date) {
      // All-day: Google's end date is exclusive; ours is inclusive.
      const last = end.date && end.date > start.date ? addDays(end.date, -1) : start.date;
      inst = { ...base, instance_key: orig.date ?? (orig.dateTime ? instant(orig.dateTime) : null) ?? start.date, all_day: true, starts_at: null, ends_at: null, start_date: start.date, end_date: last };
    } else {
      const s = instant(start.dateTime);
      const en = instant(end.dateTime) ?? s;
      if (!s || !en) continue;
      inst = { ...base, instance_key: (orig.dateTime ? instant(orig.dateTime) : null) ?? orig.date ?? s, all_day: false, starts_at: s, ends_at: en < s ? s : en, start_date: null, end_date: null };
    }
    const k = `${inst.uid} ${inst.instance_key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(inst);
    if (out.length >= 5000) break;
  }
  return out;
}

/** One calendar's events from a month ago to a year ahead, recurrences expanded, cancelled ones left out. */
export async function listEvents(c: GoogleConfig, f: typeof fetch, accessToken: string, calendarId: string, fromMs: number, toMs: number): Promise<IcsInstance[]> {
  const items: Record<string, unknown>[] = [];
  let pageToken = '';
  for (let page = 0; page < 4; page++) {
    const j = await apiGet(c, f, accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
      singleEvents: 'true', showDeleted: 'false', maxResults: '2500', timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(),
      fields: 'items(id,iCalUID,status,summary,location,start,end,originalStartTime,recurringEventId),nextPageToken',
      ...(pageToken ? { pageToken } : {}),
    });
    items.push(...((j.items as Record<string, unknown>[] | undefined) ?? []));
    pageToken = typeof j.nextPageToken === 'string' ? j.nextPageToken : '';
    if (!pageToken) break;
  }
  return toInstances(items);
}
