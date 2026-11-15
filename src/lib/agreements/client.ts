/**
 * Agreements in the browser / app: the outbox kept on this phone (./store.ts), the household's database calls, a React
 * hook, and the overlay that puts this phone's agreements into the family profile, so Today, the calendar, cleaning,
 * Family Responsibilities and the meeting all read the same thing, online or not.
 *
 * Signed-in families: offline-first, synced with the household. Labeled sample/demo families: their own tab-only store
 * (src/lib/club/store.ts → sampleStore), no sync.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { accountRpc } from '../account';
import { APP_RESUME_EVENT } from '../native/platform';
import type { FamilyProfile, Responsibility } from '../club/family-profile';
import {
  adoptAgreements, emptyAgreements, liveAgreements, newAgreementId, removeLocal, saveLocal, syncAgreements,
  type AgreementApi, type AgreementRow, type AgreementState,
} from './store';

const KEY = 'omc:household:agreements:v1';

export function loadAgreements(): AgreementState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as AgreementState | null;
    if (s && s.items && Array.isArray(s.outbox)) return { ...s, conflicts: s.conflicts ?? [] };
  } catch { /* fall through */ }
  return emptyAgreements();
}
export function persistAgreements(s: AgreementState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: this visit only */ }
}

const toDb = (r: AgreementRow) => ({
  id: r.id, category: r.category, text: r.text, owner_ids: r.owner_ids,
  ...(r.finished ? { finished: r.finished } : {}), ...(r.when ? { when: r.when } : {}),
  ...(r.month ? { month: r.month } : {}), ...(r.source ? { source: r.source } : {}),
});
export const accountAgreementApi: AgreementApi = {
  save: (row, base) => accountRpc<AgreementRow>('household_agreement_save', { p: toDb(row), p_base: base }),
  remove: (id, base) => accountRpc<AgreementRow | null>('household_agreement_remove', { p_id: id, p_base: base }),
  changes: (since) => accountRpc<{ now: string; agreements: AgreementRow[] }>('household_agreements', { p_since: since }),
};

/** The family profile with this phone's agreements in place of the profile's own confirmed rows. */
export function withAgreements(profile: FamilyProfile | null, s: AgreementState | null): FamilyProfile | null {
  if (!s) return profile;
  const agreements = liveAgreements(s).map((a): Responsibility => ({
    id: a.id, status: 'confirmed', category: a.category, ownerIds: a.owner_ids, helperIds: [],
    scope: a.owner_ids.length > 1 ? 'shared' : 'individual',
    agreement: {
      text: a.text, ...(a.finished ? { finished: a.finished } : {}), ...(a.when ? { when: a.when } : {}),
      ...(a.month ? { month: a.month } : {}), ...(a.source ? { source: a.source } : {}), ...(a.confirmed_at ? { agreedAt: a.confirmed_at } : {}),
    },
  }));
  if (!profile && !agreements.length) return null;
  const base = profile ?? { setupDone: [], setupCompleted: false, challenges: [], activities: [], responsibilities: [] };
  return { ...base, responsibilities: [...base.responsibilities.filter((r) => r.status !== 'confirmed'), ...agreements] };
}

/** Seed from the household's profile the first time (an agreement made on the website before this phone had any). */
export function seedFromProfile(s: AgreementState, profile: FamilyProfile | null): AgreementState {
  if (!profile || Object.keys(s.items).length || s.since) return s;
  const items: Record<string, AgreementRow> = {};
  for (const r of profile.responsibilities) {
    if (r.status !== 'confirmed' || !r.id || !r.agreement) continue;
    items[r.id] = {
      id: r.id, category: r.category, owner_ids: r.ownerIds, text: r.agreement.text, finished: r.agreement.finished ?? null,
      when: r.agreement.when ?? null, month: r.agreement.month ?? null, source: r.agreement.source ?? null,
      revision: -1, confirmed_at: r.agreement.agreedAt ?? null, // replaced by the server's copy on the first sync
    };
  }
  return { ...s, items };
}

export type AgreementStatus = 'none' | 'saving' | 'synced' | 'offline';

/** For one household (`scope` = its id); null scope: nothing to sync (signed out, or a demo). */
export function useAgreements(scope: string | null) {
  const [state, setState] = useState<AgreementState>(() => {
    const s = loadAgreements();
    return scope ? adoptAgreements(s, scope) : s;
  });
  const [status, setStatus] = useState<AgreementStatus>('none');
  const ref = useRef(state);
  const busy = useRef(false);
  const commit = useCallback((s: AgreementState) => { ref.current = s; setState(s); persistAgreements(s); }, []);

  const syncNow = useCallback(async () => {
    if (!scope || busy.current) return;
    busy.current = true;
    setStatus('saving');
    try {
      const start = ref.current;
      const startOps = new Map(start.outbox.map((o) => [o.opId, o]));
      const r = await syncAgreements(start, accountAgreementApi);
      // Changes made while the request was out are re-applied on top.
      let merged = r.state;
      for (const o of ref.current.outbox) {
        if (startOps.get(o.opId) === o) continue;
        merged = o.kind === 'save' && o.row ? saveLocal(merged, o.row) : removeLocal(merged, o.id);
      }
      commit(merged);
      setStatus(r.offline ? 'offline' : 'synced');
    } catch {
      setStatus('offline');
    } finally {
      busy.current = false;
    }
  }, [scope, commit]);

  useEffect(() => {
    if (!scope) return;
    commit(adoptAgreements(ref.current, scope));
    void syncNow();
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
  }, [scope, commit, syncNow]);

  const change = (f: (s: AgreementState) => AgreementState) => { commit(f(ref.current)); void syncNow(); };
  return {
    state: scope ? state : null,
    status,
    pending: state.outbox.length,
    seed: (profile: FamilyProfile | null) => { if (scope) commit(seedFromProfile(ref.current, profile)); },
    save: (row: Omit<AgreementRow, 'revision' | 'id'> & { id?: string }) => change((s) => saveLocal(s, { ...row, id: row.id ?? newAgreementId() })),
    remove: (id: string) => change((s) => removeLocal(s, id)),
    dismissConflicts: () => commit({ ...ref.current, conflicts: [] }),
    syncNow,
  };
}

/** Plain-language note for set-aside changes. */
export function conflictText(c: { text: string; kind: 'changed' | 'removed' | 'refused' }): string {
  if (c.kind === 'changed') return `“${c.text}” was changed by the other grown-up first, so we kept their version. Check it and make your change again if you still need it.`;
  if (c.kind === 'removed') return `“${c.text}” was removed on another phone, so your change wasn’t kept.`;
  return `“${c.text}” couldn’t be saved (someone in it may have left the family). Your family’s copy is shown.`;
}
