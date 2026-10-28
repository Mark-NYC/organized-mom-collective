import { describe, expect, it } from 'vitest';
import { sampleHouseholds as samples } from '../../../data/club/samples';
import {
  aprilFingerprint, aprilView, applyFamily, assign, chooseMeal, DEFAULT_RULE, eligible, freshState, fromLegacy,
  isAprilState, mealsFor, restoreTeam, restoreWording, setText, type AprilMember,
} from './april-dinner-plan';

const family = (id: string) => samples.find((s) => s.id === id)!.household.members as AprilMember[];
const rivera = family('rivera');
const prepared = (members: AprilMember[]) => applyFamily(freshState(), members);

describe('April dinner plan', () => {
  it('prepares the team from the family: grown-ups lead and cook, children by age', () => {
    const v = aprilView(prepared(rivera), rivera);
    expect(Object.fromEntries(Object.entries(v.roles).map(([r, p]) => [r, p.name]))).toEqual({ captain: 'Dad', checker: 'Sofia', table: 'Mateo', cook: 'Mom' });
  });

  it('never gives a child the stove or the captain role, nor the checker job under 7', () => {
    const elena = rivera.find((m) => m.firstName === 'Elena')!;
    const sofia = rivera.find((m) => m.firstName === 'Sofia')!;
    expect(eligible('cook', sofia)).toBe(false);
    expect(eligible('captain', sofia)).toBe(false);
    expect(eligible('checker', elena)).toBe(false);
    expect(eligible('table', elena)).toBe(true);
    const s = prepared(rivera);
    assign(s, 'cook', sofia.id, rivera);
    assign(s, 'checker', elena.id, rivera);
    expect(s.assignments.cook).not.toBe(sofia.id);
    expect(s.assignments.checker).not.toBe(elena.id);
  });

  it('leaves archived members off the sheet and moves their job to someone current', () => {
    const s = prepared(rivera);
    const sofia = rivera.find((m) => m.firstName === 'Sofia')!;
    assign(s, 'checker', sofia.id, rivera);
    const later = rivera.map((m) => (m.id === sofia.id ? { ...m, archived: true } : m));
    applyFamily(s, later);
    expect(s.assignments.checker).not.toBe(sofia.id);
    expect(aprilView(s, later).roles.checker.name).not.toBe('Sofia');
  });

  it('fills every role for a one-parent family and for every sample', () => {
    for (const sample of samples.filter((x) => x.household.members.length)) {
      const members = sample.household.members as AprilMember[];
      const v = aprilView(prepared(members), members);
      for (const p of Object.values(v.roles)) expect(p.name).not.toBe('Our family');
    }
  });

  it('a different dinner replaces only the recipe wording', () => {
    const s = prepared(rivera);
    setText(s, 'meal', 'Abuela’s tacos');
    setText(s, 'ingredient:0', 'Pinto beans');
    setText(s, 'rule', 'Captain says what’s next.');
    setText(s, 'step:1', 'Cook it');
    const team = { ...s.assignments };
    chooseMeal(s, 'pasta-a');
    expect(s.text).toEqual({ rule: 'Captain says what’s next.', 'step:1': 'Cook it' });
    expect(s.assignments).toEqual(team);
  });

  it('restores the team without touching wording, and wording without touching the team', () => {
    const s = prepared(rivera);
    const luis = rivera.find((m) => m.firstName === 'Luis')!;
    const ana = rivera.find((m) => m.firstName === 'Ana')!;
    assign(s, 'captain', ana.id, rivera);
    assign(s, 'cook', luis.id, rivera);
    setText(s, 'rule', 'Ours');
    restoreTeam(s, rivera);
    expect(s.assignments.captain).toBe(luis.id);
    expect(s.text.rule).toBe('Ours');
    assign(s, 'captain', ana.id, rivera);
    restoreWording(s);
    expect(s.text).toEqual({});
    expect(s.assignments.captain).toBe(ana.id);
  });

  it('wording back to the default, or blank, is no change at all', () => {
    const s = prepared(rivera);
    setText(s, 'rule', `  ${DEFAULT_RULE} `);
    setText(s, 'intro', '   ');
    expect(s.text).toEqual({});
    setText(s, 'meal', 'x'.repeat(200));
    expect(s.text.meal).toHaveLength(90);
  });

  it('approval follows only what prints', () => {
    const s = prepared(rivera);
    const before = aprilFingerprint(s, rivera);
    s.customized.push('captain');
    expect(aprilFingerprint(s, rivera)).toBe(before);
    chooseMeal(s, 'pasta-a');
    expect(aprilFingerprint(s, rivera)).not.toBe(before);
  });

  it('offers every effort and dinner family a recipe', () => {
    for (const effort of ['full', 'quick', 'minimal'] as const) {
      for (const c of ['tacos', 'pasta', 'soup', 'onepot']) expect(mealsFor(effort, c).length).toBeGreaterThan(0);
    }
  });

  it('reads the earlier April page’s tab plan for the same family only', () => {
    const raw = JSON.stringify({ profile: 'rivera:sample-rivera', meal: 'soup-a', assignments: { captain: 'sample-rivera-ana', checker: '', table: '', cook: '' }, customized: ['captain'], textEdits: { rule: 'Ours' } });
    const s = fromLegacy(raw, 'rivera', 'sample-rivera')!;
    expect(isAprilState(s)).toBe(true);
    expect(s).toMatchObject({ meal: 'soup-a', customized: ['captain'], text: { rule: 'Ours' } });
    expect(fromLegacy(raw, 'chen', 'sample-chen')).toBeNull();
    expect(fromLegacy('{bad', 'rivera', 'sample-rivera')).toBeNull();
    expect(isAprilState({ meal: 'x' })).toBe(false);
  });
});
