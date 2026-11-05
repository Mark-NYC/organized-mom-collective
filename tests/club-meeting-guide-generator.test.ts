import { describe, expect, it } from 'vitest';
import { january2027 } from '../src/data/club/meeting-guides/2027-01';
import { GUIDE_MONTHS, guideMonth } from '../src/data/club/meeting-guides';
import { generateMeetingGuide, guideFingerprint } from '../src/lib/club/meeting-guide/generate';
import { emptyGuideState, guideProfile, isGuideState } from '../src/lib/club/meeting-guide/state';
import { GUIDE_STAGES, stageFor } from '../src/lib/club/meeting-guide/stages';
import { PART_ORDER, PART_TITLES } from '../src/lib/club/meeting-guide/types';
import { FAMILIES } from './fixtures/meeting-guide-families';

const content = january2027;
const gen = (key: string, state = emptyGuideState(content)) => {
  const f = FAMILIES.find((x) => x.key === key)!;
  return generateMeetingGuide({ household: f.household, profile: f.profile, content, state });
};
const allText = (g: ReturnType<typeof gen>) => JSON.stringify(g);

describe('January Family Meeting guide generator', () => {
  it('keeps the four established parts, in order, with their minutes', () => {
    for (const f of FAMILIES) {
      const g = gen(f.key);
      expect(g.parts.map((p) => p.title)).toEqual(['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice']);
      expect(g.parts.map((p) => p.minutes)).toEqual([2, 3, 3, 2]);
      expect(PART_ORDER.map((p) => PART_TITLES[p])).toEqual(g.parts.map((p) => p.title));
    }
  });

  it('gives every person at home a line in every part', () => {
    for (const f of FAMILIES) {
      const g = gen(f.key);
      for (const part of g.parts) {
        expect(part.lines.map((l) => l.id).sort()).toEqual(f.household.members.map((m) => m.id).sort());
        for (const l of part.lines) expect(l.text.length).toBeGreaterThan(10);
      }
    }
  });

  it('gives a 2-year-old and a 12-year-old substantially different contributions', () => {
    const g = gen('two-adults-2-7');
    const ada = g.people.find((p) => p.name === 'Ada')!;
    const tobi = g.people.find((p) => p.name === 'Tobi')!;
    expect(ada.stage).toBe('toddler');
    expect(ada.part).toBeNull();
    expect(ada.lines.parts).toMatch(/No job yet/);
    for (const part of PART_ORDER) expect(ada.lines[part]).not.toBe(tobi.lines[part]);
    const jade = gen('single-5-9-13').people.find((p) => p.name === 'Jade')!;
    expect(jade.stage).toBe('teen');
    for (const part of PART_ORDER) expect(jade.lines[part]).not.toBe(ada.lines[part]);
  });

  it('uses her own activities and school, never invented ones', () => {
    const g = gen('two-adults-2-7');
    expect(g.parts[1].questions![0]).toContain('soccer');
    expect(allText(gen('single-5-9-13'))).toMatch(/piano|swim team/);
    const minimal = allText(gen('minimal'));
    expect(minimal).not.toMatch(/soccer|piano|swim|robotics|their activity/);
    expect(gen('minimal').missing).toEqual(expect.arrayContaining(['ages', 'activities', 'priorities']));
  });

  it('lets the account holder lead only when nobody else can', () => {
    const single = gen('single-5-9-13');
    const kara = single.people.find((p) => p.name === 'Kara')!;
    expect(kara.leads).toEqual([]);
    expect(single.parts.map((p) => p.leaderName)).toEqual(['Jade', 'Leo', 'Jade', 'Leo']);
    const two = gen('two-adults-2-7');
    expect(two.people.find((p) => p.name === 'Ngozi')!.leads).toEqual([]);
    expect(two.parts.find((p) => p.id === 'practice')!.leaderName).toMatch(/Daniel|Tobi/);
    const pre = gen('single-preschooler');
    expect(pre.parts.every((p) => p.leaderName === 'Lucia')).toBe(true);
    expect(pre.prepare.join(' ')).toContain('You open this first meeting');
  });

  it('never lets anyone under 6 lead, and 6–8 only Let’s Practice', () => {
    for (const f of FAMILIES) {
      const g = gen(f.key);
      for (const part of g.parts) {
        const leader = g.people.find((p) => p.id === part.leaderId);
        if (!leader || leader.stage === 'adult') continue;
        expect(['middle', 'teen', 'early']).toContain(leader.stage);
        if (leader.stage === 'early') expect(part.id).toBe('practice');
      }
    }
  });

  it('gives siblings in the same stage different lines', () => {
    const g = gen('minimal');
    const [sky, river] = g.people.filter((p) => p.stage === 'child');
    expect(sky.lines.focus).not.toBe(river.lines.focus);
  });

  it('agrees on one or two actions, matched to her priority', () => {
    for (const f of FAMILIES) {
      const g = gen(f.key);
      expect(g.actions.length).toBeGreaterThanOrEqual(1);
      expect(g.actions.length).toBeLessThanOrEqual(2);
    }
    expect(gen('two-adults-2-7').actions[0].id).toBe('night-before');
    expect(gen('single-5-9-13').actions.map((a) => a.id)).toContain('own-entries');
    expect(gen('single-preschooler').actions.map((a) => a.id)).not.toContain('own-entries');
  });

  it('applies her corrections: stage, part, leader, actions, rhythm', () => {
    const s = emptyGuideState(content);
    s.people.j1 = { stage: 'teen' };
    s.people.j2 = { custom: 'Feeds the fish every morning.' };
    s.leaders.focus = 'j1';
    s.actions = ['sunday-look'];
    s.rhythm = 'fri-dinner';
    const g = gen('minimal', s);
    expect(g.people.find((p) => p.id === 'j1')!.stage).toBe('teen');
    expect(g.parts[0].leaderName).toBe('Sky');
    expect(g.people.find((p) => p.id === 'j2')!.part!.text).toBe('Feeds the fish every morning.');
    expect(g.actions.map((a) => a.id)).toEqual(['sunday-look']);
    expect(g.rhythm.when).toBe('Friday after dinner');
    // A child can't be turned into a grown-up.
    s.people.j1 = { stage: 'adult' };
    expect(gen('minimal', s).people.find((p) => p.id === 'j1')!.stage).toBe('child');
    expect(isGuideState(s)).toBe(true);
  });

  it('is deterministic and keeps families apart', () => {
    for (const f of FAMILIES) expect(guideFingerprint(gen(f.key))).toBe(guideFingerprint(gen(f.key)));
    const names = (k: string) => FAMILIES.find((f) => f.key === k)!.household.members.map((m) => m.firstName);
    for (const f of FAMILIES) {
      const text = allText(gen(f.key));
      for (const other of FAMILIES.filter((o) => o.key !== f.key)) for (const n of names(other.key)) expect(text).not.toContain(`"${n}"`);
    }
  });

  it('follows the writing rules', () => {
    const words = JSON.stringify(GUIDE_MONTHS);
    expect(words).not.toMatch(/\b(Mom|Dad|parents?)\b/i);
    for (const f of FAMILIES) expect(allText(gen(f.key))).not.toMatch(/\b(Mom|Dad|parents?)\b|\{\w+\}/);
    for (const part of PART_ORDER) for (const stage of GUIDE_STAGES) expect(content.parts[part].byStage[stage].length).toBeGreaterThan(0);
  });

  it('keeps only the profile answers it uses', () => {
    const p = guideProfile({ setupDone: [], setupCompleted: true, challenges: ['preparing'], priority: 'mornings', activities: [{ category: 'sports', name: ' soccer ', memberIds: ['c2'], days: [2], startsAt: '17:00' }], responsibilities: [] });
    expect(p).toEqual({ priority: 'mornings', challenges: ['preparing'], activities: [{ category: 'sports', name: 'soccer', memberIds: ['c2'] }] });
    expect(guideProfile({ setupDone: [], setupCompleted: false, challenges: [], activities: [], responsibilities: [] })).toBeUndefined();
  });

  it('finds a month by its id, and matches stages by age', () => {
    expect(guideMonth('2027-01-01')).toBe(january2027);
    expect(guideMonth('2027-02')).toBeNull();
    const kid = (age: number) => ({ id: 'x', firstName: 'X', kind: 'child' as const, role: 'child' as const, birthYear: 2026 - age, birthMonth: 6 });
    expect([2, 3, 5, 6, 8, 9, 12, 13, 17].map((a) => stageFor(kid(a), '2027-01'))).toEqual(['toddler', 'preschool', 'preschool', 'early', 'early', 'middle', 'middle', 'teen', 'teen']);
  });
});
