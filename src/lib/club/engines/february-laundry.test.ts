import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import {
  ANY_GROWN_UP, applyFamily, freshState, fromLegacy, isLaundryState, laundryFingerprint, laundryView, machineLine, planChanged,
  restoreSuggested, setLevel, setOperator, toggleDay, type LaundryMember,
} from './february-laundry';

const family = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household.members as LaundryMember[];
const rivera = family('rivera');
const id = (n: string, m = rivera) => m.find((x) => x.firstName === n)!.id;
const kid = (i: string, firstName: string, birthYear: number): LaundryMember => ({ id: i, firstName, kind: 'child', birthYear, birthMonth: 1 });
const guides = (s = freshState(), m = rivera) => laundryView(applyFamily(s, m), m).guides;

describe('February laundry guides', () => {
  it('suggests a level from age in February 2027; mixed levels get one of each guide', () => {
    const v = laundryView(freshState(), rivera);
    expect(v.kids.map((k) => [k.name, k.age, k.level])).toEqual([['Sofia', 10, 'older'], ['Mateo', 7, 'young'], ['Elena', 5, 'young']]);
    expect(v.guides).toEqual([{ level: 'young', names: ['Mateo', 'Elena'] }, { level: 'older', names: ['Sofia'] }]);
  });

  it('one younger child, two younger, one older, two older: one guide each time', () => {
    expect(guides(freshState(), [kid('a', 'Ana', 2021)])).toEqual([{ level: 'young', names: ['Ana'] }]);
    expect(guides(freshState(), [kid('a', 'Ana', 2021), kid('b', 'Bo', 2022)])).toEqual([{ level: 'young', names: ['Ana', 'Bo'] }]);
    expect(guides(freshState(), [kid('a', 'Ana', 2015)])).toEqual([{ level: 'older', names: ['Ana'] }]);
    expect(guides(freshState(), [kid('a', 'Ana', 2015), kid('b', 'Bo', 2013)])).toEqual([{ level: 'older', names: ['Ana', 'Bo'] }]);
  });

  it('Mom can override readiness; moving everyone to one level drops the other page', () => {
    const s = freshState();
    setLevel(s, id('Sofia'), 'young', rivera);
    expect(guides(s)).toEqual([{ level: 'young', names: ['Sofia', 'Mateo', 'Elena'] }]);
    expect(planChanged(s, rivera)).toBe(true);
    setLevel(s, id('Sofia'), 'older', rivera);
    expect(s.levels).toEqual({});
    setLevel(s, id('Mateo'), 'older', rivera);
    expect(guides(s)).toEqual([{ level: 'young', names: ['Elena'] }, { level: 'older', names: ['Sofia', 'Mateo'] }]);
    restoreSuggested(s);
    expect(planChanged(s, rivera)).toBe(false);
  });

  it('days: several in week order, or "As needed" on its own; never empty', () => {
    const s = freshState();
    toggleDay(s, 'Wednesday');
    expect(laundryView(s, rivera).daysLine).toBe('Wednesday · Saturday');
    toggleDay(s, 'As needed');
    expect(laundryView(s, rivera).daysLine).toBe('As needed');
    toggleDay(s, 'Monday');
    expect(laundryView(s, rivera).daysLine).toBe('Monday');
    toggleDay(s, 'Monday');
    expect(laundryView(s, rivera).daysLine).toBe('As needed');
  });

  it('the operator prints as Mom, Dad or a name; the default wording is unchanged', () => {
    const s = freshState();
    expect(machineLine('young', laundryView(s, rivera).operatorName)).toBe('Grown-ups handle the machines until you are ready.');
    expect(machineLine('older', laundryView(s, rivera).operatorName)).toBe('Only operate machines after training. Ask an adult about anything unfamiliar.');
    setOperator(s, id('Luis'), rivera);
    expect(laundryView(s, rivera).operatorName).toBe('Dad');
    expect(machineLine('young', 'Dad')).toBe('Dad handles the machines until you are ready.');
    setOperator(s, id('Sofia'), rivera);
    expect(s.operator).toBe(id('Luis'));
    setOperator(s, ANY_GROWN_UP, rivera);
    expect(laundryView(s, rivera).operatorName).toBe('a grown-up');
  });

  it('archived children and missing people never print; another family starts fresh', () => {
    const s = freshState();
    setLevel(s, id('Mateo'), 'older', rivera);
    setOperator(s, id('Ana'), rivera);
    const changed = rivera.map((m) => (m.firstName === 'Mateo' || m.firstName === 'Ana' ? { ...m, archived: true } : m));
    applyFamily(s, changed);
    expect(s.levels).toEqual({});
    expect(s.operator).toBe(ANY_GROWN_UP);
    expect(JSON.stringify(laundryView(s, changed).guides)).not.toContain('Mateo');
  });

  it('a child without a birth year starts on the younger guide', () => {
    expect(guides(freshState(), [{ id: 'x', firstName: 'Kit', kind: 'child' }])).toEqual([{ level: 'young', names: ['Kit'] }]);
  });

  it('fingerprint follows what prints', () => {
    const s = freshState();
    const before = laundryFingerprint(s, rivera);
    toggleDay(s, 'Sunday');
    expect(laundryFingerprint(s, rivera)).not.toBe(before);
  });

  it('reads the earlier page’s tab edits once, for the same family only', () => {
    const raw = JSON.stringify({ familyId: 'sample-rivera', profileVersion: 1, edits: { children: [{ id: id('Mateo'), level: 'older' }], days: ['Sunday', 'Monday'], operator: 'Luis' } });
    const s = fromLegacy(raw, 'sample-rivera', rivera)!;
    expect(isLaundryState(s)).toBe(true);
    expect(laundryView(s, rivera).daysLine).toBe('Monday · Sunday');
    expect(laundryView(s, rivera).operatorName).toBe('Dad');
    expect(guides(s)).toEqual([{ level: 'young', names: ['Elena'] }, { level: 'older', names: ['Sofia', 'Mateo'] }]);
    expect(fromLegacy(raw, 'sample-chen', rivera)).toBeNull();
    expect(fromLegacy(JSON.stringify({ familyId: 'sample-rivera', edits: { day: 'Friday' } }), 'sample-rivera', rivera)!.days).toEqual(['Friday']);
  });
});
