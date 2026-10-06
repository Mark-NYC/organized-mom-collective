import { useCallback, useEffect, useState } from 'react';
import { dateKey } from './dates';
import { readList, writeList } from './storage';

/**
 * The current local date. Re-checks when the app regains focus and once a
 * minute, so a phone left open overnight rolls over to the new day.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const check = () => {
      const now = new Date();
      setToday((prev) => (dateKey(prev) === dateKey(now) ? prev : now));
    };
    const id = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  return today;
}

/**
 * A set of checked task ids persisted under `key`.
 * State is only written on explicit toggles — never as a side effect of rendering.
 */
export function useCheckedSet(key: string): [Set<string>, (id: string) => void] {
  const [state, setState] = useState(() => ({ key, ids: readList(key) }));

  // Key changed (e.g. the day rolled over): load that key's saved state.
  const ids = state.key === key ? state.ids : readList(key);
  if (state.key !== key) setState({ key, ids });

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) setState({ key, ids: readList(key) });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const toggle = useCallback(
    (id: string) => {
      // Read fresh from storage so we never clobber changes made elsewhere.
      const current = readList(key);
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      writeList(key, next);
      setState({ key, ids: next });
    },
    [key],
  );

  return [new Set(ids), toggle];
}
