/** The five household types the January guide is checked against (tests and docs/club/samples/). Made-up families. */
import type { FamilyMember, Household } from '../../src/lib/club/profile';
import type { GuideProfile } from '../../src/lib/club/meeting-guide/state';

const adult = (id: string, firstName: string, holder = false, role: FamilyMember['role'] = holder ? 'parent' : 'partner'): FamilyMember =>
  ({ id, firstName, kind: 'adult', role, ...(holder ? { isAccountHolder: true } : {}) });
/** A child who is `age` in January 2027 (born in June). */
const child = (id: string, firstName: string, age?: number): FamilyMember =>
  ({ id, firstName, kind: 'child', role: 'child', ...(age === undefined ? {} : { birthYear: 2026 - age, birthMonth: 6 }) });
const home = (id: string, displayName: string | undefined, members: FamilyMember[], preferences: Household['preferences'] = {}): Household =>
  ({ id, displayName, preferences, profileVersion: 1, members });

export const FAMILIES: { key: string; label: string; household: Household; profile?: GuideProfile }[] = [
  {
    key: 'two-adults-2-7', label: 'Two adults, children 2 and 7',
    household: home('h1', 'Okafor', [adult('a1', 'Ngozi', true), adult('a2', 'Daniel'), child('c1', 'Ada', 2), child('c2', 'Tobi', 7)], { school: 'public' }),
    profile: { priority: 'mornings', challenges: ['preparing'], activities: [{ category: 'sports', name: 'soccer', memberIds: ['c2'] }, { category: 'school', memberIds: ['c2'] }] },
  },
  {
    key: 'single-5-9-13', label: 'Single parent, children 5, 9 and 13',
    household: home('h2', 'Bennett', [adult('b1', 'Kara', true), child('d1', 'Mia', 5), child('d2', 'Leo', 9), child('d3', 'Jade', 13)], { school: 'public' }),
    profile: { priority: 'reminding', challenges: ['knowing-plans', 'sharing-fairly'], activities: [{ category: 'lessons', name: 'piano', memberIds: ['d2'] }, { category: 'sports', name: 'swim team', memberIds: ['d3'] }] },
  },
  {
    key: 'two-adults-teen', label: 'Two adults with a teenager',
    household: home('h3', 'Lindqvist', [adult('e1', 'Maja', true), adult('e2', 'Sam'), child('f1', 'Elsa', 15)]),
    profile: { priority: 'activities', challenges: ['communicating'], activities: [{ category: 'clubs', name: 'robotics', memberIds: ['f1'] }] },
  },
  {
    key: 'single-preschooler', label: 'Single parent with a preschooler',
    household: home('h4', 'Ortiz', [adult('g1', 'Lucia', true), child('h1c', 'Mateo', 4)]),
  },
  {
    key: 'minimal', label: 'Minimal intake (names only, no ages, no profile)',
    household: home('h5', undefined, [adult('i1', 'Jo', true), child('j1', 'Sky'), child('j2', 'River')]),
  },
];
