/**
 * August kit: Ready for the School Year (docs/club/YEAR_ONE_CALENDAR.md → August; mailer in
 * docs/club/mailers/2027-08-school-year.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape every kit is moving to: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`), printed on the front of a double-sided Letter sheet.
 * - The action (`action`): a six-line Back-to-School Countdown, printed under the letter, checkable on screen.
 * - The tool (`tool`): a school-day routine chart per child, morning or after school, from `items` (4–6 steps).
 * The back of the letter teaches kids owning their routines, with an example from the tool's own rules.
 * The family calendar stays the plan; nothing here is a second one. The first draft's launch plan and command center
 * live on in src/data/club/libraries/school-year.ts.
 */
import type { KitConfig, KitItem, SchoolType } from '../types';
import { routes } from '../../../routes';

const SLUG = '2027-08-school-year';

/** Goes to a school building (backpacks, school papers). */
const SCHOOL: SchoolType[] = ['public', 'private'];
const AWAY: SchoolType[] = ['public', 'private', 'preschool'];
const ANY: SchoolType[] = ['public', 'private', 'homeschool', 'preschool'];

const step = (section: 'morning' | 'after-school', item: Omit<KitItem, 'for' | 'frequency' | 'effort' | 'section' | 'scope'>): KitItem => ({
  for: 'child', frequency: 'weekdays', effort: 1, section, scope: 'each', ...item,
});

/**
 * School-day routine steps, in routine order. A child gets the (at most) six that fit their age and school with the
 * lowest `priority`; the rest are one tap away. School types are guessed from age and the family's homeschool
 * preference: 3–4 preschool, 5–17 school.
 */
const routines: KitItem[] = [
  step('morning', { id: 'up-and-good-morning', title: 'Up and good morning', doneMeans: 'Out of bed when the light’s on.', minAge: 2, maxAge: 3, priority: 8, levels: [[2, 'learning']], requires: { childSchool: ANY } }),
  step('morning', { id: 'up-with-alarm', title: 'Up with my alarm', doneMeans: 'Up on the first alarm.', minAge: 9, priority: 4, levels: [[9, 'with-check'], [11, 'owns']], requires: { childSchool: ANY } }),
  step('morning', { id: 'get-dressed', title: 'Get dressed', doneMeans: 'Clothes from last night, on.', minAge: 3, maxAge: 12, priority: 1, levels: [[3, 'learning'], [5, 'with-check'], [7, 'owns']], illustration: 'get-dressed', requires: { childSchool: ANY } }),
  step('morning', { id: 'make-bed-am', title: 'Make my bed', doneMeans: 'Covers up, pillow back.', minAge: 5, maxAge: 12, priority: 5, levels: [[5, 'learning'], [7, 'owns']], illustration: 'make-my-bed', requires: { childSchool: ANY } }),
  step('morning', { id: 'breakfast', title: 'Breakfast at the table', doneMeans: 'Eaten and my dishes to the counter.', minAge: 2, priority: 2, levels: [[2, 'learning'], [6, 'owns']], illustration: 'clear-the-table', requires: { childSchool: ANY } }),
  step('morning', { id: 'brush-teeth-am', title: 'Brush my teeth', doneMeans: 'Two minutes.', minAge: 3, maxAge: 12, priority: 3, levels: [[3, 'learning'], [5, 'with-check'], [7, 'owns']], illustration: 'brush-my-teeth', requires: { childSchool: ANY } }),
  step('morning', { id: 'comb-hair', title: 'Comb my hair', doneMeans: 'Brushed before shoes go on.', minAge: 3, maxAge: 8, priority: 7, levels: [[3, 'learning'], [6, 'with-check'], [8, 'owns']], illustration: 'comb-my-hair', requires: { childSchool: ANY } }),
  step('morning', { id: 'by-the-door', title: 'Backpack, lunch and shoes by the door', doneMeans: 'Ready to grab five minutes before we leave.', minAge: 4, priority: 2, levels: [[4, 'learning'], [6, 'with-check'], [8, 'owns']], illustration: 'pack-my-backpack', requires: { childSchool: AWAY } }),
  step('morning', { id: 'at-school-spot', title: 'Ready at my school spot', doneMeans: 'Books and pencils out when lessons start.', minAge: 5, priority: 2, levels: [[5, 'learning'], [8, 'owns']], illustration: 'tidy-my-desk', requires: { childSchool: ['homeschool'] } }),
  step('morning', { id: 'check-the-calendar', title: 'Check today on the family calendar', doneMeans: 'I know what’s after school and who’s driving.', minAge: 9, priority: 5, levels: [[9, 'with-check'], [11, 'owns']], requires: { childSchool: ANY } }),

  step('after-school', { id: 'unpack-backpack', title: 'Lunchbox to the sink, backpack on its hook', doneMeans: 'Unpacked before anything else.', minAge: 3, priority: 1, levels: [[3, 'learning'], [6, 'with-check'], [8, 'owns']], illustration: 'pack-my-backpack', requires: { childSchool: AWAY } }),
  step('after-school', { id: 'school-things-away', title: 'Put my school things away', doneMeans: 'Books and work back at my school spot.', minAge: 4, priority: 1, levels: [[4, 'learning'], [7, 'owns']], illustration: 'tidy-my-desk', requires: { childSchool: ['homeschool'] } }),
  step('after-school', { id: 'wash-hands-pm', title: 'Wash my hands', doneMeans: 'Soap, then snack.', minAge: 2, maxAge: 8, priority: 2, levels: [[2, 'learning'], [5, 'owns']], illustration: 'wash-my-hands', requires: { childSchool: ANY } }),
  step('after-school', { id: 'snack', title: 'Snack', doneMeans: 'From the snack spot, wrapper in the trash.', minAge: 2, priority: 3, levels: [[2, 'learning'], [5, 'owns']], requires: { childSchool: ANY } }),
  step('after-school', { id: 'papers-to-inbox', title: 'School papers in the inbox for a grown-up', doneMeans: 'Anything to sign goes in the inbox the day it comes home.', minAge: 7, priority: 4, levels: [[7, 'with-check'], [9, 'owns']], requires: { childSchool: SCHOOL } }),
  step('after-school', { id: 'homework', title: 'Homework at my spot', doneMeans: 'Done before screens.', minAge: 7, priority: 2, levels: [[7, 'with-check'], [10, 'owns']], illustration: 'tidy-my-desk', requires: { childSchool: SCHOOL } }),
  step('after-school', { id: 'read-twenty', title: 'Read for 20 minutes', doneMeans: 'A book of my choice.', minAge: 6, maxAge: 12, priority: 6, levels: [[6, 'with-check'], [8, 'owns']], requires: { childSchool: ANY } }),
  step('after-school', { id: 'toys-back', title: 'Toys back in their bins', doneMeans: 'Before dinner.', minAge: 2, maxAge: 6, priority: 4, levels: [[2, 'learning'], [5, 'with-check']], illustration: 'put-toys-away', requires: { childSchool: ANY } }),
  step('after-school', { id: 'clothes-for-tomorrow', title: 'Lay out tomorrow’s clothes', doneMeans: 'Picked and on the chair.', minAge: 3, maxAge: 10, priority: 5, levels: [[3, 'learning'], [6, 'owns']], illustration: 'get-dressed', requires: { childSchool: ANY } }),
  step('after-school', { id: 'pack-for-tomorrow', title: 'Pack my backpack for tomorrow', doneMeans: 'Packed and by the door before bed.', minAge: 7, priority: 3, levels: [[7, 'with-check'], [9, 'owns']], illustration: 'pack-my-backpack', requires: { childSchool: SCHOOL } }),
  step('after-school', { id: 'my-family-job', title: 'Do my family job', doneMeans: 'The one job that’s mine this week, done before dinner.', minAge: 6, priority: 5, levels: [[6, 'with-check'], [9, 'owns']], illustration: 'set-the-table', requires: { childSchool: ANY } }),
  step('after-school', { id: 'tomorrow-on-the-calendar', title: 'Look at tomorrow on the family calendar', doneMeans: 'I know what’s on tomorrow and what I need for it.', minAge: 9, priority: 6, levels: [[9, 'with-check'], [11, 'owns']], requires: { childSchool: ANY } }),
  step('after-school', { id: 'pack-my-lunch', title: 'Pack my lunch for tomorrow', doneMeans: 'In the fridge, ready to grab.', minAge: 10, priority: 5, levels: [[10, 'with-check'], [12, 'owns']], requires: { childSchool: SCHOOL } }),
];

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-08',
  theme: 'Ready for the School Year',
  subtitle: 'One calmer start. Everyone has a part.',
  shift: 'Get ready for school together, with the plan on the family calendar, instead of Mom getting everyone ready.',
  engine: 'responsibilities',
  engineVersion: 2,
  setup: 'school',
  items: routines,
  action: {
    title: 'Our Back-to-School Countdown',
    intro: 'Six things, done together in the weeks before school starts. Write a name beside each one, and let it be someone other than Mom when you can.',
    items: [
      'Add school dates and activities to the family calendar.',
      'Check clothes, shoes and school supplies.',
      'Set up a place for backpacks and school papers.',
      'Decide who’s handling drop-off and pick-up.',
      'Practice morning and after-school routines.',
      'Pack bags and get everything ready the night before.',
    ],
    helperLabel: 'Who’s helping?',
  },
  tool: {
    printable: 'school-routines',
    title: 'Make your kids’ school-day routines',
    blurb: 'A picture chart for each child, morning or after school. We suggest four to six steps for their age; change anything, then print it for where it happens.',
    cta: 'Make a routine chart',
  },
  printables: [
    { id: 'school-routines', title: 'School-Day Routine', tabLabel: 'Routine charts', page: 'letter-portrait', kind: 'flagship', component: 'RoutineChart', items: 'items', editor: 'routine' },
    { id: 'countdown', title: 'Our Back-to-School Countdown', page: 'letter-portrait', kind: 'worksheet', component: 'Countdown' },
    { id: 'letter', title: 'Your August letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'Before the first bell',
      greeting: 'Hi friend,',
      body: [
        'Back-to-school has a way of landing on one person. The forms, the supply lists, the shoes that suddenly don’t fit, the question of who’s driving on Tuesday. If that person is usually you, this letter is for you.',
        'This year, try getting ready together. Not you preparing everyone, but everyone preparing a little. A six-year-old can try on shoes and lay out an outfit. A ten-year-old can pack their own backpack. A partner can own drop-off, start to finish.',
        'The countdown below is six things, not sixty. Put the school dates on the family calendar where everyone can see them, then work down the list together. Write a name beside each one.',
        'And start small. One routine that sticks by October is worth more than five perfect ones that fall apart in week two. The wobbly first weeks are normal.',
        'You don’t have to carry the school year alone. Everyone has a part.',
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'Helping kids own their school day',
      sections: [
        { heading: 'Four to six steps', body: 'Short enough to remember, long enough to matter. A longer chart turns into one more thing you have to enforce.' },
        { heading: 'Pictures first', body: 'Early readers follow the pictures. Older kids check their own boxes. Either way, the chart does the reminding, not you.' },
        { heading: 'Ask “What’s next?”', body: 'When a step gets missed, point to the chart instead of giving the instruction. They look; they find it; it stays theirs.' },
        { heading: 'Practice before it counts', body: 'Run the morning twice before the first day, while being late doesn’t matter yet. Change the step that sticks.' },
      ],
    },
    example: { title: 'A school morning for a seven-year-old', age: 7, section: 'morning', items: 'items' },
    invite: {
      title: 'Make a chart for each of your kids',
      body: 'Scan the code, pick a child and morning or after school. We suggest steps for their age; change any of them, then print.',
    },
    calendarNote: 'Before the first day, write every first day, early dismissal and school break on your family calendar, where everyone can see them.',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
  related: [routes.routineChart, routes.backToSchool],
};
