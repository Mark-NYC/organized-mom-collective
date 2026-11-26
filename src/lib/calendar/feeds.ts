/**
 * Calendar subscriptions in the app (docs/calendar/CALENDAR_INTEGRATION.md): an adult's iCal feeds (school, sports,
 * work), read-only, shown in the family calendar beside the family's own plans.
 *
 * The server fetches and expands feeds (the calendar-feeds Edge Function); the app lists them, changes their privacy,
 * and turns the imported occurrences into read-only calendar events in this device's time zone, so every view
 * (Week, Month, Agenda, Today, the weekly Family Meeting) shows them with no special cases. The family's own events
 * (src/lib/calendar/store.ts) are untouched: imported ones never enter its sync, outbox or storage.
 *
 * Until the database has the feed functions (migration 20261205), every call fails and `available` stays false:
 * the calendar looks and works exactly as before.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { accountFunction, accountRpc, getSession, loadSession, SESSION_STORAGE_KEY } from '../account';
import { APP_RESUME_EVENT } from '../native/platform';
import { addDays, localToday, type CalendarEvent } from './recurrence';

export type FeedVisibility = 'private' | 'household';
export interface Feed {
  id: string;
  kind: 'ical' | 'google';
  /** Google calendars: the connected account and calendar (owner only). */
  google_account_id?: string | null;
  google_calendar_id?: string | null;
  name: string;
  visibility: FeedVisibility;
  member_id: string | null;
  /** Added by this adult (they can change or remove it; they alone see its host and errors). */
  mine: boolean;
  /** The link's host name, for its owner only (the link itself stays encrypted on the server). */
  url_host: string | null;
  status: 'pending' | 'ok' | 'error' | 'disconnected';
  last_error: string | null;
  event_count: number;
  last_success_at: string | null;
  /** When its imported events last changed (the app re-downloads events only then). */
  events_at?: string;
}
export interface FeedEvent {
  feed_id: string;
  uid: string;
  instance_key: string;
  title: string;
  location: string | null;
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'confirmed' | 'tentative';
}

export const feedsApi = {
  list: () => accountRpc<Feed[]>('calendar_feeds'),
  add: (p: { url: string; name: string; visibility: FeedVisibility; member_id: string | null; timezone: string }) => accountRpc<Feed>('calendar_feed_add', { p }),
  update: (id: string, p: Partial<Pick<Feed, 'name' | 'visibility' | 'member_id'>>) => accountRpc<Feed>('calendar_feed_update', { p_id: id, p }),
  remove: (id: string) => accountRpc<boolean>('calendar_feed_remove', { p_id: id }),
  retry: (id: string) => accountRpc<Feed>('calendar_feed_retry', { p_id: id }),
  /** Fetch it now (the server checks it's this adult's). */
  refresh: (id: string) => accountFunction<{ result: string; count: number; error?: string }>('calendar-feeds', { feed_id: id }),
  events: (from: string, to: string, scope: 'mine' | 'household') => accountRpc<FeedEvent[]>('calendar_feed_events', { p_from: from, p_to: to, p_scope: scope }),
};

// ---------------------------------------------------------------- Connect Google Calendar (docs/calendar/GOOGLE_CALENDAR.md)
export interface GoogleAccount { id: string; email: string | null; status: 'ok' | 'reconnect'; last_error: string | null; calendars: number; created_at: string }
export interface GoogleCalendarChoice {
  id: string; name: string; color: string | null; time_zone: string | null; primary: boolean; access_role: string;
  imported: boolean; feed_id: string | null; visibility: FeedVisibility; member_id: string | null;
}
/** What Google's redirect back means, for her (the `google` query parameter). */
export const GOOGLE_RESULT: Record<string, string> = {
  connected: 'Google Calendar connected. Choose which calendars to show.',
  cancelled: 'You didn’t connect Google. Nothing changed.',
  permissions: 'To import your calendars, allow both calendar permissions on Google’s screen, then try again.',
  expired: 'That connection attempt expired. Tap Connect Google Calendar again.',
  error: 'Google Calendar couldn’t be connected. Try again in a minute.',
};
export const googleApi = {
  /** Her connected Google accounts; throws not_enabled / missing-function errors when Google isn't on for her. */
  accounts: () => accountRpc<GoogleAccount[]>('calendar_google_accounts'),
  /** Google's consent screen URL (one-time state + PKCE; no tokens ever come to the app). */
  start: (ret: 'web' | 'app', origin: string) => accountFunction<{ url: string }>('calendar-google', { action: 'start', return: ret, origin }),
  calendars: (accountId: string) => accountFunction<{ calendars: GoogleCalendarChoice[]; missing: { id: string; name: string; feed_id: string }[] }>('calendar-google', { action: 'calendars', account_id: accountId }),
  select: (accountId: string, calendars: { id: string; name: string; member_id: string | null; visibility: FeedVisibility; timezone: string | null }[]) =>
    accountRpc<Feed[]>('calendar_google_select', { p_account: accountId, p_calendars: calendars }),
  disconnect: (accountId: string) => accountFunction<{ ok: boolean; revoked: boolean }>('calendar-google', { action: 'disconnect', account_id: accountId }),
};

const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch { return 'America/New_York'; } };
const localParts = (iso: string, tz: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${String(+p.hour % 24).padStart(2, '0')}:${p.minute}` };
};

/** Imported occurrences → read-only calendar events, in this device's zone, in the feed owner's chosen family color. */
export function toCalendarEvents(events: FeedEvent[], feeds: Feed[], tz = zone()): CalendarEvent[] {
  const byId = new Map(feeds.map((f) => [f.id, f]));
  return events.flatMap((e): CalendarEvent[] => {
    const f = byId.get(e.feed_id);
    if (!f) return [];
    const base = {
      id: `ext:${e.feed_id}:${e.uid}:${e.instance_key}`, title: e.title, location: e.location, notes: null, timezone: tz,
      recurrence: null, skip_dates: [], member_ids: f.member_id ? [f.member_id] : [], owner_member_id: null, revision: 0,
      external: { feed_id: f.id, name: f.name, visibility: f.visibility, mine: f.mine, tentative: e.status === 'tentative', uid: e.uid, instance_key: e.instance_key },
    };
    if (e.all_day && e.start_date) return [{ ...base, starts_on: e.start_date, ends_on: e.end_date && e.end_date !== e.start_date ? e.end_date : null, start_time: null, end_time: null }];
    if (!e.starts_at || !e.ends_at) return [];
    const s = localParts(e.starts_at, tz);
    const en = localParts(e.ends_at, tz);
    return [{ ...base, starts_on: s.date, ends_on: null, start_time: s.time, end_time: en.date === s.date && en.time !== s.time ? en.time : null }];
  });
}

const CACHE = 'omc:calendar:feeds:v1';
type Audience = 'mine' | 'household';
interface Cached { scope: string; adult: string; which: Audience; feeds: Feed[]; events: FeedEvent[]; from: string }

const adultId = () => loadSession()?.user_id ?? null;
function subscribeAdult(change: () => void) {
  const storage = (e: StorageEvent) => { if (!e.key || e.key === SESSION_STORAGE_KEY) change(); };
  window.addEventListener('storage', storage);
  window.addEventListener(SESSION_STORAGE_KEY, change);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener(SESSION_STORAGE_KEY, change);
  };
}
function readCache(scope: string, adult: string, which: Audience): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(`${CACHE}:${which}`) ?? 'null') as Cached | null;
    return c?.scope === scope && c.adult === adult && c.which === which ? c : null;
  } catch { return null; }
}
const signature = (feeds: Feed[]) => feeds.map((f) => [f.id, f.visibility, f.member_id, f.events_at ?? f.last_success_at].join('|')).sort().join(',');
const gone = (e: unknown) => /could not find the function|schema cache|404|not_enabled/i.test((e as Error)?.message ?? '');

async function fetchFresh(scope: string, adult: string, which: Audience): Promise<Cached | null> {
  const session = await getSession();
  if (adultId() !== adult) return null;
  if (!session) return readCache(scope, adult, which);
  if (session.user_id !== adult) return null;
  const today = localToday();
  const from = `${addDays(today, -35)}T00:00:00Z`;
  const to = `${addDays(today, 130)}T00:00:00Z`;
  const previous = readCache(scope, adult, which);
  try {
    const all = await feedsApi.list();
    if (adultId() !== adult) return null;
    const feeds = all.filter(f => which === 'mine' || f.visibility === 'household');
    const events = previous?.from === from && signature(previous.feeds) === signature(feeds)
      ? previous.events : feeds.length ? await feedsApi.events(from, to, which) : [];
    if (adultId() !== adult) return null;
    const result = { scope, adult, which, from, feeds, events };
    try {
      localStorage.setItem(`${CACHE}:${which}`, JSON.stringify({ ...result, feeds: feeds.map(f => ({ ...f, url_host: null })) }));
    } catch { /* storage unavailable, still usable this visit */ }
    return result;
  } catch (error) {
    if (adultId() !== adult) return null;
    if (!gone(error)) return previous;
    for (const w of ['mine', 'household'] as const) {
      if (readCache(scope, adult, w)) localStorage.removeItem(`${CACHE}:${w}`);
    }
    return null;
  }
}

export async function loadExternalEvents(scope: string, which: Audience, onCached?: (e: CalendarEvent[]) => void): Promise<CalendarEvent[]> {
  const adult = adultId();
  if (!adult) return [];
  const cached = readCache(scope, adult, which);
  if (cached) onCached?.(toCalendarEvents(cached.events, cached.feeds));
  const result = await fetchFresh(scope, adult, which);
  return result && adultId() === adult ? toCalendarEvents(result.events, result.feeds) : [];
}

export interface ExternalCalendars {
  available: boolean;
  feeds: Feed[];
  events: CalendarEvent[];
  loading: boolean;
  reload(): Promise<void>;
}

export function useExternalCalendars(scope: string | null, which: Audience = 'mine'): ExternalCalendars {
  const adult = useSyncExternalStore(subscribeAdult, adultId, () => null);
  const cached = useMemo(() => scope && adult ? readCache(scope, adult, which) : null, [scope, adult, which]);
  const [result, setResult] = useState<Cached | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    if (!scope || !adult) { setResult(null); setLoading(false); return; }
    setLoading(true);
    try {
      const next = await fetchFresh(scope, adult, which);
      if (id === request.current) setResult(next);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [scope, adult, which]);
  useEffect(() => {
    setResult(cached);
    void reload();
    const refresh = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener(APP_RESUME_EVENT, refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 15 * 60_000);
    return () => {
      ++request.current;
      window.removeEventListener(APP_RESUME_EVENT, refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, [cached, reload]);
  const visible = result && result.scope === scope && result.adult === adult && result.which === which ? result : null;
  const events = useMemo(() => visible ? toCalendarEvents(visible.events, visible.feeds) : [], [visible]);
  return { available: Boolean(visible), feeds: visible?.feeds ?? [], events, loading, reload };
}
