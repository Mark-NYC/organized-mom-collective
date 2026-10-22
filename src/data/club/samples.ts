/**
 * Sample households for development and Preview deployments (?sample=<id> on any /club page). Made-up families, not
 * customers, and every page shows a "Sample household" banner while one is open. Edits stay in this browser tab
 * (sessionStorage), never reach the database, and never sync to an account.
 *
 * Ages are fixed for November 2026 (birth year and month), so previews match the tests in tests/club/.
 */
import type { Household } from '../../lib/club/profile';

export interface SampleHousehold {
  id: string;
  label: string;
  /** What the sample is for, in the picker. */
  shows: string;
  household: Household;
}

const kid = (id: string, firstName: string, birthYear: number, birthMonth: number) => ({ id, firstName, kind: 'child' as const, role: 'child' as const, birthYear, birthMonth });

export const sampleHouseholds: SampleHousehold[] = [
  {
    id: 'rivera',
    label: 'Sample: the Rivera family',
    shows: 'Two parents, kids 4, 7 and 10, a dog',
    household: {
      id: 'sample-rivera',
      displayName: 'The Rivera Family',
      preferences: { pets: true, priorities: ['evenings', 'kids-independence'] },
      profileVersion: 1,
      members: [
        { id: 'sample-rivera-ana', firstName: 'Ana', kind: 'adult', role: 'parent', isAccountHolder: true },
        { id: 'sample-rivera-luis', firstName: 'Luis', kind: 'adult', role: 'partner' },
        kid('sample-rivera-sofia', 'Sofia', 2016, 3),
        kid('sample-rivera-mateo', 'Mateo', 2019, 6),
        kid('sample-rivera-elena', 'Elena', 2022, 2),
      ],
    },
  },
  {
    id: 'brooks',
    label: 'Sample: the Brooks family',
    shows: 'One parent, kids 6 and 9',
    household: {
      id: 'sample-brooks',
      displayName: 'Team Brooks',
      preferences: {},
      profileVersion: 1,
      members: [
        { id: 'sample-brooks-jess', firstName: 'Jess', kind: 'adult', role: 'parent', isAccountHolder: true },
        kid('sample-brooks-max', 'Max', 2017, 9),
        kid('sample-brooks-lily', 'Lily', 2020, 5),
      ],
    },
  },
  {
    id: 'chen',
    label: 'Sample: the Chen family',
    shows: 'Two parents, a grandparent, teens 13 and 16, kids 5 and 8: a long chart',
    household: {
      id: 'sample-chen',
      displayName: 'The Chen Family',
      preferences: { pets: true, priorities: ['shared-load', 'tidy-home', 'mornings'] },
      profileVersion: 1,
      members: [
        { id: 'sample-chen-mei', firstName: 'Mei', kind: 'adult', role: 'parent', isAccountHolder: true },
        { id: 'sample-chen-david', firstName: 'David', kind: 'adult', role: 'partner' },
        { id: 'sample-chen-lin', firstName: 'Lin', kind: 'adult', role: 'grandparent' },
        kid('sample-chen-grace', 'Grace', 2010, 4),
        kid('sample-chen-owen', 'Owen', 2013, 1),
        kid('sample-chen-ivy', 'Ivy', 2018, 7),
        kid('sample-chen-leo', 'Leo', 2021, 3),
      ],
    },
  },
  {
    id: 'okafor',
    label: 'Sample: the Okafor family',
    shows: 'Two parents and a toddler',
    household: {
      id: 'sample-okafor',
      displayName: 'The Okafors',
      preferences: {},
      profileVersion: 1,
      members: [
        { id: 'sample-okafor-ada', firstName: 'Ada', kind: 'adult', role: 'parent', isAccountHolder: true },
        { id: 'sample-okafor-tunde', firstName: 'Tunde', kind: 'adult', role: 'partner' },
        kid('sample-okafor-zara', 'Zara', 2023, 8),
      ],
    },
  },
  {
    id: 'new',
    label: 'Sample: a new member',
    shows: 'No family yet: try the welcome form',
    household: { id: 'sample-new', preferences: {}, profileVersion: 0, members: [] },
  },
];

export const sampleById = (id: string | null | undefined) => sampleHouseholds.find((s) => s.id === id);
