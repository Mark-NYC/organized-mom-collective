import { describe, expect, it } from 'vitest';
import {
  adoptAgreements, emptyAgreements, liveAgreements, removeLocal, saveLocal, syncAgreements,
  type AgreementApi, type AgreementRow, type AgreementState,
} from '../src/lib/agreements/store';

/** A fake household server with the rules of household_agreement_save / _remove / household_agreements. */
function server() {
  const rows = new Map<string, AgreementRow & { t: number }>();
  let clock = 1000;
  let online = true;
  const archived = new Set<string>();
  const out = ({ t: _t, ...r }: AgreementRow & { t: number }): AgreementRow => r;
  const api: AgreementApi = {
    async save(row, base) {
      if (!online) throw new TypeError('Failed to fetch');
      if (row.owner_ids.some((o) => archived.has(o))) throw new Error('invalid');
      const cur = rows.get(row.id);
      if (cur) {
        if (cur.deleted) throw new Error('removed');
        if (base !== cur.revision) throw new Error('conflict');
        const next = { ...row, revision: cur.revision + 1, deleted: false, confirmed_at: cur.confirmed_at, t: ++clock };
        rows.set(row.id, next);
        return out(next);
      }
      if (base !== null) throw new Error('removed');
      const same = [...rows.values()].find((r) => !r.deleted && r.source && r.source === row.source && r.month === row.month && r.owner_ids.join() === row.owner_ids.join());
      if (same) return out(same);
      const next = { ...row, revision: 1, deleted: false, confirmed_at: `c${clock}`, t: ++clock };
      rows.set(row.id, next);
      return out(next);
    },
    async remove(id, base) {
      if (!online) throw new TypeError('Failed to fetch');
      const cur = rows.get(id);
      if (!cur) return null;
      if (cur.deleted) return out(cur);
      if (base !== cur.revision) throw new Error('conflict');
      const next = { ...cur, deleted: true, revision: cur.revision + 1, t: ++clock };
      rows.set(id, next);
      return out(next);
    },
    async changes(since) {
      if (!online) throw new TypeError('Failed to fetch');
      const t = since ? Number(since) : -Infinity;
      return { now: String(clock), agreements: [...rows.values()].filter((r) => (since ? r.t > t : !r.deleted)).map(out) };
    },
  };
  return { api, rows, archived, offline: () => { online = false; }, online: () => { online = true; } };
}
// The store subtracts a 5-minute overlap from `since` with Date.parse; the fake clock is a plain number, so give it
// an ISO-shaped value that parses back to itself (ms since epoch).
function fixClock(s: AgreementState): AgreementState { return s.since ? { ...s, since: new Date(Number(s.since) + 5 * 60_000).toISOString() } : s; }
const syncIt = async (s: AgreementState, api: AgreementApi) => {
  const wrap: AgreementApi = { ...api, changes: (since) => api.changes(since ? String(Date.parse(since)) : null) };
  const r = await syncAgreements(s, wrap);
  return { ...r, state: fixClock(r.state) };
};

const row = (id: string, o: Partial<AgreementRow> = {}): AgreementRow => ({
  id, category: 'cleaning', owner_ids: ['maya'], text: 'Take out the trash', month: '2026-11', source: 'month:nov-trash', revision: 0, ...o,
});

describe('agreements on this phone', () => {
  it('agree offline, sync later: saved once, with the server revision', async () => {
    const srv = server();
    srv.offline();
    let s = saveLocal(emptyAgreements('h1'), row('a1'));
    let r = await syncIt(s, srv.api);
    expect(r.offline).toBe(true);
    expect(r.state.outbox).toHaveLength(1);
    expect(liveAgreements(r.state).map((a) => a.text)).toEqual(['Take out the trash']);
    srv.online();
    r = await syncIt(r.state, srv.api);
    expect(r.offline).toBe(false);
    expect(r.state.outbox).toHaveLength(0);
    expect(r.state.items.a1.revision).toBe(1);
    expect(srv.rows.size).toBe(1);
  });

  it('edits before a sync collapse into one save', async () => {
    const srv = server();
    let s = saveLocal(emptyAgreements('h1'), row('a1'));
    s = saveLocal(s, row('a1', { text: 'Trash and recycling' }));
    expect(s.outbox).toHaveLength(1);
    const r = await syncIt(s, srv.api);
    expect(srv.rows.get('a1')!.text).toBe('Trash and recycling');
  });

  it('the same suggestion agreed on two phones offline becomes one agreement', async () => {
    const srv = server();
    const a = await syncIt(saveLocal(emptyAgreements('h1'), row('phoneA')), srv.api);
    const b = await syncIt(saveLocal(emptyAgreements('h1'), row('phoneB')), srv.api);
    expect(srv.rows.size).toBe(1);
    expect(Object.keys(b.state.items)).toEqual(['phoneA']);
    expect(a.state.items.phoneA.revision).toBe(1);
  });

  it('edit vs edit: the other adult got there first; theirs stays, ours is named, nothing overwritten', async () => {
    const srv = server();
    const base = (await syncIt(saveLocal(emptyAgreements('h1'), row('a1')), srv.api)).state;
    let mom = base;
    let dad = base;
    dad = (await syncIt(saveLocal(dad, { ...dad.items.a1, owner_ids: ['leo'] }), srv.api)).state;
    srv.offline();
    mom = saveLocal(mom, { ...mom.items.a1, text: 'Mom’s words' });
    srv.online();
    const r = await syncIt(mom, srv.api);
    expect(r.state.conflicts).toEqual([expect.objectContaining({ id: 'a1', kind: 'changed', text: 'Mom’s words' })]);
    expect(r.state.items.a1.owner_ids).toEqual(['leo']);
    expect(r.state.items.a1.text).toBe('Take out the trash');
    expect(srv.rows.get('a1')!.owner_ids).toEqual(['leo']);
    expect(dad.items.a1.revision).toBe(2);
  });

  it('edit vs remove: it stays removed and the edit is named, never brought back', async () => {
    const srv = server();
    const base = (await syncIt(saveLocal(emptyAgreements('h1'), row('a1')), srv.api)).state;
    await syncIt(removeLocal(base, 'a1'), srv.api);
    const r = await syncIt(saveLocal(base, { ...base.items.a1, text: 'edited offline' }), srv.api);
    expect(r.state.conflicts.map((c) => c.kind)).toEqual(['removed']);
    expect(liveAgreements(r.state)).toEqual([]);
    expect(srv.rows.get('a1')!.deleted).toBe(true);
  });

  it('remove vs edit: our stale remove is refused, their edit stays', async () => {
    const srv = server();
    const base = (await syncIt(saveLocal(emptyAgreements('h1'), row('a1')), srv.api)).state;
    await syncIt(saveLocal(base, { ...base.items.a1, text: 'their edit' }), srv.api);
    const r = await syncIt(removeLocal(base, 'a1'), srv.api);
    expect(r.state.conflicts.map((c) => c.kind)).toEqual(['changed']);
    expect(liveAgreements(r.state).map((a) => a.text)).toEqual(['their edit']);
  });

  it('reassigning to someone who left the family is refused and named; the household copy comes back', async () => {
    const srv = server();
    const base = (await syncIt(saveLocal(emptyAgreements('h1'), row('a1')), srv.api)).state;
    srv.archived.add('gone');
    const r = await syncIt(saveLocal(base, { ...base.items.a1, owner_ids: ['gone'] }), srv.api);
    expect(r.state.conflicts.map((c) => c.kind)).toEqual(['refused']);
    expect(r.state.items.a1.owner_ids).toEqual(['maya']);
  });

  it('a removal made on the other phone arrives as a tombstone', async () => {
    const srv = server();
    const base = (await syncIt(saveLocal(emptyAgreements('h1'), row('a1')), srv.api)).state;
    await syncIt(removeLocal(base, 'a1'), srv.api);
    const r = await syncIt(base, srv.api);
    expect(liveAgreements(r.state)).toEqual([]);
  });

  it('removing one that never reached the server just drops it', () => {
    const s = removeLocal(saveLocal(emptyAgreements('h1'), row('a1')), 'a1');
    expect(s.items).toEqual({});
    expect(s.outbox).toEqual([]);
  });

  it('a phone with no household yet keeps them and uploads after signing in; another household starts clean', () => {
    const s = saveLocal(emptyAgreements(), row('a1'));
    expect(adoptAgreements(s, 'h1').items.a1).toBeTruthy();
    expect(adoptAgreements({ ...s, scope: 'h1' }, 'h2')).toEqual(emptyAgreements('h2'));
  });
});

describe('offline agreements survive trouble that isn\'t about them', () => {
  it('server trouble, a rate limit or an expired sign-in keeps every offline change', async () => {
    const srv = server();
    let s = saveLocal(saveLocal(adoptAgreements(emptyAgreements(), 'h1'), row('a')), row('b', { source: 'month:nov-dishes', text: 'Dishes' }));
    for (const failure of ['request_failed_503', 'signed_out', 'request_failed_429', 'no_household']) {
      const failing: AgreementApi = { ...srv.api, save: async () => { throw new Error(failure); } };
      const r = await syncIt(s, failing);
      expect(r.offline, failure).toBe(true);
      expect(r.state.outbox.map((o) => o.id), failure).toEqual(['a', 'b']);
      expect(liveAgreements(r.state).length, failure).toBe(2);
      expect(r.state.conflicts, failure).toEqual([]);
      s = r.state;
    }
    const r = await syncIt(s, srv.api);
    expect(r.state.outbox).toEqual([]);
    expect(srv.rows.size).toBe(2);
  });
});
