/**
 * The household's development records in the browser / app (Club families, in the weekly Family Meeting).
 *
 * Online only, like follow-through check-ins: a decision is a moment in the meeting, not a background edit, and the
 * database is the only judge of household and Club access (household_development_decide). The record and its family
 * agreement are saved by the database in one transaction; the phone shows "saved" only after that answer arrives.
 * Retries are safe: the same record id and agreement id are sent again, and the database returns what it saved.
 *
 * Records are tagged with the scope (user + household) they were loaded for (./meeting-plan.ts): after a sign-out,
 * an account switch or a household change, the previous family's records are never returned.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SESSION_STORAGE_KEY, accountRpc, getSession, loadSession } from '../account';
import { isDemo } from '../calendar/client';
import { accountStore } from '../club/store';
import { APP_RESUME_EVENT } from '../native/platform';
import { SKILLS_LIBRARY_VERSION } from './skills';
import { recordsFor, type ScopedRecords } from './meeting-plan';
import { decisionToDb, recordFromDb, type DbAgreement, type DbDevelopmentRecord, type DecisionInput, type DevelopmentRecord } from './records';

export type DecideError = 'conflict' | 'club_required' | 'offline' | 'invalid' | 'exists' | 'signed_out' | 'too_many';
export type DecideResult =
  | { ok: true; record: DevelopmentRecord; agreement?: DbAgreement; adopted: boolean }
  | { ok: false; error: DecideError };

/** A database error message → what the meeting tells the family. Anything unknown counts as "not saved". */
export function decideError(e: unknown): DecideError {
  const m = e instanceof Error ? e.message : '';
  if (/conflict/.test(m)) return 'conflict';
  if (/club_required/.test(m)) return 'club_required';
  if (/signed_out|not_signed_in|no_household/.test(m)) return 'signed_out';
  if (/too_many/.test(m)) return 'too_many';
  if (/exists|removed/.test(m)) return 'exists';
  if (/invalid/.test(m)) return 'invalid';
  return 'offline';
}

/**
 * Who is signed in and whether they have Club, rechecked when the app resumes, the tab becomes visible, or another tab
 * signs in or out. A new account starts without Club until the database confirms it. A network failure keeps the last
 * confirmed answer for the same account; a definite "no access" (or a refused write: `revoke`) removes it at once.
 */
export function useMeetingAccess() {
  const [state, setState] = useState<{ userId: string | null; club: boolean; checked: boolean }>({ userId: null, club: false, checked: false });
  const seq = useRef(0);
  const check = useCallback(async () => {
    const mine = ++seq.current;
    const s = await getSession().catch(() => null);
    const userId = s?.user_id ?? null;
    if (mine !== seq.current) return;
    if (!userId) { setState({ userId: null, club: false, checked: true }); return; }
    setState((prev) => (prev.userId === userId ? prev : { userId, club: false, checked: false }));
    let access: boolean | null = null;
    try { access = Boolean((await accountStore.me())?.access); } catch { access = null; }
    if (mine !== seq.current || loadSession()?.user_id !== userId) return; // switched accounts meanwhile
    setState((prev) => ({ userId, club: access ?? (prev.userId === userId ? prev.club : false), checked: true }));
  }, []);
  useEffect(() => {
    void check();
    const visible = () => { if (document.visibilityState === 'visible') void check(); };
    const storage = (e: StorageEvent) => { if (e.key === SESSION_STORAGE_KEY || e.key === null) void check(); };
    window.addEventListener(APP_RESUME_EVENT, visible);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(APP_RESUME_EVENT, visible);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('storage', storage);
    };
  }, [check]);
  const revoke = useCallback(() => setState((s) => ({ ...s, club: false })), []);
  return { ...state, recheck: check, revoke };
}

/** `scope` from recordScope(): null loads nothing (free, signed out, sample family). */
export function useDevelopment(scope: string | null) {
  const [loaded, setLoaded] = useState<ScopedRecords | null>(null);
  const current = useRef(scope);
  current.current = scope;
  const load = useCallback(async () => {
    if (!scope || isDemo()) return;
    try {
      const rows = await accountRpc<DbDevelopmentRecord[]>('household_development');
      if (current.current === scope) setLoaded({ scope, records: rows.map(recordFromDb) });
    } catch {
      if (current.current === scope) setLoaded({ scope, records: null });
    }
  }, [scope]);
  useEffect(() => { void load(); }, [load]);

  /** One explicit family decision. New records pass a fresh id with memberId/skillId/title. */
  const decide = useCallback(async (
    target: DevelopmentRecord | { id: string; memberId: string; skillId: string; title: string },
    input: DecisionInput,
  ): Promise<DecideResult> => {
    if (!scope) return { ok: false, error: 'club_required' };
    const isNew = !('revision' in target);
    try {
      const row = await accountRpc<DbDevelopmentRecord>('household_development_decide', {
        p: decisionToDb(target, input, SKILLS_LIBRARY_VERSION, isNew),
        p_base: isNew ? null : (target as DevelopmentRecord).revision,
      });
      const record = recordFromDb(row);
      if (current.current === scope) {
        setLoaded((l) => (l && l.scope === scope ? { scope, records: [...(l.records ?? []).filter((r) => r.id !== record.id), record] } : l));
      }
      return { ok: true, record, ...(row.agreement ? { agreement: row.agreement } : {}), adopted: Boolean(row.adopted) };
    } catch (e) {
      const error = decideError(e);
      if (error === 'conflict' || error === 'exists') void load();
      return { ok: false, error };
    }
  }, [scope, load]);

  return { records: recordsFor(loaded, scope), reload: load, decide };
}

export const newRecordId = () =>
  (globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));
