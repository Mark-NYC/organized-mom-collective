import { describe, expect, it } from 'vitest';
import { january2027 } from '../src/data/club/meeting-guides/2027-01';
import { GUIDE_MONTHS, guideMonth } from '../src/data/club/meeting-guides';
import { checkInDue, nextStep } from '../src/lib/club/family-plan';
import { generateMeetingGuide, guideFingerprint } from '../src/lib/club/meeting-guide/generate';
import { emptyGuideState, guideProfile, isGuideState } from '../src/lib/club/meeting-guide/state';
import { stageFor } from '../src/lib/club/meeting-guide/stages';
import { FAMILIES } from './fixtures/meeting-guide-families';

const content = january2027;
const gen = (key: string, state = emptyGuideState(content)) => {
  const f = FAMILIES.find((x) => x.key === key)!;
  return generateMeetingGuide({ household: f.household, profile: f.profile, content, state });
};
const person = (g: ReturnType<typeof gen>, name: string) => g.people.find((p) => p.name === name)!;
const text = (g: ReturnType<typeof gen>) => JSON.stringify({ ...g, plan: undefined });

describe('January Family Meeting guide', () => {
  it('keeps the four established parts, in order, with their minutes', () => {
    for (const f of FAMILIES) {
      const g = gen(f.key);
      expect(g.sections.map((p) => p.title)).toEqual(['Our Focus', 'Let’s Talk', 'Everyone’s Part', 'Let’s Practice']);
      expect(g.sections.map((p) => p.minutes)).toEqual([2, 3, 3, 2]);
    }
  });

  it('names one or two things that matter most, only from her answers', () => {
    expect(gen('young-support').focus.map((f) => f.title)).toEqual(['Easier evenings', 'Smoother daily routines']);
    // reminding and remembering are one theme: one focus, not two.
    expect(gen('two-adults-teen').focus.map((f) => f.title)).toEqual(['Fewer reminders', 'Sharing plans with each other']);
    // activities and knowing-plans are one theme; sharing-fairly is the second.
    expect(gen('mixed-busy').focus.map((f) => f.source)).toEqual(['priority', 'challenge']);
    for (const f of FAMILIES) expect(gen(f.key).focus.length).toBeLessThanOrEqual(2);
    expect(gen('minimal').focus).toEqual([{ id: 'month', source: 'month', title: 'Starting our monthly Family Meeting' }]);
  });

  it('gives each child the part she said she wants for them, in the version for their age', () => {
    const tobi = person(gen('young-support'), 'Tobi');
    expect(tobi.part).toMatchObject({ itemId: 'own-belongings', source: 'desired', cue: 'Coming in the door' });
    expect(tobi.part!.support).toMatch(/together the first week/);
    const park = gen('school-age');
    expect(person(park, 'Jun').part!.itemId).toBe('pack-school-bag');
    expect(person(park, 'Jun').part!.behavior).toContain('school');
    expect(person(park, 'Mira').part!.itemId).toBe('homework-start');
    expect(person(park, 'Mira').part!.support).toMatch(/On their own/);
  });

  it('recognizes what a child already does instead of adding work', () => {
    const mira = person(gen('school-age'), 'Mira');
    expect(mira.keeps).toMatch(/Already takes care of pet care/);
    const jade = person(gen('mixed-busy'), 'Jade');
    expect(jade.keeps).toMatch(/laundry/);
    // The account holder never gets a "keeps doing" line (it would only list what she carries).
    for (const f of FAMILIES) for (const p of gen(f.key).people.filter((x) => x.isHolder)) expect(p.keeps).toBeNull();
  });

  it('spreads unassigned wishes so siblings differ, and never gives one a child already owns', () => {
    const g = gen('mixed-busy');
    const parts = ['Mia', 'Leo', 'Jade'].map((n) => person(g, n).part!.itemId);
    // Two wishes for any child, three children: neighbours differ, every part is one of her wishes, each in its age's version.
    expect(parts[0]).not.toBe(parts[1]);
    expect(parts.every((p) => ['own-belongings', 'help-with-meals'].includes(p))).toBe(true);
    expect(person(g, 'Mia').part!.behavior).not.toBe(person(g, 'Jade').part!.behavior);
  });

  it('gives a 2-year-old no job and a teen real independence', () => {
    const ada = person(gen('young-support'), 'Ada');
    expect(ada.part).toBeNull();
    const elsa = person(gen('two-adults-teen'), 'Elsa');
    expect(elsa.part!.behavior).toMatch(/Sets their own wind-down time/);
    expect(elsa.part!.support).toMatch(/Their way/);
  });

  it('offers at most one obstacle, as a possibility, only from her challenges', () => {
    expect(gen('school-age').obstacle).toMatchObject({ principle: 'trigger' });
    expect(gen('school-age').obstacle!.obstacle).toMatch(/might/);
    expect(gen('young-support').obstacle!.principle).toBe('simplicity');
    expect(gen('minimal').obstacle).toBeNull();
    expect(gen('minimal').obstacleOpen).toMatch(/What usually gets in our way/);
  });

  it('turns the plan’s own setups into at most two to-dos', () => {
    const g = gen('young-support');
    expect(g.todos[0]).toMatch(/^For Tobi: Put a low hook/);
    for (const f of FAMILIES) expect(gen(f.key).todos.length).toBeLessThanOrEqual(2);
    expect(gen('two-adults-teen').todos).toEqual(content.todosDefault.slice(0, 2));
  });

  it('uses her own activities and school, never invented ones', () => {
    expect(gen('mixed-busy').questions[0]).toContain('piano');
    expect(text(gen('minimal'))).not.toMatch(/soccer|piano|swim|robotics|their activity/);
    expect(gen('minimal').missing).toEqual(expect.arrayContaining(['ages', 'activities', 'priorities', 'growth areas']));
  });

  it('lets the account holder lead only when nobody else can; under 6 never leads', () => {
    const busy = gen('mixed-busy');
    expect(person(busy, 'Kara').leads).toEqual([]);
    expect(gen('single-preschooler').sections.every((p) => p.leaderName === 'Lucia')).toBe(true);
    for (const f of FAMILIES) {
      const g = gen(f.key);
      for (const s of g.sections) {
        const l = g.people.find((p) => p.id === s.leaderId);
        if (l && l.stage === 'early') expect(s.id).toBe('practice');
        if (l) expect(['toddler', 'preschool', 'child']).not.toContain(l.stage);
      }
    }
  });

  it('applies her corrections: stage, part, own words, leader, rhythm', () => {
    const s = emptyGuideState(content);
    s.people.j1 = { stage: 'teen' };
    s.people.j2 = { custom: 'Feeds the fish every morning.' };
    s.leaders.focus = 'j1';
    s.rhythm = 'fri-dinner';
    const g = gen('minimal', s);
    expect(g.people.find((p) => p.id === 'j1')!.stage).toBe('teen');
    expect(g.sections[0].leaderName).toBe('Sky');
    expect(g.people.find((p) => p.id === 'j2')!.part!.behavior).toBe('Feeds the fish every morning.');
    expect(g.rhythm.when).toBe('Friday after dinner');
    s.people.j1 = { stage: 'adult' };
    expect(gen('minimal', s).people.find((p) => p.id === 'j1')!.stage).toBe('child');
    const t = emptyGuideState(content);
    t.people.c2 = { part: 'jan-shoes' };
    expect(person(gen('young-support', t), 'Tobi').part!.itemId).toBe('jan-shoes');
    expect(isGuideState(s)).toBe(true);
  });

  it('produces the plan as structured data', () => {
    const g = gen('school-age');
    expect(g.plan.practices.find((p) => p.memberId === 'p2')).toMatchObject({ itemId: 'pack-school-bag', category: 'school-prep', source: 'desired', status: 'suggested', progress: 'practicing', since: '2027-01' });
    expect(g.plan.obstacle).toMatchObject({ challengeId: 'remembering', principle: 'trigger' });
    expect(g.plan.focus.length).toBe(2);
    expect(g.plan.practices.every((p) => p.cue || p.source === 'custom')).toBe(true);
  });

  it('is deterministic, keeps families apart and follows the writing rules', () => {
    for (const f of FAMILIES) expect(guideFingerprint(gen(f.key))).toBe(guideFingerprint(gen(f.key)));
    for (const f of FAMILIES) {
      const t = text(gen(f.key));
      expect(t).not.toMatch(/\b(Mom|Dad|parents?)\b|\{\w+\}/);
      for (const other of FAMILIES.filter((o) => o.key !== f.key)) for (const m of other.household.members) expect(t).not.toContain(`"${m.firstName}"`);
    }
    expect(JSON.stringify(GUIDE_MONTHS)).not.toMatch(/\b(Mom|Dad|parents?)\b/i);
  });

  it('keeps only the profile answers it uses', () => {
    const p = guideProfile({ setupDone: [], setupCompleted: true, challenges: ['preparing'], priority: 'mornings', activities: [{ category: 'sports', name: ' soccer ', memberIds: ['c2'], days: [2], startsAt: '17:00' }],
      responsibilities: [{ status: 'desired', category: 'belongings', item: 'own-belongings', ownerIds: ['c2'], helperIds: [] }, { status: 'suggested', category: 'meals', ownerIds: [], helperIds: [] }] });
    expect(p).toEqual({ priority: 'mornings', challenges: ['preparing'], activities: [{ category: 'sports', name: 'soccer', memberIds: ['c2'] }], responsibilities: [{ status: 'desired', category: 'belongings', item: 'own-belongings', ownerIds: ['c2'] }] });
    expect(guideProfile({ setupDone: [], setupCompleted: false, challenges: [], activities: [], responsibilities: [] })).toBeUndefined();
  });

  it('finds a month by its id, and matches stages by age', () => {
    expect(guideMonth('2027-01-01')).toBe(january2027);
    expect(guideMonth('2027-02')).toBeNull();
    const kid = (age: number) => ({ id: 'x', firstName: 'X', kind: 'child' as const, role: 'child' as const, birthYear: 2026 - age, birthMonth: 6 });
    expect([2, 3, 5, 6, 8, 9, 12, 13, 17].map((a) => stageFor(kid(a), '2027-01'))).toEqual(['toddler', 'preschool', 'preschool', 'early', 'early', 'middle', 'middle', 'teen', 'teen']);
  });
});

describe('progress check-in rules (data foundation)', () => {
  it('celebrates success without adding work, continues, adjusts or retires', () => {
    expect(nextStep({ answer: 'on-own' })).toEqual({ kind: 'celebrate', progress: 'independent' });
    expect(nextStep({ answer: 'reminders' })).toEqual({ kind: 'continue', progress: 'improving' });
    expect(nextStep({ answer: 'struggling', barrier: 'forgets' })).toEqual({ kind: 'adjust', progress: 'struggling', principle: 'trigger' });
    expect(nextStep({ answer: 'struggling' })).toEqual({ kind: 'adjust', progress: 'struggling', principle: null });
    expect(nextStep({ answer: 'moved-on' })).toEqual({ kind: 'retire', progress: 'retired' });
  });
  it('is due six weeks after a practice started or was last asked about', () => {
    expect(checkInDue(null, '2027-01', '2027-02-10')).toBe(false);
    expect(checkInDue(null, '2027-01', '2027-02-12')).toBe(true);
    expect(checkInDue('2027-02-12', '2027-01', '2027-03-01')).toBe(false);
  });
});
