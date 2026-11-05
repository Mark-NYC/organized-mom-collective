/**
 * Ten different family situations the January companion is checked against (tests, docs/club/samples/ and the
 * quality report docs/club/JANUARY_QUALITY.md). Made-up families; first names are unique across them so the tests can
 * catch one family's details leaking into another's companion.
 */
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
const profile = (p: Partial<GuideProfile>): GuideProfile => ({ challenges: [], activities: [], responsibilities: [], ...p });

export interface Family { key: string; label: string; household: Household; profile?: GuideProfile }

export const FAMILIES: Family[] = [
  {
    key: 'preschool-support', label: '1 · Preschoolers who need a lot of support (2 and 4, two adults)',
    household: home('h1', 'Okafor', [adult('a1', 'Ngozi', true), adult('a2', 'Daniel'), child('c1', 'Ada', 2), child('c2', 'Tobi', 4)]),
    profile: profile({ priority: 'evenings', challenges: ['routines'], responsibilities: [wants('own-belongings', 'belongings', ['c2']), owns('transportation', ['a2'])] }),
  },
  {
    key: 'fewer-reminders', label: '2 · Elementary children who need fewer reminders (7 and 10, one adult)',
    household: home('h2', 'Park', [adult('p1', 'Hana', true), child('p2', 'Jun', 7), child('p3', 'Mira', 10)], { school: 'public', pets: true }),
    profile: profile({ priority: 'reminding', challenges: ['remembering'], activities: [{ category: 'school', memberIds: ['p2', 'p3'] }],
      responsibilities: [wants('pack-school-bag', 'school-prep', ['p2']), wants('homework-start', 'homework', ['p3']), owns('pet-care', ['p3'])] }),
  },
  {
    key: 'mixed-ages', label: '3 · Mixed ages with competing responsibilities (5, 9 and 13, two adults)',
    household: home('h3', 'Bennett', [adult('b1', 'Kara', true), adult('b2', 'Marcus'), child('d1', 'Mia', 5), child('d2', 'Leo', 9), child('d3', 'Jade', 13)], { school: 'public' }),
    profile: profile({ priority: 'tidying', challenges: ['sharing-fairly'],
      responsibilities: [wants('help-with-meals', 'meals'), wants('tidy-room', 'cleaning', ['d2']), owns('laundry', ['d3']), owns('transportation', ['b2'])] }),
  },
  {
    key: 'busy-schedules', label: '4 · Busy family struggling with schedules and activities (11 and 15, two adults)',
    household: home('h4', 'Lindqvist', [adult('e1', 'Maja', true), adult('e2', 'Sam'), child('f1', 'Elsa', 15), child('f2', 'Nils', 11)]),
    profile: profile({ priority: 'activities', challenges: ['knowing-plans', 'communicating'],
      activities: [{ category: 'clubs', name: 'robotics', memberIds: ['f1'] }, { category: 'sports', name: 'hockey', memberIds: ['f2'] }, { category: 'work', memberIds: ['e2'] }],
      responsibilities: [wants('own-belongings', 'belongings', ['f2'])] }),
  },
  {
    key: 'mornings', label: '5 · Struggling with morning routines (6 and 8, one adult)',
    household: home('h5', 'Ortiz', [adult('g1', 'Lucia', true), child('g2', 'Mateo', 6), child('g3', 'Sofia', 8)], { school: 'public' }),
    profile: profile({ priority: 'mornings', challenges: ['routines', 'preparing'], responsibilities: [wants('morning-routine', 'routines'), wants('pack-school-bag', 'school-prep', ['g3'])] }),
  },
  {
    key: 'resistance', label: '6 · Children resist household responsibilities (8 and 11, two adults)',
    household: home('h6', 'Haddad', [adult('k1', 'Amira', true), adult('k2', 'Yusuf'), child('k3', 'Omar', 8), child('k4', 'Layla', 11)]),
    profile: profile({ priority: 'other', priorityNote: 'Kids pushing back on every chore', challenges: ['sharing-fairly'],
      responsibilities: [wants('tidy-room', 'cleaning', ['k3']), wants('help-with-meals', 'meals', ['k4'])] }),
  },
  {
    key: 'independent', label: '7 · One child already highly independent (6 and 12, one adult)',
    household: home('h7', 'Chen', [adult('m1', 'Mei', true), child('m2', 'Grace', 12), child('m3', 'Owen', 6)], { school: 'public' }),
    profile: profile({ priority: 'school-stuff', challenges: [],
      responsibilities: [owns('school-prep', ['m2']), owns('homework', ['m2']), owns('belongings', ['m2']), wants('pack-school-bag', 'school-prep')] }),
  },
  {
    key: 'many-priorities', label: '8 · Several competing priorities (7 and 9, two adults)',
    household: home('h8', 'Garcia', [adult('n1', 'Rosa', true), adult('n2', 'Tomas'), child('n3', 'Ana', 9), child('n4', 'Ben', 7)]),
    profile: profile({ priority: 'evenings', challenges: ['knowing-plans', 'remembering', 'routines', 'sharing-fairly', 'preparing'],
      responsibilities: [wants('bedtime-routine', 'routines', ['n4']), wants('help-with-meals', 'meals', ['n3']), wants('put-away-laundry', 'laundry'), wants('tidy-room', 'cleaning')] }),
  },
  {
    key: 'vague', label: '9 · Limited intake: names only, no ages, no answers',
    household: home('h9', undefined, [adult('i1', 'Jo', true), child('j1', 'Sky'), child('j2', 'River')]),
  },
  {
    key: 'one-challenge', label: '10 · Three children, one shared challenge and nothing else (4, 7 and 10, one adult)',
    household: home('h10', 'Kim', [adult('q1', 'Hye', true), child('q2', 'Min', 4), child('q3', 'Joon', 7), child('q4', 'Seo', 10)]),
    profile: profile({ challenges: ['remembering'] }),
  },
];
