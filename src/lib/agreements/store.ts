/**
 * Family Meeting agreements on this phone: offline-first, then synced with the household
 * (supabase/migrations/20261127000000_family_agreements.sql; docs/ios/ACCESS_MODEL_ASSESSMENT.md → 3).
 *
 * - "We agreed", edit, reassign and remove apply here at once and wait in an outbox (localStorage, mirrored to native
 *   storage in the app), so nothing is lost when the signal drops or the app is closed.
 * - sync(): pushes the outbox in order with the revision each change started from, then pulls what changed (with a
 *   5-minute overlap; merging is by revision, so pulling twice is harmless).
 * - The other adult is never overwritten. The server answers:
 *     'conflict' → they changed it first: theirs stays, ours is set aside and named;
 *     'removed'  → they removed it: it stays removed, ours is named;
 *     'invalid'  → refused (e.g. reassigned to someone who left the family): ours is dropped and named.
 *   The same suggestion agreed on both phones becomes one agreement: the server returns the existing one and this
 *   phone takes its id.
 *
 * Pure state functions (tests/agreements-store.test.ts); the browser wrapper is ./client.ts.
 */
import type { ResponsibilityCategory } from '../../data/club/family-profile';
import { retryLater } from '../sync-errors';

export interface AgreementRow {
  id: string;
  category: ResponsibilityCategory;
  owner_ids: string[];
  text: string;
  finished?: string | null;
  when?: string | null;
  month?: string | null;
  source?: string | null;
  /** Server revision this copy matches; 0 = not on the server yet. */
  revision: number;
  deleted?: boolean;
  confirmed_at?: string | null;
  updated_at?: string | null;
}

export interface AgreementOp { opId: string; kind: 'save' | 'remove'; id: string; base: number | null; row?: AgreementRow }
export interface AgreementConflict { id: string; text: string; kind: 'changed' | 'removed' | 'refused'; at: string }
export interface AgreementState {
  /** The household id these belong to; 'none' before one is known. */
  scope: string;
  items: Record<string, AgreementRow>;
  outbox: AgreementOp[];
  since: string | null;
  conflicts: AgreementConflict[];
}
export interface AgreementApi {
  save(row: AgreementRow, base: number | null): Promise<AgreementRow>;
  remove(id: string, base: number | null): Promise<AgreementRow | null>;
  changes(since: string | null): Promise<{ now: string; agreements: AgreementRow[] }>;
}

export const emptyAgreements = (scope = 'none'): AgreementState => ({ scope, items: {}, outbox: [], since: null, conflicts: [] });
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
export const newAgreementId = () => uid();

/** The agreements the family has now (not removed), oldest first. */
export const liveAgreements = (s: AgreementState) =>
  Object.values(s.items).filter((a) => !a.deleted).sort((a, b) => (a.confirmed_at ?? '').localeCompare(b.confirmed_at ?? ''));

// ------------------------------------------------------------------ changes on this phone

/** Agree, edit or reassign here; queue it. Edits before a sync collapse into one save from the same base. */
export function saveLocal(s: AgreementState, row: Omit<AgreementRow, 'revision'> & { revision?: number }): AgreementState {
  const prev = s.items[row.id];
  const pending = s.outbox.find((o) => o.id === row.id && o.kind === 'save');
  const base = pending ? pending.base : prev && prev.revision > 0 ? prev.revision : null;
  const next: AgreementRow = { ...row, revision: prev?.revision ?? 0, deleted: false, confirmed_at: prev?.confirmed_at ?? row.confirmed_at ?? null };
  const op: AgreementOp = { opId: pending?.opId ?? uid(), kind: 'save', id: row.id, base, row: next };
  return {
    ...s,
    items: { ...s.items, [row.id]: next },
    outbox: pending ? s.outbox.map((o) => (o === pending ? op : o)) : [...s.outbox, op],
  };
}

/** Remove here; queue it. One never sent to the server just disappears. */
export function removeLocal(s: AgreementState, id: string): AgreementState {
  const prev = s.items[id];
  if (!prev || prev.deleted) return s;
  const pendingSave = s.outbox.find((o) => o.id === id && o.kind === 'save');
  const outbox = s.outbox.filter((o) => o.id !== id);
  if (prev.revision === 0) {
    const { [id]: _gone, ...items } = s.items;
    return { ...s, items, outbox };
  }
  return {
    ...s,
    items: { ...s.items, [id]: { ...prev, deleted: true } },
    outbox: [...outbox, { opId: uid(), kind: 'remove', id, base: pendingSave?.base ?? prev.revision }],
  };
}

// ------------------------------------------------------------------ the server's copies

/** Take the server's copies, except for agreements with a change still waiting here. */
export function mergeRemote(s: AgreementState, remote: AgreementRow[]): AgreementState {
  const waiting = new Set(s.outbox.map((o) => o.id));
  const items = { ...s.items };
  for (const r of remote) {
    if (waiting.has(r.id)) continue;
    const mine = items[r.id];
    if (mine && mine.revision > r.revision) continue;
    items[r.id] = r;
  }
  return { ...s, items };
}

/** Signed in to a household: agreements made before it was known upload to it; another household starts clean. */
export function adoptAgreements(s: AgreementState, scope: string): AgreementState {
  if (s.scope === scope) return s;
  if (s.scope === 'none') return { ...s, scope, since: null };
  return emptyAgreements(scope);
}

// ------------------------------------------------------------------ sync

export interface AgreementSyncResult { state: AgreementState; pushed: number; offline: boolean }

export async function syncAgreements(start: AgreementState, api: AgreementApi, now = () => new Date().toISOString()): Promise<AgreementSyncResult> {
  let s = start;
  if (s.scope === 'none') return { state: s, pushed: 0, offline: false };
  let pushed = 0;
  for (const op of [...s.outbox]) {
    const drop = (st: AgreementState) => ({ ...st, outbox: st.outbox.filter((o) => o.opId !== op.opId) });
    try {
      if (op.kind === 'save' && op.row) {
        const saved = await api.save(op.row, op.base);
        const items = { ...s.items };
        if (saved.id !== op.id) delete items[op.id]; // already agreed on the other phone: one agreement, its id
        items[saved.id] = saved;
        s = drop({ ...s, items });
      } else if (op.kind === 'remove') {
        const removed = await api.remove(op.id, op.base);
        const items = { ...s.items };
        if (removed) items[op.id] = removed;
        else delete items[op.id];
        s = drop({ ...s, items });
      }
      pushed++;
    } catch (e) {
      if (retryLater(e)) return { state: s, pushed, offline: true }; // no signal, signed out, server trouble: keep it all
      const reason = (e as Error).message;
      const text = op.row?.text ?? s.items[op.id]?.text ?? 'An agreement';
      const kind: AgreementConflict['kind'] = reason === 'conflict' ? 'changed' : reason === 'removed' ? 'removed' : 'refused';
      const items = { ...s.items };
      if (kind === 'removed') items[op.id] = { ...(items[op.id] ?? op.row!), deleted: true };
      else if ((items[op.id]?.revision ?? 0) === 0) delete items[op.id]; // never reached the server
      // 'changed' / a refused edit: the pull below brings the household's copy back.
      if (kind !== 'removed' && items[op.id]) items[op.id] = { ...items[op.id], revision: -1 }; // force the pull to replace it
      s = drop({ ...s, items, conflicts: [...s.conflicts, { id: op.id, text, kind, at: now() }] });
    }
  }
  try {
    const sinceWithOverlap = s.since ? new Date(Date.parse(s.since) - 5 * 60_000).toISOString() : null;
    // A forced refresh (a conflict above) pulls everything, so the household's copy replaces ours.
    const forced = Object.values(s.items).some((a) => a.revision < 0);
    const r = await api.changes(forced ? null : sinceWithOverlap);
    let merged = mergeRemote(s, r.agreements);
    if (forced) {
      const onServer = new Set(r.agreements.map((a) => a.id));
      const items = Object.fromEntries(Object.entries(merged.items).filter(([id, a]) => a.revision >= 0 || onServer.has(id)));
      merged = { ...merged, items };
    }
    s = { ...merged, since: r.now };
  } catch (e) {
    if (retryLater(e)) return { state: s, pushed, offline: true };
    throw e;
  }
  return { state: s, pushed, offline: false };
}
