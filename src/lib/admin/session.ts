/**
 * /admin sign-in: Supabase Auth password, then an authenticator-app code (TOTP). Every admin read and
 * action needs the MFA-verified (aal2) session this produces; the database and the Edge Functions
 * enforce that, this file only gets the session. One session per browser tab (sessionStorage), signed
 * out after ADMIN_IDLE_MS without activity. Plan: docs/operations/ADMIN_DASHBOARD_PLAN.md.
 */
import { ADMIN_IDLE_MS } from '../../data/admin';

const URL_ = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';
export const adminConfigured = () => Boolean(URL_ && KEY);

const SESSION_KEY = 'omc:v1:admin';
const ACTIVE_KEY = 'omc:v1:admin:active';
/** The order and survey dashboards' old per-page sessions: cleared on sign-out. */
const LEGACY_KEYS = ['omc:v1:shop-admin', 'omc:v1:survey-admin'];

export type Aal = 'aal1' | 'aal2';

export interface AdminSession {
  access_token: string;
  refresh_token: string;
  /** ms since epoch */
  expires_at: number;
  email: string;
  aal: Aal;
}

export interface Factor {
  id: string;
  factor_type: string;
  status: 'verified' | 'unverified';
  friendly_name?: string;
}

export interface Enrollment {
  id: string;
  /** SVG data URI from Supabase */
  qr: string;
  /** For typing into the app by hand */
  secret: string;
}

type Fetch = typeof fetch;

/** The `aal` claim of an access token (display only: the server checks the verified token). */
export function tokenClaims(token: string): { aal: Aal; sub?: string; exp?: number } {
  try {
    const part = token.split('.')[1] ?? '';
    const p = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')));
    return { aal: p.aal === 'aal2' ? 'aal2' : 'aal1', sub: p.sub, exp: p.exp };
  } catch {
    return { aal: 'aal1' };
  }
}

const AUTH_ERRORS: Record<number, string> = {
  400: 'That email and password didn’t match.',
  422: 'That email and password didn’t match.',
  429: 'Too many attempts. Wait a few minutes and try again.',
};

function toSession(data: { access_token: string; refresh_token: string; expires_in: number; user?: { email?: string } }, email: string): AdminSession {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    email: data.user?.email ?? email,
    aal: tokenClaims(data.access_token).aal,
  };
}

export function createAdminAuth(f: Fetch = (...a) => fetch(...a), base = URL_, key = KEY) {
  const call = async (path: string, init: RequestInit & { token?: string } = {}) => {
    const { token, ...rest } = init;
    return f(`${base}/auth/v1${path}`, {
      ...rest,
      headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  };
  const fail = async (res: Response, fallback: string): Promise<never> => {
    const body = (await res.json().catch(() => ({}))) as { msg?: string; error_description?: string; message?: string };
    if (AUTH_ERRORS[res.status] && fallback === 'signin') throw new Error(AUTH_ERRORS[res.status]);
    if (res.status === 429) throw new Error(AUTH_ERRORS[429]);
    throw new Error(body.msg ?? body.error_description ?? body.message ?? `${fallback} failed (${res.status}).`);
  };

  return {
    async signIn(email: string, password: string): Promise<AdminSession> {
      const res = await call('/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (!res.ok) return fail(res, 'signin');
      return toSession(await res.json(), email);
    },

    async refresh(s: AdminSession): Promise<AdminSession> {
      const res = await call('/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }) });
      if (!res.ok) return fail(res, 'Refresh');
      return toSession(await res.json(), s.email);
    },

    async factors(s: AdminSession): Promise<Factor[]> {
      const res = await call('/user', { token: s.access_token });
      if (!res.ok) return fail(res, 'Loading your account');
      const user = (await res.json()) as { factors?: Factor[] };
      return (user.factors ?? []).filter((x) => x.factor_type === 'totp');
    },

    /** Starts adding an authenticator app. Leftover unfinished attempts are removed first. */
    async enroll(s: AdminSession, existing: Factor[]): Promise<Enrollment> {
      for (const x of existing.filter((x) => x.status === 'unverified')) {
        await call(`/factors/${x.id}`, { method: 'DELETE', token: s.access_token });
      }
      const res = await call('/factors', {
        method: 'POST',
        token: s.access_token,
        body: JSON.stringify({ factor_type: 'totp', friendly_name: `Admin ${new Date().toISOString().slice(0, 10)}`, issuer: 'Organized Mom Collective' }),
      });
      if (!res.ok) return fail(res, 'Adding the authenticator');
      const d = (await res.json()) as { id: string; totp: { qr_code: string; secret: string } };
      return { id: d.id, qr: qrSrc(d.totp.qr_code), secret: d.totp.secret };
    },

    /** Checks a 6-digit code and returns the upgraded (aal2) session. */
    async verify(s: AdminSession, factorId: string, code: string): Promise<AdminSession> {
      const ch = await call(`/factors/${factorId}/challenge`, { method: 'POST', token: s.access_token, body: '{}' });
      if (!ch.ok) return fail(ch, 'Starting the check');
      const { id } = (await ch.json()) as { id: string };
      const res = await call(`/factors/${factorId}/verify`, {
        method: 'POST',
        token: s.access_token,
        body: JSON.stringify({ challenge_id: id, code }),
      });
      if (res.status === 400 || res.status === 422) throw new Error('That code didn’t work. Check the time on your phone and use the newest code.');
      if (!res.ok) return fail(res, 'Checking the code');
      return toSession(await res.json(), s.email);
    },

    async signOut(s: AdminSession | null) {
      if (s) await call('/logout', { method: 'POST', token: s.access_token }).catch(() => undefined);
    },
  };
}

/**
 * Supabase returns the QR code as `data:image/svg+xml;utf-8,<svg …>` with the SVG unescaped. Its
 * `#000000` colors end the URL at the `#`, so the image breaks. Re-encode the SVG part.
 */
export function qrSrc(raw: string): string {
  const m = raw.match(/^data:image\/svg\+xml(;[^,]*)?,([\s\S]*)$/);
  if (!m || /;base64$/i.test(m[1] ?? '')) return raw;
  let svg = m[2];
  try {
    if (/%[0-9a-f]{2}/i.test(svg)) svg = decodeURIComponent(svg);
  } catch {
    /* not encoded after all */
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Valid 6-digit authenticator code (spaces allowed while typing). */
export const cleanCode = (v: string) => v.replace(/\s+/g, '');
export const isCode = (v: string) => /^\d{6}$/.test(cleanCode(v));

// ------------------------------------------------------------------ this tab's session

export function loadSession(now = Date.now(), store: Storage | undefined = globalThis.sessionStorage): AdminSession | null {
  try {
    const s = JSON.parse(store?.getItem(SESSION_KEY) ?? 'null') as AdminSession | null;
    const active = Number(store?.getItem(ACTIVE_KEY) ?? 0);
    if (!s || !s.refresh_token) return null;
    if (idleExpired(active, now)) {
      clearSession(store);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: AdminSession, store: Storage | undefined = globalThis.sessionStorage) {
  try {
    store?.setItem(SESSION_KEY, JSON.stringify(s));
    store?.setItem(ACTIVE_KEY, String(Date.now()));
  } catch {
    /* this page only */
  }
}

export function clearSession(store: Storage | undefined = globalThis.sessionStorage) {
  try {
    for (const k of [SESSION_KEY, ACTIVE_KEY, ...LEGACY_KEYS]) store?.removeItem(k);
  } catch {
    /* nothing saved */
  }
}

export function markActive(store: Storage | undefined = globalThis.sessionStorage, now = Date.now()) {
  try {
    store?.setItem(ACTIVE_KEY, String(now));
  } catch {
    /* fine */
  }
}

export const idleExpired = (lastActive: number, now = Date.now()) => !lastActive || now - lastActive > ADMIN_IDLE_MS;

/** Refresh when the access token has under five minutes left. */
export const needsRefresh = (s: AdminSession, now = Date.now()) => s.expires_at - now < 5 * 60 * 1000;

// ------------------------------------------------------------------ database calls with the session

/** Calls a SQL function as the signed-in admin. */
export async function adminRpc<T>(s: AdminSession, name: string, body: object = {}, f: Fetch = (...a) => fetch(...a)): Promise<T> {
  const res = await f(`${URL_}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error('expired');
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    const err = new Error(e.message ?? `${name} failed (${res.status})`) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = e.code;
    throw err;
  }
  // Functions returning void answer 204 with no body.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Reads a table or view through row-level security as the signed-in admin. */
export async function adminSelect<T>(s: AdminSession, table: string, query: string, f: Fetch = (...a) => fetch(...a)): Promise<T[]> {
  const res = await f(`${URL_}/rest/v1/${table}?${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}` },
  });
  if (res.status === 401) throw new Error('expired');
  if (!res.ok) throw new Error(`Couldn’t load ${table} (${res.status}).`);
  return (await res.json()) as T[];
}

/** Records an admin action. Never blocks the action it describes. */
export function auditLog(s: AdminSession, action: string, target?: string, detail: Record<string, unknown> = {}) {
  return adminRpc(s, 'admin_log', { p_action: action, p_target: target ?? null, p_detail: detail }).catch(() => undefined);
}
