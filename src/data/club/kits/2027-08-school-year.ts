/**
 * August kit: Ready for the School Year (docs/club/YEAR_ONE_CALENDAR.md → August; mailer in
 * docs/club/mailers/2027-08-school-year.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape every kit is moving to: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`), printed on the front of a double-sided Letter sheet.
 * - The action (`action`): a six-line Back-to-School Countdown, printed under the letter, checkable on screen.
 * - The tool (`tool`): the site's routine chart (/routine-chart), opened inside the Club for one child at a time with
 *   their name and age (src/data/club/tools.ts). No Club copy of it.
 * The back of the letter teaches kids owning their routines, with the routine chart's own morning starter.
 * The family calendar stays the plan; nothing here is a second one. The first draft's launch plan and command center
 * live on in src/data/club/libraries/school-year.ts.
 */
import type { KitConfig } from '../types';
import { routes } from '../../../routes';

const SLUG = '2027-08-school-year';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-08',
  theme: 'Ready for the School Year',
  subtitle: 'One calmer start. Everyone has a part.',
  shift: 'Get ready for school together, with the plan on the family calendar, instead of Mom getting everyone ready.',
  engine: 'responsibilities',
  engineVersion: 2,
  items: [],
  action: {
    title: 'Our Back-to-School Countdown',
    intro: 'Six things to get ready together. Not all at once, and not all by you: start with what matters most, and put a name beside each one.',
    items: [
      { text: 'Add school dates and activities to the family calendar.', daysBefore: 14 },
      { text: 'Check clothes, shoes and school supplies.', daysBefore: 10, essential: true },
      { text: 'Set up a place for backpacks and school papers.', daysBefore: 7 },
      { text: 'Decide who’s handling drop-off and pick-up.', daysBefore: 7, essential: true },
      { text: 'Practice morning and after-school routines.', daysBefore: 5 },
      { text: 'Pack bags and get everything ready the night before.', daysBefore: 1, essential: true },
    ],
    helperLabel: 'Who’s helping?',
  },
  tool: {
    tool: 'routine-chart',
    title: 'Make your kids’ school-day routines',
    blurb: 'A picture chart for each child, morning or after school, made with our routine chart: tap illustrated steps, put them in order, add times, then download it to print.',
    cta: 'Make a routine chart',
  },
  printables: [
    { id: 'countdown', title: 'Our Back-to-School Countdown', page: 'letter-portrait', kind: 'flagship', component: 'Countdown' },
    { id: 'letter', title: 'Your August letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'Before the first bell',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'Back-to-school has a way of landing on one person. The forms, the supply lists, the shoes that suddenly don’t fit, the question of who’s driving on Tuesday. If that person is usually you, this letter is for you.',
        'This year, try getting ready together. Not you preparing everyone, but everyone preparing a little. A six-year-old can try on shoes and lay out an outfit. A ten-year-old can pack their own backpack. A partner can own drop-off, start to finish.',
        'The countdown below is six things, not sixty. You don’t have to tackle all six at once. Start with what matters most, and share the jobs. Put the school dates on the family calendar first, where everyone can see them.',
        'And start small. One routine that sticks by October beats five perfect ones that fall apart in week two.',
        'You don’t have to carry the school year alone. Everyone has a part.',
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'Helping kids own their school day',
      sections: [
        { heading: 'Four to six steps.', body: 'Enough to matter, few enough to remember.' },
        { heading: 'Pictures first.', body: 'Early readers follow the pictures; the chart does the reminding, not you.' },
        { heading: 'Ask “What’s next?”', body: 'When a step gets missed, point to the chart instead of giving the instruction.' },
      ],
    },
    conversation: {
      label: 'Ask at dinner this week',
      question: 'What’s one thing you want to be able to do by yourself before school starts?',
      note: 'Everyone answers, grown-ups too.',
    },
    example: { title: 'A school morning to start from', variant: 'morning' },
    invite: {
      title: 'Dates worked out, charts for each child',
      body: 'Scan the code and enter your first day of school: we’ll suggest a day for each countdown item, then help you make a chart for each child. This page works fine without it.',
    },
    calendarNote: 'Before the first day, write every first day, early dismissal and school break on your family calendar, where everyone can see them.',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
  related: [routes.routineChart, routes.backToSchool],
};
