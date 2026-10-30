/**
 * Sample households for development and Preview deployments (?sample=<id> on any /club page). Made-up families, not
 * customers, and every page shows a "Sample household" banner while one is open. Edits stay in this browser tab
 * (sessionStorage), never reach the database, and never sync to an account.
 *
 * Ages are fixed for November 2026 (birth year and month), so previews match the tests in tests/club/.
 */
import type { Household } from '../../lib/club/profile';
import type { FamilyProfile } from '../../lib/club/family-profile';

export interface SampleHousehold {
  id: string;
  label: string;
  /** What the sample is for, in the picker. */
  shows: string;
  household: Household;
  /**
   * Made-up answers to the family profile's steps 2–6 (src/lib/club/family-profile.ts), so previews of the Monthly
   * Family Meeting show what a filled-in profile does. Samples without one start with nothing answered.
   */
  profile?: FamilyProfile;
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
    profile: {
      setupDone: ['week', 'responsibilities', 'growth', 'challenges', 'priority'],
      setupCompleted: true,
      challenges: ['knowing-plans', 'routines'],
      priority: 'evenings',
      priorityNote: 'The hour before dinner',
      activities: [
        { id: 'sample-rivera-a1', category: 'school', memberIds: ['sample-rivera-sofia', 'sample-rivera-mateo'], days: [1, 2, 3, 4, 5], startsAt: '08:00' },
        { id: 'sample-rivera-a2', category: 'sports', name: 'Soccer', memberIds: ['sample-rivera-sofia'], days: [2, 4], startsAt: '17:30' },
        { id: 'sample-rivera-a3', category: 'work', memberIds: ['sample-rivera-luis'], days: [1, 2, 3, 4, 5] },
      ],
      responsibilities: [
        { id: 'sample-rivera-r1', status: 'existing', category: 'meals', ownerIds: ['sample-rivera-ana', 'sample-rivera-luis'], helperIds: ['sample-rivera-sofia'], scope: 'shared' },
        { id: 'sample-rivera-r2', status: 'existing', category: 'transportation', ownerIds: ['sample-rivera-luis'], helperIds: [], scope: 'individual' },
        { id: 'sample-rivera-r3', status: 'existing', category: 'pet-care', ownerIds: ['sample-rivera-sofia'], helperIds: ['sample-rivera-mateo'], scope: 'individual' },
        { id: 'sample-rivera-r4', status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: ['sample-rivera-sofia'], helperIds: [] },
        { id: 'sample-rivera-r5', status: 'desired', category: 'laundry', item: 'put-away-laundry', ownerIds: [], helperIds: [] },
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
    profile: {
      setupDone: ['week', 'responsibilities', 'growth', 'challenges', 'priority'],
      setupCompleted: true,
      challenges: ['sharing-fairly', 'communicating'],
      priority: 'tidying',
      activities: [
        { id: 'sample-chen-a1', category: 'school', memberIds: ['sample-chen-grace', 'sample-chen-owen', 'sample-chen-ivy'], days: [1, 2, 3, 4, 5] },
        { id: 'sample-chen-a2', category: 'lessons', name: 'Piano', memberIds: ['sample-chen-ivy'], days: [3], startsAt: '16:00' },
        { id: 'sample-chen-a3', category: 'sports', name: 'Swim team', memberIds: ['sample-chen-grace', 'sample-chen-owen'], days: [1, 3, 5] },
        { id: 'sample-chen-a4', category: 'community', name: 'Church', memberIds: [], days: [0] },
      ],
      responsibilities: [
        { id: 'sample-chen-r1', status: 'existing', category: 'meals', ownerIds: ['sample-chen-lin', 'sample-chen-david'], helperIds: ['sample-chen-grace'], scope: 'shared' },
        { id: 'sample-chen-r2', status: 'existing', category: 'laundry', ownerIds: ['sample-chen-mei'], helperIds: ['sample-chen-owen'], scope: 'individual' },
        { id: 'sample-chen-r3', status: 'existing', category: 'transportation', ownerIds: ['sample-chen-david', 'sample-chen-mei'], helperIds: [], scope: 'shared' },
        { id: 'sample-chen-r4', status: 'existing', category: 'cleaning', ownerIds: ['sample-chen-grace', 'sample-chen-owen'], helperIds: ['sample-chen-ivy'], scope: 'shared' },
        { id: 'sample-chen-r5', status: 'desired', category: 'routines', item: 'morning-routine', ownerIds: ['sample-chen-ivy', 'sample-chen-leo'], helperIds: [] },
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
    id: 'hughes',
    label: 'Sample: the Hughes family',
    shows: 'A parent who hasn’t added the children yet',
    household: {
      id: 'sample-hughes',
      displayName: 'The Hughes family',
      preferences: {},
      profileVersion: 1,
      members: [{ id: 'sample-hughes-claire', firstName: 'Claire', kind: 'adult', role: 'parent', isAccountHolder: true }],
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
