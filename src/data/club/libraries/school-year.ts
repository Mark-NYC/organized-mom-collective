/**
 * School-year item sets that aren't in a monthly kit. They were August 2027's first draft (a 20-plus-task launch plan
 * with an owner per task, and a year-round command center); the owner simplified August to one letter, one six-line
 * countdown and the routine tool (2026-10-23), because together they asked too much of her and competed with the wall
 * calendar. Kept, tested, for a later kit or a free tool: they run on the responsibilities engine with a school setup
 * (src/lib/club/school.ts) and the overview's first actions (src/lib/club/overview.ts).
 */
import type { KitItem, SchoolType } from '../types';

/** Goes to a school building (backpacks, supply lists, school forms). */
const SCHOOL: SchoolType[] = ['public', 'private'];
const AWAY: SchoolType[] = ['public', 'private', 'preschool'];
const ANY: SchoolType[] = ['public', 'private', 'homeschool', 'preschool'];

const prep = (item: Omit<KitItem, 'for' | 'frequency' | 'effort' | 'section' | 'scope'>): KitItem => ({
  for: 'child', frequency: 'once', effort: 1, section: 'self', scope: 'each', ...item,
});
const shared = (item: Omit<KitItem, 'frequency' | 'section' | 'scope' | 'core'> & { core?: boolean }): KitItem => ({
  frequency: 'once', section: 'family', scope: 'household', core: true, ...item,
});

/**
 * The School Launch Plan: each child's own prep by age and school type, plus shared prep with one owner each
 * (`lead` counts back from each child's first day, `priority` orders a short list of first actions).
 */
export const schoolLaunch: KitItem[] = [
  // Shared prep: one owner each, never everything on one parent.
  shared({ id: 'school-calendar', title: 'Put first days, early dismissals and school breaks on the family calendar', doneMeans: 'Every child’s first day and the first few school breaks are written where the family can see them.', for: 'anyone', minAge: 12, levels: [[12, 'with-check'], [14, 'owns']], effort: 2, lead: 'two-weeks', priority: 1, requires: { childSchool: ANY } }),
  shared({ id: 'supply-lists', title: 'Find each supply list and buy what’s missing', doneMeans: 'Each child’s list is checked off, and what’s left is bought.', for: 'adult', effort: 3, lead: 'two-weeks', priority: 2, requires: { childSchool: AWAY } }),
  shared({ id: 'homeschool-week', title: 'Plan the first homeschool week and gather materials', doneMeans: 'Week one’s lessons are picked and the books and supplies are on the shelf.', for: 'adult', effort: 4, lead: 'two-weeks', priority: 2, requires: { childSchool: ['homeschool'] } }),
  shared({ id: 'school-forms', title: 'Fill out and return school forms', doneMeans: 'Emergency contacts, health, pickup and photo forms are in before the first day.', for: 'adult', effort: 3, lead: 'two-weeks', priority: 3, requires: { childSchool: AWAY } }),
  shared({ id: 'school-rides', title: 'Settle each child’s drop-off and pick-up plan', doneMeans: 'Everyone knows who drives, which days, and the backup when that person can’t.', for: 'adult', effort: 2, lead: 'one-week', priority: 4, requires: { childSchool: AWAY } }),
  shared({ id: 'earlier-bedtimes', title: 'Move bedtimes earlier, 15 minutes every few nights', doneMeans: 'By the first day, bedtime is school-night bedtime.', for: 'adult', effort: 2, lead: 'two-weeks', priority: 5, requires: { childSchool: ANY } }),
  shared({ id: 'backpack-station', title: 'Reset the backpack station by the door', doneMeans: 'A hook or bin per child, a spot for shoes, and an inbox for papers that need a grown-up.', for: 'anyone', minAge: 9, levels: [[9, 'with-check'], [12, 'owns']], effort: 2, lead: 'one-week', priority: 6, illustration: 'pack-my-backpack', requires: { childSchool: AWAY } }),
  shared({ id: 'health-forms', title: 'Check the physical and vaccine forms the school needs', doneMeans: 'Appointments are booked or the forms are already in.', for: 'adult', effort: 2, lead: 'two-weeks', priority: 7, requires: { childSchool: AWAY } }),
  shared({ id: 'first-week-lunches', title: 'Plan the first week of lunches and stock up', doneMeans: 'Five lunches planned and the food is in the house.', for: 'anyone', minAge: 13, levels: [[13, 'with-check'], [15, 'owns']], effort: 2, lead: 'one-week', priority: 8, requires: { childSchool: SCHOOL } }),
  shared({ id: 'meet-the-teacher', title: 'Go to meet-the-teacher or orientation', doneMeans: 'The date is on the calendar and someone’s going.', for: 'adult', effort: 2, lead: 'one-week', requires: { childSchool: AWAY } }),
  shared({ id: 'first-day-photo', title: 'Take the first-day photo', doneMeans: 'One photo per child, before the rush out the door.', for: 'anyone', minAge: 10, levels: [[10, 'owns']], effort: 1, lead: 'first-day', core: false, requires: { childSchool: ANY } }),

  // Each child's own prep, by age and school type.
  prep({ id: 'try-on-clothes', title: 'Try on school clothes and shoes', doneMeans: 'Too small goes in the donate bag; what’s missing goes on the list.', minAge: 3, levels: [[3, 'learning'], [6, 'with-check'], [10, 'owns']], lead: 'two-weeks', priority: 11, illustration: 'put-clothes-away', requires: { childSchool: ANY } }),
  prep({ id: 'backpack-and-supplies', title: 'Empty last year’s backpack and check my supplies', doneMeans: 'Old papers out, supplies checked against the list, missing things written down.', minAge: 7, levels: [[7, 'with-check'], [10, 'owns']], lead: 'two-weeks', priority: 12, illustration: 'tidy-my-desk', requires: { childSchool: SCHOOL } }),
  prep({ id: 'label-my-things', title: 'Label my backpack, lunchbox and water bottle', doneMeans: 'My name is on everything that leaves the house.', minAge: 4, maxAge: 8, levels: [[4, 'learning'], [7, 'with-check']], lead: 'one-week', illustration: 'pack-my-backpack', requires: { childSchool: AWAY } }),
  prep({ id: 'practice-school-morning', title: 'Practice the school morning twice', doneMeans: 'Up, dressed, breakfast and out the door on time, two practice runs.', minAge: 4, maxAge: 7, levels: [[4, 'learning'], [6, 'with-check']], lead: 'one-week', priority: 10, illustration: 'get-dressed', requires: { childSchool: AWAY } }),
  prep({ id: 'practice-drop-off', title: 'Practice drop-off: a quick hug and a wave', doneMeans: 'We’ve talked through the goodbye and tried it once.', minAge: 2, maxAge: 5, levels: [[2, 'learning']], lead: 'one-week', priority: 10, requires: { childSchool: ['preschool'] } }),
  prep({ id: 'my-school-spot', title: 'Set up my school spot', doneMeans: 'A place for my books, pencils and today’s work.', minAge: 4, levels: [[4, 'learning'], [7, 'with-check'], [10, 'owns']], lead: 'one-week', priority: 10, illustration: 'tidy-my-desk', requires: { childSchool: ['homeschool'] } }),
  prep({ id: 'class-schedule', title: 'Look up my class schedule, bus and locker', doneMeans: 'I know where I’m going on day one and how I’m getting there.', minAge: 11, levels: [[11, 'with-check'], [13, 'owns']], lead: 'one-week', priority: 10, requires: { childSchool: SCHOOL } }),
  prep({ id: 'my-own-alarm', title: 'Set my own alarm and test it', doneMeans: 'It goes off at the school-day time, and I get up on it.', minAge: 9, levels: [[9, 'with-check'], [11, 'owns']], lead: 'night-before', requires: { childSchool: ['public', 'private', 'homeschool'] } }),
  prep({ id: 'first-day-outfit', title: 'Pick out my first-day outfit', doneMeans: 'Clothes and shoes laid out the night before.', minAge: 3, maxAge: 10, levels: [[3, 'learning'], [6, 'owns']], lead: 'night-before', illustration: 'get-dressed', requires: { childSchool: AWAY } }),
  prep({ id: 'pack-the-night-before', title: 'Pack my backpack the night before', doneMeans: 'Packed and by the door before bed.', minAge: 5, levels: [[5, 'learning'], [7, 'with-check'], [9, 'owns']], lead: 'night-before', illustration: 'pack-my-backpack', requires: { childSchool: SCHOOL } }),
  prep({ id: 'excited-and-nervous', title: 'Share one hope and one worry about school', doneMeans: 'Said out loud at the school-year huddle.', minAge: 4, levels: [[4, 'owns']], lead: 'one-week', requires: { childSchool: ANY } }),
];

/** The School-Year Command Center: who owns rides, school email, lunches and papers for the year. */
const job = (item: Omit<KitItem, 'section' | 'scope'>): KitItem => ({ section: 'family', scope: 'household', ...item });
export const schoolCommand: KitItem[] = [
  job({ id: 'morning-drop-off', title: 'Morning drop-off', doneMeans: 'Out the door on time, and the backup knows when it’s their turn.', for: 'adult', frequency: 'weekdays', effort: 3, core: true, requires: { childSchool: AWAY } }),
  job({ id: 'afternoon-pick-up', title: 'Afternoon pick-up', doneMeans: 'There on time, or someone else is and the school knows.', for: 'adult', frequency: 'weekdays', effort: 3, core: true, requires: { childSchool: AWAY } }),
  job({ id: 'activity-driving', title: 'Driving to activities and practices', doneMeans: 'Every practice has a driver on the calendar before the week starts.', for: 'adult', frequency: 'weekly', effort: 3, core: true, requires: { childSchool: ANY } }),
  job({ id: 'school-messages', title: 'School emails, apps and the parent portal', doneMeans: 'Read, dates go on the calendar, anything to do goes to its owner.', for: 'adult', frequency: 'daily', effort: 2, core: true, requires: { childSchool: AWAY } }),
  job({ id: 'school-lunches', title: 'School lunches: plan, shop, pack or check', doneMeans: 'Lunch food is in the house and every school day has a lunch.', for: 'adult', frequency: 'weekdays', effort: 3, core: true, requires: { childSchool: SCHOOL } }),
  job({ id: 'school-papers', title: 'School papers: read, sign, return', doneMeans: 'The inbox is empty by bedtime.', for: 'adult', frequency: 'weekdays', effort: 2, core: true, requires: { childSchool: AWAY } }),
  job({ id: 'homeschool-plan', title: 'Plan the homeschool week and lessons', doneMeans: 'Next week’s lessons are ready by Sunday night.', for: 'adult', frequency: 'weekly', effort: 4, core: true, requires: { childSchool: ['homeschool'] } }),
  job({ id: 'sunday-planning', title: 'Sunday planning: next week on the family calendar', doneMeans: 'Practices, games, early dismissals and who’s driving are written in for the week.', for: 'anyone', minAge: 12, levels: [[12, 'with-check'], [14, 'owns']], frequency: 'weekly', effort: 2, core: true, requires: { childSchool: ANY } }),
  job({ id: 'sick-days', title: 'Sick days: who stays home or picks up', doneMeans: 'Decided the night before when someone’s not well, not at 7 a.m.', for: 'adult', frequency: 'as-needed', effort: 1, core: true, requires: { childSchool: ANY } }),
  job({ id: 'homework-check-in', title: 'Homework check-in after dinner', doneMeans: 'A quick look at what’s due tomorrow, not doing it for them.', for: 'anyone', minAge: 15, levels: [[15, 'owns']], frequency: 'weekdays', effort: 2, requires: { childSchool: SCHOOL } }),
  job({ id: 'school-events', title: 'Conferences, school events and volunteering', doneMeans: 'Signed up, on the calendar, and someone goes.', for: 'adult', frequency: 'as-needed', effort: 2, requires: { childSchool: AWAY } }),
  job({ id: 'gear-ready', title: 'Sports and activity gear ready the night before', doneMeans: 'Uniform, cleats and water bottle by the door.', for: 'anyone', minAge: 10, levels: [[10, 'with-check'], [12, 'owns']], frequency: 'weekly', effort: 1, requires: { childSchool: ANY } }),
];
