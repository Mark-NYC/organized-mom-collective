/**
 * Synthetic evaluation (docs/intelligence/STAGE_B_REPORT.md → Synthetic evaluation): 50 generated households, 6–12
 * months each, replayed through the Lab with the real learner, scored against each scenario's ground truth, and swept
 * for privacy and quality invariants. Set INTEL_REPORT=<path> to also write the evaluation report.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { daysBetween } from '../src/lib/intel/cadence';
import { evaluate, runLab, type LabResult, type Verdict } from '../src/lib/intel/lab';
import { generateHouseholds, type SyntheticHousehold } from '../src/lib/intel/synthetic';

const households = generateHouseholds();
const runs = new Map<string, LabResult>(households.map((h) => [h.id, runLab(h)]));
const verdicts: Verdict[] = households.flatMap((h) => evaluate(h, runs.get(h.id)!.memories));

describe('the 50 synthetic households', () => {
  it('are diverse: single- and two-parent homes, children of every age, varied engagement, 6–12 months', () => {
    expect(households).toHaveLength(50);
    const shapes = new Set(households.map((h) => h.shape));
    expect([...shapes].sort()).toEqual(['multigenerational', 'single-parent', 'two-parent']);
    expect(households.filter((h) => h.shape === 'single-parent').length).toBeGreaterThanOrEqual(10);
    const ages = households.flatMap((h) => h.children.map((c) => c.age));
    expect(Math.min(...ages)).toBeLessThanOrEqual(3);
    expect(Math.max(...ages)).toBeGreaterThanOrEqual(15);
    expect(new Set(households.map((h) => h.engagement)).size).toBe(3);
    for (const h of households) {
      expect(h.months).toBeGreaterThanOrEqual(6);
      expect(h.months).toBeLessThanOrEqual(12);
      expect(h.signals.length).toBeGreaterThan(100);
      expect(h.signals.every((s) => s.synthetic && s.household_id === h.id)).toBe(true);
    }
    expect(new Set(households.map((h) => h.seededFrom)).size).toBe(7); // the seven non-empty sample families
  });
  it('are deterministic (the same seed gives the same households) and differ by seed', () => {
    expect(JSON.stringify(generateHouseholds(3))).toBe(JSON.stringify(generateHouseholds(3)));
    expect(JSON.stringify(generateHouseholds(3, 1))).not.toBe(JSON.stringify(generateHouseholds(3)));
  });
  it('cover every scripted scenario many times', () => {
    const count = new Map<string, number>();
    for (const h of households) for (const s of h.scenarios) count.set(s.kind, (count.get(s.kind) ?? 0) + 1);
    expect(count.size).toBe(18);
    for (const [kind, n] of count) expect(n, kind).toBeGreaterThanOrEqual(kind === 'learning-off' || kind === 'load-imbalance' ? 5 : 8); // load: two-adult homes only
  });
  it('carry no names, free text or real identifiers', () => {
    const text = JSON.stringify(households.map((h) => h.signals));
    expect(text).not.toMatch(/sample-|Rivera|Brooks|Chen|Okafor|Hughes|Lindqvist|Goering|@|https?:/);
  });
});

describe('engine vs ground truth (default seed)', () => {
  it('meets every scenario expectation', () => {
    const fails = verdicts.filter((v) => !v.pass).map((v) => `${v.household} ${v.scenario} ${v.expectation.subject_key}: wanted ${v.expectation.status.join('|')}, got ${v.got}`);
    expect(fails).toEqual([]);
    expect(verdicts.length).toBeGreaterThan(500);
  });
  it.each([1, 7, 42])('holds up on another seed (%i): at least 99% of expectations', (seed) => {
    const hs = generateHouseholds(50, seed);
    const v = hs.flatMap((h) => evaluate(h, runLab(h).memories));
    expect(v.filter((x) => x.pass).length / v.length).toBeGreaterThanOrEqual(0.99);
  }, 60_000);
});

describe('invariants across all 50 histories', () => {
  const each = (fn: (h: SyntheticHousehold, r: LabResult) => void) => { for (const h of households) fn(h, runs.get(h.id)!); };

  it('private calendar signals only ever produce memory visible to that same adult', () => {
    each((h, r) => {
      const users = new Set(h.adults.map((a) => a.user));
      for (const m of r.memories) if (m.visible_to) expect(users.has(m.visible_to)).toBe(true);
      const privateRefs = new Set(h.signals.filter((s) => s.visible_to).map((s) => s.subject_ref));
      for (const m of r.memories.filter((x) => !x.visible_to)) for (const ref of privateRefs) expect(m.subject_key.endsWith(`:${ref}`)).toBe(false);
    });
  });
  it('nothing is learned from the engine\'s own outputs, and one-off events never become beliefs', () => {
    each((_, r) => {
      for (const m of r.memories) expect(m.subject_key).not.toMatch(/rec-presented|memory-/);
      expect(r.memories.filter((m) => /oneoff/.test(m.subject_key) && m.status === 'observed')).toEqual([]);
    });
  });
  it('family-confirmed memory is never overridden by behavior', () => {
    each((h, r) => {
      for (const a of h.actions.filter((x) => x.type === 'confirm')) {
        const m = r.memories.find((x) => x.subject_key === (a as { subject_key: string }).subject_key)!;
        expect(m).toMatchObject({ status: 'confirmed', source: 'family', content: (a as { content: object }).content });
      }
    });
  });
  it('forgotten memory stays forgotten without enough new evidence', () => {
    each((h, r) => {
      for (const a of h.actions.filter((x) => x.type === 'forget')) expect(r.memories.find((x) => x.subject_key === (a as { subject_key: string }).subject_key)?.status).toBe('forgotten');
    });
  });
  it('turning learning off records no learning signals afterwards and freezes memory', () => {
    const off = households.filter((h) => h.actions.some((a) => a.type === 'learning'));
    expect(off.length).toBeGreaterThanOrEqual(5);
    for (const h of off) {
      const day = h.actions.find((a) => a.type === 'learning')!.day;
      const r = runs.get(h.id)!;
      expect(r.dropped).toBeGreaterThan(0);
      expect(r.recorded.filter((s) => s.local_day >= day && !s.kind.startsWith('app_') && s.kind !== 'plan_added')).toEqual([]);
      const before = runLab(h, { until: day });
      const changed = r.memories.filter((m) => { const b = before.memories.find((x) => x.subject_key === m.subject_key && x.member_id === m.member_id && x.visible_to === m.visible_to); return !b || JSON.stringify(b) !== JSON.stringify(m); });
      expect(changed.map((m) => m.subject_key)).toEqual([]);
    }
  });
  it('withdrawing personal-calendar consent deletes that adult\'s private memory and signals', () => {
    const h = households.find((x) => x.scenarios.some((s) => s.kind === 'private-calendar'))!;
    const user = h.signals.find((s) => s.visible_to)!.visible_to!;
    expect(runs.get(h.id)!.memories.some((m) => m.visible_to === user)).toBe(true);
    const withdrawn = runLab({ ...h, actions: [...h.actions, { day: '2026-11-20', type: 'personal-calendars', user, enabled: false }] });
    expect(withdrawn.memories.filter((m) => m.visible_to === user)).toEqual([]);
    expect(withdrawn.recorded.filter((s) => s.visible_to === user)).toEqual([]);
    expect(withdrawn.memories.filter((m) => !m.visible_to).length).toBe(runs.get(h.id)!.memories.filter((m) => !m.visible_to).length); // the household's own memory is untouched
  });
  it('observed ownership never becomes an assignment, and every inferred belief is reviewable', () => {
    each((_, r) => {
      for (const m of r.memories) {
        expect(JSON.stringify(m.content)).not.toMatch(/assign/);
        if (m.source === 'stats' && (m.status === 'observed' || m.status === 'tentative')) expect(m.review_after).toBeTruthy();
      }
    });
  });
  it('no stale belief: every observed statistical memory was seen within its review window (while learning is on)', () => {
    each((h, r) => {
      if (h.actions.some((a) => a.type === 'learning' && !a.enabled)) return; // frozen by design; readers honor review_after
      for (const m of r.memories.filter((x) => x.status === 'observed' && x.source === 'stats')) expect(m.review_after! >= h.end, `${h.id} ${m.subject_key}`).toBe(true);
    });
  });
  it('memory stays bounded (no runaway growth from noise)', () => {
    each((h, r) => expect(r.memories.length, h.id).toBeLessThanOrEqual(40));
  });
});

if (process.env.INTEL_REPORT) {
  describe('report', () => it('writes the synthetic evaluation report', () => writeFileSync(process.env.INTEL_REPORT!, report()), 120_000));
}

function report(): string {
  const byScenario = new Map<string, { pass: number; total: number; adjusted: number }>();
  for (const v of verdicts) {
    const s = byScenario.get(v.scenario) ?? { pass: 0, total: 0, adjusted: 0 };
    s.total++; if (v.pass) s.pass++; if (v.expectation.adjusted) s.adjusted++;
    byScenario.set(v.scenario, s);
  }
  const seeds = [1, 7, 42, 2026, 99991].map((seed) => {
    const hs = generateHouseholds(50, seed); const v = hs.flatMap((h) => evaluate(h, runLab(h).memories));
    return { seed, pass: v.filter((x) => x.pass).length, total: v.length, misses: v.filter((x) => !x.pass).map((x) => `${x.household} ${x.scenario}: wanted ${x.expectation.status.join('|')}${x.expectation.anchor ? ` @${x.expectation.anchor}` : ''}, got ${x.got.replace(/"next":"[^"]+",?/, '')}`) };
  });
  const unexpected = new Map<string, number>();
  for (const h of households) {
    const keys = new Set(h.scenarios.flatMap((s) => s.expect.map((e) => e.subject_key)));
    for (const m of runs.get(h.id)!.memories) if (m.status === 'observed' && !keys.has(m.subject_key)) { const k = `${m.category} · ${m.subject_key.replace(/\d+/g, '#')}`; unexpected.set(k, (unexpected.get(k) ?? 0) + 1); }
  }
  const statuses = new Map<string, number>();
  for (const r of runs.values()) for (const m of r.memories) statuses.set(m.status, (statuses.get(m.status) ?? 0) + 1);
  const n = (f: (h: SyntheticHousehold) => boolean) => households.filter(f).length;
  const signals = households.reduce((a, h) => a + h.signals.length, 0);
  const span = households.map((h) => daysBetween(h.start, h.end));
  const lines = [
    '# Synthetic evaluation (generated)',
    '',
    'Generated by `INTEL_REPORT=docs/intelligence/SYNTHETIC_EVALUATION.md npx vitest run tests/intel-synthetic.test.ts`. Do not edit by hand.',
    '',
    `## Households\n\n- ${households.length} households (seed 20261216), seeded from the sample families: ${n((h) => h.shape === 'two-parent')} two-parent, ${n((h) => h.shape === 'single-parent')} single-parent, ${n((h) => h.shape === 'multigenerational')} multigenerational`,
    `- Engagement: ${n((h) => h.engagement === 'high')} high, ${n((h) => h.engagement === 'medium')} medium, ${n((h) => h.engagement === 'low')} low`,
    `- History: ${Math.min(...span)}–${Math.max(...span)} days each; ${signals.toLocaleString('en-US')} signals in all`,
    `- Children aged ${Math.min(...households.flatMap((h) => h.children.map((c) => c.age)))}–${Math.max(...households.flatMap((h) => h.children.map((c) => c.age)))}`,
    '',
    '## Ground truth, default seed',
    '',
    '| Scenario | Expectations met | Adjusted to realized history |',
    '| --- | --- | --- |',
    ...[...byScenario].sort().map(([k, s]) => `| ${k} | ${s.pass}/${s.total} | ${s.adjusted} |`),
    `| **all** | **${verdicts.filter((v) => v.pass).length}/${verdicts.length}** | ${verdicts.filter((v) => v.expectation.adjusted).length} |`,
    '',
    '"Adjusted" means the generated family went quiet longer than the cadence\'s review window, so the truth became "reconsidered (retired)" rather than "still believed".',
    '',
    '## Robustness across seeds',
    '',
    '| Seed | Met | Misses |',
    '| --- | --- | --- |',
    ...seeds.map((s) => `| ${s.seed} | ${s.pass}/${s.total} (${((100 * s.pass) / s.total).toFixed(1)}%) | ${s.misses.join('<br>') || 'none'} |`),
    '',
    '## Beliefs nobody scripted (observed, default seed)',
    '',
    'Discovery is open-ended: these were learned without a scenario asking for them. Each was reviewed as a legitimate derivation (app-open timing per adult, the weekly rhythm of a chore, who does a chore, adult load balance).',
    '',
    '| Belief | Memories (one per household, or per adult for timing) |',
    '| --- | --- |',
    ...[...unexpected].sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## Final memory status mix',
    '',
    ...[...statuses].sort().map(([k, v]) => `- ${k}: ${v}`),
    '',
  ];
  return lines.join('\n');
}
