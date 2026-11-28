/**
 * The app's side of the engine (src/lib/intel/client.ts, describe.ts, components/intel/HouseholdIntelligence.tsx):
 * what V21 writes teach, the signal queue, the memory wording and the consent copy.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { opaqueRef, signalsFor } from '../src/lib/intel/client';
import { describeMemory, rhythm } from '../src/lib/intel/describe';
import { validSignal } from '../src/lib/intel/signals';

const ex = { existingAgreements: new Set(['11111111-2222-4333-8444-555555555555']) };
const uuid = '11111111-2222-4333-8444-555555555555';

describe('what a V21 write teaches (opaque ids only)', () => {
  it('a new agreement vs a changed one', () => {
    expect(signalsFor({ kind: 'agreement-save', category: 'meals', text: 'Maya packs her lunch', ownerIds: [], meta: {} }, ex)[0]).toMatchObject({ kind: 'agreement_saved', subject_kind: 'agreement', value: 'meals' });
    expect(signalsFor({ kind: 'agreement-save', id: uuid, category: 'meals', text: 'x', ownerIds: [], meta: {} }, ex)[0]).toMatchObject({ kind: 'agreement_changed', subject_ref: uuid });
  });
  it('never carries a title, a note or an agreement\'s words', () => {
    const all = [
      ...signalsFor({ kind: 'agreement-save', category: 'meals', text: 'Maya packs her lunch', ownerIds: ['m1'], meta: {} }, ex),
      ...signalsFor({ kind: 'task-done', id: uuid }, ex),
      ...signalsFor({ kind: 'priority-add', note: 'Call the dentist about Maya' }, ex),
      ...signalsFor({ kind: 'priority-add', ref: { source: 'imported', event_uid: 'abc123-jane.doe@school.example', instance_key: 'k' } }, ex),
      ...signalsFor({ kind: 'cleaning-check', key: 'kitchen-wipe' }, ex),
    ];
    const text = JSON.stringify(all);
    expect(text).not.toMatch(/Maya|lunch|dentist|jane|school\.example/);
    for (const s of all) expect(validSignal({ ...s, local_day: '2026-11-27', local_hour: 9, local_dow: 5 } as never), JSON.stringify(s)).not.toBeNull();
  });
  it('an imported event id becomes a stable opaque ref (it can hold an email)', () => {
    expect(opaqueRef('e', 'imported:x@y.z')).toBe(opaqueRef('e', 'imported:x@y.z'));
    expect(opaqueRef('e', 'imported:x@y.z')).not.toBe(opaqueRef('e', 'imported:x@y.y'));
    expect(opaqueRef('e', 'imported:x@y.z')).toMatch(/^e[0-9a-z]+$/);
  });
  it('a development decision carries the decision, not the skill\'s words', () => {
    const r = signalsFor({ kind: 'development', before: null, after: { id: uuid, memberId: uuid, skillId: 'school-day-prep', title: 'Packs her bag', stage: 'with-help', status: 'active', history: [{ decision: 'practice', on: '2026-11-27' }] } as never }, ex);
    expect(r[0]).toMatchObject({ kind: 'development_decided', subject_kind: 'development', value: 'practice', member_id: uuid });
    expect(JSON.stringify(r)).not.toMatch(/Packs/);
  });
  it('meeting steps, events and the intelligence document teach nothing here (they arrive as product moments)', () => {
    expect(signalsFor({ kind: 'meeting-step', step: 2 }, ex)).toEqual([]);
    expect(signalsFor({ kind: 'meeting-finished' }, ex)).toEqual([]);
  });
});

describe('the signal queue', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  const stub = (opts: { signedIn?: boolean; fail?: boolean; search?: string } = {}) => {
    const data = new Map<string, string>(opts.signedIn !== false ? [['omc:account:session', JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3600e3, user_id: 'u', email: 'a@b.co' })]] : []);
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), key: () => null, length: 0 });
    vi.stubGlobal('location', { search: opts.search ?? '' });
    vi.stubGlobal('window', {});
    const calls: { url: string; body: { p_signals: unknown[] } }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return opts.fail ? new Response('{"message":"x"}', { status: 500 }) : new Response('1', { status: 200 });
    });
    return { calls, data };
  };
  const tick = () => new Promise((r) => setTimeout(r, 5));

  it('batches signals from one moment into one call, at most 50 each', async () => {
    const { calls } = stub();
    const { signal } = await import('../src/lib/intel/client');
    signal(...Array.from({ length: 60 }, (_, i) => ({ kind: 'task_done' as const, subject_kind: 'task' as const, subject_ref: `t${i}` })));
    await tick();
    expect(calls.map((c) => c.body.p_signals.length)).toEqual([50, 10]);
    expect(calls[0].url).toMatch(/\/rpc\/household_signal_log$/);
  });
  it('drops invalid signals on the device (free text never leaves)', async () => {
    const { calls } = stub();
    const { signal } = await import('../src/lib/intel/client');
    signal({ kind: 'task_done', subject_kind: 'task', subject_ref: 'Maya’s lunch!' }, { kind: 'not_a_kind' as never }, { kind: 'task_done', value: 'Has Spaces' });
    await tick();
    expect(calls).toHaveLength(0);
  });
  it('keeps the queue when sending fails, and sends it next time', async () => {
    const { calls, data } = stub({ fail: true });
    const { signal, flush } = await import('../src/lib/intel/client');
    signal({ kind: 'task_done', subject_kind: 'task', subject_ref: 't1' });
    await tick();
    expect(calls).toHaveLength(1);
    expect(JSON.parse(data.get('omc:intel:queue:v1')!)).toHaveLength(1);
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body)) }); return new Response('1', { status: 200 }); });
    await flush();
    expect(calls).toHaveLength(2);
    expect(data.has('omc:intel:queue:v1')).toBe(false);
  });
  it('sends nothing signed out or in the demo', async () => {
    let { calls } = stub({ signedIn: false });
    let { signal } = await import('../src/lib/intel/client');
    signal({ kind: 'app_open' }); await tick();
    expect(calls).toHaveLength(0);
    vi.resetModules();
    ({ calls } = stub({ search: '?demo=1' }));
    ({ signal } = await import('../src/lib/intel/client'));
    signal({ kind: 'app_open' }); await tick();
    expect(calls).toHaveLength(0);
  });
});

describe('what we\'ve noticed, in plain words', () => {
  const names = { m1: 'Ana', m2: 'Luis' };
  it('rhythms', () => {
    expect(rhythm('weekly', '2')).toBe('every Tuesday');
    expect(rhythm('biweekly', '5')).toBe('every other Friday');
    expect(rhythm('monthly', '2:6')).toBe('on the second Saturday of the month');
    expect(rhythm('monthly', '15')).toBe('around the 15th of each month');
    expect(rhythm('monthly', '22')).toBe('around the 22nd of each month');
    expect(rhythm('annual', '11-29')).toBe('every year around November 29');
    expect(rhythm('irregular', null)).toBeNull();
  });
  it('a pattern, ownership, load and timing', () => {
    expect(describeMemory({ category: 'occasion', subject_key: 'event-occurred:series:abc', content: { anchor: '2' }, cadence: 'weekly', status: 'observed', source: 'stats' }, names)).toBe('A plan that happens every Tuesday.');
    expect(describeMemory({ category: 'collaboration', subject_key: 'owner:a1', content: { observed_owner: 'm1', agreed_owners: ['m2'], differs_from_agreement: true }, cadence: 'weekly', status: 'observed', source: 'stats' }, names))
      .toBe('Ana has been doing one of the jobs Luis agreed to take. Worth a word at your Family Meeting?');
    expect(describeMemory({ category: 'collaboration', subject_key: 'load:adults', content: { carries_most: 'm1' }, cadence: 'weekly', status: 'observed', source: 'stats' }, names)).toMatch(/^Ana has been doing most .* not a to-do\.$/);
    expect(describeMemory({ category: 'timing', subject_key: 'opens', content: { from_hour: 19, to_hour: 21 }, cadence: 'daily', status: 'observed', source: 'stats' }, names)).toBe('You usually open the app between 7 pm and 9 pm. Only you see this.');
  });
  it('never blames, never assigns', () => {
    const lines = [
      describeMemory({ category: 'collaboration', subject_key: 'owner:a1', content: { observed_owner: 'm1', agreed_owners: ['m2'], differs_from_agreement: true }, cadence: 'weekly', status: 'observed', source: 'stats' }, names),
      describeMemory({ category: 'collaboration', subject_key: 'load:adults', content: { carries_most: 'm1' }, cadence: 'weekly', status: 'observed', source: 'stats' }, names),
    ].join(' ');
    expect(lines).not.toMatch(/forgot|failed|should|must|assign|lazy|neglect/i);
  });
});

describe('consent and controls', () => {
  const ui = readFileSync('src/components/intel/HouseholdIntelligence.tsx', 'utf8');
  it('AI help needs an explicit yes, and "Not now" stores nothing', () => {
    expect(ui).toMatch(/data-ai-consent-yes/);
    expect(ui).toMatch(/onClick=\{\(\) => setAnswered\(true\)\} data-ai-consent-no/);
  });
  it('the consent copy says what goes out, what never does, and how to stop', () => {
    expect(ui).toMatch(/only plan names are sent/);
    expect(ui).toMatch(/Never descriptions, notes, addresses, or your children’s ages/);
    expect(ui).toMatch(/turn it off anytime in Account/);
    expect(ui).toMatch(/Everything else works the same either way/);
  });
  it('turning AI on sends the consent version; personal calendars are this adult\'s own choice', () => {
    const client = readFileSync('src/lib/intel/client.ts', 'utf8');
    expect(client).toMatch(/patch\.ai_enabled \? \{ ai_consent_version: AI_CONSENT_VERSION \}/);
    expect(ui).toMatch(/the other grown-up decides for themselves/);
  });
  it('Account has learning, AI, my calendars, the memory list with confirm / change the day / forget, and erase', () => {
    for (const hook of ['data-intel-learning', 'data-intel-ai', 'data-intel-personal', 'data-intel-memory', 'data-intel-confirm', 'data-intel-day', 'data-intel-forget', 'data-intel-erase']) expect(ui).toContain(hook);
  });
  it('is shown in onboarding and in Account, and hides itself without the engine', () => {
    expect(readFileSync('src/components/ourweek/OurWeekFamilySetup.tsx', 'utf8')).toMatch(/<HouseholdIntelligence household=\{access\.householdId\} mode="onboarding" \/>/);
    expect(readFileSync('src/components/v20/LiveFamily.tsx', 'utf8')).toMatch(/<HouseholdIntelligence household=\{access\.householdId\} mode="account"/);
    expect(ui).toMatch(/if \(!st\) return null;/);
  });
});
