import { describe, expect, it } from 'vitest';
import { adopt, deleteLocal, emptyState, mergeRemote, saveLocal, skipOccurrence, sync, type CalendarApi, type CalendarState } from '../src/lib/calendar/store';
import type { CalendarEvent } from '../src/lib/calendar/recurrence';

/** A fake household server with the same rules as calendar_event_save / _delete / calendar_changes. */
function server() {
  const rows = new Map<string, CalendarEvent & { updated: number }>();
  let clock = 1000;
  let online = true;
  const api: CalendarApi = {
    async save(e, base) {
      if (!online) throw new Error('request_failed_0');
      const cur = rows.get(e.id);
      if (cur ? cur.deleted || base !== cur.revision : base !== null) throw new Error('conflict');
      const row = { ...e, revision: (cur?.revision ?? 0) + 1, deleted: false, updated: ++clock };
      rows.set(e.id, row);
      return strip(row);
    },
    async remove(id, base) {
      if (!online) throw new Error('request_failed_0');
      const cur = rows.get(id);
      if (!cur) return null;
      if (cur.deleted) return strip(cur);
      if (base !== cur.revision) throw new Error('conflict');
      const row = { ...cur, deleted: true, revision: cur.revision + 1, updated: ++clock };
      rows.set(id, row);
      return strip(row);
    },
    async changes(since) {
      if (!online) throw new Error('request_failed_0');
      const t = since ? Date.parse(since) : -Infinity;
      return { now: new Date(clock).toISOString(), events: [...rows.values()].filter((r) => (since ? r.updated > t : !r.deleted)).map(strip) };
    },
  };
  const strip = ({ updated: _u, ...e }: CalendarEvent & { updated: number }): CalendarEvent => e;
  return { api, rows, offline: () => { online = false; }, online: () => { online = true; } };
}

const ev = (id: string, title = 'Dentist'): CalendarEvent => ({ id, title, starts_on: '2026-11-18', start_time: '15:30', timezone: 'America/New_York', member_ids: [], revision: 0 });

describe('calendar on one phone', () => {
  it('saves offline, uploads later, once', async () => {
    const srv = server();
    srv.offline();
    let s = saveLocal(emptyState('h1'), ev('a'));
    s = saveLocal(s, { ...s.events.a, title: 'Dentist 3:30' }); // two edits before a sync
    expect(s.outbox).toHaveLength(1);
    let r = await sync(s, srv.api);
    expect(r.offline).toBe(true);
    expect(r.state.outbox).toHaveLength(1);
    expect(r.state.events.a.title).toBe('Dentist 3:30'); // still on the phone
    srv.online();
    r = await sync(r.state, srv.api);
    expect(r.offline).toBe(false);
    expect(r.state.outbox).toHaveLength(0);
    expect(srv.rows.size).toBe(1);
    expect(r.state.events.a.revision).toBe(1);
  });

  it('deleting something never uploaded just removes it', () => {
    const s = deleteLocal(saveLocal(emptyState('h1'), ev('a')), 'a');
    expect(s.events).toEqual({});
    expect(s.outbox).toEqual([]);
  });

  it('a local calendar (no account) keeps working, then uploads when she signs in', async () => {
    const srv = server();
    let s = saveLocal(emptyState(), ev('a'));
    expect((await sync(s, srv.api)).pushed).toBe(0); // local: nothing to sync
    s = adopt(s, 'h1');
    const r = await sync(s, srv.api);
    expect(r.pushed).toBe(1);
    expect(srv.rows.get('a')?.title).toBe('Dentist');
  });

  it('another account on this phone starts clean', () => {
    const s = adopt(saveLocal(emptyState('h1'), ev('a')), 'h2');
    expect(s.events).toEqual({});
  });

  it('skipping one date of a repeat is an ordinary edit', () => {
    const s = skipOccurrence(saveLocal(emptyState('h1'), { ...ev('a'), recurrence: { freq: 'weekly' } }), 'a', '2026-11-25');
    expect(s.events.a.skip_dates).toEqual(['2026-11-25']);
    expect(s.outbox).toHaveLength(1);
  });
});

describe('two phones, one household', () => {
  async function twoPhones() {
    const srv = server();
    let mom: CalendarState = saveLocal(emptyState('h1'), ev('a'));
    mom = (await sync(mom, srv.api)).state;
    let dad: CalendarState = (await sync(emptyState('h1'), srv.api)).state;
    return { srv, mom, dad: dad, set: (m: CalendarState, d: CalendarState) => { mom = m; dad = d; } };
  }

  it('his change shows up on her phone', async () => {
    const { srv, mom, dad } = await twoPhones();
    const dad2 = (await sync(saveLocal(dad, { ...dad.events.a, title: 'Dentist (Dr. Park)' }), srv.api)).state;
    const mom2 = (await sync(mom, srv.api)).state;
    expect(mom2.events.a.title).toBe('Dentist (Dr. Park)');
    expect(dad2.events.a.revision).toBe(2);
  });

  it('both edit the same event: the first one stands, the second is set aside and named, never merged over it', async () => {
    const { srv, mom, dad } = await twoPhones();
    await sync(saveLocal(dad, { ...dad.events.a, start_time: '16:00' }), srv.api);
    const r = await sync(saveLocal(mom, { ...mom.events.a, title: 'Dentist moved' }), srv.api);
    expect(r.state.conflicts.map((c) => c.title)).toEqual(['Dentist moved']);
    expect(r.state.events.a.start_time).toBe('16:00'); // his version, pulled
    expect(r.state.events.a.title).toBe('Dentist');
    expect(srv.rows.get('a')?.title).toBe('Dentist');
  });

  it('a delete on one phone removes it from the other', async () => {
    const { srv, mom, dad } = await twoPhones();
    await sync(deleteLocal(dad, 'a'), srv.api);
    const r = await sync(mom, srv.api);
    expect(r.state.events.a).toBeUndefined();
  });

  it('editing something the other adult deleted: their delete stands', async () => {
    const { srv, mom, dad } = await twoPhones();
    await sync(deleteLocal(dad, 'a'), srv.api);
    const r = await sync(saveLocal(mom, { ...mom.events.a, title: 'x' }), srv.api);
    expect(r.state.events.a).toBeUndefined();
    expect(r.state.conflicts).toHaveLength(1);
  });

  it('an old copy from the server never replaces a newer one here', () => {
    const s = mergeRemote({ ...emptyState('h1'), events: { a: { ...ev('a'), revision: 3, title: 'new' } } }, [{ ...ev('a'), revision: 2, title: 'old' }]);
    expect(s.events.a.title).toBe('new');
  });

  it('a change waiting here is not replaced by the pull before it is pushed', () => {
    const s = saveLocal({ ...emptyState('h1'), events: { a: { ...ev('a'), revision: 1 } } }, { ...ev('a'), revision: 1, title: 'mine' });
    expect(mergeRemote(s, [{ ...ev('a'), revision: 2, title: 'theirs' }]).events.a.title).toBe('mine');
  });
});
