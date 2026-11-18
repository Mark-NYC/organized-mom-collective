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
  name: string;
  visibility: FeedVisibility;
  member_id: string | null;
  /** Added by this adult (they can change or remove it; they alone see its link and errors). */
  mine: boolean;
  url: string | null;
  status: 'pending' | 'ok' | 'error' | 'disconnected';
  last_error: string | null;
  event_count: number;
  last_success_at: string | null;
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
      external: { feed_id: f.id, name: f.name, visibility: f.visibility, mine: f.mine, tentative: e.status === 'tentative' },
    };
    if (e.all_day && e.start_date) return [{ ...base, starts_on: e.start_date, ends_on: e.end_date && e.end_date !== e.start_date ? e.end_date : null, start_time: null, end_time: null }];
    if (!e.starts_at || !e.ends_at) return [];
    const s = localParts(e.starts_at, tz);
    const en = localParts(e.ends_at, tz);
    return [{ ...base, starts_on: s.date, ends_on: null, start_time: s.time, end_time: en.date === s.date && en.time !== s.time ? en.time : null }];
  });
}

const CACHE = 'omc:calendar:feeds:v1';
interface Cached { scope: string; which: 'mine' | 'household'; feeds: Feed[]; events: FeedEvent[]; at: string }
const readCache = (scope: string, which: string): Cached | null => {
  try { const c = JSON.parse(localStorage.getItem(`${CACHE}:${which}`) ?? 'null') as Cached | null; return c && c.scope === scope ? c : null; } catch { return null; }
};
const writeCache = (c: Cached) => { try { localStorage.setItem(`${CACHE}:${c.which}`, JSON.stringify(c)); } catch { /* this visit only */ } };

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
    const { from, to } = windowFor();
    const [f, ev] = await Promise.all([feedsApi.list(), feedsApi.events(from, to, which)]);
    writeCache({ scope, which, feeds: f, events: ev, at: new Date().toISOString() });
    return toCalendarEvents(ev, f);
  } catch {
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
 * shared ones (the weekly Family Meeting). Kept on the device for offline; refreshed on focus and every 5 minutes.
 */
export function useExternalCalendars(scope: string | null, which: 'mine' | 'household' = 'mine'): ExternalCalendars {
  const cached = scope ? readCache(scope, which) : null;
  const [feeds, setFeeds] = useState<Feed[]>(cached?.feeds ?? []);
  const [raw, setRaw] = useState<FeedEvent[]>(cached?.events ?? []);
  const [available, setAvailable] = useState(Boolean(cached));
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const again = useRef(false);
  const reload = useCallback(async (): Promise<void> => {
    if (!scope || scope === 'local') return;
    if (busy.current) { again.current = true; return; }
    if (!(await getSession())) return;
    busy.current = true;
    setLoading(true);
    try {
      const { from, to } = windowFor();
      const [f, ev] = await Promise.all([feedsApi.list(), feedsApi.events(from, to, which)]);
      setFeeds(f); setRaw(ev); setAvailable(true);
      writeCache({ scope, which, feeds: f, events: ev, at: new Date().toISOString() });
    } catch (e) {
      // No feed functions on this server (not yet set up): the calendar stays as it was. Offline: keep the copy.
      if (/could not find the function|schema cache|404/i.test((e as Error).message)) setAvailable(false);
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
    const t = window.setInterval(again, 5 * 60_000);
    return () => { window.removeEventListener(APP_RESUME_EVENT, again); document.removeEventListener('visibilitychange', again); window.clearInterval(t); };
  }, [reload]);
  const events = useMemo(() => toCalendarEvents(raw, feeds), [raw, feeds]);
  return { available, feeds, events, loading, reload };
}
