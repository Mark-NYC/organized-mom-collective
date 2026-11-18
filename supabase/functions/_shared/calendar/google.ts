/**
 * Google Calendar, read-only (docs/ios/CALENDAR_INTEGRATION.md): OAuth 2.0 authorization-code flow with PKCE, run
 * entirely on the server (Edge Function). Scopes: calendar.calendarlist.readonly + calendar.events.readonly (read only;
 * nothing is ever written to her Google calendars) and openid email (to name the connection "jen@gmail.com").
 *
 * Events are listed with singleEvents=true, so Google expands repeats, moved occurrences and cancellations itself, in
 * the calendar's own time zone; each occurrence has a stable id. Pure helpers here; HTTP in ../handlers/calendar.ts.
 */
import { addDays } from './dates.ts';
import { clip, LIMITS, safeLink, type ImportedInstance } from './types.ts';

export const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_API = 'https://www.googleapis.com/calendar/v3';
export const GOOGLE_SCOPES = [
  'openid', 'email',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

export function authUrl(o: { clientId: string; redirectUri: string; state: string; challenge: string; loginHint?: string | null }): string {
  const q = new URLSearchParams({
    client_id: o.clientId, redirect_uri: o.redirectUri, response_type: 'code', scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false', state: o.state,
    code_challenge: o.challenge, code_challenge_method: 'S256',
  });
  if (o.loginHint) q.set('login_hint', o.loginHint);
  return `${GOOGLE_AUTH}?${q}`;
}

/** The email in an id_token received straight from Google's token endpoint over TLS (OIDC: no signature check needed). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const part = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const body = JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4))) as { email?: string; email_verified?: boolean };
    return typeof body.email === 'string' ? body.email.toLowerCase().slice(0, 254) : null;
  } catch {
    return null;
  }
}

export interface GoogleCalendarEntry {
  id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean;
  accessRole?: string; deleted?: boolean; hidden?: boolean; timeZone?: string;
}
export interface SourceEntry { external_id: string; name: string; color: string | null; primary: boolean; timezone: string | null }

/** Her calendar list as sources (hidden and deleted ones left out; the primary first). */
export function sourcesFromList(items: GoogleCalendarEntry[]): SourceEntry[] {
  return items
    .filter((c) => c.id && !c.deleted)
    .map((c) => ({
      external_id: c.id.slice(0, 500),
      name: clip(c.summaryOverride || c.summary || c.id, 120)!,
      color: /^#[0-9a-f]{6}$/i.test(c.backgroundColor ?? '') ? c.backgroundColor!.toLowerCase() : null,
      primary: Boolean(c.primary),
      timezone: c.timeZone ?? null,
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
}

export interface GoogleEvent {
  id: string; status?: string; summary?: string; location?: string; description?: string; htmlLink?: string;
  iCalUID?: string; recurringEventId?: string; visibility?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
}

/** One occurrence from events.list(singleEvents=true), or null for cancelled / unusable ones. */
export function fromGoogle(ev: GoogleEvent, calendarZone: string | null): ImportedInstance | null {
  if (!ev.id || ev.status === 'cancelled' || !ev.start) return null;
  const base = {
    instance_key: ev.id.slice(0, 600), uid: (ev.iCalUID ?? ev.id).slice(0, 500),
    title: clip(ev.summary, LIMITS.title) ?? '(No title)', location: clip(ev.location, LIMITS.location),
    notes: clip(ev.description?.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' '), LIMITS.notes),
    url: safeLink(ev.htmlLink), recurring: Boolean(ev.recurringEventId),
    private: ev.visibility === 'private' || ev.visibility === 'confidential',
  };
  if (ev.start.date && /^\d{4}-\d{2}-\d{2}$/.test(ev.start.date)) {
    const endEx = ev.end?.date && ev.end.date > ev.start.date ? ev.end.date : addDays(ev.start.date, 1);
    return { ...base, all_day: true, start_date: ev.start.date, end_date: addDays(endEx, -1), starts_at: null, ends_at: null, timezone: null };
  }
  const s = Date.parse(ev.start.dateTime ?? '');
  if (!Number.isFinite(s)) return null;
  const e = Date.parse(ev.end?.dateTime ?? '');
  return {
    ...base, all_day: false, start_date: null, end_date: null,
    starts_at: new Date(s).toISOString(), ends_at: Number.isFinite(e) && e > s ? new Date(e).toISOString() : null,
    timezone: ev.start.timeZone ?? calendarZone,
  };
}

/** What a Google error means for the connection. */
export function googleTrouble(status: number, body: { error?: string | { status?: string; message?: string } } | null): 'reauth' | 'gone' | 'retry' {
  const code = typeof body?.error === 'string' ? body.error : body?.error?.status;
  if (status === 400 && code === 'invalid_grant') return 'reauth'; // revoked, password change, 6-month idle, testing-mode 7-day expiry
  if (status === 401) return 'reauth';
  if (status === 403 && /insufficient|PERMISSION_DENIED/i.test(String(code ?? ''))) return 'reauth';
  if (status === 404 || status === 410) return 'gone';
  return 'retry';
}
