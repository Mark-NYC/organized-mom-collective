/**
 * V16 experiment (docs/ios/V16_EXPERIMENT.md): the FICTIONAL demo household the preview runs on. Never a real family,
 * never saved to the server. The Riveras are the same made-up family the existing demos and e2e suites use
 * (supabase/migrations/20261209000000_demo_rivera.sql): Ana and Luis, Sofia (10), Mateo (7) and Elena (4).
 *
 * Every date is relative to the week the preview is opened, so the calendar, the Club month and the cleaning zones
 * are always the real ones for "this week".
 */
import { memberColors, type MarkerColor } from '../../data/club/family-colors';
import type { FamilyProfile } from '../club/family-profile';
import type { Household } from '../club/profile';
import { addDays, type CalendarEvent } from '../calendar/recurrence';

export const ANA = 'm-ana';
export const LUIS = 'm-luis';
export const SOFIA = 'm-sofia';
export const MATEO = 'm-mateo';
export const ELENA = 'm-elena';

export type Adults = 'two' | 'one';

/**
 * The household as src/lib/club/profile.ts models it. Colors are NOT invented here: they come from
 * memberColors() with Ana's saved picks, exactly as the real app resolves them, so they never shift with the month.
 */
export function demoHousehold(adults: Adults): Household {
  const members: Household['members'] = [
    { id: ANA, firstName: 'Ana', kind: 'adult', role: 'parent', isAccountHolder: true },
    { id: LUIS, firstName: 'Luis', kind: 'adult', role: 'partner' },
    { id: SOFIA, firstName: 'Sofia', kind: 'child', role: 'child', birthYear: 2016, birthMonth: 3 },
    { id: MATEO, firstName: 'Mateo', kind: 'child', role: 'child', birthYear: 2019, birthMonth: 6 },
    { id: ELENA, firstName: 'Elena', kind: 'child', role: 'child', birthYear: 2022, birthMonth: 2 },
  ];
  return {
    id: 'demo-rivera',
    displayName: 'The Rivera Family',
    profileVersion: 1,
    // Saved color picks (household.preferences.colors): the same map the real household stores.
    preferences: { pets: true, week_starts: 'monday', colors: { [ANA]: 'teal', [LUIS]: 'brown', [SOFIA]: 'purple', [MATEO]: 'orange', [ELENA]: 'pink' } } as Household['preferences'],
    members: adults === 'one' ? members.filter((m) => m.id !== LUIS) : members,
  };
}

export const colorsFor = (h: Household): Record<string, MarkerColor> => memberColors(h);

/** The expanded profile buildFamilyMeeting reads: Sofia's soccer on Thursdays, so the Club month can mention it. */
export function demoProfile(): FamilyProfile {
  return {
    setupDone: [], setupCompleted: true, challenges: ['preparing'], priority: 'activities',
    activities: [{ id: 'a-soccer', category: 'sports', name: 'soccer', memberIds: [SOFIA], days: [4], startsAt: '16:00' }],
    responsibilities: [],
  };
}

export type Scenario = 'first' | 'week4';

const ext = (feed: string, name: string, visibility: 'private' | 'household', mine: boolean, uid: string): CalendarEvent['external'] =>
  ({ feed_id: feed, name, visibility, mine, tentative: false, uid });

/**
 * The family's calendar for the week starting `monday`. Imported (Google / iCal) events carry `external` and are
 * read-only, exactly like src/lib/calendar/feeds.ts marks them. Luis's private work calendar is included on purpose:
 * the curation layer must never show it to Ana.
 */
export function demoEvents(monday: string, scenario: Scenario, adults: Adults): CalendarEvent[] {
  const base = { timezone: 'America/Chicago', revision: 1 } as const;
  const list: CalendarEvent[] = [
    { ...base, id: 'e-conf', title: 'Parent-teacher conference', starts_on: monday, start_time: '15:15', end_time: '15:45', member_ids: [ANA, SOFIA], source: 'manual' },
    { ...base, id: 'e-soccer', title: 'Soccer practice', starts_on: addDays(monday, -25), start_time: '16:00', end_time: '17:15', member_ids: [SOFIA],
      recurrence: { freq: 'weekly', by_day: [4] }, external: ext('feed-riverside', 'Riverside FC', 'household', true, 'practice@riverside-fc') },
    { ...base, id: 'e-school', title: 'School', starts_on: addDays(monday, -60), start_time: '08:05', end_time: '15:00', member_ids: [SOFIA, MATEO],
      recurrence: { freq: 'weekly', by_day: [1, 2, 3, 4, 5] }, external: ext('feed-lincoln', 'Lincoln Elementary', 'household', true, 'school@lincoln') },
    { ...base, id: 'e-piano', title: 'Piano lesson', starts_on: addDays(monday, -27), start_time: '17:00', end_time: '17:30', member_ids: [SOFIA],
      recurrence: { freq: 'weekly', by_day: [2] }, source: 'manual' },
    { ...base, id: 'e-dentist', title: 'Dentist', starts_on: addDays(monday, 2), start_time: '10:30', member_ids: [ANA, ELENA], source: 'manual' },
    // Ana's own private calendar: she sees it, marked private; it never reaches the family's shared plan.
    { ...base, id: 'e-ana-work', title: 'Team offsite', starts_on: addDays(monday, 3), start_time: '09:00', end_time: '12:00', member_ids: [ANA],
      external: ext('feed-ana-work', 'Ana · Work', 'private', true, 'offsite@ana-work') },
  ];
  if (adults === 'two') {
    // Luis's private calendar: exists in the data, never shown on Ana's phone (mine: false, private).
    list.push({ ...base, id: 'e-luis-private', title: 'Quarterly review', starts_on: addDays(monday, 1), start_time: '13:00', member_ids: [LUIS],
      external: ext('feed-luis-work', 'Luis · Work', 'private', false, 'review@luis-work') });
  }
  if (scenario === 'week4') {
    list.push({ ...base, id: 'e-fieldtrip', title: 'School field trip', starts_on: addDays(monday, 4), start_time: '08:30', end_time: '14:00', member_ids: [SOFIA],
      external: ext('feed-lincoln', 'Lincoln Elementary', 'household', true, 'fieldtrip@lincoln') });
    // A Family Meeting the family really put on its calendar: the only way Today ever shows a meeting time.
    list.push({ ...base, id: 'e-meeting', title: 'Family Meeting', starts_on: addDays(monday, -22), start_time: '17:00', member_ids: [],
      recurrence: { freq: 'weekly', by_day: [0] }, source: 'manual' });
  }
  return list;
}
