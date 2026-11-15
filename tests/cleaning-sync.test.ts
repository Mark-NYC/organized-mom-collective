import { describe, expect, it } from 'vitest';
import {
  adoptCleaning, emptyCleaningSync, keyOf, marksFor, parseKey, queue, syncCleaning, toApply,
  type CleaningApi, type CleaningSyncState, type Mark,
} from '../src/lib/cleaning-sync/store';

/** A fake household with the rules of cleaning_marks_push / cleaning_marks_changes: per item, the latest tap wins. */
function household() {
  const rows = new Map<string, Mark & { synced: number }>();
  let clock = Date.parse('2026-11-16T12:00:00Z');
  let mode: 'ok' | 'down' | 'error' | 'refuse' = 'ok';
  const fail = () => {
    if (mode === 'down') throw new TypeError('Failed to fetch');
    if (mode === 'error') throw new Error('request_failed_503');
  };
  const api: CleaningApi = {
    async push(marks) {
      fail();
      if (mode === 'refuse') throw new Error('invalid');
      for (const m of marks) {
        const k = `${m.list}|${m.period}|${m.item}`;
        const cur = rows.get(k);
        if (!cur || Date.parse(cur.at) < Date.parse(m.at)) rows.set(k, { ...m, synced: ++clock });
      }
    },
    async changes(since) {
      fail();
      const t = since ? Date.parse(since) : -Infinity;
      const marks = [...rows.values()].filter((r) => (since ? r.synced > t : r.done)).map(({ synced: _s, ...m }) => m);
      return { now: new Date(clock).toISOString(), marks };
    },
  };
  return { api, rows, set: (m: typeof mode) => { mode = m; }, tick: (ms: number) => { clock += ms; } };
}

/** The wall clock every phone reads (two taps are never at the same instant). */
let t = Date.parse('2026-11-16T12:00:00Z');
/** One phone: its device lists (what storage.ts keeps) and its sync state. */
function phone(scope = 'h1', lists: Record<string, string[]> = {}) {
  let state: CleaningSyncState = adoptCleaning(emptyCleaningSync(), scope, Object.entries(lists));
  const p = {
    lists,
    get state() { return state; },
    tap(key: string, item: string, at?: string) {
      const cur = lists[key] ?? [];
      const done = !cur.includes(item);
      lists[key] = done ? [...cur, item] : cur.filter((x) => x !== item);
      state = queue(state, marksFor(key, done ? [item] : [], done ? [] : [item], at ?? new Date((t += 1000)).toISOString()));
    },
    async sync(api: CleaningApi) {
      const r = await syncCleaning(state, api);
      state = r.state;
      for (const m of r.apply) {
        const cur = lists[keyOf(m)] ?? [];
        lists[keyOf(m)] = m.done ? [...new Set([...cur, m.item])] : cur.filter((x) => x !== m.item);
      }
      return r;
    },
  };
  return p;
}
const DAY = 'omc:v1:daily:2026-11-16';

describe('cleaning keys', () => {
  it('reads the companion\'s checklist keys and nothing else', () => {
    expect(parseKey(DAY)).toEqual({ list: 'daily', period: '2026-11-16' });
    expect(parseKey('omc:v1:monthly:2026-11')).toEqual({ list: 'monthly', period: '2026-11' });
    for (const k of ['omc:v1:onboarded', 'omc:v1:install-invite', 'omc:calendar:v1', 'omc:v1:daily:today']) expect(parseKey(k)).toBeNull();
    expect(keyOf({ list: 'focus', period: '2026-11-16' })).toBe('omc:v1:focus:2026-11-16');
  });
});

describe('two phones, one household', () => {
  it('a checkmark on one phone shows on the other', async () => {
    const h = household(); const mom = phone(); const dad = phone();
    mom.tap(DAY, 'dishes');
    await mom.sync(h.api);
    await dad.sync(h.api);
    expect(dad.lists[DAY]).toEqual(['dishes']);
    expect(mom.state.outbox).toEqual([]);
  });

  it('they check different things at the same time: both stay', async () => {
    const h = household(); const mom = phone(); const dad = phone();
    mom.tap(DAY, 'dishes'); dad.tap(DAY, 'counters');
    await mom.sync(h.api); await dad.sync(h.api); await mom.sync(h.api);
    expect([...mom.lists[DAY]].sort()).toEqual(['counters', 'dishes']);
    expect([...dad.lists[DAY]].sort()).toEqual(['counters', 'dishes']);
  });

  it('an uncheck travels too', async () => {
    const h = household(); const mom = phone(); const dad = phone();
    mom.tap(DAY, 'dishes'); await mom.sync(h.api); await dad.sync(h.api);
    dad.tap(DAY, 'dishes'); await dad.sync(h.api); await mom.sync(h.api);
    expect(mom.lists[DAY]).toEqual([]);
  });

  it('the same item: the later tap wins, even when the earlier one arrives last', async () => {
    const h = household(); const mom = phone(); const dad = phone();
    mom.tap(DAY, 'dishes'); await mom.sync(h.api); await dad.sync(h.api);
    // Dad unchecks offline at 9:00 and doesn't sync. Mom unchecks and rechecks later, online.
    dad.tap(DAY, 'dishes', '2026-11-16T14:00:00Z');
    mom.tap(DAY, 'dishes', '2026-11-16T15:00:00Z'); mom.tap(DAY, 'dishes', '2026-11-16T15:00:05Z');
    await mom.sync(h.api);
    await dad.sync(h.api); // his older uncheck arrives last and loses
    await dad.sync(h.api);
    expect(h.rows.get('daily|2026-11-16|dishes')?.done).toBe(true);
    expect(dad.lists[DAY]).toEqual(['dishes']);
    expect(mom.lists[DAY]).toEqual(['dishes']);
  });

  it('several taps on one item before a sync send only the last', () => {
    const p = phone();
    p.tap(DAY, 'dishes'); p.tap(DAY, 'dishes'); p.tap(DAY, 'dishes');
    expect(p.state.outbox).toHaveLength(1);
    expect(p.state.outbox[0].done).toBe(true);
  });
});

describe('offline and recovery', () => {
  it('no signal: taps stay on the phone and go up on reconnect, once', async () => {
    const h = household(); const mom = phone(); const dad = phone();
    h.set('down');
    mom.tap(DAY, 'dishes'); mom.tap(DAY, 'counters');
    const r = await mom.sync(h.api);
    expect(r.offline).toBe(true);
    expect(mom.state.outbox).toHaveLength(2);
    expect(mom.lists[DAY]).toEqual(['dishes', 'counters']); // still checked on her phone
    h.set('ok');
    await mom.sync(h.api); await mom.sync(h.api); await dad.sync(h.api);
    expect(mom.state.outbox).toEqual([]);
    expect([...dad.lists[DAY]].sort()).toEqual(['counters', 'dishes']);
    expect(h.rows.size).toBe(2);
  });

  it('server trouble keeps every tap; nothing is dropped', async () => {
    const h = household(); const mom = phone();
    mom.tap(DAY, 'dishes');
    h.set('error');
    expect((await mom.sync(h.api)).offline).toBe(true);
    expect(mom.state.outbox).toHaveLength(1);
  });

  it('the pull never undoes a tap still waiting here', async () => {
    const h = household(); const mom = phone(); const dad = phone();
    mom.tap(DAY, 'dishes'); await mom.sync(h.api); await dad.sync(h.api);
    dad.tap(DAY, 'dishes'); // unchecked on his phone, not sent yet
    expect(toApply(dad.state, [{ list: 'daily', period: '2026-11-16', item: 'dishes', done: true, at: '2026-11-16T12:00:01Z' }])).toEqual([]);
  });

  it('a refused batch is dropped, never retried forever, and the pull still runs', async () => {
    const h = household(); const mom = phone(); const dad = phone();
    dad.tap(DAY, 'counters'); await dad.sync(h.api);
    h.set('refuse');
    mom.tap(DAY, 'dishes');
    const r = await mom.sync(h.api);
    expect(r.offline).toBe(false);
    expect(mom.state.outbox).toEqual([]);
    expect(mom.lists[DAY]).toContain('counters');
  });

  it('more taps than one call takes go in batches', async () => {
    const h = household(); const p = phone();
    for (let i = 0; i < 450; i++) p.tap(DAY, `task-${i}`);
    let calls = 0;
    await p.sync({ ...h.api, push: (m) => { calls++; expect(m.length).toBeLessThanOrEqual(200); return h.api.push(m); } });
    expect(calls).toBe(3);
    expect(h.rows.size).toBe(450);
  });
});

describe('joining a household with progress already on the phone', () => {
  it('what she checked before signing in is offered, and never undoes the other grown-up', async () => {
    const h = household(); const dad = phone();
    dad.tap(DAY, 'dishes'); await dad.sync(h.api);
    dad.tap(DAY, 'dishes'); await dad.sync(h.api); // he unchecked it: the household says not done
    // Her phone had dishes and laundry checked from before it knew the household.
    const mom = phone('h1', { [DAY]: ['dishes', 'laundry'] });
    await mom.sync(h.api); await mom.sync(h.api);
    expect(h.rows.get('daily|2026-11-16|dishes')?.done).toBe(false); // his uncheck stands
    expect(h.rows.get('daily|2026-11-16|laundry')?.done).toBe(true); // hers fills the gap
    await dad.sync(h.api);
    expect(dad.lists[DAY]).toEqual(['laundry']);
  });

  it('another household on the same phone starts clean: nothing of the first is sent', () => {
    const first = queue(adoptCleaning(emptyCleaningSync(), 'h1', []), marksFor(DAY, ['dishes'], [], '2026-11-16T12:00:00Z'));
    const second = adoptCleaning(first, 'h2', [[DAY, ['dishes']]]);
    expect(second).toEqual({ scope: 'h2', outbox: [], since: null });
  });

  it('no household: nothing is queued or sent', async () => {
    const h = household();
    const r = await syncCleaning(emptyCleaningSync(), h.api);
    expect(r).toEqual({ state: emptyCleaningSync(), apply: [], pushed: 0, offline: false });
  });
});
