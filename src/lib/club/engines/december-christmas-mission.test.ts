import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import {
  ANY_GROWN_UP, applyFamily, decFingerprint, decView, freshState, helperLabel, isDecState, missionChanged, restoreMission, setHelper,
  toggleKid, type DecMember,
} from './december-christmas-mission';

const family = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household.members as DecMember[];
const rivera = family('rivera');
const id = (n: string, m = rivera) => m.find((x) => x.firstName === n)!.id;

describe('December Christmas mission', () => {
  it('is prepared for every child, with Dad helping when there are two parents', () => {
    const v = decView(freshState(rivera), rivera);
    expect(v.forLine).toBe('Sofia, Mateo & Elena');
    expect(v.helper).toBe('Dad');
    expect(v.layout.members).toEqual(['Ana', 'Dad', 'Sofia', 'Mateo', 'Elena']);
  });

  it('a single parent is Mom; other grown-ups go by name', () => {
    const brooks = family('brooks');
    expect(decView(freshState(brooks), brooks).helper).toBe('Mom');
    const chen = family('chen');
    expect(helperLabel(id('Lin', chen), chen)).toBe('Lin');
    expect(helperLabel(id('David', chen), chen)).toBe('Dad');
  });

  it('children can come off the mission, but one always stays, in family order', () => {
    const s = freshState(rivera);
    toggleKid(s, id('Mateo'), rivera);
    toggleKid(s, id('Sofia'), rivera);
    toggleKid(s, id('Elena'), rivera);
    expect(decView(s, rivera).forLine).toBe('Elena');
    toggleKid(s, id('Sofia'), rivera);
    expect(decView(s, rivera).forLine).toBe('Sofia & Elena');
    expect(missionChanged(s, rivera)).toBe(true);
    restoreMission(s, rivera);
    expect(missionChanged(s, rivera)).toBe(false);
  });

  it('picks any grown-up or a named one; ignores strangers', () => {
    const s = freshState(rivera);
    setHelper(s, ANY_GROWN_UP, rivera);
    expect(decView(s, rivera).helper).toBe('a grown-up');
    setHelper(s, id('Ana'), rivera);
    expect(decView(s, rivera).helper).toBe('Mom');
    setHelper(s, 'someone-else', rivera);
    expect(decView(s, rivera).helper).toBe('Mom');
    setHelper(s, id('Sofia'), rivera);
    expect(decView(s, rivera).helper).toBe('Mom');
  });

  it('archived members never print; a missing helper goes back to the prepared one', () => {
    const s = freshState(rivera);
    setHelper(s, id('Ana'), rivera);
    const changed = rivera.map((m) => (m.firstName === 'Sofia' || m.firstName === 'Ana' ? { ...m, archived: true } : m));
    applyFamily(s, changed);
    const v = decView(s, changed);
    expect(v.forLine).toBe('Mateo & Elena');
    expect(v.helper).toBe('Mom');
    expect(JSON.stringify(v.layout)).not.toMatch(/Sofia|Ana/);
  });

  it('a family without children prints “Our family”', () => {
    const hughes = family('hughes');
    const v = decView(applyFamily(freshState(hughes), hughes), hughes);
    expect(v.forLine).toBe('Our family');
    expect(v.helper).toBe('Mom');
  });

  it('the fingerprint follows what prints', () => {
    const s = freshState(rivera);
    const before = decFingerprint(s, rivera);
    setHelper(s, ANY_GROWN_UP, rivera);
    expect(decFingerprint(s, rivera)).not.toBe(before);
    expect(isDecState(s)).toBe(true);
    expect(isDecState({ kids: [1], helper: 'x' })).toBe(false);
  });
});
