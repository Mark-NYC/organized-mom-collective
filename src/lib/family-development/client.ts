/**
 * The household's development records in the browser / app (Club families, in the weekly Family Meeting).
 *
 * Online only, like follow-through check-ins: a decision is a moment in the meeting, not a background edit, and the
 * database is the only judge of household and Club access (household_development_decide). If the read fails
 * (signed out, the sample family, offline, or the migration not applied yet) `records` stays null and the meeting
 * shows no development guidance at all: it works exactly as before.
 */
import { useCallback, useEffect, useState } from 'react';
import { accountRpc, getSession } from '../account';
import { isDemo } from '../calendar/client';
import { SKILLS_LIBRARY_VERSION } from './skills';
import { decisionToDb, recordFromDb, type DbDevelopmentRecord, type DecisionInput, type DevelopmentRecord } from './records';

export type DecideResult = { ok: true; record: DevelopmentRecord } | { ok: false; error: 'conflict' | 'club_required' | 'offline' | 'invalid' | 'exists' };

export function useDevelopment(enabled: boolean) {
  const [records, setRecords] = useState<DevelopmentRecord[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!enabled || isDemo() || !(await getSession().catch(() => null))) { setRecords(null); setLoaded(true); return; }
    try {
      const rows = await accountRpc<DbDevelopmentRecord[]>('household_development');
      setRecords(rows.map(recordFromDb));
    } catch {
      setRecords(null);
    }
    setLoaded(true);
  }, [enabled]);
  useEffect(() => { void load(); }, [load]);

  /** One explicit family decision. New records pass a fresh id with memberId/skillId/title. */
  const decide = useCallback(async (
    target: DevelopmentRecord | { id: string; memberId: string; skillId: string; title: string },
    input: DecisionInput,
  ): Promise<DecideResult> => {
    const isNew = !('revision' in target);
    try {
      const row = await accountRpc<DbDevelopmentRecord>('household_development_decide', {
        p: decisionToDb(target, input, SKILLS_LIBRARY_VERSION, isNew),
        p_base: isNew ? null : (target as DevelopmentRecord).revision,
      });
      const record = recordFromDb(row);
      setRecords((list) => [...(list ?? []).filter((r) => r.id !== record.id), record]);
      return { ok: true, record };
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      const error = /conflict/.test(m) ? 'conflict' : /club_required/.test(m) ? 'club_required' : /exists/.test(m) ? 'exists' : /invalid/.test(m) ? 'invalid' : 'offline';
      if (error === 'conflict' || error === 'exists') void load();
      return { ok: false, error };
    }
  }, [load]);

  return { records, loaded, reload: load, decide };
}

export const newRecordId = () =>
  (globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));
