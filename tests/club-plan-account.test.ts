// A member's /app/club/<month> plan saved to her account (src/lib/club/plan/account.ts): what opens, what saves, and
// what is never overwritten. The browser check is scripts/club-onboarding-e2e.mjs --only=months.
import { describe, expect, it } from 'vitest';
import { connectPlanAccount, initialValue, memberPlanHref, type PlanAccountDeps, type PlanSaveStatus } from '../src/lib/club/plan/account';
import type { ResourceVersion } from '../src/lib/club/membership';

class FakeStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const KEY = 'omc:club:june-app:v1';
const JUNE = '2027-06-summer-with-a-plan';
const JAN = '2027-01-fresh-start-together';
const member = (slug: string) => `omc:club:member:${slug}:v1`;
const tick = () => new Promise((r) => setTimeout(r, 5));

function setup(res: Partial<ResourceVersion> = {}, opts: { failSave?: string; failLoad?: boolean } = {}) {
  const storage = new FakeStorage();
  const db = { state: res.state ?? {}, revision: res.revision ?? 0, saves: 0 };
  const statuses: PlanSaveStatus[] = [];
  let act = () => {};
  const deps: PlanAccountDeps = {
    load: async () => {
      if (opts.failLoad) throw new Error('offline');
      return { can: res.can ?? 'edit', month: '2027-06-01', state: structuredClone(db.state), revision: db.revision, approved_at: null, mailing: null };
    },
    save: async (_slug, state, revision) => {
      if (opts.failSave) throw new Error(opts.failSave);
      if (revision !== db.revision) throw new Error('conflict');
      db.saves++;
      db.state = structuredClone(state);
      return ++db.revision;
    },
    storage: storage as unknown as Storage,
    onUserAction: (cb) => { act = cb; },
    onStatus: (s) => statuses.push(s),
    wait: 0,
  };
  return { storage, db, deps, statuses, act: () => act() };
}

describe('member plans on /app/club save to her account', () => {
  it('her saved plan opens in the tool', async () => {
    const t = setup({ state: { [KEY]: { s: 's', v: '{"saved":1}' } }, revision: 3 });
    const a = await connectPlanAccount(JUNE, KEY, t.deps);
    expect(t.storage.getItem(KEY)).toBe('{"saved":1}');
    expect(a.status).toBe('saved');
    a.stop();
  });

  it('what the tool writes back on opening never saves (and never clears her approval)', async () => {
    const t = setup({ state: { [KEY]: { s: 's', v: '{"saved":1}' } }, revision: 3 });
    const a = await connectPlanAccount(JUNE, KEY, t.deps);
    t.storage.setItem(KEY, '{"saved":1}');
    t.storage.setItem(KEY, '{"fresh":"default"}'); // a tool redrawing before she touched anything
    await tick();
    expect(t.db.saves).toBe(0);
    a.stop();
  });

  it('a fresh plan saves only once she changes it', async () => {
    const t = setup();
    const a = await connectPlanAccount(JUNE, KEY, t.deps);
    t.storage.setItem(KEY, '{"v":0}'); // the tool's first write: her starting point
    t.act();
    t.storage.setItem(KEY, '{"v":0}');
    await tick();
    expect(t.db.saves).toBe(0);
    t.storage.setItem(KEY, '{"v":1}');
    await tick();
    expect(t.db.saves).toBe(1);
    expect(t.db.state[KEY]).toEqual({ s: 's', v: '{"v":1}' });
    expect(t.statuses.at(-1)).toBe('saved');
    a.stop();
  });

  it('saving keeps what her copy of the month saved (never overwritten)', async () => {
    const copy = { s: 'l' as const, v: '{"habit":"cards"}' };
    const t = setup({ state: { [member(JAN)]: copy }, revision: 2 });
    const a = await connectPlanAccount(JAN, 'omc:club:january-weekly-meeting:v1', t.deps);
    expect(a.earlierCopy).toBe(true); // a different tool: linked, not loaded
    expect(t.storage.getItem('omc:club:january-weekly-meeting:v1')).toBeNull();
    t.act();
    t.storage.setItem('omc:club:january-weekly-meeting:v1', '{"a":1}');
    t.storage.setItem('omc:club:january-weekly-meeting:v1', '{"a":2}');
    await tick();
    expect(t.db.state[member(JAN)]).toEqual(copy);
    expect(t.db.state['omc:club:january-weekly-meeting:v1'].v).toBe('{"a":2}');
    a.stop();
  });

  it('a plan saved on her copy of the same tool opens here until she saves one here', () => {
    expect(initialValue({ [member(JUNE)]: { s: 'l', v: 'copy' } }, KEY, JUNE)).toBe('copy');
    expect(initialValue({ [member(JUNE)]: { s: 'l', v: 'copy' }, [KEY]: { s: 's', v: 'app' } }, KEY, JUNE)).toBe('app');
    expect(initialValue({ [member(JAN)]: { s: 'l', v: 'cards' } }, 'k', JAN)).toBeNull();
  });

  it('another device saved first: stops saving and says so, overwriting nothing', async () => {
    const t = setup({ state: { [KEY]: { s: 's', v: 'mine' } }, revision: 1 });
    const a = await connectPlanAccount(JUNE, KEY, t.deps);
    t.db.revision = 2; // the other device
    t.db.state = { [KEY]: { s: 's', v: 'theirs' } };
    t.act();
    t.storage.setItem(KEY, 'changed here');
    await tick();
    expect(t.statuses.at(-1)).toBe('conflict');
    expect(t.db.state[KEY].v).toBe('theirs');
    t.storage.setItem(KEY, 'again');
    await tick();
    expect(t.db.state[KEY].v).toBe('theirs');
    a.stop();
  });

  it('read-only months open her plan and never save', async () => {
    const t = setup({ can: 'read', state: { [KEY]: { s: 's', v: 'kept' } }, revision: 4 });
    const a = await connectPlanAccount(JUNE, KEY, t.deps);
    t.act();
    t.storage.setItem(KEY, 'x');
    await tick();
    expect(t.storage.getItem(KEY)).toBe('x');
    expect(t.db.saves).toBe(0);
    expect(a.status).toBe('read');
    a.stop();
  });

  it('printed months stop saving; an unreachable account leaves the tab working', async () => {
    const t = setup({}, { failSave: 'already_printed' });
    const a = await connectPlanAccount(JUNE, KEY, t.deps);
    t.storage.setItem(KEY, 'a');
    t.act();
    t.storage.setItem(KEY, 'b');
    await tick();
    expect(t.statuses.at(-1)).toBe('printed');
    a.stop();
    const off = setup({}, { failLoad: true });
    const b = await connectPlanAccount(JUNE, KEY, off.deps);
    expect(b.status).toBe('unavailable');
    off.storage.setItem(KEY, 'still works');
    expect(off.storage.getItem(KEY)).toBe('still works');
  });

  it('stop() restores storage', async () => {
    const t = setup();
    const before = FakeStorage.prototype.setItem;
    const a = await connectPlanAccount(JUNE, KEY, t.deps);
    expect(FakeStorage.prototype.setItem).not.toBe(before);
    a.stop();
    expect(FakeStorage.prototype.setItem).toBe(before);
  });
});

describe('Club home and dashboard open the app tools', () => {
  it('every month but November opens /app/club/<month>', () => {
    expect(memberPlanHref(JUNE)).toBe('/app/club/june');
    expect(memberPlanHref(JAN)).toBe('/app/club/january');
    expect(memberPlanHref('2026-12-christmas-mission')).toBe('/app/club/december');
    expect(memberPlanHref('2026-11-family-ownership')).toBe('/club/resources/2026-11-family-ownership');
    expect(memberPlanHref('2027-12-christmas-family-affair')).toBe('/club/resources/2027-12-christmas-family-affair');
  });
});
