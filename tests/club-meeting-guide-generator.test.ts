import { describe, expect, it } from 'vitest';
import { january2027 } from '../src/data/club/meeting-guides/2027-01';
import { GUIDE_MONTHS, guideMonth } from '../src/data/club/meeting-guides';
import { MEETING_GUIDE } from '../src/data/club/meeting-guide';
import { CHALLENGES, PRIORITIES, GROWTH_ITEMS } from '../src/data/club/family-profile';
import { checkInDue, commit, nextStep } from '../src/lib/club/family-plan';
import { familyTitle, generateMeetingGuide, guideFingerprint, type MeetingGuide } from '../src/lib/club/meeting-guide/generate';
import { emptyGuideState, guideProfile, isGuideState, type GuideProfile } from '../src/lib/club/meeting-guide/state';
import { stageFor } from '../src/lib/club/meeting-guide/stages';
import type { Household } from '../src/lib/club/profile';
import { FAMILIES } from './fixtures/meeting-guide-families';

const content = january2027;
const fam = (key: string) => FAMILIES.find((x) => x.key === key)!;
const gen = (key: string, state = emptyGuideState()) => generateMeetingGuide({ household: fam(key).household, profile: fam(key).profile, content, state });
const kid = (g: MeetingGuide, name: string) => g.people.find((p) => p.name === name)!;
const text = (g: MeetingGuide) => JSON.stringify({ ...g, plan: undefined, rationale: undefined });
/** Every line that prints. */
const lines = (g: MeetingGuide) => [
  ...g.focus.flatMap((f) => [f.title, f.opportunity]), ...g.talk.map((t) => t.text), g.partsDiscover ?? '',
  ...g.people.flatMap((p) => [...p.ideas.map((i) => i.text), p.keeps ?? '']), ...g.grownUps.map((t) => t.text), ...g.practice.map((t) => t.text),
].filter(Boolean);

/** The rules every companion keeps, whatever the family. */
function invariants(g: MeetingGuide, label: string) {
  expect(g.sections.map((s) => s.title), label).toEqual(MEETING_GUIDE.parts.map((p) => p.title));
  expect(g.focus.length, label).toBeGreaterThanOrEqual(1);
  expect(g.focus.length, label).toBeLessThanOrEqual(2);
  expect(g.talk.length, label).toBeLessThanOrEqual(4);
  expect(g.practice.length, label).toBeLessThanOrEqual(2);
  const choice = g.plan.obstacle?.principle === 'ownership';
  for (const p of g.people) {
    expect(p.ideas.length, `${label} ${p.name}`).toBeLessThanOrEqual(choice && ['early', 'middle', 'teen'].includes(p.stage) ? 2 : 1);
    for (const i of p.ideas) expect(i.text, label).not.toMatch(/\b(their|they|them|he|she|his|her)\b/i);
  }
  const l = lines(g);
  expect(l.filter((x, i) => l.indexOf(x) !== i), `${label}: repeated lines`).toEqual([]);
  expect(text(g), label).not.toMatch(/\b(Mom|Dad|parents?)\b|\{\w+\}|Led by|Hand this guide/);
  // Grounded: a focus other than the month's own always has intake evidence behind it.
  for (const f of g.rationale.focus) if (f.id !== 'meetings') expect(f.evidence.length, label).toBeGreaterThan(0);
}

describe('January companion: selection', () => {
  it('keeps the rules for all ten families', () => {
    for (const f of FAMILIES) invariants(gen(f.key), f.key);
  });

  it('picks the opportunity her answers point to most strongly', () => {
    const focus = (k: string) => gen(k).rationale.focus.map((f) => f.id);
    expect(focus('preschool-support')).toEqual(['evenings']);
    expect(focus('fewer-reminders')).toEqual(['reminders']);
    expect(focus('mixed-ages')).toEqual(['home']);
    expect(focus('busy-schedules')).toEqual(['schedules']);
    expect(focus('mornings')).toEqual(['mornings']);
    expect(focus('resistance')).toEqual(['sharing']);
    expect(focus('independent')).toEqual(['school']);
    expect(focus('vague')).toEqual(['meetings']);
    expect(focus('one-challenge')).toEqual(['reminders']);
  });

  it('keeps one focus when she reports many, and never reuses an answer to justify a second', () => {
    const g = gen('many-priorities');
    expect(g.focus.map((f) => f.title)).toEqual(['Easier evenings']);
    expect(g.rationale.considered.length).toBeGreaterThan(4);
    // The preschool family's one "routines" answer supports evenings; it can't also make mornings a second focus.
    expect(gen('preschool-support').focus.length).toBe(1);
  });

  it('keeps one focus even when another is well supported; the other waits in the rationale', () => {
    const household: Household = { id: 'x', displayName: 'Test', preferences: {}, profileVersion: 1, members: [
      { id: 'x1', firstName: 'Pat', kind: 'adult', role: 'parent', isAccountHolder: true },
      { id: 'x2', firstName: 'Kit', kind: 'child', role: 'child', birthYear: 2018, birthMonth: 6 },
    ] };
    const profile: GuideProfile = { priority: 'mornings', challenges: ['knowing-plans', 'communicating'], activities: [], responsibilities: [] };
    const g = generateMeetingGuide({ household, profile, content });
    expect(g.rationale.focus.map((f) => f.id)).toEqual(['mornings']);
    expect(g.rationale.considered.find((c) => c.id === 'schedules')!.why).toMatch(/candidate for a later meeting/);
  });

  it('offers each child one possible starting point, her wishes first; the family picks one to try', () => {
    expect(kid(gen('fewer-reminders'), 'Jun').ideas.map((i) => [i.itemId, i.source])).toEqual([['pack-school-bag', 'desired']]);
    expect(kid(gen('fewer-reminders'), 'Mira').ideas.map((i) => i.itemId)).toEqual(['homework-start']);
    expect(kid(gen('preschool-support'), 'Tobi').ideas.map((i) => i.itemId)).toEqual(['own-belongings']);
    const r = gen('resistance');
    expect(kid(r, 'Omar').ideas.map((i) => i.itemId)).toEqual(['tidy-room']);
    for (const f of FAMILIES) for (const p of gen(f.key).people) { expect(p.ideas.length).toBeLessThanOrEqual(1); expect(p.choose).toBe(false); }
    expect(content.partsNote).toMatch(/Choose one to try first together/);
  });

  it('recognizes an independent child instead of adding work', () => {
    const grace = kid(gen('independent'), 'Grace');
    expect(grace.ideas).toEqual([]);
    expect(grace.keeps).toBe('Grace already takes care of getting ready for school. Ask Grace to show everyone how, instead of adding a new job.');
    expect(kid(gen('fewer-reminders'), 'Mira').keeps).toMatch(/Mira already takes care of pet care/);
  });

  it('asks before assuming: obstacles she reported are possibilities; otherwise a discovery question', () => {
    expect(gen('fewer-reminders').talk[1].text).toBe('What gets in the way? One possibility: jobs might not have a clear “when”.');
    expect(gen('independent').talk[1].text).toMatch(/^What gets in the way of having school things ready: no set time, no set spot, or something else\?$/);
    expect(gen('independent').plan.obstacle).toBeNull();
  });

  it('hands the choice to the children: one question naming the children 6+ with a starting point', () => {
    expect(gen('mixed-ages').talk.map((t) => t.text)).toContain('Ask Leo and Jade which starting point they’d try first, or what they’d try instead.');
    // Preschoolers aren't asked to analyze it; they do it together first.
    expect(gen('preschool-support').talk.map((t) => t.key)).toEqual(['talk:evenings', 'talk:obstacle']);
    expect(gen('fewer-reminders').talk.at(-1)!.text).toBe('Ask Jun and Mira which starting point they’d try first, or what they’d try instead.');
    for (const f of FAMILIES) for (const p of gen(f.key).people) expect(p.ask).toBeNull();
  });

  it('offers her obstacle’s adjustment once, in Practice', () => {
    expect(gen('resistance').practice.map((p) => p.text)).toContain('One thing worth trying: let each child choose a part from two that fit their age.');
    expect(gen('resistance').talk[1].text).toMatch(/whoever notices first/);
  });

  it('offers one adjustment worth trying and a way to keep it going without adding work', () => {
    expect(gen('independent').practice.map((p) => p.text)).toEqual(['One thing worth trying: a hook by the door at the right height, for Owen.', 'When it’s going well, say so, and hold off on adding a new job.']);
    expect(gen('fewer-reminders').practice[1].text).toMatch(/^Before reminding, try asking “What’s next\?”/);
  });

  it('with too little intake, asks instead of guessing, and offers January’s own meeting habit', () => {
    const g = gen('vague');
    expect(g.people.every((p) => p.ideas.length === 0)).toBe(true);
    expect(g.partsDiscover).toBe('Ask Sky and River what to take on, once the meeting is a habit. One small part is plenty.');
    expect(g.practice.map((p) => p.key)).toEqual(['practice:meeting', 'practice:sustain']);
    expect(g.focus[0].title).toBe('Starting our Family Meetings');
    expect(g.missing).toEqual(expect.arrayContaining(['ages', 'priorities', 'growth areas']));
  });

  it('asks which job, instead of picking one, when she named a challenge but no job', () => {
    const g = gen('one-challenge');
    expect(g.people.every((p) => p.ideas.length === 0)).toBe(true);
    expect(g.partsDiscover).toBe('Ask Min, Joon and Seo which job they hear the most reminders about, then give that job a clear “when” together.');
    expect(g.practice.map((p) => p.key)).toEqual(['practice:obstacle', 'practice:sustain']);
  });

  it('prefers the setup that makes an idea easier over “make it smaller”, which one idea per child already is', () => {
    expect(gen('mornings').practice[0].text).toBe('One thing worth trying: a three-step picture list by the mirror, for Mateo.');
    expect(gen('mornings').talk[1].text).toMatch(/too many steps/);
  });

  it('never leaves a child 3+ off the page: an idea, recognition, or a question', () => {
    for (const f of FAMILIES) {
      const g = gen(f.key);
      for (const p of g.people.filter((x) => !x.joinsIn)) expect(Boolean(p.ideas.length || p.keeps || g.partsDiscover?.includes(p.name)), `${f.key} ${p.name}`).toBe(true);
    }
    // No answers at all: no manufactured ideas, even with ages; January's meeting habit is the starting point.
    const household: Household = { id: 'y', displayName: 'Twins', preferences: {}, profileVersion: 1, members: [
      { id: 'y1', firstName: 'Ari', kind: 'adult', role: 'parent', isAccountHolder: true },
      { id: 'y2', firstName: 'Bo', kind: 'child', role: 'child', birthYear: 2018, birthMonth: 4 },
      { id: 'y3', firstName: 'Cy', kind: 'child', role: 'child', birthYear: 2020, birthMonth: 9 },
    ] };
    const g = generateMeetingGuide({ household, content });
    expect(g.people.every((p) => p.ideas.length === 0)).toBe(true);
    expect(g.partsDiscover).toMatch(/^Ask Bo and Cy /);
    expect(g.practice[0].key).toBe('practice:meeting');
  });

  it('never repeats the same line for siblings; little ones join through Let’s Talk, not a card', () => {
    const g = gen('mixed-ages');
    expect(new Set(g.people.flatMap((p) => p.ideas.map((i) => i.text))).size).toBe(g.people.flatMap((p) => p.ideas).length);
    const ada = kid(gen('preschool-support'), 'Ada');
    expect(ada).toMatchObject({ joinsIn: true, ideas: [], keeps: null });
    expect(gen('preschool-support').talkLittle).toBe(content.talkLittle);
  });

  it('gives grown-ups a conversation, never a job; notices what another grown-up already does', () => {
    expect(gen('preschool-support').grownUps.map((t) => t.text)).toEqual([content.grownUps, 'Daniel already takes care of driving and pickups. Worth noticing out loud.']);
    for (const f of FAMILIES) expect(text(gen(f.key))).not.toMatch(/(Ngozi|Hana|Kara|Maja|Lucia|Amira|Mei|Rosa|Jo|Hye) already/);
  });

  it('uses her own activities, never invented ones', () => {
    expect(gen('busy-schedules').talk[0].text).toBe('What’s happening for each of us this week, like robotics?');
    for (const k of ['vague', 'one-challenge', 'preschool-support']) expect(text(gen(k))).not.toMatch(/robotics|hockey|soccer|piano/);
  });

  it('holds its rules for every priority and challenge, not just the ten families', () => {
    const household: Household = { id: 's', displayName: 'Sweep', preferences: {}, profileVersion: 1, members: [
      { id: 's1', firstName: 'Lee', kind: 'adult', role: 'parent', isAccountHolder: true },
      { id: 's2', firstName: 'Ivy', kind: 'child', role: 'child', birthYear: 2022, birthMonth: 6 },
      { id: 's3', firstName: 'Max', kind: 'child', role: 'child', birthYear: 2017, birthMonth: 6 },
    ] };
    for (const pr of [undefined, ...PRIORITIES.map((p) => p.id)]) {
      for (const ch of [[], ...CHALLENGES.map((c) => [c.id])]) {
        for (const wish of [[], [GROWTH_ITEMS[(ch.length + (pr?.length ?? 0)) % GROWTH_ITEMS.length].id]]) {
          const profile: GuideProfile = { ...(pr ? { priority: pr, ...(pr === 'other' ? { priorityNote: 'Our own words' } : {}) } : {}), challenges: ch, activities: [],
            responsibilities: wish.map((w) => ({ status: 'desired' as const, category: GROWTH_ITEMS.find((g) => g.id === w)!.category, item: w, ownerIds: ['s3'] })) };
          invariants(generateMeetingGuide({ household, profile, content }), `${pr}/${ch}/${wish}`);
        }
      }
    }
  });
});

describe('January companion: structure and data', () => {
  it('uses the four established parts in the framework’s own words, as a menu', () => {
    const g = gen('mornings');
    expect(g.sections.map((s) => s.goal)).toEqual(['What we’re working on together, and why it helps all of us.', 'Everyone answers, the youngest first. No wrong answers, no fixing anyone.', 'Each person picks or agrees to one small part they own this month.', 'Try one part together right now, so the first time isn’t a reminder later.']);
    expect(content.subtitle).toBe('Ideas for our January Family Meetings.');
  });

  it('hides what she takes off, and keeps her stage corrections', () => {
    const s = emptyGuideState();
    s.hidden = ['talk:mornings', 'idea:g2:morning-routine'];
    s.people.g3 = { stage: 'teen' };
    const g = gen('mornings', s);
    expect(g.talk.map((t) => t.key)).not.toContain('talk:mornings');
    expect(kid(g, 'Mateo').ideas).toEqual([]);
    expect(kid(g, 'Sofia').stage).toBe('teen');
    s.people.g3 = { stage: 'adult' };
    expect(kid(gen('mornings', s), 'Sofia').stage).toBe('early');
    expect(isGuideState(s)).toBe(true);
  });

  it('saves ideas as suggestions, never commitments', () => {
    const g = gen('fewer-reminders');
    expect(g.plan.ideas.map((i) => [i.memberId, i.itemId])).toEqual([['p2', 'pack-school-bag'], ['p3', 'homework-start']]);
    expect(g.plan.ideas.every((i) => i.status === 'suggested' && !('progress' in i))).toBe(true);
    expect(g.plan.obstacle).toMatchObject({ challengeId: 'remembering', principle: 'trigger' });
    expect('commitments' in g.plan).toBe(false);
  });

  it('is deterministic, keeps families apart and follows the writing rules', () => {
    for (const f of FAMILIES) expect(guideFingerprint(gen(f.key))).toBe(guideFingerprint(gen(f.key)));
    for (const f of FAMILIES) {
      const t = text(gen(f.key));
      for (const other of FAMILIES.filter((o) => o.key !== f.key)) for (const m of other.household.members) expect(t, `${f.key} has ${m.firstName}`).not.toMatch(new RegExp(`\\b${m.firstName}\\b`));
    }
    expect(JSON.stringify(GUIDE_MONTHS)).not.toMatch(/\b(Mom|Dad|parents?)\b/i);
  });

  it('keeps only the profile answers it uses', () => {
    const p = guideProfile({ setupDone: [], setupCompleted: true, challenges: ['preparing'], priority: 'mornings', activities: [{ category: 'sports', name: ' soccer ', memberIds: ['c2'], days: [2], startsAt: '17:00' }],
      responsibilities: [{ status: 'desired', category: 'belongings', item: 'own-belongings', ownerIds: ['c2'], helperIds: [] }, { status: 'suggested', category: 'meals', ownerIds: [], helperIds: [] }] });
    expect(p).toEqual({ priority: 'mornings', challenges: ['preparing'], activities: [{ category: 'sports', name: 'soccer', memberIds: ['c2'] }], responsibilities: [{ status: 'desired', category: 'belongings', item: 'own-belongings', ownerIds: ['c2'] }] });
    expect(guideProfile({ setupDone: [], setupCompleted: false, challenges: [], activities: [], responsibilities: [] })).toBeUndefined();
  });

  it('keeps her own family name as she wrote it', () => {
    const h = (displayName?: string): Household => ({ id: 'n', displayName, preferences: {}, profileVersion: 1, members: [] });
    expect(['The Goerings', 'the Rivera family', 'Team Brooks', 'Okafor', undefined].map((n) => familyTitle(h(n)))).toEqual(['The Goerings', 'The Rivera family', 'Team Brooks', 'The Okafor Family', 'Our Family']);
  });

  it('finds a month by its id, and matches stages by age', () => {
    expect(guideMonth('2027-01-01')).toBe(january2027);
    expect(guideMonth('2027-02')).toBeNull();
    const k = (age: number) => ({ id: 'x', firstName: 'X', kind: 'child' as const, role: 'child' as const, birthYear: 2026 - age, birthMonth: 6 });
    expect([2, 3, 5, 6, 8, 9, 12, 13, 17].map((a) => stageFor(k(a), '2027-01'))).toEqual(['toddler', 'preschool', 'preschool', 'early', 'early', 'middle', 'middle', 'teen', 'teen']);
  });
});

describe('progress tracking foundation', () => {
  it('celebrates success without adding work, continues, adjusts or retires', () => {
    expect(nextStep({ answer: 'on-own' })).toEqual({ kind: 'celebrate', progress: 'independent' });
    expect(nextStep({ answer: 'reminders' })).toEqual({ kind: 'continue', progress: 'improving' });
    expect(nextStep({ answer: 'struggling', barrier: 'forgets' })).toEqual({ kind: 'adjust', progress: 'struggling', principle: 'trigger' });
    expect(nextStep({ answer: 'struggling' })).toEqual({ kind: 'adjust', progress: 'struggling', principle: null });
    expect(nextStep({ answer: 'moved-on' })).toEqual({ kind: 'retire', progress: 'retired' });
  });
  it('only a family’s own choice makes a commitment, and only commitments are checked in on', () => {
    const idea = gen('fewer-reminders').plan.ideas[0];
    const c = commit(idea, 'meeting', '2027-01-10');
    expect(c).toMatchObject({ status: 'accepted', progress: 'practicing', since: '2027-01-10', itemId: idea.itemId });
    expect(checkInDue(c, '2027-02-20')).toBe(false);
    expect(checkInDue(c, '2027-02-21')).toBe(true);
    expect(checkInDue({ ...c, lastCheckedOn: '2027-02-21' }, '2027-03-01')).toBe(false);
    expect(checkInDue({ ...c, progress: 'retired' }, '2027-06-01')).toBe(false);
    expect(checkInDue({ ...(idea as unknown as Record<string, unknown>), since: '2027-01-01', progress: 'practicing' } as never, '2027-06-01')).toBe(false);
  });
});
