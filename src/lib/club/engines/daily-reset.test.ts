import { describe, expect, it } from 'vitest';
import { sampleHouseholds } from '../../../data/club/samples';
import {
  EVERYONE, applyFamily, freshState, fromLegacy, isResetState, planChanged, resetFingerprint, resetView, restorePlan, setArea, setJob,
  setJobOwner, setText, setTrigger, type ResetMember,
} from './daily-reset';

const family = (id: string) => sampleHouseholds.find((s) => s.id === id)!.household.members as ResetMember[];
const rivera = family('rivera');
const id = (n: string, m = rivera) => m.find((x) => x.firstName === n)!.id;

describe('October Daily Reset', () => {
  it('is prepared from the youngest child’s age in October 2027', () => {
    const v = resetView(applyFamily(freshState(rivera), rivera), rivera);
    expect(v.age).toBe(5);
    expect(v.count).toBe(2);
    expect(v.countLine).toBe('Two little jobs. Then we’re done.');
    expect(v.jobs.map((j) => [j.label, j.person])).toEqual([['Toys Put Away', 'Sofia'], ['Clothes in Hamper', 'Everyone']]);
    expect(v.owner).toBe("Our family's whole-house cleanup");
  });

  it('older children get three jobs and their own wording', () => {
    const chen = family('chen').filter((m) => m.firstName !== 'Leo' && m.firstName !== 'Ivy');
    const v = resetView(applyFamily(freshState(chen), chen), chen);
    expect(v.count).toBe(3);
    expect(v.duration).toBe('I own this reset and check my own work.');
    expect(v.jobs.map((j) => j.person)).toEqual(['Grace', 'Owen', 'Everyone']);
  });

  it('cue, area, jobs, people and retyped words; blank goes back', () => {
    const s = applyFamily(freshState(rivera), rivera);
    setTrigger(s, 'After School');
    expect(resetView(s, rivera).coaching).toBe("Now that we're home, let's put our things where they belong.");
    setArea(s, 'playroom', rivera);
    expect(resetView(s, rivera).jobs.map((j) => j.label)).toEqual(['Toys Put Away', 'Clothes in Hamper']);
    setJob(s, 1, 'Books Put Away');
    setJobOwner(s, 0, id('Mateo'), rivera);
    setJobOwner(s, 1, 'stranger', rivera);
    const v = resetView(s, rivera);
    expect(v.jobs.map((j) => [j.label, j.person])).toEqual([['Toys Put Away', 'Mateo'], ['Books Put Away', 'Everyone']]);
    expect(v.finish).toBe('Each item is back where it belongs.');
    setText(s, 'start', 'Start with your shoes.');
    expect(resetView(s, rivera).start).toBe('Start with your shoes.');
    setText(s, 'start', '  ');
    expect(resetView(s, rivera).start).toBe('Start with just one toy.');
    setText(s, 'cue', 'When the timer rings');
    expect(resetView(s, rivera).cue).toBe('When the timer rings');
    expect(planChanged(s, rivera)).toBe(true);
    restorePlan(s, rivera);
    expect(planChanged(s, rivera)).toBe(false);
  });

  it('archived children and gone people never print; another family starts fresh', () => {
    const s = applyFamily(freshState(rivera), rivera);
    setJobOwner(s, 0, id('Elena'), rivera);
    const without = rivera.map((m) => (m.firstName === 'Elena' ? { ...m, archived: true } : m));
    applyFamily(s, without);
    const v = resetView(s, without);
    expect(v.count).toBe(3);
    expect(JSON.stringify(v)).not.toContain('Elena');
    const okafor = family('okafor');
    expect(resetView(applyFamily(freshState(okafor), okafor), okafor).jobs.map((j) => j.person)).toEqual(['Zara', 'Zara']);
  });

  it('fingerprint follows what prints', () => {
    const s = applyFamily(freshState(rivera), rivera);
    const before = resetFingerprint(s, rivera);
    setJobOwner(s, 1, EVERYONE, rivera);
    expect(resetFingerprint(s, rivera)).toBe(before);
    setJobOwner(s, 1, id('Sofia'), rivera);
    expect(resetFingerprint(s, rivera)).not.toBe(before);
  });

  it('reads the earlier September page’s tab copy once, for the same family', () => {
    const state = { owner: 'family', area: 'living', trigger: 'After Dinner', jobs: ['Toys Put Away', 'Personal Belongings Put Away', 'Floor Vacuum-Ready'], jobOwners: [], custom: true, text: {} };
    const raw = JSON.stringify({ familyKey: 'rivera:sample-rivera', state });
    const s = fromLegacy(raw, 'rivera:sample-rivera', rivera)!;
    expect(isResetState(s)).toBe(true);
    expect(resetView(s, rivera).summary).toEqual({ owner: 'Our kids together', area: 'Living Room', trigger: 'After Dinner' });
    expect(fromLegacy(raw, 'chen:sample-chen', rivera)).toBeNull();
  });
});
