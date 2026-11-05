/**
 * The Monthly Family Focus (January): the eight situations it must handle, family colors, and Mom's review
 * (Keep it / Change it / Skip it). Made-up families only.
 */
import { describe, expect, it } from 'vitest';
import { january2027 as content } from '../src/data/club/meeting-guides/2027-01';
import { MARKER_COLORS, memberColors } from '../src/data/club/family-colors';
import { generateMeetingGuide, guideFingerprint, type MeetingGuide } from '../src/lib/club/meeting-guide/generate';
import { emptyGuideState, isGuideState, type GuideProfile, type GuideState } from '../src/lib/club/meeting-guide/state';
import type { FamilyMember, Household } from '../src/lib/club/profile';

const adult = (id: string, firstName: string, holder = true): FamilyMember => ({ id, firstName, kind: 'adult', role: 'parent', isAccountHolder: holder });
const child = (id: string, firstName: string, age: number): FamilyMember => ({ id, firstName, kind: 'child', role: 'child', birthYear: 2026 - age, birthMonth: 6 });
const home = (members: FamilyMember[], colors?: Record<string, string>): Household => ({ id: 'h', displayName: 'Test', preferences: colors ? { colors } : {}, profileVersion: 1, members });
const prof = (p: Partial<GuideProfile>): GuideProfile => ({ challenges: [], activities: [], responsibilities: [], ...p });
const gen = (h: Household, p: GuideProfile | null, state: GuideState = emptyGuideState()) => generateMeetingGuide({ household: h, profile: p, content, state });
const kids = (g: MeetingGuide) => g.experiments.map((e) => e.memberIds);

/** What every Family Focus keeps, whatever the family. */
function rules(g: MeetingGuide, label: string) {
  expect(g.focus, label).toHaveLength(1);
  expect(g.experiments.length, `${label}: never more than two habits`).toBeLessThanOrEqual(2);
  expect(g.experiments.length, label).toBeGreaterThanOrEqual(1);
  expect(g.focusPage.words.map((w) => w.word), label).toEqual(['Notice', 'Choose', 'Practice', 'Grow']);
  for (const e of g.experiments) {
    expect(e.ownership.length, label).toBeGreaterThan(10);
    if (e.basis === 'need') expect(e.why, `${label}: a need is backed by her answers`).not.toBe('');
    // An anchor her answers don't confirm is offered as options (the page prefixes it).
    expect(typeof e.anchor.verified, label).toBe('boolean');
  }
  // Every member has a color, all distinct.
  const hexes = Object.values(g.colors).map((c) => c.hex);
  expect(new Set(hexes).size, label).toBe(hexes.length);
}

describe('Monthly Family Focus: eight situations', () => {
  it('1. two children with different ages and specific challenges: an individual habit each', () => {
    const h = home([adult('a', 'Jo'), child('k1', 'Nia', 5), child('k2', 'Theo', 11)]);
    const g = gen(h, prof({ priority: 'mornings', challenges: ['routines'], responsibilities: [
      { status: 'desired', category: 'routines', item: 'morning-routine', ownerIds: ['k1'] },
      { status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: ['k2'] }] }));
    rules(g, '1');
    expect(g.experiments.every((e) => !e.adaptations && e.memberIds.length === 1)).toBe(true);
    expect(kids(g).flat().sort()).toEqual(['k1', 'k2']);
    expect(g.experiments.find((e) => e.memberIds[0] === 'k1')!.action).not.toBe(g.experiments.find((e) => e.memberIds[0] === 'k2')!.action);
  });

  it('2. three children sharing one challenge: one shared routine, each child’s version kept', () => {
    const h = home([adult('a', 'Jo'), child('k1', 'Ada', 4), child('k2', 'Ben', 8), child('k3', 'Cy', 12)]);
    const g = gen(h, prof({ priority: 'tidying', challenges: ['sharing-fairly'] }));
    rules(g, '2');
    const shared = g.experiments.find((e) => e.adaptations);
    expect(shared).toBeTruthy();
    expect(shared!.memberIds.sort()).toEqual(['k1', 'k2', 'k3']);
    expect(new Set(shared!.adaptations!.map((a) => a.action)).size, 'capability differences kept').toBeGreaterThan(1);
  });

  it('3. five or more children: grouped sensibly, never one habit per child', () => {
    const h = home([adult('a', 'Jo'), ...['Al', 'Bo', 'Cal', 'Dee', 'Eli', 'Fay'].map((n, i) => child(`k${i}`, n, 3 + i * 2))]);
    const g = gen(h, prof({ priority: 'evenings', challenges: ['routines'] }));
    rules(g, '3');
    expect(g.experiments.some((e) => (e.adaptations?.length ?? 0) >= 4)).toBe(true);
    expect(g.experiments.length).toBeLessThanOrEqual(2);
  });

  it('4. siblings sharing an activity despite different ages: grouped by the activity, not by age', () => {
    const h = home([adult('a', 'Jo'), child('k1', 'Ivy', 6), child('k2', 'Max', 13)]);
    const g = gen(h, prof({ priority: 'activities', activities: [{ category: 'sports', name: 'swim team', memberIds: ['k1', 'k2'] }] }));
    rules(g, '4');
    const swim = g.experiments.find((e) => /swim team/.test(e.title));
    expect(swim, JSON.stringify(g.experiments.map((e) => e.title))).toBeTruthy();
    expect(swim!.memberIds.sort()).toEqual(['k1', 'k2']);
    expect(swim!.adaptations!.map((a) => a.name)).toEqual(['Ivy', 'Max']);
  });

  it('5. one child already independent: recognized, not given more work', () => {
    const h = home([adult('a', 'Jo'), child('k1', 'Rae', 10), child('k2', 'Sam', 7)]);
    const g = gen(h, prof({ priority: 'school-stuff', responsibilities: [
      { status: 'existing', category: 'school-prep', item: 'pack-school-bag', ownerIds: ['k1'] },
      { status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: ['k2'] }] }));
    rules(g, '5');
    expect(g.experiments.filter((e) => e.itemId === 'pack-school-bag').flatMap((e) => e.memberIds)).not.toContain('k1');
    expect(g.recognized.some((r) => /Rae/.test(r.text))).toBe(true);
  });

  it('6. limited intake: the Family Meeting habit, and nothing invented', () => {
    const g = gen(home([adult('a', 'Jo'), child('k1', 'Lu', 8)]), null);
    rules(g, '6');
    expect(g.focus[0].because).toBe('');
    expect(g.experiments.every((e) => e.basis === 'consider' && !e.why)).toBe(true);
    expect(g.experiments.some((e) => /meeting/i.test(`${e.title} ${e.action}`))).toBe(true);
  });

  it('7. competing priorities: one focus, the fewest habits, the rest left for later', () => {
    const h = home([adult('a', 'Jo'), child('k1', 'Ola', 7), child('k2', 'Pim', 9)]);
    const g = gen(h, prof({ priority: 'mornings', challenges: ['routines', 'preparing', 'remembering', 'sharing-fairly', 'knowing-plans'], responsibilities: [
      { status: 'desired', category: 'routines', item: 'morning-routine', ownerIds: ['k1'] },
      { status: 'desired', category: 'chores', item: 'tidy-room', ownerIds: ['k2'] },
      { status: 'desired', category: 'chores', item: 'pet-care', ownerIds: ['k1', 'k2'] }] }));
    rules(g, '7');
    expect(g.focus[0].id).toBe('mornings');
    expect(g.experiments.length).toBeLessThanOrEqual(2);
  });

  it('8. a teen with autonomy: the teen owns the plan, with no hand-holding', () => {
    const h = home([adult('a', 'Jo'), child('t', 'Zoe', 15)]);
    const g = gen(h, prof({ priority: 'school-stuff', responsibilities: [{ status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: ['t'] }] }));
    rules(g, '8');
    const e = g.experiments.find((x) => x.memberIds.includes('t'))!;
    expect(e.support ?? '').not.toMatch(/together|help with|at first/i);
    expect(`${e.ownership}`).toMatch(/Zoe/);
  });
});

describe('Family colors', () => {
  const h = home([adult('a', 'Jo'), child('k1', 'Ada', 4), child('k2', 'Ben', 8), child('k3', 'Cy', 12)]);
  it('auto-assigns distinct, named marker colors, children first, the same every month', () => {
    const c = memberColors(h);
    expect(Object.keys(c).sort()).toEqual(['a', 'k1', 'k2', 'k3']);
    expect(c.k1.id).toBe(MARKER_COLORS[0].id);
    expect(new Set(Object.values(c).map((x) => x.id)).size).toBe(4);
    expect(memberColors(structuredClone(h))).toEqual(c);
  });
  it('keeps her saved choice by member id, and never clashes', () => {
    const c = memberColors(home(h.members, { k2: 'teal' }));
    expect(c.k2.id).toBe('teal');
    expect(new Set(Object.values(c).map((x) => x.id)).size).toBe(4);
    // Reordering members doesn't move her choice.
    expect(memberColors(home([...h.members].reverse(), { k2: 'teal' })).k2.id).toBe('teal');
  });
  it('a shared habit carries every participant, each with name and color', () => {
    const g = gen(h, prof({ priority: 'tidying' }));
    const shared = g.experiments.find((e) => e.adaptations)!;
    for (const id of shared.memberIds) expect(g.colors[id]).toMatchObject({ name: expect.any(String), hex: expect.stringMatching(/^#/) });
  });
});

describe('Mom’s review: Keep it / Change it / Skip it', () => {
  const h = home([adult('a', 'Jo'), child('k1', 'Nia', 5), child('k2', 'Theo', 11)]);
  const p = prof({ priority: 'mornings', responsibilities: [
    { status: 'desired', category: 'routines', item: 'morning-routine', ownerIds: ['k1'] },
    { status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: ['k2'] }] });
  const base = gen(h, p);
  const [first, second] = base.experiments;

  it('skip takes it off the printable but keeps it in her review', () => {
    const g = gen(h, p, { ...emptyGuideState(), hidden: [first.key] });
    expect(g.experiments.map((e) => e.key)).not.toContain(first.key);
    expect(g.suggested.map((e) => e.key)).toContain(first.key);
  });
  it('change prints her words; her "when" counts as confirmed', () => {
    const state: GuideState = { ...emptyGuideState(), edits: { [second.key]: { action: 'Pack it right after dinner.', anchor: 'after dinner' } } };
    expect(isGuideState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const e = gen(h, p, state).experiments.find((x) => x.key === second.key)!;
    expect(e).toMatchObject({ action: 'Pack it right after dinner.', anchor: { text: 'after dinner', verified: true }, edited: true });
  });
  it('keep marks it, but a kept suggestion is still not a commitment', () => {
    const g = gen(h, p, { ...emptyGuideState(), kept: [first.key] });
    expect(g.experiments.find((e) => e.key === first.key)!.kept).toBe(true);
    // The saved plan holds offered ideas only: all 'suggested', nothing a check-in would pick up.
    expect(Object.keys(g.plan).sort()).toEqual(['focus', 'ideas', 'month', 'obstacle', 'v']);
    for (const idea of g.plan.ideas) expect(idea.status).toBe('suggested');
  });
  it('her choices change what she approves (the fingerprint)', () => {
    const skip = gen(h, p, { ...emptyGuideState(), hidden: [first.key] });
    expect(guideFingerprint(skip)).not.toBe(guideFingerprint(base));
  });
  it('rejects oversized or malformed edits', () => {
    expect(isGuideState({ ...emptyGuideState(), edits: { x: { action: 'a'.repeat(500) } } })).toBe(false);
    expect(isGuideState({ ...emptyGuideState(), kept: [1] })).toBe(false);
  });
});
