/**
 * Responsibilities on imported calendar events (docs/calendar/EVENT_RESPONSIBILITIES.md): "Pack soccer bag · Mateo",
 * "Drive · Luis" on a Google or school calendar event. The calendar says what's happening; the family says who does
 * what.
 *
 * Kept on the server apart from the imported events (migration 20261211), keyed by the event's UID and occurrence, so a
 * refresh, a failed refresh or re-adding a calendar never touches them. Nothing is ever written to the source
 * calendar. Only household adults, and only where the staged rollout has it on: until then (or before the migration)
 * every call fails, `available` stays false and the calendar looks exactly as before.
 *
 * Saves need a connection (a responsibility two adults edit should never fork); the last copy stays on the device for
 * reading offline. Checking something off shows at once and is undone if the server refuses.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { accountRpc, getSession } from '../account';
import { APP_RESUME_EVENT } from '../native/platform';
import { addDays, localToday, type CalendarEvent } from './recurrence';

export interface EventTask {
  id: string;
  event_uid: string;
  instance_key: string;
  feed_id: string | null;
  /** The event was a one-off when this was added (the server follows it if it's rescheduled). */
  single: boolean;
  /** The event's title and local date when last seen: the label if it has left the calendar. */
  event_title: string;
  event_on: string;
  title: string;
  member_id: string | null;
  done: boolean;
  done_at: string | null;
  updated_at: string;
}

export const MAX_TASK_TITLE = 80;
export const MAX_TASKS_PER_EVENT = 20;

export const eventTasksApi = {
  list: (from: string, to: string) => accountRpc<EventTask[]>('calendar_event_tasks', { p_from: from, p_to: to }),
  save: (p: { id: string; event_uid?: string; instance_key?: string; title?: string; member_id?: string | null }) => accountRpc<EventTask>('calendar_event_task_save', { p }),
  done: (id: string, done: boolean) => accountRpc<EventTask>('calendar_event_task_done', { p_id: id, p_done: done }),
  remove: (id: string) => accountRpc<boolean>('calendar_event_task_delete', { p_id: id }),
};

/** An imported occurrence's identity (UID + occurrence), or null for the family's own events. */
export const occurrenceOf = (e: Pick<CalendarEvent, 'external'>): { uid: string; instance_key: string } | null =>
  e.external?.uid && e.external.instance_key ? { uid: e.external.uid, instance_key: e.external.instance_key } : null;
const k = (uid: string, key: string) => `${uid}\n${key}`;

/** This occurrence's responsibilities, in the order they were added. */
export function tasksFor(tasks: EventTask[], e: Pick<CalendarEvent, 'external'>): EventTask[] {
  const o = occurrenceOf(e);
  return o ? tasks.filter((t) => t.event_uid === o.uid && t.instance_key === o.instance_key) : [];
}

/** "2 of 3 done", for a calendar row (text, never a control). */
export function doneLabel(list: EventTask[]): string | null {
  if (!list.length) return null;
  const done = list.filter((t) => t.done).length;
  return done === list.length ? 'All done' : `${done} of ${list.length} done`;
}

export interface TodayTask { task: EventTask; event: CalendarEvent | null; date: string }
/**
 * Responsibilities for the next `days` days (today first), each with its event when it's on the calendar. One whose
 * event has left the calendar (cancelled, deleted, its calendar removed) is listed only while unfinished and recent,
 * so it can be removed; finished ones simply drop off.
 */
export function upcomingTasks(tasks: EventTask[], events: CalendarEvent[], today: string, days = 7): TodayTask[] {
  const end = addDays(today, days - 1);
  const byKey = new Map<string, CalendarEvent>();
  for (const e of events) { const o = occurrenceOf(e); if (o) byKey.set(k(o.uid, o.instance_key), e); }
  return tasks
    .map((t) => { const event = byKey.get(k(t.event_uid, t.instance_key)) ?? null; return { task: t, event, date: event?.starts_on ?? t.event_on }; })
    .filter((x) => x.date >= today && x.date <= end && (x.event || !x.task.done))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.event?.start_time ?? '').localeCompare(b.event?.start_time ?? '') || a.task.event_uid.localeCompare(b.task.event_uid));
}

/** What a refused save means, for her. */
export function taskError(e: unknown): string {
  const m = (e as Error)?.message ?? '';
  if (/too_many/.test(m)) return `That’s the most for one event (${MAX_TASKS_PER_EVENT}).`;
  if (/not_found/.test(m)) return 'That event isn’t on your calendar anymore.';
  if (/invalid/.test(m)) return 'That didn’t look right. Check the words and who’s doing it.';
  if (/fetch|network|Failed|offline/i.test(m)) return 'You’re offline. Try again when you’re connected.';
  return 'Couldn’t save that. Try again in a moment.';
}

const CACHE = 'omc:calendar:event-tasks:v1';
const windowFor = () => { const t = localToday(); return { from: addDays(t, -35), to: addDays(t, 130) }; };
const readCache = (scope: string): EventTask[] | null => {
  try { const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { scope: string; tasks: EventTask[] } | null; return c && c.scope === scope ? c.tasks : null; } catch { return null; }
};
const writeCache = (scope: string, tasks: EventTask[]) => { try { localStorage.setItem(CACHE, JSON.stringify({ scope, tasks })); } catch { /* this visit only */ } };
const dropCache = () => { try { localStorage.removeItem(CACHE); } catch { /* nothing kept */ } };
/** Not on this server, or not on for this household (staged rollout): nothing shows, even offline later. */
const gone = (e: unknown) => /could not find the function|schema cache|404|not_enabled|no_household/i.test((e as Error)?.message ?? '');
export const newTaskId = () => (crypto.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));

export interface EventTasks {
  /** On for this household (and the server has it). */
  available: boolean;
  tasks: EventTask[];
  /** Add (no id yet) or change one. Resolves to an error message, or null when saved. */
  save(p: { id?: string; event?: CalendarEvent; title: string; member_id: string | null }): Promise<string | null>;
  toggle(id: string): Promise<string | null>;
  remove(id: string): Promise<string | null>;
  reload(): Promise<void>;
}

/**
 * The household's responsibilities on imported events (`scope` = the household id, null when signed out or in the
 * demo). The device copy first, then the server; again on focus, on resume and every minute while open, so the other
 * adult's check-offs show up.
 */
export function useEventTasks(scope: string | null): EventTasks {
  const [tasks, setTasks] = useState<EventTask[]>(() => (scope && readCache(scope)) || []);
  const [available, setAvailable] = useState(() => Boolean(scope && readCache(scope)));
  const busy = useRef(false);
  const latest = useRef(tasks);
  latest.current = tasks;
  const put = useCallback((next: EventTask[]) => { setTasks(next); if (scope) writeCache(scope, next); }, [scope]);

  useEffect(() => {
    const c = scope ? readCache(scope) : null;
    setTasks(c ?? []); setAvailable(Boolean(c));
  }, [scope]);

  const reload = useCallback(async () => {
    if (!scope || scope === 'local' || busy.current) return;
    if (!(await getSession())) return;
    busy.current = true;
    try {
      const { from, to } = windowFor();
      put(await eventTasksApi.list(from, to));
      setAvailable(true);
    } catch (e) {
      if (gone(e)) { setAvailable(false); setTasks([]); dropCache(); }
    } finally { busy.current = false; }
  }, [scope, put]);

  useEffect(() => {
    void reload();
    const again = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener(APP_RESUME_EVENT, again);
    document.addEventListener('visibilitychange', again);
    const t = window.setInterval(again, 60_000);
    return () => { window.removeEventListener(APP_RESUME_EVENT, again); document.removeEventListener('visibilitychange', again); window.clearInterval(t); };
  }, [reload]);

  const merge = (saved: EventTask) => {
    const list = latest.current;
    put(list.some((t) => t.id === saved.id) ? list.map((t) => (t.id === saved.id ? saved : t)) : [...list, saved]);
  };

  const save: EventTasks['save'] = async ({ id, event, title, member_id }) => {
    const words = title.trim();
    if (!words) return 'Write what needs doing.';
    if (words.length > MAX_TASK_TITLE) return `Keep it under ${MAX_TASK_TITLE} characters.`;
    try {
      if (id) merge(await eventTasksApi.save({ id, title: words, member_id }));
      else {
        const o = event && occurrenceOf(event);
        if (!o) return 'That event isn’t on your calendar anymore.';
        merge(await eventTasksApi.save({ id: newTaskId(), event_uid: o.uid, instance_key: o.instance_key, title: words, member_id }));
      }
      return null;
    } catch (e) { return taskError(e); }
  };

  const toggle: EventTasks['toggle'] = async (id) => {
    const before = latest.current;
    const t = before.find((x) => x.id === id);
    if (!t) return null;
    put(before.map((x) => (x.id === id ? { ...x, done: !t.done } : x)));
    try { merge(await eventTasksApi.done(id, !t.done)); return null; } catch (e) { put(latest.current.map((x) => (x.id === id ? t : x))); return taskError(e); }
  };

  const remove: EventTasks['remove'] = async (id) => {
    try { await eventTasksApi.remove(id); put(latest.current.filter((x) => x.id !== id)); return null; } catch (e) { return taskError(e); }
  };

  return { available, tasks, save, toggle, remove, reload };
}
