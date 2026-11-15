/**
 * The family calendar in the browser / app: persistence, the household's database calls and a React hook
 * (docs/ios/FAMILY_CALENDAR.md). State rules live in ./store.ts (pure, tested).
 *
 * Stored under omc:calendar:v1 (mirrored to native storage in the app; never synced into account_saves, see
 * syncableKey in src/lib/account.ts: the calendar has its own table).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { accountRpc, accountsEnabled, getSession } from '../account';
import { accountStore } from '../club/store';
import { householdAccess } from '../household/api';
import { appPreviewFamily } from '../app-family';
import { memberColors, type MarkerColor } from '../../data/club/family-colors';
import type { Household } from '../club/profile';
import { APP_RESUME_EVENT } from '../native/platform';
import type { CalendarEvent } from './recurrence';
import { adopt, deleteLocal, emptyState, saveLocal, skipOccurrence, sync, type CalendarApi, type CalendarState } from './store';

const KEY = 'omc:calendar:v1';
/** ?demo=1: the made-up sample family, labeled as a demo, its own storage, never synced (screenshots, previews). */
export const isDemo = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1';
const key = () => (isDemo() ? 'omc:calendar-demo:v1' : KEY);

export function loadState(): CalendarState {
  try {
    const raw = localStorage.getItem(key());
    if (raw) {
      const s = JSON.parse(raw) as CalendarState;
      if (s && typeof s === 'object' && s.events && Array.isArray(s.outbox)) return { ...s, conflicts: s.conflicts ?? [] };
    }
  } catch { /* fall through */ }
  return emptyState();
}
export function persist(s: CalendarState): boolean {
  try {
    localStorage.setItem(key(), JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

interface DbEvent extends Omit<CalendarEvent, 'start_time' | 'end_time'> { start_time: string | null; end_time: string | null }
const fromDb = (e: DbEvent | null): CalendarEvent | null => (e ? { ...e, skip_dates: e.skip_dates ?? [], member_ids: e.member_ids ?? [] } : null);

export const supabaseCalendarApi: CalendarApi = {
  async save(event, base) {
    const { revision: _r, deleted: _d, updated_at: _u, source: _s, source_ref: _sr, ...body } = event;
    return fromDb(await accountRpc<DbEvent>('calendar_event_save', { p_event: body, p_base_revision: base }))!;
  },
  async remove(id, base) {
    return fromDb(await accountRpc<DbEvent | null>('calendar_event_delete', { p_id: id, p_base_revision: base }));
  },
  async changes(since) {
    const r = await accountRpc<{ now: string; events: DbEvent[] }>('calendar_changes', { p_since: since });
    return { now: r.now, events: r.events.map((e) => fromDb(e)!) };
  },
};

export const importTypicalWeek = (startsOn: string, timezone: string) =>
  accountRpc<number>('calendar_import_activities', { p_starts_on: startsOn, p_timezone: timezone });

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'no-household';

export interface CalendarHook {
  state: CalendarState;
  status: SyncStatus;
  household: Household | null;
  colors: Record<string, MarkerColor>;
  signedIn: boolean;
  /** Storage blocked (private mode): changes last only this visit. */
  unsaved: boolean;
  save(e: CalendarEvent): void;
  remove(id: string): void;
  skip(id: string, date: string): void;
  dismissConflicts(): void;
  syncNow(): Promise<void>;
}

export function useCalendar(): CalendarHook {
  const [state, setState] = useState<CalendarState>(loadState);
  const [status, setStatus] = useState<SyncStatus>('local');
  const [household, setHousehold] = useState<Household | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const ref = useRef(state);
  const syncing = useRef(false);

  const commit = useCallback((next: CalendarState) => {
    ref.current = next;
    setState(next);
    setUnsaved(!persist(next));
  }, []);

  const syncNow = useCallback(async () => {
    if (syncing.current || ref.current.scope === 'local' || isDemo()) return;
    syncing.current = true;
    setStatus('syncing');
    try {
      const start = ref.current;
      const startOps = new Map(start.outbox.map((o) => [o.opId, o]));
      const r = await sync(start, supabaseCalendarApi);
      // She may have changed things while the request was out: anything new or changed in the outbox since `start`
      // is re-applied on top of the result (saveLocal collapses edits into the same op, so compare the op itself).
      let merged = r.state;
      for (const o of ref.current.outbox) {
        if (startOps.get(o.opId) === o) continue;
        merged = o.kind === 'save' && o.event ? saveLocal(merged, o.event) : deleteLocal(merged, o.id);
      }
      commit(merged);
      setStatus(r.offline ? 'offline' : 'synced');
    } finally {
      syncing.current = false;
    }
  }, [commit]);

  // Who's here: signed in with a household → the household's calendar; otherwise this phone's own.
  useEffect(() => {
    if (isDemo()) {
      void appPreviewFamily().then(setHousehold);
      return;
    }
    if (!accountsEnabled()) return;
    getSession().then(async (s) => {
      if (!s) return;
      setSignedIn(true);
      const [h, access] = await Promise.all([accountStore.household().catch(() => null), householdAccess().catch(() => null)]);
      setHousehold(h);
      if (!access) return setStatus('no-household');
      commit(adopt(ref.current, access.householdId));
      await syncNow();
    }).catch(() => setStatus('offline'));
  }, [commit, syncNow]);

  // Catch up when the app comes back, the window refocuses, and every minute while open.
  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') void syncNow(); };
    window.addEventListener(APP_RESUME_EVENT, again);
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', again);
    const t = window.setInterval(again, 60_000);
    return () => {
      window.removeEventListener(APP_RESUME_EVENT, again);
      window.removeEventListener('online', again);
      document.removeEventListener('visibilitychange', again);
      window.clearInterval(t);
    };
  }, [syncNow]);

  const change = (f: (s: CalendarState) => CalendarState) => {
    commit(f(ref.current));
    void syncNow();
  };
  return {
    state, status, household, signedIn, unsaved,
    colors: household ? memberColors(household) : {},
    // Stamped here so the week before the Family Meeting can say "new" or "changed" before it syncs (the server's
    // own time replaces it once saved).
    save: (e) => change((s) => saveLocal(s, { ...e, updated_at: new Date().toISOString() })),
    remove: (id) => change((s) => deleteLocal(s, id)),
    skip: (id, date) => change((s) => skipOccurrence(s, id, date)),
    dismissConflicts: () => commit({ ...ref.current, conflicts: [] }),
    syncNow,
  };
}
