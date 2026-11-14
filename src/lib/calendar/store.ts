/**
 * The family calendar on this phone: offline-first, then synced with the household (docs/ios/FAMILY_CALENDAR.md).
 *
 * - Every change applies here at once and goes into an outbox in localStorage (mirrored to native storage in the
 *   app, so it survives the app being killed). Works with no signal and with no account ("local" calendar).
 * - sync(): pushes the outbox in order, then pulls everything changed since last time (5-minute overlap; merging is
 *   idempotent by revision).
 * - Never overwrites the other adult: each save carries the revision it started from. If theirs landed first the
 *   server says 'conflict'; their version is kept, and this phone's change is set aside and named in `conflicts` so
 *   the app can say "Sam changed Dentist on another phone; check it and make your change again."
 * - Signing in with a household turns a local calendar into the household's: its events upload as new ones.
 *
 * The state functions are pure (tested in tests/calendar-store.test.ts); the browser wrapper is at the bottom.
 */
import type { CalendarEvent } from './recurrence';

export interface Op { opId: string; kind: 'save' | 'delete'; id: string; base: number | null; event?: CalendarEvent }
export interface Conflict { id: string; title: string; at: string }
export interface CalendarState {
  /** 'local' (no household yet) or the household id these events belong to. */
  scope: string;
  events: Record<string, CalendarEvent>;
  outbox: Op[];
  /** Server time of the last pull. */
  since: string | null;
  conflicts: Conflict[];
}
export interface CalendarApi {
  save(event: CalendarEvent, base: number | null): Promise<CalendarEvent>;
  remove(id: string, base: number | null): Promise<CalendarEvent | null>;
  changes(since: string | null): Promise<{ now: string; events: CalendarEvent[] }>;
}

export const emptyState = (scope = 'local'): CalendarState => ({ scope, events: {}, outbox: [], since: null, conflicts: [] });
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
export const newEventId = () => uid();

// ------------------------------------------------------------------ local changes

/** Add or change an event here; queue it. Several edits before a sync collapse into one save from the same base. */
export function saveLocal(s: CalendarState, event: CalendarEvent): CalendarState {
  const prev = s.events[event.id];
  const pending = s.outbox.find((o) => o.id === event.id && o.kind === 'save');
  const base = pending ? pending.base : prev && prev.revision > 0 ? prev.revision : null;
  const op: Op = { opId: pending?.opId ?? uid(), kind: 'save', id: event.id, base, event: { ...event, revision: prev?.revision ?? 0 } };
  return {
    ...s,
    events: { ...s.events, [event.id]: { ...event, revision: prev?.revision ?? 0 } },
    outbox: pending ? s.outbox.map((o) => (o === pending ? op : o)) : [...s.outbox, op],
  };
}

/** Delete here; queue it. An event never uploaded just disappears. */
export function deleteLocal(s: CalendarState, id: string): CalendarState {
  const prev = s.events[id];
  if (!prev) return s;
  const never = prev.revision === 0;
  const pendingSave = s.outbox.find((o) => o.id === id && o.kind === 'save');
  const outbox = s.outbox.filter((o) => o.id !== id);
  const { [id]: _gone, ...events } = s.events;
  if (never) return { ...s, events, outbox };
  return { ...s, events, outbox: [...outbox, { opId: uid(), kind: 'delete', id, base: pendingSave?.base ?? prev.revision }] };
}

/** Skip one date of a repeating event ("no practice on the 25th"). */
export function skipOccurrence(s: CalendarState, id: string, date: string): CalendarState {
  const e = s.events[id];
  if (!e) return s;
  return saveLocal(s, { ...e, skip_dates: [...new Set([...(e.skip_dates ?? []), date])].sort() });
}

// ------------------------------------------------------------------ the server's changes

/** Take the server's copies, except for events with a change still waiting here (pushed first, conflict-checked). */
export function mergeRemote(s: CalendarState, remote: CalendarEvent[]): CalendarState {
  const waiting = new Set(s.outbox.map((o) => o.id));
  const events = { ...s.events };
  for (const r of remote) {
    if (waiting.has(r.id)) continue;
    const mine = events[r.id];
    if (mine && mine.revision > r.revision) continue;
    if (r.deleted) delete events[r.id];
    else events[r.id] = r;
  }
  return { ...s, events };
}

/** Make the outbox's events the household's: after signing in, a local calendar uploads as new events. */
export function adopt(s: CalendarState, scope: string): CalendarState {
  if (s.scope === scope) return s;
  if (s.scope === 'local') return { ...s, scope, since: null };
  return emptyState(scope); // a different household (another account on this phone): start clean
}

// ------------------------------------------------------------------ sync

export interface SyncResult { state: CalendarState; pushed: number; offline: boolean }

export async function sync(start: CalendarState, api: CalendarApi, now = () => new Date().toISOString()): Promise<SyncResult> {
  let s = start;
  if (s.scope === 'local') return { state: s, pushed: 0, offline: false };
  let pushed = 0;
  for (const op of [...s.outbox]) {
    try {
      if (op.kind === 'save' && op.event) {
        const saved = await api.save(op.event, op.base);
        s = { ...s, events: { ...s.events, [op.id]: saved }, outbox: s.outbox.filter((o) => o.opId !== op.opId) };
      } else if (op.kind === 'delete') {
        await api.remove(op.id, op.base);
        s = { ...s, outbox: s.outbox.filter((o) => o.opId !== op.opId) };
      }
      pushed++;
    } catch (e) {
      if ((e as Error).message === 'conflict') {
        // Theirs wins; ours is set aside and named. The pull below brings their version.
        const title = op.event?.title ?? s.events[op.id]?.title ?? 'An event';
        const { [op.id]: _mine, ...events } = s.events;
        s = { ...s, events, outbox: s.outbox.filter((o) => o.opId !== op.opId), conflicts: [...s.conflicts, { id: op.id, title, at: now() }] };
        continue;
      }
      return { state: s, pushed, offline: true }; // no signal: keep the rest for next time
    }
  }
  try {
    const sinceWithOverlap = s.since ? new Date(Date.parse(s.since) - 5 * 60_000).toISOString() : null;
    const r = await api.changes(sinceWithOverlap);
    s = { ...mergeRemote(s, r.events), since: r.now };
  } catch {
    return { state: s, pushed, offline: true };
  }
  return { state: s, pushed, offline: false };
}
