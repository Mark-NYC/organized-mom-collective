/**
 * Progressive evaluation and Lab replay (src/lib/intel/eval/, src/lib/intel/lab.ts → interpretWithReplay):
 * deterministic routing, minimized requests, representative households, scoring, and replay that never calls out.
 * The live pipeline is rehearsed end to end in scripts/test-intel-eval-pipeline.mjs.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOG } from '../src/lib/intel/eval/catalog';
import { eventsFor, interpretRequests, patternRequests, representative, route, scoreInterpret, type CacheEntry } from '../src/lib/intel/eval/evaluate';
import { interpretWithReplay, runLab } from '../src/lib/intel/lab';
import { generateHouseholds } from '../src/lib/intel/synthetic';
import { estimateMicroUsd } from '../supabase/functions/_shared/intel/provider';
import { EVENT_KINDS, NEED_IDS, TASKS, fingerprint } from '../supabase/functions/_shared/intel/tasks';

const hs = generateHouseholds();

describe('the labeled titles', () => {
  it('use only the closed vocabularies, and are minimized (tokens, no contact details)', () => {
    for (const c of CATALOG) {
      expect(EVENT_KINDS, c.key).toContain(c.kind);
      for (const n of c.needs) expect(NEED_IDS, c.key).toContain(n);
      expect(c.title).not.toMatch(/@|https?:|\d{3}-\d{4}/);
    }
    expect(new Set(CATALOG.map((c) => c.key)).size).toBe(CATALOG.length);
  });
});

describe('deterministic first', () => {
  it('everything the rules settle confidently is right, and never reaches a model', () => {
    for (const c of CATALOG) {
      const r = route(c.title);
      if (r.route === 'rules') expect([c.kind, ...(c.alsoOk ?? [])], c.title).toContain(r.kind);
    }
  });
  it('a birthday without party words is second-guessed (the rules are confidently wrong about reminders)', () => {
    expect(route('P2 birthday').route).toBe('model');
    expect(route('P3 birthday party').route).toBe('rules');
  });
  it('the rules settle about a quarter of all titles across the 50 households, for free', () => {
    const all = hs.flatMap((h) => eventsFor(h));
    const byRules = all.filter((p) => route(p.event.title).route === 'rules').length / all.length;
    expect(byRules).toBeGreaterThan(0.15);
  });
});

describe('requests are small, minimized and valid', () => {
  it('every interpret request passes the task\'s own input checks, ≤ 20 titles, nothing but id/title/repeats/day part', () => {
    for (const h of hs) for (const r of interpretRequests(h)) {
      expect(TASKS['interpret-event'].validInput(r.input), h.id).toBeNull();
      expect(JSON.stringify(r.input).length).toBeLessThanOrEqual(TASKS['interpret-event'].maxInputChars);
    }
  });
  it('pattern review gets only tentative statistical beliefs, never private or confirmed ones', () => {
    for (const h of hs.slice(0, 15)) {
      const mem = runLab(h).memories;
      for (const r of patternRequests(h, mem)) {
        expect(TASKS['pattern-review'].validInput(r.input), h.id).toBeNull();
        expect((r.input.candidates as unknown[]).length).toBeLessThanOrEqual(mem.filter((m) => m.status === 'tentative').length);
      }
    }
  });
  it('the whole A + B + C plan costs cents at the cheap model\'s prices (worst case)', () => {
    const reqs = hs.flatMap((h) => interpretRequests(h));
    const worst = reqs.reduce((a, r) => a + estimateMicroUsd('gpt-6-luna', TASKS['interpret-event'], r.input)!, 0);
    expect(worst).toBeLessThan(100_000); // under $0.10 for all 50 households, against the $5.00 approved
  });
});

describe('five representative households', () => {
  it('cover single-parent, two-parent and multigenerational homes, every engagement level and most scenarios', () => {
    const rep = representative(hs, 5);
    expect(rep).toHaveLength(5);
    expect(new Set(rep.map((h) => h.shape)).size).toBe(3);
    expect(new Set(rep.map((h) => h.engagement)).size).toBe(3);
    expect(new Set(rep.flatMap((h) => h.scenarios.map((s) => s.kind))).size).toBeGreaterThanOrEqual(14);
    expect(representative(hs, 5).map((h) => h.id)).toEqual(rep.map((h) => h.id)); // stable
  });
});

describe('scoring', () => {
  it('rules where they decide; the model where it answered; the rules again on a miss', () => {
    const h = hs[0];
    const s0 = scoreInterpret(h, new Map());
    expect(s0.every((x) => x.source !== 'model')).toBe(true);
    const answers = new Map(eventsFor(h).map((p) => [p.id, { kind: p.event.kind, needs: p.event.needs }]));
    const s1 = scoreInterpret(h, answers);
    expect(s1.every((x) => x.kindOk && x.needsOk)).toBe(true);
  });
});

describe('Lab replay', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses saved answers only: no network, no cost; a miss falls back to the rules', async () => {
    vi.stubGlobal('fetch', () => { throw new Error('the Lab must never call out'); });
    const h = hs[3];
    const [first, ...others] = interpretRequests(h);
    const cache = new Map<string, CacheEntry>();
    const fp = await fingerprint('interpret-event', 'gpt-6-luna', first.input);
    cache.set(fp, { fingerprint: fp, task: 'interpret-event', model: 'gpt-6-luna', prompt_version: 'ie-1', input: first.input, cost_micro_usd: 300, at: '2026-11-28',
      output: { valid: true, reason: null, result: { items: (first.input.items as { id: string }[]).map((it) => ({ id: it.id, kind: 'school-event', needs: ['outfit'], is_exception: false, confidence: 0.7 })) } } });
    const r = await interpretWithReplay(h, cache);
    expect(r.replayed).toBe(1);
    expect(r.misses).toBe(others.length);
    expect(r.events.filter((e) => e.source === 'replay').length).toBe((first.input.items as unknown[]).length);
    expect(r.events.filter((e) => e.source === 'rules').every((e) => e.needs.length === 0)).toBe(true);
    expect(JSON.stringify(await interpretWithReplay(h, cache))).toBe(JSON.stringify(r)); // deterministic
  });
  it('an invalid saved answer is never used', async () => {
    const h = hs[3];
    const [first] = interpretRequests(h);
    const fp = await fingerprint('interpret-event', 'gpt-6-luna', first.input);
    const cache = new Map<string, CacheEntry>([[fp, { fingerprint: fp, task: 'interpret-event', model: 'gpt-6-luna', prompt_version: 'ie-1', input: first.input, cost_micro_usd: 300, at: '2026-11-28',
      output: { valid: false, reason: 'kind', result: { items: [{ id: 'e1', kind: 'sleepover' }] } } }]]);
    expect((await interpretWithReplay(h, cache)).events.some((e) => e.source === 'replay')).toBe(false);
  });
  it('the Lab and the runner contain no provider call; live inference is only the runner\'s explicit --live', () => {
    for (const f of ['src/lib/intel/lab.ts', 'src/lib/intel/eval/evaluate.ts']) expect(readFileSync(f, 'utf8')).not.toMatch(/fetch\(|openai\.com|OPENAI_API_KEY/);
    const runner = readFileSync('scripts/intel-eval.mjs', 'utf8');
    expect(runner).toMatch(/const live = flags\.includes\('--live'\);/);
    expect(runner).toMatch(/if \(live && fresh\.length\)/);
    expect(runner).not.toMatch(/OPENAI_API_KEY|api\.openai\.com/); // the key never leaves the function
  });
});
