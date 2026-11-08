// The Welcome Family Rhythm on her account (docs/club/WELCOME_MARCH_DECEMBER_MIGRATION.md → Phase 2b): who can open it,
// approval that holds on every device, and the save bridge's approve / unapprove. SQL side: supabase/tests/club-welcome-plan.sql.
import { describe, expect, it } from 'vitest';
import { connectPlanAccount, type PlanAccountDeps } from '../src/lib/club/plan/account';
import { readApproval, setApprovalStore, writeApproval, type Approval } from '../src/lib/club/plan/status';
import { loadKitHousehold, type KitHouseholdEnv } from '../src/lib/club/kit-household';
import { sampleStore, type ClubStore } from '../src/lib/club/store';
import type { ResourceVersion } from '../src/lib/club/membership';

class FakeStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const KEY = 'omc:club:welcome-family-rhythm:v1';
const tick = () => new Promise((r) => setTimeout(r, 5));

const account = (me: Awaited<ReturnType<ClubStore['me']>>): ClubStore => ({
  kind: 'account', label: '', me: async () => me,
  household: async () => ({ id: 'h1', displayName: 'The Parks', preferences: {}, profileVersion: 1, members: [{ id: 'm1', firstName: 'Jo', kind: 'adult', role: 'parent', isAccountHolder: true }] }),
  saveHousehold: async () => { throw new Error('unused'); }, documents: async () => ({ can: 'edit', documents: {} }), saveDocument: async () => 1,
  profile: async () => null, saveActivities: async () => { throw new Error('unused'); }, saveResponsibilities: async () => { throw new Error('unused'); },
  saveFocus: async () => { throw new Error('unused'); },
});
const env = (store: ClubStore): KitHouseholdEnv => ({ accountsEnabled: () => true, hasSession: async () => true, accountStore: store, sampleStore });

describe('Welcome Family Rhythm: who can open it', () => {
  it('any member with Club access, whatever month she holds (none yet included)', async () => {
    expect(await loadKitHousehold(null, '', env(account({ access: true, onboarded: true, kits: [] })))).toMatchObject({ status: 'ready', source: 'account' });
  });
  it('after her membership ends, if she ever held a month', async () => {
    expect(await loadKitHousehold(null, '', env(account({ access: false, onboarded: true, kits: [{ slug: '2027-01-fresh-start-together', can: 'read' }] })))).toMatchObject({ status: 'ready' });
  });
  it('not someone who was never a member', async () => {
    expect(await loadKitHousehold(null, '', env(account({ access: false, onboarded: false, kits: [] })))).toMatchObject({ status: 'denied' });
  });
  it('samples open as before, labeled', async () => {
    const r = await loadKitHousehold(null, '?sample=chen', { ...env(account({ access: false, onboarded: false, kits: [] })), accountsEnabled: () => false });
    expect(r).toMatchObject({ status: 'ready', source: 'sample', sample: 'chen' });
  });
  it('a month still checks its own kit', async () => {
    expect(await loadKitHousehold('2027-03-spring-clean-together', '', env(account({ access: true, onboarded: true, kits: [] })))).toMatchObject({ status: 'denied' });
  });
});

describe('approval stores', () => {
  it('a registered key reads and writes through its store; other keys stay in the tab', () => {
    let held: Approval | null = null;
    setApprovalStore('test:server', { read: (f) => (held && held.for === f ? held : null), write: (a) => { held = a; } });
    writeApproval('test:server', { for: 'x', print: 'p', at: '2026-11-08T00:00:00Z' });
    expect(held).toMatchObject({ print: 'p' });
    expect(readApproval('test:server', 'x')).toMatchObject({ print: 'p' });
    expect(readApproval('test:server', 'another family')).toBeNull();
    setApprovalStore('test:server', null);
  });
});

function setup(res: { state?: ResourceVersion['state']; revision?: number; approved?: { at: string; fp: string } } = {}) {
  const storage = new FakeStorage();
  const db = { state: res.state ?? {}, revision: res.revision ?? 0, approved: res.approved ?? null as { at: string; fp: string } | null, calls: [] as string[] };
  let act = () => {};
  let saved = 0;
  const deps: PlanAccountDeps = {
    load: async () => ({ can: 'edit', month: '', state: structuredClone(db.state), revision: db.revision, approved_at: db.approved?.at ?? null, approved_fingerprint: db.approved?.fp ?? null, mailing: null }) as ResourceVersion,
    save: async (_s, state, revision) => {
      if (revision !== db.revision) throw new Error('conflict');
      db.calls.push('save'); db.state = structuredClone(state); db.approved = null; return ++db.revision;
    },
    approve: async (revision, fp, state) => {
      db.calls.push(`approve:${revision}`);
      if (revision === 0) { if (!state) throw new Error('invalid'); db.state = structuredClone(state); db.revision = 1; }
      else if (revision !== db.revision) throw new Error('conflict');
      db.approved = { at: 'now', fp };
      return db.revision;
    },
    unapprove: async (revision) => { if (revision !== db.revision) throw new Error('conflict'); db.calls.push('unapprove'); db.approved = null; },
    onSaved: () => { saved++; },
    storage: storage as unknown as Storage,
    onUserAction: (cb) => { act = cb; },
    onStatus: () => undefined,
    wait: 0,
  };
  return { storage, db, deps, act: () => act(), saved: () => saved };
}

describe('Welcome Family Rhythm: approval on her account', () => {
  it('her approval loads with her plan, so it shows on another device', async () => {
    const t = setup({ state: { [KEY]: { s: 's', v: '{"v":3}' } }, revision: 2, approved: { at: '2026-11-08T12:00:00Z', fp: 'FP' } });
    const a = await connectPlanAccount('welcome-family-rhythm', KEY, t.deps);
    expect(a.approval).toEqual({ at: '2026-11-08T12:00:00Z', print: 'FP' });
    a.stop();
  });

  it('approving the prepared plan (never changed) saves it with the approval', async () => {
    const t = setup();
    const a = await connectPlanAccount('welcome-family-rhythm', KEY, t.deps);
    t.storage.setItem(KEY, '{"v":3,"context":"welcome","month":"2026-11"}');
    await a.approve('FP1');
    expect(t.db.calls).toEqual(['approve:0']);
    expect(t.db.state[KEY].v).toBe('{"v":3,"context":"welcome","month":"2026-11"}');
    expect(a.approval?.print).toBe('FP1');
    // The next change saves on revision 1, not 0: no conflict.
    t.act();
    t.storage.setItem(KEY, '{"v":3,"changed":1}');
    await tick();
    expect(t.db.calls).toEqual(['approve:0', 'save']);
    expect(t.db.approved).toBeNull();
    expect(t.saved()).toBe(1);
    a.stop();
  });

  it('a change still waiting saves before the approval, so she approves what she sees', async () => {
    const t = setup({ state: { [KEY]: { s: 's', v: '{"a":1}' } }, revision: 1 });
    const a = await connectPlanAccount('welcome-family-rhythm', KEY, { ...t.deps, wait: 10000 });
    t.act();
    t.storage.setItem(KEY, '{"a":2}');
    await a.approve('FP2');
    expect(t.db.calls).toEqual(['save', 'approve:2']);
    expect(t.db.approved?.fp).toBe('FP2');
    a.stop();
  });

  it('undo takes it back; a stale tab is refused, never overwritten', async () => {
    const t = setup({ state: { [KEY]: { s: 's', v: '{"a":1}' } }, revision: 1, approved: { at: 'x', fp: 'FP' } });
    const a = await connectPlanAccount('welcome-family-rhythm', KEY, t.deps);
    await a.unapprove();
    expect(t.db.approved).toBeNull();
    t.db.revision = 5; // saved on another device
    await expect(a.approve('FP3')).rejects.toThrow('conflict');
    expect(t.db.approved).toBeNull();
    a.stop();
  });

  it('a month without approve deps is unchanged: approval stays on the device', async () => {
    const t = setup();
    const { approve: _a, unapprove: _u, ...month } = t.deps;
    const a = await connectPlanAccount('2027-06-summer-with-a-plan', 'omc:club:june-app:v1', month);
    await expect(a.approve('FP')).rejects.toThrow('unavailable');
    expect(a.approval).toBeNull();
    a.stop();
  });
});
