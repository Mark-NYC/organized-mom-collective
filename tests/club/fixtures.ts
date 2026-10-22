/** Test families for the Organized Family Club engine (docs/club/KIT_TEMPLATE.md → Test households, and more). */
import type { FamilyMember, Household, HouseholdPreferences } from '../../src/lib/club/profile';

export const MONTH = '2026-11';

/** A child who is `age` on the first of November 2026 (born in March). */
export const kid = (id: string, age: number, name = id): FamilyMember => ({ id, firstName: name, kind: 'child', role: 'child', birthYear: 2026 - age, birthMonth: 3 });
export const adult = (id: string, holder = false, role: FamilyMember['role'] = holder ? 'parent' : 'partner'): FamilyMember => ({
  id, firstName: id, kind: 'adult', role, ...(holder ? { isAccountHolder: true } : {}),
});

export const family = (id: string, members: FamilyMember[], preferences: HouseholdPreferences = {}): Household => ({ id, preferences, profileVersion: 1, members });

/** Every shape we promise to handle. */
export const families: Record<string, Household> = {
  // KIT_TEMPLATE A–D
  A: family('hh-a', [adult('mom', true), adult('dad'), kid('ava', 4), kid('ben', 7), kid('cal', 10)], { pets: true }),
  B: family('hh-b', [adult('solo', true), kid('dee', 6), kid('eli', 9)]),
  C: family('hh-c', [adult('pat', true), adult('sam'), kid('tot', 3)]),
  D: family('hh-d', [adult('mia', true), adult('jo'), kid('fin', 5), kid('gus', 8), kid('hal', 11), kid('ivy', 13)], { pets: true, faith_content: false }),
  // More shapes
  noKids: family('hh-e', [adult('ann', true), adult('bo')]),
  soloNoKids: family('hh-f', [adult('cy', true)]),
  teens: family('hh-g', [adult('dot', true), adult('ed'), kid('flo', 14), kid('gil', 16)]),
  bigSolo: family('hh-h', [adult('hen', true), kid('k2', 2), kid('k5', 5), kid('k7', 7), kid('k9', 9), kid('k12', 12), kid('k15', 15)], { pets: true }),
  grandparent: family('hh-i', [adult('liz', true), adult('max'), adult('nan', false, 'grandparent'), kid('oli', 6), kid('pia', 9)]),
  toddlers: family('hh-j', [adult('quin', true), adult('rae'), kid('t1', 2), kid('t2', 3)]),
  youngAdultAtHome: family('hh-k', [adult('sky', true), kid('ty', 18)]),
  noHolderFlag: family('hh-l', [adult('uma'), adult('val'), kid('wes', 8)]),
};
