import { describe, expect, it } from 'vitest';
import {
  HABIT_DEFAULTS, applyFamilyNames, applyFinder, familyCardNames, freshHabitState, habitFingerprint, isHabitState, ownerLine,
  setCount, setHabit, suggestionFor,
} from './january-habit-cards';
import type { PlanMember } from './october-sunday-reset';

const rivera: PlanMember[] = [
  { id: 'ana', firstName: 'Ana', kind: 'adult', role: 'parent', isAccountHolder: true },
  { id: 'sofia', firstName: 'Sofia', kind: 'child', birthYear: 2016 },
  { id: 'mateo', firstName: 'Mateo', kind: 'child', birthYear: 2019 },
  { id: 'gone', firstName: 'Gone', kind: 'child', archived: true },
];

describe('January habit cards', () => {
  it('starts from the four prepared habits, two printed', () => {
    const s = freshHabitState();
    expect(s.count).toBe(2);
    expect(s.habits.map((h) => h.name)).toEqual(HABIT_DEFAULTS.map((h) => h.name));
    expect(isHabitState(s)).toBe(true);
    expect(isHabitState({ ...s, count: 3 })).toBe(false);
    expect(isHabitState({ ...s, habits: s.habits.slice(0, 3) })).toBe(false);
  });

  it('names cards for the family’s children, skipping archived members', () => {
    expect(familyCardNames(rivera)).toEqual(['Sofia’s morning', 'Mateo’s backpack', 'Sofia’s bedroom', 'Our kitchen']);
    expect(familyCardNames([])[0]).toBe('My morning');
  });

  it('never overwrites a name she typed when the family changes', () => {
    const s = applyFamilyNames(freshHabitState(), rivera);
    setHabit(s, 1, { name: 'Shoes by the door' });
    applyFamilyNames(s, [{ id: 'x', firstName: 'Lily', kind: 'child' }]);
    expect(s.habits[0].name).toBe('Lily’s morning');
    expect(s.habits[1].name).toBe('Shoes by the door');
  });

  it('applies the finder: one habit prints one card, two print two', () => {
    const one = applyFinder(freshHabitState(), [{ problem: 'Getting out the door', action: 1, who: 'The kids' }]);
    expect(one.count).toBe(1);
    expect(one.habits[0]).toMatchObject({ name: 'Ready to go', action: 'We put everything we need for tomorrow by the door.', who: 'The kids' });
    const two = applyFinder(freshHabitState(), [{ problem: 'Starting homework', action: 0, who: 'Everyone' }, { problem: 'Getting ready for bed', action: 2, who: 'Mom' }]);
    expect(two.count).toBe(2);
    expect(suggestionFor({ problem: 'Getting ready for bed', action: 2, who: 'Mom' }).action).toBe('We put pajamas on after brushing our teeth.');
  });

  it('fingerprints only what prints', () => {
    const s = freshHabitState();
    const two = habitFingerprint(s);
    setHabit(s, 3, { name: 'Not printed' });
    expect(habitFingerprint(s)).toBe(two);
    setCount(s, 1);
    expect(habitFingerprint(s)).not.toBe(two);
    const one = habitFingerprint(s);
    setHabit(s, 1, { action: 'Hidden card change' });
    expect(habitFingerprint(s)).toBe(one);
  });

  it('keeps fields to the printed lengths and prints the owner line', () => {
    const s = setHabit(freshHabitState(), 0, { name: 'x'.repeat(80), who: 'Sofia' });
    expect(s.habits[0].name).toHaveLength(42);
    expect(ownerLine(s.habits[0].who)).toBe('FOR SOFIA');
    expect(ownerLine('')).toBe('FOR THE FAMILY');
  });
});
