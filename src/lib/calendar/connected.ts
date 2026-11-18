/**
 * Connected calendars on the website and in the app (docs/ios/CALENDAR_INTEGRATION.md): Google Calendar and subscribed
 * links (school, sports), shown beside the family's own events. Read-only here: they change where they came from.
 *
 * - Reads: calendar_imported_feed / calendar_sources_list (RPCs; the database decides what each adult may see).
 * - Connecting, refreshing and removing: the calendar-connect Edge Function (secrets never reach the browser).
 * - Kept on this device under omc:calendar-connected:v1 for the signed-in adult only, so the week still shows with no
 *   signal; dropped when someone else signs in. Never synced into account_saves (src/lib/account.ts syncableKey).
 *
 * The pure parts (toDisplayEvents) are tested in tests/calendar-connected.test.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accountRpc, accountsEnabled, getSession } from '../account';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../supabase-config';
import { APP_RESUME_EVENT, isNativeApp } from '../native/platform';
import { addDays, localToday, type CalendarEvent } from './recurrence';

export interface ImportedRow {
  id: string;
  source_id: string;
  uid: string;
  title: string;
  location: string | null;
  notes: string | null;
  url: string | null;
  all_day: boolean;
  start_date: string | null;
  end_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  recurring: boolean;
  mine: boolean;
}
export interface MyCalendar {
  id: string; name: string; color: string | null; selected: boolean; shared: boolean; member_ids: string[];
  last_synced_at: string | null; sync_error: string | null;
}
export interface MyConnection {
  id: string; provider: 'google' | 'ical'; label: string; status: 'active' | 'reauth' | 'error'; last_error: string | null; calendars: MyCalendar[];
}
export interface SharedCalendar { id: string; name: string; provider: 'google' | 'ical'; member_ids: string[]; last_synced_at: string | null; stale: boolean }
export interface SourceList { mine: MyConnection[]; shared_with_me: SharedCalendar[] }

interface SourceInfo { name: string; provider: 'google' | 'ical'; member_ids: string[] }

const pad = (n: number) => String(n).padStart(2, '0');
/** An instant as a date and time on this device's clock (her phone is in her family's zone). */
export function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/**
 * Imported rows → read-only events the calendar, Today and the Family Meeting already know how to show. The same event
 * on two connected calendars (both adults invited, or a team calendar added twice) shows once: same UID and start.
 */
export function toDisplayEvents(rows: ImportedRow[], sources: Record<string, SourceInfo>): CalendarEvent[] {
  const byKey = new Map<string, CalendarEvent>();
  for (const r of rows) {
    const src = sources[r.source_id];
    if (!src) continue;
    let starts_on: string;
    let start_time: string | null = null;
    let end_time: string | null = null;
    let ends_on: string | null = null;
    if (r.all_day) {
      if (!r.start_date) continue;
      starts_on = r.start_date;
      ends_on = r.end_date && r.end_date > r.start_date ? r.end_date : null;
    } else {
      if (!r.starts_at) continue;
      const s = localParts(r.starts_at);
      starts_on = s.date;
      start_time = s.time;
      if (r.ends_at) {
        // A minute before the end, so something ending at midnight stays on its day.
        const last = localParts(new Date(Date.parse(r.ends_at) - 60_000).toISOString()).date;
        if (last > s.date) ends_on = last;
        else {
          const e = localParts(r.ends_at);
          end_time = e.date === s.date && e.time > s.time ? e.time : null;
        }
      }
    }
    const key = `${r.uid}|${r.starts_at ?? r.start_date}`;
    const seen = byKey.get(key);
    if (seen) {
      // Prefer her own copy (it has the "open in Google" link); remember the other calendar's name.
      if (!seen.external!.mine && r.mine) {
        byKey.set(key, { ...seen, id: `ext:${r.id}`, external: { ...seen.external!, sourceId: r.source_id, sourceName: src.name, provider: src.provider, url: r.url, mine: true, alsoOn: [...seen.external!.alsoOn, seen.external!.sourceName] }, member_ids: [...new Set([...seen.member_ids, ...src.member_ids])] });
      } else if (!seen.external!.alsoOn.includes(src.name) && seen.external!.sourceName !== src.name) {
        seen.external!.alsoOn.push(src.name);
        seen.member_ids = [...new Set([...seen.member_ids, ...src.member_ids])];
      }
      continue;
    }
    byKey.set(key, {
      id: `ext:${r.id}`, title: r.title, notes: r.notes, location: r.location, starts_on, start_time, end_time, ends_on,
      timezone: r.timezone ?? 'UTC', recurrence: null, skip_dates: [], member_ids: [...src.member_ids], owner_member_id: null,
      source: src.provider, revision: 0,
      external: { provider: src.provider, sourceId: r.source_id, sourceName: src.name, url: r.url, mine: r.mine, alsoOn: [] },
    });
  }
  return [...byKey.values()];
}

/** Calendar id → its name, kind and whose it is, from both lists. */
export function sourceIndex(list: SourceList | null): Record<string, SourceInfo> {
  const out: Record<string, SourceInfo> = {};
  for (const c of list?.mine ?? []) for (const cal of c.calendars) out[cal.id] = { name: cal.name, provider: c.provider, member_ids: cal.member_ids };
  for (const s of list?.shared_with_me ?? []) out[s.id] = { name: s.name, provider: s.provider, member_ids: s.member_ids };
  return out;
}

// ------------------------------------------------------------------ this device's copy

const KEY = 'omc:calendar-connected:v1';
interface Cache { user: string; rows: ImportedRow[]; sources: SourceList; at: string }
function readCache(): Cache | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Cache | null;
    return c && Array.isArray(c.rows) && c.sources ? c : null;
  } catch {
    return null;
  }
}
function writeCache(c: Cache | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch { /* private mode: this visit only */ }
}
/** The last copy on this device, for screens that read without React (the Family Meeting page). */
export function loadConnectedEvents(): CalendarEvent[] {
  const c = readCache();
  return c ? toDisplayEvents(c.rows, sourceIndex(c.sources)) : [];
}

// ------------------------------------------------------------------ the server

export type ConnectError =
  | 'not_signed_in' | 'google_unavailable' | 'unavailable' | 'invalid_url' | 'unsupported_url' | 'private_host'
  | 'unreachable' | 'not_a_calendar' | 'duplicate' | 'too_many' | 'reauth' | 'not_found' | 'failed';

async function fn<T>(body: Record<string, unknown>): Promise<T & { error?: ConnectError }> {
  const s = await getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/calendar-connect`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s.access_token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({ error: 'failed' }))) as T & { error?: ConnectError };
  if (res.status === 401) return { ...data, error: 'not_signed_in' };
  return data;
}

export const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch { return 'America/New_York'; } };

/** Open Google's consent page: in the app, an in-app Safari sheet (Google refuses sign-in inside app web views). */
export async function connectGoogle(): Promise<ConnectError | null> {
  const native = isNativeApp();
  const r = await fn<{ url?: string }>({ action: 'google_start', return_to: native ? 'app' : 'web' });
  if (r.error || !r.url) return r.error ?? 'failed';
  if (native) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: r.url, presentationStyle: 'popover' });
      return null;
    } catch { /* fall through to the page itself */ }
  }
  location.assign(r.url);
  return null;
}

// ------------------------------------------------------------------ the hook

export type ConnectedStatus = 'off' | 'loading' | 'ready' | 'offline';
export interface ConnectedHook {
  status: ConnectedStatus;
  events: CalendarEvent[];
  sources: SourceList | null;
  /** Google can be connected here (the function has its OAuth client). */
  googleReady: boolean;
  refresh(): Promise<void>;
  subscribe(url: string, name?: string): Promise<ConnectError | null>;
  update(id: string, change: { selected?: boolean; shared?: boolean; member_ids?: string[] }): Promise<ConnectError | null>;
  disconnect(connectionId: string): Promise<ConnectError | null>;
  connectGoogle(): Promise<ConnectError | null>;
  relistGoogle(connectionId: string): Promise<ConnectError | null>;
}

export function useConnected(enabled: boolean): ConnectedHook {
  // Only for a signed-in adult on a site with accounts (never in the demo); load() checks it's still hers.
  const cached = useRef(enabled && accountsEnabled() ? readCache() : null);
  const [rows, setRows] = useState<ImportedRow[]>(() => cached.current?.rows ?? []);
  const [sources, setSources] = useState<SourceList | null>(() => cached.current?.sources ?? null);
  const [status, setStatus] = useState<ConnectedStatus>('off');
  const [googleReady, setGoogleReady] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (!enabled || busy.current || !accountsEnabled()) return;
    const s = await getSession();
    if (!s) {
      writeCache(null);
      setRows([]); setSources(null); setStatus('off');
      return;
    }
    // Someone else's copy on this device is never shown.
    if (cached.current && cached.current.user !== s.user_id) { writeCache(null); cached.current = null; setRows([]); setSources(null); }
    busy.current = true;
    setStatus((st) => (st === 'off' ? 'loading' : st));
    try {
      const today = localToday();
      const [list, feed] = await Promise.all([
        accountRpc<SourceList>('calendar_sources_list'),
        accountRpc<{ events: ImportedRow[] }>('calendar_imported_feed', { p_from: addDays(today, -35), p_to: addDays(today, 190) }),
      ]);
      setSources(list); setRows(feed.events);
      cached.current = { user: s.user_id, rows: feed.events, sources: list, at: new Date().toISOString() };
      writeCache(cached.current);
      setStatus('ready');
    } catch {
      setStatus('offline');
    } finally {
      busy.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    fn<{ google?: boolean }>({ action: 'status' }).then((r) => setGoogleReady(Boolean(r.google))).catch(() => setGoogleReady(false));
    const again = () => { if (document.visibilityState === 'visible') void load(); };
    // Back from Google's consent sheet in the app: pick up the new calendars.
    let off: (() => void) | undefined;
    if (isNativeApp()) {
      import('@capacitor/browser').then(({ Browser }) => Browser.addListener('browserFinished', () => void load()))
        .then((h) => { off = () => void h.remove(); }).catch(() => undefined);
    }
    window.addEventListener(APP_RESUME_EVENT, again);
    document.addEventListener('visibilitychange', again);
    const t = window.setInterval(again, 5 * 60_000);
    return () => {
      window.removeEventListener(APP_RESUME_EVENT, again);
      document.removeEventListener('visibilitychange', again);
      window.clearInterval(t);
      off?.();
    };
  }, [enabled, load]);

  const events = useMemo(() => toDisplayEvents(rows, sourceIndex(sources)), [rows, sources]);
  const after = async (r: { error?: ConnectError } | null) => { await load(); return r?.error ?? null; };
  return {
    status, sources, googleReady,
    events,
    refresh: async () => { await fn({ action: 'refresh' }).catch(() => null); await load(); },
    subscribe: async (url, name) => after(await fn({ action: 'ical_subscribe', url, name, zone: zone() }).catch(() => ({ error: 'failed' as const }))),
    update: async (id, c) => {
      try {
        await accountRpc('calendar_source_update', { p_id: id, p_selected: c.selected ?? null, p_shared: c.shared ?? null, p_member_ids: c.member_ids ?? null });
        return await after(null);
      } catch (e) {
        return (e as Error).message === 'invalid' ? 'failed' : 'unavailable';
      }
    },
    disconnect: async (id) => after(await fn({ action: 'disconnect', connection_id: id }).catch(() => ({ error: 'failed' as const }))),
    connectGoogle,
    relistGoogle: async (id) => after(await fn({ action: 'google_calendars', connection_id: id }).catch(() => ({ error: 'failed' as const }))),
  };
}
