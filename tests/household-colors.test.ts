import { describe, expect, it } from 'vitest';
import { memberColors } from '../src/data/club/family-colors';
import { pinMemberColors, unpinned } from '../src/lib/household/colors';
import type { Household } from '../src/lib/club/profile';

const family = (members: Household['members'], colors?: Record<string, string>): Household => ({
  id: 'h', profileVersion: 1, preferences: colors ? { colors } : {}, members,
});
const ana = { id: 'ana', firstName: 'Ana', kind: 'adult', role: 'parent', isAccountHolder: true } as const;
const luis = { id: 'luis', firstName: 'Luis', kind: 'adult', role: 'partner' } as const;
const sofia = { id: 'sofia', firstName: 'Sofia', kind: 'child', role: 'child', birthYear: 2016 } as const;
const mateo = { id: 'mateo', firstName: 'Mateo', kind: 'child', role: 'child', birthYear: 2019 } as const;
const baby = { id: 'baby', firstName: 'Lu', kind: 'child', role: 'child', birthYear: 2025 } as const;

describe('member colors stay put', () => {
  it('shows the problem: without pinning, a new child shifts the grown-ups', () => {
    const before = memberColors(family([ana, luis, sofia, mateo]));
    const after = memberColors(family([ana, luis, sofia, mateo, baby]));
    expect(after.ana.id).not.toBe(before.ana.id); // children come first, so the new child takes a color ahead of Ana
  });

  it('pins everyone to the color they already see, before the change', () => {
    const before = family([ana, luis, sofia, mateo]);
    const shown = memberColors(before);
    const pinned = pinMemberColors(before, ['ana', 'luis', 'sofia', 'mateo']);
    for (const id of ['ana', 'luis', 'sofia', 'mateo']) expect(pinned[id]).toBe(shown[id].id);
    // After the save, the new child gets a color nobody has; nobody else moves.
    const after = family([ana, luis, sofia, mateo, baby], pinned);
    const next = memberColors(after);
    for (const id of ['ana', 'luis', 'sofia', 'mateo']) expect(next[id].id).toBe(shown[id].id);
    expect(Object.values(pinned)).not.toContain(next.baby.id);
    expect(unpinned(after)).toEqual(['baby']);
  });

  it('never overwrites a saved color; an explicit new choice wins', () => {
    const before = family([ana, sofia], { sofia: 'purple' });
    expect(pinMemberColors(before, ['ana', 'sofia']).sofia).toBe('purple');
    expect(pinMemberColors(before, ['ana', 'sofia'], { sofia: 'teal' }).sofia).toBe('teal');
    expect(pinMemberColors(before, ['ana', 'sofia'], { sofia: 'not-a-color' }).sofia).toBe('purple');
  });

  it('archiving someone doesn\'t move anyone else', () => {
    const before = family([ana, luis, sofia, mateo]);
    const shown = memberColors(before);
    const pinned = pinMemberColors(before, ['ana', 'luis', 'mateo']);
    const after = memberColors(family([ana, luis, { ...sofia, archived: true }, mateo], pinned));
    for (const id of ['ana', 'luis', 'mateo']) expect(after[id].id).toBe(shown[id].id);
  });

  it('a brand-new family has nothing to pin yet', () => {
    expect(pinMemberColors(null, [])).toEqual({});
  });
});
