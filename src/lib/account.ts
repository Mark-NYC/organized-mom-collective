import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config';
/**
 * Customer accounts, step 1 (supabase/ACCOUNTS.md): sign in with a 6-digit emailed code, keep what
 * she makes in the browser in sync with her account, list what she bought.
 *
 * - Auth: Supabase Auth email OTP over plain fetch (no SDK), like the admin sign-in. The session
 *   stays in this browser (localStorage) until she signs out; the access token refreshes itself.
 * - Saves: every tool and article element already writes to localStorage under an `omc:` key.
 *   installStorageHook() notices those writes, so no component needs to know about accounts. Sync
 *   needs no clocks: each key remembers the server time of the copy it last matched (`at`) and
 *   whether it changed since (`dirty`). See reconcile().
 * - Not synced: the cleaning companion's own progress (omc:v1:*, step 2), this file's own keys,
 *   the download-gate flag, and anything under omc:club… (the Club has its own tables). The database refuses
 *   the same keys.
 * Off unless PUBLIC_ACCOUNTS_ENABLED is 'true'.
 */

const URL_ = SUPABASE_URL;
const KEY = SUPABASE_ANON_KEY;
export const accountsEnabled = () => import.meta.env.PUBLIC_ACCOUNTS_ENABLED === 'true' && Boolean(URL_ && KEY);

const SESSION_KEY = 'omc:account:session';
const SYNC_KEY = 'omc:account:sync';
const NUDGE_KEY = 'omc:account:nudge';
export const CHANGED_EVENT = 'omc:account:changed';

export interface AccountSession {
  access_token: string;
  refresh_token: string;
  /** ms since epoch */
  expires_at: number;
  email: string;
  user_id: string;
}

export interface SyncMeta {
  /** Server updated_at of the copy this browser last matched. */
  at?: string;
  /** Changed here since `at`. */
  dirty?: boolean;
  page?: string;
  label?: string;
}

export interface ServerSave {
  key: string;
  data: { raw?: string } | null;
  page: string | null;
  label: string | null;
  updated_at: string;
}

// ------------------------------------------------------------------ pure helpers (tested)

/** Same rule as account_saves.key in the database. */
export function syncableKey(key: string): boolean {
  return (
    key.length <= 120 &&
    /^omc:[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*)*$/.test(key) &&
    // Club data lives in its own tables (supabase/migrations/20261023000000_club_core.sql), never in saves.
    !/^omc:(v1|account|tool-download-access|club[a-z0-9._-]*)(:|$)/.test(key)
  );
}

/** Only an on-site path may be a sign-in's `next`. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.length > 200) return null;
  return /^\/[A-Za-z0-9/_.-]*$/.test(next) ? next : null;
}

/** "omc:organized-family-habits-builder:v1" → "Organized family habits builder", when no page label was recorded. */
export function labelFromKey(key: string): string {
  const name = key.replace(/^omc:/, '').replace(/:v\d+$/, '').replace(/[:._-]+/g, ' ').trim();
  return name ? name[0].toUpperCase() + name.slice(1) : key;
}

/**
 * What to download and what to upload. No clocks are compared, only server stamps:
 * - On the server, not here → pull.
 * - Here and on the server, never synced on this browser → pull (the account copy wins on a new device).
 * - Changed here since the last sync → push.
 * - Unchanged here, changed on the server → pull.
 * - Here, not on the server: never synced or changed since → push; synced and unchanged → she removed
 *   it from her account, so leave it (it uploads again only if she changes it).
 */
export function reconcile(local: Record<string, SyncMeta | undefined>, localKeys: string[], server: Pick<ServerSave, 'key' | 'updated_at'>[]) {
  const pull: string[] = [];
  const push: string[] = [];
  const have = new Set(localKeys);
  const onServer = new Set(server.map((s) => s.key));
  for (const s of server) {
    const m = local[s.key];
    if (!have.has(s.key) || !m?.at) pull.push(s.key);
    else if (m.dirty) push.push(s.key);
    else if (m.at !== s.updated_at) pull.push(s.key);
  }
  for (const key of localKeys) {
    if (onServer.has(key)) continue;
    const m = local[key];
    if (!m?.at || m.dirty) push.push(key);
  }
  return { pull, push };
}

// ------------------------------------------------------------------ storage

const ls = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};
const read = <T>(key: string, fallback: T): T => {
  try {
    return (JSON.parse(ls()?.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
};
// Writes by this file go through the original setItem, so the hook never sees them.
let rawSet: (key: string, value: string) => void = (k, v) => ls()?.setItem(k, v);
let rawRemove: (key: string) => void = (k) => ls()?.removeItem(k);
const write = (key: string, value: unknown) => {
  try {
    rawSet(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
};

export const loadSession = () => read<AccountSession | null>(SESSION_KEY, null);
const saveSession = (s: AccountSession | null) => {
  try {
    if (s) rawSet(SESSION_KEY, JSON.stringify(s));
    else rawRemove(SESSION_KEY);
  } catch {
    /* fine */
  }
};
const loadMeta = () => read<Record<string, SyncMeta>>(SYNC_KEY, {});
const saveMeta = (m: Record<string, SyncMeta>) => write(SYNC_KEY, m);

/** Every syncable key in this browser. */
export function localSyncKeys(): string[] {
  const store = ls();
  if (!store) return [];
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && syncableKey(k)) keys.push(k);
  }
  return keys;
}

// ------------------------------------------------------------------ Supabase Auth (email code)

type AuthResponse = { access_token: string; refresh_token: string; expires_in: number; user?: { id?: string; email?: string } };

async function auth(path: string, body: object, token?: string): Promise<Response> {
  return fetch(`${URL_}/auth/v1${path}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

const toSession = (d: AuthResponse, email: string): AccountSession => ({
  access_token: d.access_token,
  refresh_token: d.refresh_token,
  expires_at: Date.now() + d.expires_in * 1000,
  email: (d.user?.email ?? email).toLowerCase(),
  user_id: d.user?.id ?? '',
});

export type CodeResult = 'sent' | 'invalid' | 'rate_limited' | 'error';

/** Emails her a 6-digit code (creates the sign-in on first use). */
export async function requestCode(email: string): Promise<CodeResult> {
  const clean = email.trim().toLowerCase();
  if (clean.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return 'invalid';
  try {
    const res = await auth('/otp', { email: clean, create_user: true });
    if (res.ok) return 'sent';
    return res.status === 429 ? 'rate_limited' : res.status === 400 || res.status === 422 ? 'invalid' : 'error';
  } catch {
    return 'error';
  }
}

export type VerifyResult = { ok: true; session: AccountSession } | { ok: false; error: 'wrong_code' | 'rate_limited' | 'error' };

export async function verifyCode(email: string, code: string): Promise<VerifyResult> {
  const clean = email.trim().toLowerCase();
  const token = code.replace(/\D/g, '');
  if (token.length < 6) return { ok: false, error: 'wrong_code' };
  try {
    const res = await auth('/verify', { type: 'email', email: clean, token });
    if (!res.ok) return { ok: false, error: res.status === 429 ? 'rate_limited' : res.status >= 500 ? 'error' : 'wrong_code' };
    const session = toSession((await res.json()) as AuthResponse, clean);
    saveSession(session);
    return { ok: true, session };
  } catch {
    return { ok: false, error: 'error' };
  }
}

/** The current session, refreshed when under five minutes are left. Null when signed out or revoked. */
export async function getSession(): Promise<AccountSession | null> {
  const s = loadSession();
  if (!s?.refresh_token) return null;
  if (s.expires_at - Date.now() > 5 * 60 * 1000) return s;
  try {
    const res = await auth('/token?grant_type=refresh_token', { refresh_token: s.refresh_token });
    if (res.status >= 400 && res.status < 500) {
      saveSession(null);
      return null;
    }
    if (!res.ok) return s.expires_at > Date.now() ? s : null;
    const next = toSession((await res.json()) as AuthResponse, s.email);
    saveSession({ ...next, user_id: next.user_id || s.user_id });
    return loadSession();
  } catch {
    return s.expires_at > Date.now() ? s : null;
  }
}

/** Signs out everywhere this session reached and forgets sync state; what's on this device stays. */
export async function signOut() {
  const s = loadSession();
  if (s) await auth('/logout', {}, s.access_token).catch(() => undefined);
  saveSession(null);
  try {
    rawRemove(SYNC_KEY);
  } catch {
    /* fine */
  }
}

// ------------------------------------------------------------------ database calls as her

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const s = await getSession();
  if (!s) throw new Error('signed_out');
  const res = await fetch(`${URL_}/rest/v1${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 401) throw new Error('signed_out');
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(e.message ?? `request_failed_${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
const rpc = <T>(name: string, body: object = {}) => api<T>(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
/** A database function called as the signed-in customer (the Club's store, src/lib/club/store.ts). */
export const accountRpc = rpc;

export interface AccountProfile {
  email: string | null;
  marketing: boolean;
  saves: number;
}
export interface AccountOrder {
  id: string;
  order_number: number;
  paid_at: string | null;
  digital: boolean;
  payment_status: 'paid' | 'partially_refunded' | 'refunded';
  fulfillment_status: 'unfulfilled' | 'packing' | 'shipped' | 'delivered' | 'canceled';
  carrier: string | null;
  tracking_url: string | null;
  total_cents: number | null;
  currency: string;
  test: boolean;
  files: boolean;
  items: { name: string; slug: string; quantity: number }[];
}

export const loadProfile = () => rpc<AccountProfile>('account_profile');
export const loadOrders = () => rpc<AccountOrder[]>('account_orders');
export const setMarketing = (on: boolean) => rpc<null>('account_set_marketing', { p_on: on });
export const listSaves = () => api<ServerSave[]>('/account_saves?select=key,data,page,label,updated_at&order=updated_at.desc');

export async function removeSave(key: string) {
  await api<null>(`/account_saves?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE' });
  const meta = loadMeta();
  if (meta[key]) {
    delete meta[key].at;
    meta[key].dirty = false;
    saveMeta(meta);
  }
}

export async function deleteAccount() {
  await rpc<null>('account_delete');
  saveSession(null);
  try {
    rawRemove(SYNC_KEY);
  } catch {
    /* fine */
  }
}

/** Signed links to a digital order's files, through the shop-download Edge Function. */
export async function accountDownload(orderId: string): Promise<{ files: { label: string; product: string; url: string | null }[] } | { error: string }> {
  const s = await getSession();
  if (!s) return { error: 'signed_out' };
  try {
    const res = await fetch(`${URL_}/functions/v1/shop-download`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: orderId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.files)) return data;
    return { error: typeof data.error === 'string' ? data.error : 'unavailable' };
  } catch {
    return { error: 'unavailable' };
  }
}

// ------------------------------------------------------------------ sync

/** Records a change to a syncable key, and uploads it soon if she's signed in. */
export function markChanged(key: string) {
  if (!syncableKey(key)) return;
  const meta = loadMeta();
  const h1 = globalThis.document?.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
  meta[key] = { ...meta[key], dirty: true, page: globalThis.location?.pathname ?? meta[key]?.page, label: (h1 || meta[key]?.label || '').slice(0, 160) || undefined };
  saveMeta(meta);
  globalThis.dispatchEvent?.(new CustomEvent(CHANGED_EVENT, { detail: { key } }));
  schedulePush();
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePush() {
  if (!loadSession()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void sync().catch(() => undefined), 1500);
}

let running: Promise<SyncResult> | undefined;
export interface SyncResult {
  pulled: string[];
  pushed: string[];
  failed: string[];
}

/** Brings this browser and her account into line. Returns which keys changed in each direction. */
export function sync(): Promise<SyncResult> {
  running ??= doSync().finally(() => (running = undefined));
  return running;
}

async function doSync(): Promise<SyncResult> {
  const result: SyncResult = { pulled: [], pushed: [], failed: [] };
  if (!(await getSession())) return result;
  const server = await listSaves();
  const meta = loadMeta();
  const keys = localSyncKeys();
  const { pull, push } = reconcile(meta, keys, server);
  const byKey = new Map(server.map((s) => [s.key, s]));

  for (const key of pull) {
    const s = byKey.get(key)!;
    if (typeof s.data?.raw === 'string') {
      try {
        rawSet(key, s.data.raw);
      } catch {
        result.failed.push(key);
        continue;
      }
    }
    meta[key] = { at: s.updated_at, dirty: false, page: s.page ?? meta[key]?.page, label: s.label ?? meta[key]?.label };
    result.pulled.push(key);
  }
  for (const key of push) {
    const raw = ls()?.getItem(key);
    const m = meta[key] ?? {};
    try {
      if (raw == null) {
        await removeSave(key);
        meta[key] = { ...m, at: undefined, dirty: false };
      } else {
        const at = await rpc<string>('account_put', { p_key: key, p_data: { raw }, p_page: m.page ?? null, p_label: m.label ?? labelFromKey(key) });
        meta[key] = { ...m, at, dirty: false };
      }
      result.pushed.push(key);
    } catch {
      result.failed.push(key);
    }
  }
  saveMeta(meta);
  return result;
}

/**
 * Watches this page's localStorage writes so every tool and element syncs without changes of its own.
 * Installed once per page, only when accounts are on.
 */
export function installStorageHook() {
  const proto = globalThis.Storage?.prototype as (Storage & { __omcAccount?: boolean }) | undefined;
  const store = ls();
  if (!proto || !store || proto.__omcAccount) return;
  const set = proto.setItem;
  const remove = proto.removeItem;
  rawSet = (k, v) => set.call(store, k, v);
  rawRemove = (k) => remove.call(store, k);
  proto.setItem = function (this: Storage, k: string, v: string) {
    const before = this === store && syncableKey(k) ? this.getItem(k) : null;
    set.call(this, k, v);
    if (this === store && syncableKey(k) && before !== String(v)) markChanged(k);
  };
  proto.removeItem = function (this: Storage, k: string) {
    const had = this === store && syncableKey(k) && this.getItem(k) !== null;
    remove.call(this, k);
    if (had) markChanged(k);
  };
  proto.__omcAccount = true;
}

// ------------------------------------------------------------------ the save prompt

/** Whether to offer "save it to your account" now: signed out and not dismissed in the last 14 days. */
export function shouldNudge(now = Date.now()): boolean {
  if (loadSession()) return false;
  const dismissed = read<number>(NUDGE_KEY, 0);
  return !dismissed || now - dismissed > 14 * 24 * 60 * 60 * 1000;
}
export const dismissNudge = (now = Date.now()) => write(NUDGE_KEY, now);
