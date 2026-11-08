import { describe, expect, it } from 'vitest';
import { familyContext } from '../src/lib/club/personalize/family';
import { KIT_MONTH, freshState, rhythmContext, rhythmFingerprint, rhythmView, suggestedAnchors } from '../src/lib/club/engines/march-family-rhythm';
import type { RhythmMember } from '../src/lib/club/engines/march-family-rhythm';

// Phase 2a regression: the default remains March while Welcome may ask for another month.
// Do not add a second independent recommendation engine.
const members: RhythmMember[] = [
  { id: 'adult-1', firstName: 'Jess', kind: 'adult', isAccountHolder: true },
  { id: 'child-1', firstName: 'Max', kind: 'child', birthYear: 2018, birthMonth: 6 },
] as RhythmMember[];

describe('Family Rhythm reusable month boundary', () => {
  it('preserves the March family context when no month is passed', () => {
    expect(rhythmContext(members, undefined)).toEqual(
      familyContext(members, undefined, KIT_MONTH)
    );
  });
  it('preserves March printable output and fingerprint by default', () => {
    const state = freshState();
    expect(rhythmView(state, members)).toEqual(rhythmView(state, members, undefined, KIT_MONTH));
    expect(rhythmFingerprint(state, members)).toBe(rhythmFingerprint(state, members, undefined, KIT_MONTH));
  });
  it('accepts the actual Welcome preparation month without changing March defaults', () => {
    expect(rhythmContext(members, undefined, undefined, '2027-08')).toEqual(
      familyContext(members, undefined, '2027-08')
    );
    expect(rhythmView(freshState(), members, undefined, '2027-08').printed.length).toBeGreaterThan(0);
  });
  it('prioritizes the bedtime anchor when bedtime is the stated priority', () => {
    const ctx = rhythmContext(members, undefined);
    const withBedtime = { ...ctx, snapshot: { v: 1, activities: [], responsibilities: [], priority: 'bedtime' } } as typeof ctx;
    expect(suggestedAnchors(withBedtime)[0]).toBe('teeth');
  });
});
