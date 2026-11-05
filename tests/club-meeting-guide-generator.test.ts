import { describe, expect, it } from 'vitest';
import { january2027 } from '../src/data/club/meeting-guides/2027-01';
import { GUIDE_MONTHS, guideMonth } from '../src/data/club/meeting-guides';
import { MEETING_GUIDE } from '../src/data/club/meeting-guide';
import { checkInDue, commit, nextStep } from '../src/lib/club/family-plan';
import { generateMeetingGuide, guideFingerprint, type MeetingGuide } from '../src/lib/club/meeting-guide/generate';
import { emptyGuideState, guideProfile, isGuideState } from '../src/lib/club/meeting-guide/state';
import { stageFor } from '../src/lib/club/meeting-guide/stages';
import { FAMILIES } from './fixtures/meeting-guide-families';

const content = january2027;
const gen = (key: string, state = emptyGuideState()) => {
  const f = FAMILIES.find((x) => x.key === key)!;
  return generateMeetingGuide({ household: f.household, profile: f.profile, content, state });
};
const kid = (g: MeetingGuide, name: string) => g.people.find((p) => p.name === name)!;
const text = (g: MeetingGuide) => JSON.stringify({ ...g, plan: undefined });
/** Every line that prints. */
const lines = (g: MeetingGuide) => [
  ...g.focus.flatMap((f) => [f.title, f.opportunity]), ...g.talk.map((t) => t.text), ...g.people.flatMap((p) => p.ideas.map((i) => i.text)),
  ...g.grownUps.map((t) => t.text), ...g.practice.map((t) => t.text),
].filter(Boolean);

describe('January Family Meeting companion', () => {
  it('uses the four established parts, in the framework’s own words', () => {
    const framework = MEETING_GUIDE.parts.map((p) => p.title);
    for (const f of FAMILIES) {
      const g = gen(f.key);
      expect(g.sections.map((s) => s.title)).toEqual(framework);
      expect(g.sections.map((s) => s.goal)).toEqual(['What we’re working on together, and why it helps all of us.', 'Everyone answers, the youngest first. No wrong answers, no fixing anyone.', 'Each person picks or agrees to one small part they own this month.', 'Try one part together right now, so the first time isn’t a reminder later.']);
    }
  });

  it('is a menu, not a completed meeting: no leaders, scripts, assignments or filled-in decisions', () => {
    for (const f of FAMILIES) {
      const t = text(gen(f.key));
      expect(t).not.toMatch(/Led by|leaderId|"say"|Hand this guide|opens the meeting|Week [1-4]|First meeting/i);
    }
    expect(content.partsNote).toBe('Ideas to choose from, not jobs. Decide together.');
  });

  it('names one or two priorities, only from her answers', () => {
    expect(gen('young-support').focus.map((f) => f.title)).toEqual(['Easier evenings', 'Smoother daily routines']);
    expect(gen('two-adults-teen').focus.map((f) => f.title)).toEqual(['Fewer reminders', 'Sharing plans with each other']);
    expect(gen('mixed-busy').focus.map((f) => f.source)).toEqual(['priority', 'challenge']);
    for (const f of FAMILIES) expect(gen(f.key).focus.length).toBeLessThanOrEqual(2);
    expect(gen('minimal').focus.map((f) => f.source)).toEqual(['month']);
  });

  it('offers each child up to two ideas, from what she wants for them, in their age’s version', () => {
    const tobi = kid(gen('young-support'), 'Tobi');
    expect(tobi.ideas[0]).toMatchObject({ itemId: 'own-belongings', source: 'desired' });
    expect(tobi.support).toMatch(/together at first/);
    const park = gen('school-age');
    expect(kid(park, 'Jun').ideas[0].itemId).toBe('pack-school-bag');
    expect(kid(park, 'Jun').ideas[0].text).toContain('school');
    expect(kid(park, 'Mira').ideas[0].itemId).toBe('homework-start');
    for (const f of FAMILIES) for (const p of gen(f.key).people) expect(p.ideas.length).toBeLessThanOrEqual(2);
    expect(kid(gen('young-support'), 'Ada')).toMatchObject({ joinsIn: true, ideas: [] });
    expect(kid(gen('two-adults-teen'), 'Elsa').ideas[0].text).toMatch(/wind-down time/);
  });

  it('notices what someone already does instead of suggesting it again', () => {
    expect(kid(gen('school-age'), 'Mira').keeps).toMatch(/Mira already takes care of pet care/);
    expect(kid(gen('school-age'), 'Mira').ideas.map((i) => i.itemId)).not.toContain('pet-care');
    expect(kid(gen('mixed-busy'), 'Jade').keeps).toMatch(/laundry/);
    expect(gen('young-support').grownUps.map((t) => t.text)).toEqual([content.grownUps, 'Daniel already takes care of driving and pickups. Worth noticing out loud.']);
    for (const f of FAMILIES) expect(text(gen(f.key))).not.toMatch(/(Ngozi|Hana|Kara|Maja|Lucia|Jo) already/);
  });

  it('gives grown-ups a conversation about supporting the kids, never a calendar job', () => {
    for (const f of FAMILIES) {
      const g = gen(f.key);
      expect(text(g)).not.toMatch(/add your own plans|their own plans to the calendar/i);
      expect(g.grownUps[0]?.text).toBe(content.grownUps);
    }
    expect(content.grownUps).toMatch(/help without taking over/);
  });

  it('writes each child’s ideas as plain actions under their name, without pronouns', () => {
    for (const f of FAMILIES) for (const p of gen(f.key).people) for (const i of p.ideas) expect(i.text).not.toMatch(/\b(their|they|them|he|she|his|her)\b/i);
    for (const s2 of Object.values(content.support)) expect(s2).not.toMatch(/\b(their|they|them)\b/i);
  });

  it('spreads her unassigned wishes so siblings start differently', () => {
    const g = gen('mixed-busy');
    expect(kid(g, 'Mia').ideas[0].itemId).not.toBe(kid(g, 'Leo').ideas[0].itemId);
    expect(new Set(['Mia', 'Leo', 'Jade'].flatMap((n) => kid(g, n).ideas.map((i) => i.itemId)))).toEqual(new Set(['own-belongings', 'help-with-meals']));
  });

  it('keeps Let’s Talk and Let’s Practice short, and offers the obstacle as a possibility', () => {
    for (const f of FAMILIES) {
      const g = gen(f.key);
      expect(g.talk.length).toBeLessThanOrEqual(4);
      expect(g.practice.length).toBeLessThanOrEqual(4);
    }
    expect(gen('school-age').talk.at(-1)!.text).toMatch(/^What gets in our way\? One possibility: jobs might not have a clear “when”/);
    expect(gen('minimal').talk.at(-1)!.text).toBe(content.obstacleOpen);
    expect(gen('mixed-busy').talk[0].text).toContain('piano');
  });

  it('gives habit ideas from the family’s own ideas, never repeating another section', () => {
    const g = gen('young-support');
    expect(g.practice.map((p) => p.text)).toContain('To make it easier for Tobi: a low hook and a shoe spot by the door.');
    expect(g.practice.map((p) => p.text)).toContain('One idea: each person takes one step of the routine instead of the whole thing.');
    // The obstacle is about simplicity, so the "make it smaller" tip isn't repeated.
    expect(g.practice.some((p) => p.key === 'practice:simplify')).toBe(false);
    // The obstacle is about a clear "when", so the cue tip isn't repeated.
    expect(gen('school-age').practice.some((p) => p.key === 'practice:stack')).toBe(false);
    expect(gen('mixed-busy').practice.find((p) => p.key === 'practice:stack')!.text).toBe('It can help to tie a part to something that already happens. For Mia: “Coming in the door, coat on the hook, shoes in the shoe spot.”');
    // Suggestions, not instructions.
    for (const f of FAMILIES) for (const t of gen(f.key).practice) expect(t.text).toMatch(/^(If there’s time|One idea|It can help|To make it easier|If a part keeps slipping)/);
    for (const f of FAMILIES) {
      const l = lines(gen(f.key));
      expect(l.filter((x, i) => l.indexOf(x) !== i), f.key).toEqual([]);
    }
  });

  it('hides what she takes off, and keeps her stage corrections', () => {
    const s = emptyGuideState();
    s.hidden = ['talk:week', 'idea:j1:jan-tomorrow-any', 'practice:now'];
    s.people.j2 = { stage: 'teen' };
    const g = gen('minimal', s);
    expect(g.talk.map((t) => t.key)).not.toContain('talk:week');
    expect(kid(g, 'Sky').ideas.map((i) => i.itemId)).not.toContain('jan-tomorrow-any');
    expect(g.practice.map((p) => p.key)).not.toContain('practice:now');
    expect(kid(g, 'River').stage).toBe('teen');
    expect(kid(g, 'River').ideas[0].text).toMatch(/own plans|rides/);
    s.people.j2 = { stage: 'adult' };
    expect(kid(gen('minimal', s), 'River').stage).toBe('child');
    expect(isGuideState(s)).toBe(true);
  });

  it('uses her own activities and school, never invented ones', () => {
    expect(text(gen('minimal'))).not.toMatch(/soccer|piano|swim|robotics|their activity/);
    expect(gen('minimal').missing).toEqual(expect.arrayContaining(['ages', 'activities', 'priorities', 'growth areas']));
  });

  it('keeps the ideas as structured data: suggestions, never commitments', () => {
    const g = gen('school-age');
    expect(g.plan.ideas.filter((p) => p.memberId === 'p2').map((p) => p.itemId)).toEqual(['pack-school-bag', 'jan-tomorrow']);
    expect(g.plan.ideas.every((p) => p.status === 'suggested' && p.offered === '2027-01' && !('progress' in p))).toBe(true);
    expect('commitments' in g.plan).toBe(false);
    expect(g.plan.obstacle).toMatchObject({ challengeId: 'remembering', principle: 'trigger' });
    expect(g.plan.focus.length).toBe(2);
  });

  it('is deterministic, keeps families apart and follows the writing rules', () => {
    for (const f of FAMILIES) expect(guideFingerprint(gen(f.key))).toBe(guideFingerprint(gen(f.key)));
    for (const f of FAMILIES) {
      const t = text(gen(f.key));
      expect(t).not.toMatch(/\b(Mom|Dad|parents?)\b|\{\w+\}/);
      for (const other of FAMILIES.filter((o) => o.key !== f.key)) for (const m of other.household.members) expect(t).not.toMatch(new RegExp(`\\b${m.firstName}\\b`));
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
    const k = (age: number) => ({ id: 'x', firstName: 'X', kind: 'child' as const, role: 'child' as const, birthYear: 2026 - age, birthMonth: 6 });
    expect([2, 3, 5, 6, 8, 9, 12, 13, 17].map((a) => stageFor(k(a), '2027-01'))).toEqual(['toddler', 'preschool', 'preschool', 'early', 'early', 'middle', 'middle', 'teen', 'teen']);
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
  it('only a family’s own choice makes a commitment, and only commitments are checked in on', () => {
    const idea = gen('school-age').plan.ideas[0];
    const c = commit(idea, 'meeting', '2027-01-10');
    expect(c).toMatchObject({ status: 'accepted', progress: 'practicing', since: '2027-01-10', itemId: idea.itemId });
    expect(checkInDue(c, '2027-02-20')).toBe(false);
    expect(checkInDue(c, '2027-02-21')).toBe(true);
    expect(checkInDue({ ...c, lastCheckedOn: '2027-02-21' }, '2027-03-01')).toBe(false);
    expect(checkInDue({ ...c, progress: 'retired' }, '2027-06-01')).toBe(false);
    // A suggestion has no status 'accepted', so it's never due.
    expect(checkInDue({ ...(idea as never), since: '2027-01-01', progress: 'practicing' }, '2027-06-01')).toBe(false);
  });
});
