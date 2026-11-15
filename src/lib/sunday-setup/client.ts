/**
 * Sunday Setup's week plan on this phone, synced with the household (docs/ios/SUNDAY_SETUP.md).
 * Saved here first (omc:sunday-setup:v1, mirrored to native storage in the app), then pushed with the revision it
 * started from; if the other grown-up saved first, their version is loaded and she's told (never overwritten).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { accountRpc, accountsEnabled, getSession } from '../account';
import { householdAccess } from '../household/api';
import { emptyPlan, type WeekPlan } from './summary';
import { isDemo } from '../calendar/client';

const key = () => (isDemo() ? 'omc:sunday-setup-demo:v1' : 'omc:sunday-setup:v1');
type Stored = { scope: string; weeks: Record<string, WeekPlan & { dirty?: boolean }> };

function load(): Stored {
  try {
    const s = JSON.parse(localStorage.getItem(key()) ?? 'null') as Stored | null;
    if (s && s.weeks) return s;
  } catch { /* fall through */ }
  return { scope: 'local', weeks: {} };
}
function store(s: Stored) {
  try { localStorage.setItem(key(), JSON.stringify(s)); } catch { /* private mode: this visit only */ }
}

const remoteGet = (week: string) => accountRpc<WeekPlan | null>('sunday_setup_get', { p_week_start: week });
const remoteSave = (p: WeekPlan) => accountRpc<WeekPlan>('sunday_setup_save', {
  p_week_start: p.week_start, p_dinners: p.dinners, p_chores: p.chores, p_notes: p.notes ?? null,
  p_completed: Boolean(p.completed), p_base_revision: p.revision > 0 ? p.revision : null,
});

export type SetupSync = 'local' | 'saving' | 'saved' | 'offline';

export function useWeekPlan(week: string) {
  const [stored, setStored] = useState<Stored>(load);
  const [status, setStatus] = useState<SetupSync>('local');
  const [conflict, setConflict] = useState(false);
  const shared = useRef(false);
  const ref = useRef(stored);
  const plan = stored.weeks[week] ?? emptyPlan(week);

  const commit = (s: Stored) => { ref.current = s; setStored(s); store(s); };
  const put = (p: WeekPlan & { dirty?: boolean }) => commit({ ...ref.current, weeks: { ...ref.current.weeks, [p.week_start]: p } });

  const push = useCallback(async () => {
    const p = ref.current.weeks[week];
    if (!shared.current || !p?.dirty || isDemo()) return;
    setStatus('saving');
    try {
      const saved = await remoteSave(p);
      // Keep edits made while the request was out.
      const now = ref.current.weeks[week];
      put(now === p ? { ...saved, dirty: false } : { ...now, revision: saved.revision, dirty: true });
      setStatus('saved');
      if (now !== p) void push();
    } catch (e) {
      if ((e as Error).message === 'conflict') {
        const theirs = await remoteGet(week).catch(() => null);
        if (theirs) put({ ...theirs, dirty: false });
        setConflict(true);
        setStatus('saved');
      } else setStatus('offline');
    }
  }, [week]);

  useEffect(() => {
    if (isDemo() || !accountsEnabled()) return;
    getSession().then(async (s) => {
      if (!s) return;
      const access = await householdAccess().catch(() => null);
      if (!access) return;
      shared.current = true;
      if (ref.current.scope !== access.householdId) commit({ scope: access.householdId, weeks: ref.current.scope === 'local' ? ref.current.weeks : {} });
      const mine = ref.current.weeks[week];
      if (mine?.dirty) return void push();
      const theirs = await remoteGet(week);
      if (theirs) put({ ...theirs, dirty: false });
      setStatus('saved');
    }).catch(() => setStatus('offline'));
  }, [week, push]);

  const timer = useRef<number | undefined>(undefined);
  const update = (patch: Partial<WeekPlan>) => {
    put({ ...(ref.current.weeks[week] ?? emptyPlan(week)), ...patch, dirty: true });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void push(), 600);
  };
  return { plan, update, status, conflict, dismissConflict: () => setConflict(false), shared: shared.current };
}
