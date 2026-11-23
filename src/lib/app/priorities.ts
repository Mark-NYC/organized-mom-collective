/**
 * This week's family priorities (docs/ios/FAMILY_PLAN.md): the few things the family deliberately chose in its Family
 * Meeting. Highlighted calendar events (a link to the family's own event or an imported occurrence on a calendar
 * shared with the household) or a few words ("Working together on the morning rush"). Never automatic.
 *
 * Shared by both adults through the database (migration 20261212); before it's applied every call fails, `available`
 * stays false and nothing about priorities shows. The last copy stays on the phone for reading offline.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { accountRpc, getSession } from '../account';
import { APP_RESUME_EVENT } from '../native/platform';
import { addDays, occurrences, timeLabel, type CalendarEvent } from '../calendar/recurrence';
import type { EventRef } from '../family-meeting-support';
import { newTaskId } from '../calendar/event-tasks';

export interface Priority {
  id: string;
  week_of: string;
  kind: 'event' | 'note';
  title: string;
  source: 'family' | 'imported' | null;
  event_uid: string | null;
  instance_key: string | null;
  event_on: string | null;
  sort: number;
  /** This adult added it. */
  mine: boolean;
}

/** The app shows three; the database keeps at most five a week. */
export const SHOWN = 3;
export const MAX_PER_WEEK = 5;
export const MAX_NOTE = 120;

/** The Monday of a local date's week (YYYY-MM-DD). */
export function weekOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}

export const prioritiesApi = {
  list: (from: string, to: string) => accountRpc<Priority[]>('household_priorities', { p_from: from, p_to: to }),
  save: (p: Partial<Priority> & { id: string; week_of: string }) => accountRpc<Priority>('household_priority_save', { p }),
  remove: (id: string) => accountRpc<boolean>('household_priority_remove', { p_id: id }),
};

export const sameRef = (p: Priority, r: EventRef) => p.kind === 'event' && p.source === r.source && p.event_uid === r.event_uid && p.instance_key === r.instance_key;

export interface Resolved {
  priority: Priority;
  title: string;
  /** The event's date as it is now (moved: the new date), or null for a note. */
  date: string | null;
  time: string | null;
  /** The event is no longer on the calendar (cancelled, deleted, its calendar unshared). */
  gone: boolean;
}

/** A priority with its event as it is now (never a stale copy). */
export function resolve(p: Priority, events: CalendarEvent[]): Resolved {
  if (p.kind === 'note') return { priority: p, title: p.title, date: null, time: null, gone: false };
  if (p.source === 'imported') {
    const e = events.find((x) => x.external?.uid === p.event_uid && x.external?.instance_key === p.instance_key);
    return e ? { priority: p, title: e.title, date: e.starts_on, time: e.start_time ? timeLabel(e) : null, gone: false }
      : { priority: p, title: p.title, date: p.event_on, time: null, gone: true };
  }
  const own = events.find((x) => x.id === p.event_uid && !x.deleted);
  const on = own && p.instance_key ? occurrences([own], p.instance_key, p.instance_key)[0] : undefined;
  return on ? { priority: p, title: own!.title, date: on.date, time: own!.start_time ? timeLabel(own!) : null, gone: false }
    : { priority: p, title: own?.title ?? p.title, date: p.event_on, time: null, gone: true };
}

/**
 * What Today shows: this week's priorities, or (a missed meeting) the last meeting's, if it was in the past two weeks,
 * labeled as such. Events that have passed drop off; notes stay for their week.
 */
export function currentPriorities(items: Priority[], events: CalendarEvent[], today: string): { list: Resolved[]; from: 'this-week' | 'last-meeting' | null } {
  const week = weekOf(today);
  const weeks = [...new Set(items.map((p) => p.week_of))].filter((w) => w <= week && w >= addDays(week, -14)).sort().reverse();
  for (const w of weeks) {
    const list = items.filter((p) => p.week_of === w).sort((a, b) => a.sort - b.sort)
      .map((p) => resolve(p, events))
      .filter((r) => r.priority.kind === 'note' || (r.date ?? '') >= today)
      // Privacy: an imported event this adult can no longer see (its calendar made private or unshared, or cancelled)
      // shows only to the adult who chose it, never as a stale title to anyone else, cached copy or not.
      .filter((r) => !(r.gone && r.priority.source === 'imported' && !r.priority.mine));
    if (list.length) return { list, from: w === week ? 'this-week' : 'last-meeting' };
  }
  return { list: [], from: null };
}

const CACHE = 'omc:priorities:v1';
const readCache = (scope: string): Priority[] | null => {
  try { const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { scope: string; items: Priority[] } | null; return c && c.scope === scope ? c.items : null; } catch { return null; }
};
const writeCache = (scope: string, items: Priority[]) => { try { localStorage.setItem(CACHE, JSON.stringify({ scope, items })); } catch { /* this visit only */ } };
const gone = (e: unknown) => /could not find the function|schema cache|404|no_household/i.test((e as Error)?.message ?? '');

export function priorityError(e: unknown): string {
  const m = (e as Error)?.message ?? '';
  if (/too_many/.test(m)) return `That’s ${MAX_PER_WEEK} for this week. Keep the few that matter most.`;
  if (/not_found/.test(m)) return 'That event isn’t on a calendar your family shares.';
  if (/fetch|network|Failed|offline/i.test(m)) return 'You’re offline. Try again when you’re connected.';
  return 'Couldn’t save that. Try again in a moment.';
}

export interface Priorities {
  available: boolean;
  items: Priority[];
  /** Highlight an event, or add a few words. Resolves to an error message, or null. */
  highlight(ref: EventRef, week: string): Promise<string | null>;
  addNote(title: string, week: string): Promise<string | null>;
  remove(id: string): Promise<string | null>;
  reload(): Promise<void>;
}

/** The household's priorities (the past two weeks and this one), shared by both adults; refreshed on focus. */
export function usePriorities(scope: string | null, today: string): Priorities {
  const [items, setItems] = useState<Priority[]>(() => (scope && readCache(scope)) || []);
  const [available, setAvailable] = useState(() => Boolean(scope && readCache(scope)));
  const latest = useRef(items);
  latest.current = items;
  const put = useCallback((next: Priority[]) => { setItems(next); if (scope) writeCache(scope, next); }, [scope]);
  useEffect(() => { const c = scope ? readCache(scope) : null; setItems(c ?? []); setAvailable(Boolean(c)); }, [scope]);
  const reload = useCallback(async () => {
    if (!scope || scope === 'local' || !(await getSession())) return;
    const week = weekOf(today);
    try { put(await prioritiesApi.list(addDays(week, -14), addDays(week, 7))); setAvailable(true); }
    catch (e) { if (gone(e)) { setAvailable(false); setItems([]); } }
  }, [scope, today, put]);
  useEffect(() => {
    void reload();
    const again = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener(APP_RESUME_EVENT, again);
    document.addEventListener('visibilitychange', again);
    const t = window.setInterval(again, 60_000);
    return () => { window.removeEventListener(APP_RESUME_EVENT, again); document.removeEventListener('visibilitychange', again); window.clearInterval(t); };
  }, [reload]);
  const add = async (p: Partial<Priority> & { week_of: string }) => {
    const sort = latest.current.filter((x) => x.week_of === p.week_of).length;
    try {
      const saved = await prioritiesApi.save({ id: newTaskId(), sort, ...p });
      put([...latest.current.filter((x) => x.id !== saved.id), saved]);
      return null;
    } catch (e) { return priorityError(e); }
  };
  return {
    available, items, reload,
    highlight: (ref, week) => add({ kind: 'event', week_of: week, ...ref }),
    addNote: (title, week) => (title.trim() ? add({ kind: 'note', week_of: week, title: title.trim().slice(0, MAX_NOTE) }) : Promise.resolve('Write a few words.')),
    remove: async (id) => {
      try { await prioritiesApi.remove(id); put(latest.current.filter((x) => x.id !== id)); return null; } catch (e) { return priorityError(e); }
    },
  };
}
