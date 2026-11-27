/**
 * V20 in production: the household's intelligence state (memory, feedback, reports, completion history, what was shown,
 * meeting topics, claims, notification preferences, V20 part details), shared by both adults
 * (supabase/migrations/20261215000000_household_intelligence_push.sql → household_intelligence).
 *
 * Offline-first like agreements: a change applies on this device at once and is kept with the copy it started from
 * (base). Sync sends it with the base revision; if the other adult saved first, the server returns its copy and this
 * device merges three ways (base → mine onto theirs), field by field, so two adults' feedback or reports never erase
 * each other. Never private: the state only holds keys, fingerprints and the family's own words.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { accountRpc, loadSession } from '../account';
import { addDays } from '../calendar/recurrence';
import type { IntelState } from '../v18/engine';
import type { Part } from '../v16/model';

/** V20 details an agreement row can't hold: its event, timing, need, one-time date, who asked, done for a date. */
export interface PartMeta { eventLink?: string; offsetDays?: number; need?: string; onDate?: string; askedBy?: string; lastChangedBy?: string; lastChangedOn?: string; cue?: string; doneOn?: string[] }

/** What is stored for the household (never the viewer, the demo clock or the interpreter switch: those are per device). */
export type SharedIntel = Omit<IntelState, 'viewer' | 'aiAvailable' | 'scenario' | 'clock'> & {
  partMeta?: Record<string, PartMeta>;
  /** Suggestions and handoffs not yet agreed (both adults see them). Agreed ones live in agreements. */
  pendingParts?: Record<string, Part>;
};

export const emptyShared = (): SharedIntel => ({ memory: { confirmed: [], observations: [], forgotten: {} }, resolutions: [], topics: [], baseline: null, interpretations: {} });

// ------------------------------------------------------------------ three-way merge (pure; tests/v20-live.test.ts)

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Apply what changed from `base` to `mine` onto `theirs`. Objects merge by key, arrays as sets, scalars: mine wins. */
export function merge3<T>(base: T, mine: T, theirs: T): T {
  if (same(mine, base)) return theirs;
  if (same(theirs, base)) return mine;
  if (isObj(mine) && isObj(theirs)) {
    const b: Record<string, unknown> = isObj(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(b)])) {
      const inMine = k in mine, inTheirs = k in theirs, inBase = k in b;
      if (!inMine && inBase && same(theirs[k], b[k])) continue; // I removed it, they didn't touch it
      if (!inTheirs && inBase && same(mine[k], b[k])) continue; // they removed it, I didn't touch it
      if (!inMine && !inBase) { out[k] = theirs[k]; continue; }
      if (!inTheirs && !inBase) { out[k] = mine[k]; continue; }
      const v = merge3(b[k], inMine ? mine[k] : undefined, inTheirs ? theirs[k] : undefined);
      if (v !== undefined) out[k] = v;
    }
    return out as T;
  }
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const b = Array.isArray(base) ? base.map((x) => JSON.stringify(x)) : [];
    const m = mine.map((x) => JSON.stringify(x));
    const removed = new Set(b.filter((x) => !m.includes(x)));
    const out = theirs.filter((x) => !removed.has(JSON.stringify(x)));
    const have = new Set(out.map((x) => JSON.stringify(x)));
    for (const x of mine) { const j = JSON.stringify(x); if (!b.includes(j) && !have.has(j)) { out.push(x); have.add(j); } }
    return out as T;
  }
  return mine;
}

/** Keep the document small: old feedback, reports, history and delivery records age out. Never what the family chose to keep. */
export function prune(s: SharedIntel, today: string): SharedIntel {
  const after = (d: string | undefined, days: number) => !d || d >= addDays(today, -days);
  const recent = <V,>(o: Record<string, V> | undefined, field: (v: V) => string | undefined, days: number) =>
    o ? Object.fromEntries(Object.entries(o).filter(([, v]) => after(field(v), days))) : o;
  return {
    ...s,
    feedback: s.feedback?.filter((f) => f.kind === 'never' || f.kind === 'not-relevant' || after(f.on, 90)),
    reports: s.reports?.filter((r) => after(r.date, 7)),
    history: s.history?.slice(-200),
    resolutions: s.resolutions?.filter((r) => after(r.on, 90)),
    shown: recent(s.shown, (v) => v.on, 30),
    sent: recent(s.sent, (v) => v.date, 14),
    claims: recent(s.claims, (v) => v.on, 14),
    talked: s.talked ? Object.fromEntries(Object.entries(s.talked).filter(([, d]) => after(d, 60))) : s.talked,
    interpretations: Object.fromEntries(Object.entries(s.interpretations ?? {}).slice(-200)),
    memory: { ...s.memory, observations: s.memory.observations.slice(-300) },
    pendingParts: s.pendingParts ? Object.fromEntries(Object.entries(s.pendingParts).filter(([, p]) => !p.onDate || p.onDate >= addDays(today, -7))) : s.pendingParts,
  };
}

// ------------------------------------------------------------------ the browser hook

interface Stored { scope: string; adult: string; revision: number; base: SharedIntel; state: SharedIntel; dirty: boolean }
interface Reply { conflict: boolean; revision: number; state: SharedIntel }
const KEY = 'omc:household:intelligence:v1';
const read = (scope: string, adult: string): Stored | null => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null;
    return s && s.scope === scope && s.adult === adult ? s : null;
  } catch { return null; }
};
const write = (s: Stored) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this visit only */ } };
const normalize = (s: Partial<SharedIntel> | null | undefined): SharedIntel => ({ ...emptyShared(), ...(s ?? {}) });

export type IntelStatus = 'loading' | 'synced' | 'saving' | 'offline';

/** The household's shared intelligence state for `scope` (the household id). Null scope: signed out, nothing kept. */
export function useHouseholdIntel(scope: string | null, today: string) {
  const adult = loadSession()?.user_id ?? '';
  const [doc, setDoc] = useState<Stored | null>(() => (scope && adult ? read(scope, adult) : null));
  const [status, setStatus] = useState<IntelStatus>('loading');
  const ref = useRef(doc);
  ref.current = doc;
  const busy = useRef(false);
  const again = useRef(false);

  const commit = useCallback((d: Stored) => { ref.current = d; setDoc(d); write(d); }, []);

  const sync = useCallback(async () => {
    if (!scope || !adult) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    try {
      let d = ref.current ?? { scope, adult, revision: 0, base: emptyShared(), state: emptyShared(), dirty: false };
      for (let attempt = 0; attempt < 4; attempt++) {
        if (!d.dirty) {
          const r = await accountRpc<Reply>('household_intelligence', { p_household: scope });
          if (ref.current?.dirty) { d = ref.current; continue; } // changed while asking: send it instead
          const st = normalize(r.state);
          commit({ scope, adult, revision: r.revision, base: st, state: st, dirty: false });
          break;
        }
        const sending = prune(d.state, today);
        const r = await accountRpc<Reply>('household_intelligence', { p_household: scope, p_base: d.revision, p_state: sending });
        const latest = ref.current ?? d;
        if (r.conflict) {
          // The other adult saved first: put my changes on top of theirs, then try again.
          const theirs = normalize(r.state);
          d = { ...latest, revision: r.revision, base: theirs, state: merge3(latest.base, latest.state, theirs), dirty: true };
          commit(d);
          continue;
        }
        // Saved. Anything changed on this device meanwhile stays waiting for the next round.
        const changedSince = !same(latest.state, d.state);
        d = { ...latest, revision: r.revision, base: sending, state: changedSince ? merge3(d.state, latest.state, sending) : sending, dirty: changedSince };
        commit(d);
        if (!d.dirty) break;
      }
      setStatus('synced');
    } catch {
      setStatus('offline');
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; void sync(); }
    }
  }, [scope, adult, today, commit]);

  useEffect(() => {
    if (!scope || !adult) { setDoc(null); return; }
    const cached = read(scope, adult);
    if (cached) { ref.current = cached; setDoc(cached); }
    void sync();
    const refresh = () => { if (document.visibilityState === 'visible') void sync(); };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const t = window.setInterval(refresh, 15_000);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.clearInterval(t); };
  }, [scope, adult, sync]);

  const update = useCallback((f: (s: SharedIntel) => SharedIntel) => {
    if (!scope || !adult) return;
    const d = ref.current ?? { scope, adult, revision: 0, base: emptyShared(), state: emptyShared(), dirty: false };
    const next = f(d.state);
    if (same(next, d.state)) return;
    commit({ ...d, state: next, dirty: true });
    setStatus('saving');
    void sync();
  }, [scope, adult, commit, sync]);

  return { state: doc?.state ?? null, loaded: Boolean(doc), status, update, syncNow: sync };
}
