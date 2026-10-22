/**
 * August kit: Ready for the School Year (docs/club/YEAR_ONE_CALENDAR.md → August; mailer draft in
 * docs/club/mailers/2027-08-school-year.md). Planning-phase content: not published, not for sale.
 *
 * Three engine-filled parts, all on the responsibilities engine and the same edit layer as November:
 * - the School Launch Plan (`items`): each child's own prep for their school type and first day, plus shared prep
 *   with one owner each; the overview's first actions come from here (`priority`);
 * - morning and after-school routines (`itemSets.routines`): every step that fits each child, in order;
 * - the School-Year Command Center (`itemSets.command`): who owns rides, school email, lunches and papers, plus the
 *   family's recurring commitments.
 * School types come from the kit's school setup (src/lib/club/school.ts): never assumed the same for every child.
 */
import { routes } from '../../../routes';
import type { KitConfig, KitItem, SchoolType } from '../types';

const SLUG = '2027-08-school-year';

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
const step = (section: 'morning' | 'after-school', item: Omit<KitItem, 'for' | 'frequency' | 'effort' | 'section' | 'scope'>): KitItem => ({
  for: 'child', frequency: 'weekdays', effort: 1, section, scope: 'each', ...item,
});

/** The School Launch Plan. */
const launch: KitItem[] = [
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

/** Morning and after-school routines, in order. */
const routines: KitItem[] = [
  step('morning', { id: 'up-with-alarm', title: 'Up with my alarm', doneMeans: 'Up on the first alarm.', minAge: 8, levels: [[8, 'with-check'], [10, 'owns']], requires: { childSchool: ANY } }),
  step('morning', { id: 'up-and-good-morning', title: 'Up and good morning', doneMeans: 'Out of bed when the light’s on.', minAge: 2, maxAge: 7, levels: [[2, 'learning'], [5, 'with-check']], requires: { childSchool: ANY } }),
  step('morning', { id: 'get-dressed', title: 'Get dressed', doneMeans: 'Clothes from last night, on.', minAge: 3, maxAge: 12, levels: [[3, 'learning'], [5, 'with-check'], [7, 'owns']], illustration: 'get-dressed', requires: { childSchool: ANY } }),
  step('morning', { id: 'breakfast', title: 'Breakfast at the table', doneMeans: 'Eaten and my dishes to the counter.', minAge: 2, maxAge: 9, levels: [[2, 'learning'], [6, 'owns']], illustration: 'clear-the-table', requires: { childSchool: ANY } }),
  step('morning', { id: 'brush-teeth-am', title: 'Brush my teeth', doneMeans: 'Two minutes.', minAge: 3, maxAge: 12, levels: [[3, 'learning'], [5, 'with-check'], [7, 'owns']], illustration: 'brush-my-teeth', requires: { childSchool: ANY } }),
  step('morning', { id: 'comb-hair', title: 'Comb my hair', doneMeans: 'Brushed before shoes go on.', minAge: 4, maxAge: 6, levels: [[4, 'learning'], [6, 'with-check']], illustration: 'comb-my-hair', requires: { childSchool: ANY } }),
  step('morning', { id: 'make-bed-am', title: 'Make my bed', doneMeans: 'Covers up, pillow back.', minAge: 5, maxAge: 12, levels: [[5, 'learning'], [7, 'owns']], illustration: 'make-my-bed', requires: { childSchool: ANY } }),
  step('morning', { id: 'by-the-door', title: 'Backpack, lunch, shoes and coat by the door', doneMeans: 'Ready to grab five minutes before we leave.', minAge: 4, levels: [[4, 'learning'], [6, 'with-check'], [8, 'owns']], illustration: 'pack-my-backpack', requires: { childSchool: AWAY } }),
  step('morning', { id: 'at-school-spot', title: 'Ready at my school spot', doneMeans: 'Books and pencils out when lessons start.', minAge: 5, levels: [[5, 'learning'], [8, 'owns']], illustration: 'tidy-my-desk', requires: { childSchool: ['homeschool'] } }),
  step('morning', { id: 'check-the-calendar', title: 'Check today on the family calendar', doneMeans: 'I know what’s after school and who’s driving.', minAge: 9, levels: [[9, 'with-check'], [11, 'owns']], requires: { childSchool: ANY } }),

  step('after-school', { id: 'wash-hands-pm', title: 'Wash my hands', doneMeans: 'Soap, then snack.', minAge: 2, maxAge: 6, levels: [[2, 'learning'], [5, 'owns']], illustration: 'wash-my-hands', requires: { childSchool: ANY } }),
  step('after-school', { id: 'unpack-backpack', title: 'Lunchbox to the sink, backpack on its hook', doneMeans: 'Unpacked before anything else.', minAge: 4, levels: [[4, 'learning'], [6, 'with-check'], [8, 'owns']], illustration: 'pack-my-backpack', requires: { childSchool: AWAY } }),
  step('after-school', { id: 'papers-to-inbox', title: 'School papers in the inbox for a grown-up', doneMeans: 'Anything to sign goes in the inbox the day it comes home.', minAge: 7, levels: [[7, 'with-check'], [9, 'owns']], requires: { childSchool: SCHOOL } }),
  step('after-school', { id: 'snack', title: 'Snack', doneMeans: 'From the snack spot, wrapper in the trash.', minAge: 2, maxAge: 9, levels: [[2, 'learning'], [5, 'owns']], requires: { childSchool: ANY } }),
  step('after-school', { id: 'school-things-away', title: 'Put my school things away', doneMeans: 'Books and work back at my school spot.', minAge: 4, levels: [[4, 'learning'], [7, 'owns']], illustration: 'tidy-my-desk', requires: { childSchool: ['homeschool'] } }),
  step('after-school', { id: 'homework', title: 'Homework at my spot', doneMeans: 'Done before screens.', minAge: 7, levels: [[7, 'with-check'], [10, 'owns']], illustration: 'tidy-my-desk', requires: { childSchool: SCHOOL } }),
  step('after-school', { id: 'read-twenty', title: 'Read for 20 minutes', doneMeans: 'A book of my choice.', minAge: 7, maxAge: 8, levels: [[7, 'with-check']], requires: { childSchool: ANY } }),
  step('after-school', { id: 'toys-back', title: 'Toys back in their bins', doneMeans: 'Before dinner.', minAge: 2, maxAge: 6, levels: [[2, 'learning'], [5, 'with-check']], illustration: 'put-toys-away', requires: { childSchool: ANY } }),
  step('after-school', { id: 'pack-for-tomorrow', title: 'Pack my backpack for tomorrow', doneMeans: 'Packed and by the door before bed.', minAge: 7, levels: [[7, 'with-check'], [9, 'owns']], illustration: 'pack-my-backpack', requires: { childSchool: SCHOOL } }),
  step('after-school', { id: 'pack-my-lunch', title: 'Pack my lunch for tomorrow', doneMeans: 'In the fridge, ready to grab.', minAge: 10, levels: [[10, 'with-check'], [12, 'owns']], requires: { childSchool: SCHOOL } }),
  step('after-school', { id: 'clothes-for-tomorrow', title: 'Lay out tomorrow’s clothes', doneMeans: 'Picked and on the chair.', minAge: 4, maxAge: 10, levels: [[4, 'learning'], [6, 'owns']], illustration: 'get-dressed', requires: { childSchool: ANY } }),
];

/** The School-Year Command Center: who owns the school jobs. Recurring commitments are her own rows. */
const job = (item: Omit<KitItem, 'section' | 'scope'>): KitItem => ({ section: 'family', scope: 'household', ...item });
const command: KitItem[] = [
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

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-08',
  theme: 'Ready for the School Year',
  shift: 'School starts with a plan everyone can see, and every child owns part of it.',
  engine: 'responsibilities',
  engineVersion: 1,
  setup: 'school',
  overview: {
    from: 'items',
    intro: 'We’ve planned your family’s school launch from your kids’ ages and schools. Start with these; the rest is here when you want it.',
    minActions: 5,
    maxActions: 8,
  },
  items: launch,
  itemSets: { routines, command },
  printables: [
    {
      id: 'school-launch', title: 'Our School Launch', tabLabel: 'Launch plan', page: 'letter-portrait', kind: 'flagship', component: 'LaunchChecklist', items: 'items',
    },
    {
      id: 'school-routines', title: 'School-Day Routines', tabLabel: 'Routines', page: 'letter-portrait', kind: 'worksheet', component: 'RoutineCards', items: 'routines', editor: 'routine',
    },
    {
      id: 'command-center',
      title: 'School-Year Command Center',
      tabLabel: 'Command center',
      page: 'letter-landscape',
      kind: 'worksheet',
      component: 'CommandCenter',
      items: 'command',
      editor: 'command',
      content: {
        intro: 'Ten minutes on Sunday, together. Then the wall calendar does the remembering.',
        items: [
          'Write next week’s practices, games and early dismissals on the family calendar.',
          'Name a driver for every ride, and a backup.',
          'Empty the school-paper inbox: sign, return, put dates on the calendar.',
          'Plan dinners and lunches around the busy nights.',
          'Check gear, uniforms and library books.',
          'Ask everyone: what’s one thing next week we need a hand with?',
        ],
      },
    },
    {
      id: 'school-guide', title: 'Ready for the School Year', tabLabel: 'Back-to-school guide', page: 'letter-portrait', kind: 'worksheet', component: 'Guide', secondary: true,
    },
    {
      id: 'school-huddle',
      title: 'The School-Year Huddle',
      tabLabel: 'Family huddle',
      page: 'letter-portrait',
      kind: 'activity',
      component: 'ConversationCard',
      secondary: true,
      content: {
        intro: 'About 20 minutes, everyone together, a few days before school starts.',
        items: [],
        lineLabel: 'The school-year job I’ll own',
      },
    },
    {
      id: 'backpack-station',
      title: 'Backpack Station Reset',
      tabLabel: 'Backpack station',
      page: 'letter-portrait',
      kind: 'worksheet',
      component: 'Checklist',
      secondary: true,
      content: {
        intro: 'Twenty minutes by the door, so mornings stop starting with “Where’s my…?”',
        items: [
          'Clear the drop zone: everything off the hooks, the bench and the floor.',
          'One hook or bin per child, with their name on it.',
          'A shoe spot everyone can reach, even the littlest.',
          'A paper inbox for anything a grown-up has to sign.',
          'Lunchboxes go to the sink after school, not back in the bag.',
          'Every night: backpacks packed and on their hooks before bed.',
          'Sunday: empty the inbox and check the bins during planning.',
        ],
      },
    },
  ],
  mailer: {
    // Megan writes this, in her own words. Nothing here may stand in for it.
    letter: null,
    fieldGuide: {
      title: 'Ready for the School Year',
      sections: [
        { heading: 'Start two weeks out', body: 'Forms, supply lists and bedtimes take longer than the night before allows. Two weeks gives you room for the things that need a store, a doctor or a signature.' },
        { heading: 'Give each child their own launch list', body: 'A five-year-old can try on shoes and pick a first-day outfit. A ten-year-old can check their own supplies. Their list is theirs, so the getting-ready isn’t all yours.' },
        { heading: 'Hand off whole school jobs', body: 'Rides, school email, lunches and papers each get one owner for the year, start to finish. “Can you grab the kids today?” every morning is still you running it.' },
        { heading: 'Practice the morning before it counts', body: 'Two practice runs before the first day show you where the morning sticks, while being late doesn’t matter yet.' },
        { heading: 'Make the week visible', body: 'Ten minutes on Sunday, everyone writes the week’s practices, early dismissals and drivers where the family can see them. Then fewer questions come to you.' },
        { heading: 'The first two weeks will wobble', body: 'Forgotten lunches and a missed form are normal. Keep the plan, fix one thing at the Sunday check-in, and let the routine settle.' },
      ],
    },
    activity: {
      title: 'The School-Year Huddle',
      minutes: 20,
      steps: [
        'Sit down together before the first day, with everyone’s launch list.',
        'Each person says one thing they’re excited about and one they’re nervous about. Nobody fixes anything yet.',
        'Read the school-year jobs out loud: rides, lunches, papers, the homework check-in. Each grown-up and older kid picks one to own.',
        'Each child picks one new thing they’ll do themselves this year.',
        'Agree where backpacks, shoes and school papers live.',
        'Write the first days and the first early dismissal on the family calendar together.',
      ],
    },
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
  related: [routes.backToSchool, routes.routineChart, routes.lunchSnackStation, routes.commandCenterSetup],
};
