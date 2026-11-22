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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accountFunction, accountRpc, getSession } from '../account';
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
interface Cached { scope: string; which: 'mine' | 'household'; feeds: Feed[]; events: FeedEvent[]; at: string; from?: string }
/** What the visible events depend on: if it's unchanged since the device copy, the events are too. */
const signature = (feeds: Feed[]) => feeds.map((f) => `${f.id}|${f.visibility}|${f.member_id}|${f.events_at ?? f.last_success_at}`).sort().join(',');
/** One small call for the list; the events only when a calendar changed, was added, removed or shared (or a new day). */
async function fetchFresh(scope: string, which: 'mine' | 'household'): Promise<{ feeds: Feed[]; events: FeedEvent[] }> {
  const { from, to } = windowFor();
  const feeds = await feedsApi.list();
  const c = readCache(scope, which);
  const visible = which === 'household' ? feeds.filter((f) => f.visibility === 'household') : feeds;
  const events = c && c.from === from && signature(c.feeds.filter((f) => which === 'mine' || f.visibility === 'household')) === signature(visible)
    ? c.events
    : visible.length ? await feedsApi.events(from, to, which) : [];
  writeCache({ scope, which, feeds, events, at: new Date().toISOString(), from });
  return { feeds, events };
}
const readCache = (scope: string, which: string): Cached | null => {
  try { const c = JSON.parse(localStorage.getItem(`${CACHE}:${which}`) ?? 'null') as Cached | null; return c && c.scope === scope ? c : null; } catch { return null; }
};
// Calendar links never reach the app at all (encrypted on the server); even the host name isn't kept on the device.
/** The server has no calendar subscriptions (not set up, or rolled back): nothing imported is shown, even offline later. */
// Also 'not_enabled': calendar subscriptions are switched on only for test households during the staged rollout.
const gone = (e: unknown) => /could not find the function|schema cache|404|not_enabled/i.test((e as Error)?.message ?? '');
const dropCache = (scope: string, _which?: string) => { try { for (const w of ['mine', 'household']) if (readCache(scope, w)) localStorage.removeItem(`${CACHE}:${w}`); } catch { /* nothing kept */ } };
const writeCache = (c: Cached) => { try { localStorage.setItem(`${CACHE}:${c.which}`, JSON.stringify({ ...c, feeds: c.feeds.map((f) => ({ ...f, url_host: null })) })); } catch { /* this visit only */ } };

const windowFor = () => { const t = localToday(); return { from: `${addDays(t, -35)}T00:00:00Z`, to: `${addDays(t, 130)}T00:00:00Z` }; };

/**
 * Outside React (the Club's month meeting page): a household's imported events for `which`, the copy on this device
 * first (`onCached`), then fresh from the server. Resolves to [] when calendar subscriptions aren't set up.
 */
export async function loadExternalEvents(scope: string, which: 'mine' | 'household', onCached?: (e: CalendarEvent[]) => void): Promise<CalendarEvent[]> {
  const c = readCache(scope, which);
  if (c && onCached) onCached(toCalendarEvents(c.events, c.feeds));
  try {
    if (!(await getSession())) return c ? toCalendarEvents(c.events, c.feeds) : [];
    const { feeds: f, events: ev } = await fetchFresh(scope, which);
    return toCalendarEvents(ev, f);
  } catch (e) {
    if (gone(e)) { dropCache(scope, which); return []; }
    return c ? toCalendarEvents(c.events, c.feeds) : [];
  }
}

export interface ExternalCalendars {
  /** The server has calendar subscriptions (and she's signed in to a household). */
  available: boolean;
  feeds: Feed[];
  events: CalendarEvent[];
  loading: boolean;
  reload(): Promise<void>;
}

/**
 * Subscriptions and their imported events for a household (`scope` = the household id from useCalendar), for the
 * next ~4 months and the past month. 'mine': what this adult may see (their private feeds too); 'household': only
 * shared ones (the weekly Family Meeting). Kept on the device for offline (without links); refreshed on focus and every 15 minutes.
 */
export function useExternalCalendars(scope: string | null, which: 'mine' | 'household' = 'mine'): ExternalCalendars {
  const cached = scope ? readCache(scope, which) : null;
  const [feeds, setFeeds] = useState<Feed[]>(cached?.feeds ?? []);
  const [raw, setRaw] = useState<FeedEvent[]>(cached?.events ?? []);
  const [available, setAvailable] = useState(Boolean(cached));
  const [loading, setLoading] = useState(false);
  // The device copy as soon as the household is known (sign-in is checked after the first render): offline too.
  useEffect(() => {
    const c = scope ? readCache(scope, which) : null;
    if (c) { setFeeds(c.feeds); setRaw(c.events); setAvailable(true); }
  }, [scope, which]);
  const busy = useRef(false);
  const again = useRef(false);
  const reload = useCallback(async (): Promise<void> => {
    if (!scope || scope === 'local') return;
    if (busy.current) { again.current = true; return; }
    if (!(await getSession())) return;
    busy.current = true;
    setLoading(true);
    try {
      const { feeds: f, events: ev } = await fetchFresh(scope, which);
      setFeeds(f); setRaw(ev); setAvailable(true);
    } catch (e) {
      // No feed functions on this server (not yet set up): the calendar stays as it was. Offline: keep the copy.
      if (gone(e)) { setAvailable(false); setRaw([]); setFeeds([]); dropCache(scope, which); }
    } finally {
      busy.current = false;
      setLoading(false);
    }
    // A change made while it was loading (added, removed, made private): load once more so it shows.
    if (again.current) { again.current = false; await reload(); }
  }, [scope, which]);
  useEffect(() => {
    void reload();
    const again = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener(APP_RESUME_EVENT, again);
    document.addEventListener('visibilitychange', again);
    // The server refreshes each calendar every few hours, so checking every 15 minutes (and on focus) is plenty.
    const t = window.setInterval(again, 15 * 60_000);
    return () => { window.removeEventListener(APP_RESUME_EVENT, again); document.removeEventListener('visibilitychange', again); window.clearInterval(t); };
  }, [reload]);
  const events = useMemo(() => (available ? toCalendarEvents(raw, feeds) : []), [available, raw, feeds]);
  return { available, feeds, events, loading, reload };
}
