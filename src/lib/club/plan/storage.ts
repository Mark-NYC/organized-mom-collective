/**
 * Tab-scoped plan storage until account persistence exists: sessionStorage, one entry per printable,
 * `{ current: '<sample>:<householdId>', state }`, so one family's plan is never shown to another.
 * Family data never goes into localStorage (src/lib/club/store.ts).
 */
export const planKey = (sample: string | null | undefined, householdId: string) => `${sample}:${householdId}`;

export interface ScopedPlan<S> {
  current: string;
  state: S;
}

/** The saved state for this family, if the stored JSON belongs to it and passes `valid`. */
export function readScoped<S>(raw: string | null, key: string, valid: (state: unknown) => state is S): S | null {
  try {
    const saved = JSON.parse(raw ?? 'null') as Partial<ScopedPlan<unknown>> | null;
    if (saved?.current === key && valid(saved.state)) return saved.state;
  } catch {
    /* not a plan */
  }
  return null;
}

export const tabStorage = {
  get(key: string): string | null {
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    try { sessionStorage.setItem(key, value); } catch { /* this visit only */ }
  },
  remove(key: string) {
    try { sessionStorage.removeItem(key); } catch { /* nothing stored */ }
  },
};
