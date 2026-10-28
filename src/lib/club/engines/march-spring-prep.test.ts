import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import {
  PROJECT, UNASSIGNED, applyFamily, eligible, freshState, fromLegacy, isMarState, marFingerprint, marView, ownersChanged,
  restoreOwners, restoreWording, setOwner, setText, wordingChanged, type MarMember,
} from './march-spring-prep';

const family = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household.members as MarMember[];
const rivera = family('rivera');
const id = (n: string) => rivera.find((m) => m.firstName === n)!.id;
const prepared = (m: MarMember[]) => applyFamily(freshState(), m);
const owners = (m: MarMember[], s = prepared(m)) => Object.fromEntries(marView(s, m).tasks.map((t) => [t.id, t.owner]));

describe('March spring prep', () => {
  it('uses the companion’s own five March jobs', () => {
    expect(marView(prepared(rivera), rivera).tasks.map((t) => t.title)).toEqual(PROJECT.tasks.map((t) => t.label));
  });

  it('prepares owners: children 5+ for reachable jobs, grown-ups for heights', () => {
    expect(owners(rivera)).toEqual({ 'mar-baseboards': 'Sofia', 'mar-vents': 'Dad', 'mar-winter-gear': 'Mateo', 'mar-curtains': 'Mom', 'mar-donate': 'Mom' });
  });

  it('never gives a child an adult-only job, nor any job under 5', () => {
    const s = prepared(rivera);
    setOwner(s, 'mar-vents', id('Sofia'), rivera);
    expect(s.owners['mar-vents']).not.toBe(id('Sofia'));
    const toddler: MarMember = { id: 't', firstName: 'Bo', kind: 'child', birthYear: 2023, birthMonth: 1 };
    const withToddler = [...rivera, toddler];
    setOwner(s, 'mar-baseboards', 't', withToddler);
    expect(s.owners['mar-baseboards']).not.toBe('t');
    expect(eligible('mar-donate', toddler)).toBe(false);
    expect(eligible('mar-donate', rivera.find((m) => m.firstName === 'Elena')!)).toBe(true); // 5 in March 2027
  });

  it('lets a job be optional and unassigned', () => {
    const s = prepared(rivera);
    setOwner(s, 'mar-donate', '', rivera);
    expect(owners(rivera, s)['mar-donate']).toBe(UNASSIGNED);
    applyFamily(s, rivera);
    expect(s.owners['mar-donate']).toBe('');
  });

  it('re-prepares a job whose owner is archived', () => {
    const s = prepared(rivera);
    setOwner(s, 'mar-baseboards', id('Mateo'), rivera);
    const later = rivera.map((m) => (m.firstName === 'Mateo' ? { ...m, archived: true } : m));
    applyFamily(s, later);
    expect(Object.values(owners(later, s))).not.toContain('Mateo');
  });

  it('restores owners and wording separately', () => {
    const s = prepared(rivera);
    setOwner(s, 'mar-donate', id('Sofia'), rivera);
    setText(s, 'mar-donate', 'done', 'Bag in the car.');
    restoreOwners(s, rivera);
    expect(s.owners['mar-donate']).toBe(id('Ana'));
    expect(wordingChanged(s)).toBe(true);
    setOwner(s, 'mar-donate', id('Sofia'), rivera);
    restoreWording(s);
    expect(wordingChanged(s)).toBe(false);
    expect(ownersChanged(s)).toBe(true);
  });

  it('prepared or blank wording is no change; limits hold', () => {
    const s = prepared(rivera);
    setText(s, 'mar-vents', 'title', ' Dust vents and ceiling fans ');
    setText(s, 'mar-vents', 'done', '');
    expect(s.text).toEqual({});
    setText(s, 'mar-vents', 'title', 'x'.repeat(100));
    expect(s.text['mar-vents'].title).toHaveLength(60);
  });

  it('fills every job for every sample family', () => {
    for (const sample of sampleHouseholds.filter((x) => x.household.members.length)) {
      const m = sample.household.members as MarMember[];
      expect(Object.values(owners(m))).not.toContain(UNASSIGNED);
    }
  });

  it('approval follows what prints', () => {
    const s = prepared(rivera);
    const a = marFingerprint(s, rivera);
    s.customized.push('mar-vents');
    expect(marFingerprint(s, rivera)).toBe(a);
    setText(s, 'mar-vents', 'supplies', 'Long duster');
    expect(marFingerprint(s, rivera)).not.toBe(a);
  });

  it('reads the earlier March page’s tab plan', () => {
    const s = fromLegacy(JSON.stringify({ sampleKey: 'rivera:sample-rivera', chosen: { 'mar-donate': id('Sofia') }, custom: ['mar-donate'], textEdits: { 'mar-donate': { done: 'Bag in the car.' } } }))!;
    expect(isMarState(s)).toBe(true);
    applyFamily(s, rivera);
    expect(owners(rivera, s)['mar-donate']).toBe('Sofia');
    expect(marView(s, rivera).tasks.find((t) => t.id === 'mar-donate')!.done).toBe('Bag in the car.');
    expect(fromLegacy('{bad')).toBeNull();
  });
});
