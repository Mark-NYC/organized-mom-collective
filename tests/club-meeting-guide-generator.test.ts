import { describe, expect, it } from 'vitest';
import { january2027 } from '../src/data/club/meeting-guides/2027-01';
import { GUIDE_MONTHS, guideMonth } from '../src/data/club/meeting-guides';
import { MEETING_GUIDE } from '../src/data/club/meeting-guide';
import { CHALLENGES, PRIORITIES, GROWTH_ITEMS } from '../src/data/club/family-profile';
import { sampleHouseholds } from '../src/data/club/samples';
import { checkInDue, commit, nextStep } from '../src/lib/club/family-plan';
import { familyTitle, generateMeetingGuide, guideFingerprint, type MeetingGuide } from '../src/lib/club/meeting-guide/generate';
import { emptyGuideState, guideProfile, isGuideState, type GuideProfile } from '../src/lib/club/meeting-guide/state';
import { stageFor } from '../src/lib/club/meeting-guide/stages';
import type { Household } from '../src/lib/club/profile';
import { FAMILIES } from './fixtures/meeting-guide-families';

const content = january2027;
const fam = (key: string) => FAMILIES.find((x) => x.key === key)!;
const gen = (key: string, state = emptyGuideState()) => generateMeetingGuide({ household: fam(key).household, profile: fam(key).profile, content, state });
const rivera = () => { const r = sampleHouseholds.find((s) => s.id === 'rivera')!; return generateMeetingGuide({ household: r.household, profile: guideProfile(r.profile), content }); };
const text = (g: MeetingGuide) => JSON.stringify({ ...g, plan: undefined, rationale: undefined });
const exp = (g: MeetingGuide, who: string) => g.experiments.find((e) => e.who.startsWith(who));
const lines = (g: MeetingGuide) => [
  ...g.focus.flatMap((f) => [f.title, f.opportunity]), ...g.talk.map((t) => t.text), g.partsDiscover ?? '',
  ...g.experiments.flatMap((e) => [e.action, e.ownership, e.support ?? '']), ...g.recognized.map((t) => t.text), ...g.grownUps.map((t) => t.text), ...g.practice.map((t) => t.text),
].filter(Boolean);

/** The rules every companion keeps, whatever the family. */
function invariants(g: MeetingGuide, label: string) {
  expect(g.sections.map((s) => s.title), label).toEqual(MEETING_GUIDE.parts.map((p) => p.title));
  expect(g.focus.length, label).toBe(1);
  expect(g.talk.length, label).toBeLessThanOrEqual(3);
  expect(g.experiments.length, label).toBeLessThanOrEqual(content.theme.maxExperiments);
  const individual = g.experiments.filter((e) => !e.adaptations && e.memberIds.length);
  expect(new Set(individual.map((e) => e.memberIds[0])).size, `${label}: one experiment per child at most`).toBe(individual.length);
  for (const e of g.experiments) {
    // Child-level lines never use a pronoun (group lines may say "their own", meaning each child's).
    if (!e.adaptations) for (const t of [e.action, e.ownership, e.support ?? '', e.why]) expect(t, `${label}: ${t}`).not.toMatch(/\b(he|she|him|her|his|they|them|their)\b/i);
    expect(e.ownership.length, label).toBeGreaterThan(10);
    if (e.basis === 'need') expect(e.why, `${label}: a need has a reason from her intake`).not.toBe('');
  }
  const l = lines(g);
  expect(l.filter((x, i) => l.indexOf(x) !== i), `${label}: repeated lines`).toEqual([]);
  expect(text(g), label).not.toMatch(/\b(Mom|Dad|parents?)\b|\{\w+\}|Led by|Hand this guide|Our habit experiment/);
  for (const f of g.rationale.focus) if (f.id !== 'meetings') expect(f.evidence.length, label).toBeGreaterThan(0);
}

describe('January companion: habit experiments', () => {
  it('keeps the rules for all ten families and the Rivera sample', () => {
    for (const f of FAMILIES) invariants(gen(f.key), f.key);
    invariants(rivera(), 'rivera');
  });

  it('Rivera: two distinct experiments for the evening priority, with anchors, ownership and support', () => {
    const g = rivera();
    expect(g.focus[0].title).toBe('Easier evenings');
    const sofia = exp(g, 'Sofia')!;
    expect(sofia).toMatchObject({ who: 'Sofia, 10', title: 'School things ready', action: 'Check tomorrow’s supplies and pack the school bag.', ownership: 'Let Sofia choose where the bag lives, so it’s ready without help.', source: 'desired' });
    expect(sofia.why).toBe('Easier evenings is your top priority. You’d like Sofia to take on packing the school bag.');
    // She listed Sofia in school, so school nights are confirmed; the moment within the evening is hers to pick.
    expect(sofia.anchor).toEqual({ text: 'on school nights, after homework is put away or after dinner', verified: true });
    const mateo = exp(g, 'Mateo')!;
    expect(mateo).toMatchObject({ title: 'Pajamas ready', action: 'Put pajamas on the bed before bath time.', anchor: { verified: false } });
    expect(mateo.support).toBe('A simple picture reminder near the dresser, so Mateo can remember without being told.');
    expect(g.experiments).toHaveLength(2);
    expect(g.rationale.children).toEqual([{ name: 'Elena', outcome: 'a fitting idea, left out to keep it to the strongest one or two' }]);
  });

  it('a different challenge gets a different intervention, not the same template', () => {
    const r = rivera().experiments.map((e) => e.itemId);
    const busy = gen('busy-schedules');
    expect(busy.focus[0].title).toBe('Everyone knowing the plan');
    expect(busy.experiments.map((e) => e.itemId)).toEqual(['own-belongings', 'calendar-check']);
    expect(busy.experiments.map((e) => e.itemId).some((id) => r.includes(id))).toBe(false);
    expect(busy.talk[0].text).toBe('What’s happening for each of us this week, like robotics?');
  });

  it('limited intake: no manufactured problems; the meeting habit, and one idea clearly framed as something to consider', () => {
    const household: Household = { id: 'l', displayName: 'The Lanes', preferences: {}, profileVersion: 1, members: [
      { id: 'l1', firstName: 'Pat', kind: 'adult', role: 'parent', isAccountHolder: true },
      { id: 'l2', firstName: 'Ike', kind: 'child', role: 'child', birthYear: 2018, birthMonth: 9 },
      { id: 'l3', firstName: 'Uma', kind: 'child', role: 'child', birthYear: 2022, birthMonth: 6 },
    ] };
    const g = generateMeetingGuide({ household, profile: { challenges: [], activities: [{ category: 'school', memberIds: [] }], responsibilities: [] }, content });
    expect(g.focus[0].title).toBe('Starting our Family Meeting habit');
    expect(g.starterNote).toBe(content.starterNote);
    expect(g.experiments.map((e) => [e.who, e.basis, e.why])).toEqual([['Everyone', 'consider', ''], ['Ike, 8', 'consider', '']]);
    expect(g.partsDiscover).toBe('Ask Uma what to take on, once the meeting is a habit. One small part is plenty.');
    expect(g.practice.some((p) => p.key === 'practice:obstacle')).toBe(false);
    // No ages at all: only the meeting.
    expect(gen('vague').experiments.map((e) => e.who)).toEqual(['Everyone']);
  });

  it('asks which job instead of picking one when the focus doesn’t say', () => {
    const g = gen('one-challenge');
    expect(g.experiments).toEqual([]);
    expect(g.partsDiscover).toBe('Ask Min, Joon and Seo which job they hear the most reminders about, then give that job a clear “when” together.');
  });

  it('recognizes an independent child instead of adding work', () => {
    const g = gen('independent');
    expect(g.experiments.map((e) => e.who)).toEqual(['Owen, 6']);
    expect(g.recognized.map((r) => r.text)).toEqual(['Grace already takes care of getting ready for school. Ask Grace to show everyone how, instead of adding a new job.']);
  });

  it('hands the choice to the children 6+, and keeps experiments as suggestions', () => {
    expect(rivera().talk.at(-1)!.text).toBe('Ask Sofia and Mateo: would these help, or what would you try instead?');
    expect(content.experimentsNote).toMatch(/not assignments/);
    expect(gen('preschool-support').talk.map((t) => t.key)).toEqual(['talk:evenings', 'talk:obstacle']);
  });

  it('Practice doesn’t repeat an experiment: the obstacle’s adjustment only when no experiment already uses it', () => {
    const r = rivera();
    expect(r.practice.map((p) => p.text)).toEqual(['If it gets stuck: start with one step of the routine instead of the whole thing.', content.practice.sustain.default]);
    for (const f of FAMILIES) {
      const g = gen(f.key);
      for (const e of g.experiments) expect(g.practice.map((p) => p.text).join(' ')).not.toContain(e.support ?? '§');
    }
  });

  it('holds its rules for every priority and challenge, not just these families', () => {
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
  it('hides what she takes off, and keeps her stage corrections', () => {
    const s = emptyGuideState();
    s.hidden = ['exp:g2:morning-routine', 'talk:mornings'];
    s.people.g3 = { stage: 'teen' };
    const g = gen('mornings', s);
    expect(g.experiments.map((e) => e.key)).not.toContain('exp:g2:morning-routine');
    expect(g.talk.map((t) => t.key)).not.toContain('talk:mornings');
    expect(g.people.find((p) => p.name === 'Sofia')!.stage).toBe('teen');
    expect(isGuideState(s)).toBe(true);
  });

  it('saves experiments as suggestions, never commitments', () => {
    const g = rivera();
    expect(g.plan.ideas.map((i) => i.itemId)).toEqual(['pack-school-bag', 'bedtime-routine']);
    expect(g.plan.ideas.every((i) => i.status === 'suggested' && !('progress' in i))).toBe(true);
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

  it('keeps her own family name as she wrote it', () => {
    const h = (displayName?: string): Household => ({ id: 'n', displayName, preferences: {}, profileVersion: 1, members: [] });
    expect(['The Goerings', 'the Rivera family', 'Team Brooks', 'Okafor', undefined].map((n) => familyTitle(h(n)))).toEqual(['The Goerings', 'The Rivera family', 'Team Brooks', 'The Okafor Family', 'Our Family']);
  });

  it('keeps only the profile answers it uses, and finds months and stages', () => {
    const p = guideProfile({ setupDone: [], setupCompleted: true, challenges: ['preparing'], priority: 'mornings', activities: [{ category: 'sports', name: ' soccer ', memberIds: ['c2'], days: [2], startsAt: '17:00' }],
      responsibilities: [{ status: 'desired', category: 'belongings', item: 'own-belongings', ownerIds: ['c2'], helperIds: [] }] });
    expect(p).toMatchObject({ priority: 'mornings', challenges: ['preparing'], responsibilities: [{ status: 'desired', item: 'own-belongings', ownerIds: ['c2'] }] });
    expect(guideMonth('2027-01-01')).toBe(january2027);
    expect(guideMonth('2027-02')).toBeNull();
    const k = (age: number) => ({ id: 'x', firstName: 'X', kind: 'child' as const, role: 'child' as const, birthYear: 2026 - age, birthMonth: 6 });
    expect([2, 3, 6, 9, 13].map((a) => stageFor(k(a), '2027-01'))).toEqual(['toddler', 'preschool', 'early', 'middle', 'teen']);
  });
});

describe('progress tracking foundation', () => {
  it('celebrates success without adding work, continues, adjusts or retires', () => {
    expect(nextStep({ answer: 'on-own' })).toEqual({ kind: 'celebrate', progress: 'independent' });
    expect(nextStep({ answer: 'struggling', barrier: 'forgets' })).toEqual({ kind: 'adjust', progress: 'struggling', principle: 'trigger' });
    expect(nextStep({ answer: 'moved-on' })).toEqual({ kind: 'retire', progress: 'retired' });
  });
  it('only a family’s own choice makes a commitment, and only commitments are checked in on', () => {
    const idea = rivera().plan.ideas[0];
    const c = commit(idea, 'meeting', '2027-01-10');
    expect(c).toMatchObject({ status: 'accepted', progress: 'practicing' });
    expect(checkInDue(c, '2027-02-21')).toBe(true);
    expect(checkInDue({ ...(idea as unknown as Record<string, unknown>), since: '2027-01-01', progress: 'practicing' } as never, '2027-06-01')).toBe(false);
  });
});
