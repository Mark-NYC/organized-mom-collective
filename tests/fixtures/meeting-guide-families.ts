/** The household types the January guide is checked against (tests and docs/club/samples/). Made-up families. */
import type { FamilyMember, Household } from '../../src/lib/club/profile';
import type { GuideProfile } from '../../src/lib/club/meeting-guide/state';

const adult = (id: string, firstName: string, holder = false, role: FamilyMember['role'] = holder ? 'parent' : 'partner'): FamilyMember =>
  ({ id, firstName, kind: 'adult', role, ...(holder ? { isAccountHolder: true } : {}) });
/** A child who is `age` in January 2027 (born in June). */
const child = (id: string, firstName: string, age?: number): FamilyMember =>
  ({ id, firstName, kind: 'child', role: 'child', ...(age === undefined ? {} : { birthYear: 2026 - age, birthMonth: 6 }) });
const home = (id: string, displayName: string | undefined, members: FamilyMember[], preferences: Household['preferences'] = {}): Household =>
  ({ id, displayName, preferences, profileVersion: 1, members });
const wants = (item: string, category: string, ownerIds: string[] = []) => ({ status: 'desired' as const, category, item, ownerIds });
const owns = (category: string, ownerIds: string[]) => ({ status: 'existing' as const, category, ownerIds });

export const FAMILIES: { key: string; label: string; household: Household; profile?: GuideProfile }[] = [
  {
    key: 'young-support', label: '1 · Younger children who need a lot of support (2 and 4, two adults)',
    household: home('h1', 'Okafor', [adult('a1', 'Ngozi', true), adult('a2', 'Daniel'), child('c1', 'Ada', 2), child('c2', 'Tobi', 4)]),
    profile: { priority: 'evenings', challenges: ['routines'], activities: [], responsibilities: [wants('own-belongings', 'belongings', ['c2']), owns('transportation', ['a2'])] },
  },
  {
    key: 'school-age', label: '2 · School-aged children building independence (7 and 10, one adult)',
    household: home('h2', 'Park', [adult('p1', 'Hana', true), child('p2', 'Jun', 7), child('p3', 'Mira', 10)], { school: 'public', pets: true }),
    profile: { priority: 'school-stuff', challenges: ['remembering'], activities: [{ category: 'school', memberIds: ['p2', 'p3'] }],
      responsibilities: [wants('pack-school-bag', 'school-prep', ['p2']), wants('homework-start', 'homework', ['p3']), owns('pet-care', ['p3'])] },
  },
  {
    key: 'mixed-busy', label: '3 · Children of different ages with competing schedules (5, 9 and 13, two adults)',
    household: home('h3', 'Bennett', [adult('b1', 'Kara', true), adult('b2', 'Marcus'), child('d1', 'Mia', 5), child('d2', 'Leo', 9), child('d3', 'Jade', 13)], { school: 'public' }),
    profile: { priority: 'activities', challenges: ['knowing-plans', 'sharing-fairly'],
      activities: [{ category: 'lessons', name: 'piano', memberIds: ['d2'] }, { category: 'sports', name: 'swim team', memberIds: ['d3'] }, { category: 'sports', name: 'soccer', memberIds: ['d2'] }],
      responsibilities: [wants('own-belongings', 'belongings'), wants('help-with-meals', 'meals'), owns('laundry', ['d3']), owns('transportation', ['b2'])] },
  },
  {
    key: 'two-adults-teen', label: 'Two adults with a teenager',
    household: home('h4', 'Lindqvist', [adult('e1', 'Maja', true), adult('e2', 'Sam'), child('f1', 'Elsa', 15)]),
    profile: { priority: 'reminding', challenges: ['communicating'], activities: [{ category: 'clubs', name: 'robotics', memberIds: ['f1'] }], responsibilities: [wants('bedtime-routine', 'routines', ['f1'])] },
  },
  {
    key: 'single-preschooler', label: 'Single parent with a preschooler, no profile answers',
    household: home('h5', 'Ortiz', [adult('g1', 'Lucia', true), child('h1c', 'Mateo', 4)]),
  },
  {
    key: 'minimal', label: 'Minimal intake (names only, no ages, no profile)',
    household: home('h6', undefined, [adult('i1', 'Jo', true), child('j1', 'Sky'), child('j2', 'River')]),
  },
];
