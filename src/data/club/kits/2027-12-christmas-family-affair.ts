/**
 * December kit: Christmas Is a Family Affair (docs/club/YEAR_ONE_CALENDAR.md → December; mailer in
 * docs/club/mailers/2027-12-christmas-family-affair.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape, like August and October: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`): you get to enjoy Christmas, too. Loving it doesn't mean carrying all of it.
 * - The action (`action`, a plain checklist, no dates): Our Family Christmas Plan, five decisions with an optional
 *   helper each. It works in late November or mid-December: already planned, it's a quick family check-in.
 * - The tool (`tool`): the Family Christmas Traditions Picker, a site tool opened inside the Club with the children's
 *   ages: three ideas, keep up to three.
 * December is about celebrating together and letting go of doing it all, not chores (that's October and November).
 * No Advent calendar, no countdown, no deadlines: the family calendar holds the plan, with room left open.
 */
import type { KitConfig } from '../types';

const SLUG = '2027-12-christmas-family-affair';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-12',
  theme: 'Christmas Is a Family Affair',
  subtitle: 'More together. Less on Mom.',
  shift: 'The family chooses what matters this Christmas and shares the work of making it happen, instead of Mom producing it for everyone.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our Family Christmas Plan',
    intro: 'Five little decisions to help everyone enjoy the season.',
    note: 'Already made your plans? Use this as a quick family check-in. Keep what matters, share what’s left, and let a few things go.',
    items: [
      { text: 'Choose what matters most.', detail: 'Pick two or three Christmas traditions your family really wants to enjoy.' },
      { text: 'Put the important dates on the calendar.', detail: 'Add gatherings, school events, church activities, and celebrations.' },
      { text: 'Share the gift preparations.', detail: 'Decide who’s handling shopping, wrapping, cards, and other gift-related jobs.' },
      { text: 'Choose one way to give together.', detail: 'Find a simple way to bless, serve, or encourage someone outside your household.' },
      { text: 'Share the Christmas-week jobs.', detail: 'Decide who can help with meals, preparing the house, and other responsibilities.' },
    ],
    helperLabel: 'Who’s helping?',
    editable: true,
  },
  tool: {
    tool: 'traditions-picker',
    title: 'Choose Your Christmas Traditions',
    blurb: 'Find two or three simple ways to make Christmas special together. We’ll suggest ideas that fit your family.',
    cta: 'Find Our Christmas Traditions',
    note: 'Optional. The plan works without it.',
  },
  printables: [
    { id: 'christmas-plan', title: 'Our Family Christmas Plan', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your December letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'You Get to Enjoy Christmas, Too',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'Christmas has a way of landing on one person. The gifts, the cards, the class party, the school concert, the cookies, the list of who’s coming for dinner. If that person is you, you probably love a lot of it. Much of the magic happens because you care.',
        'That’s worth keeping. But loving Christmas doesn’t mean carrying all of it. A Christmas the whole family makes together isn’t a lesser Christmas. It’s often a more meaningful one.',
        'A five-year-old can stir cookie dough and carry a plate to a neighbor. A ten-year-old can wrap gifts or plan a movie night. A partner can own a whole job, like the cards or the Christmas grocery list, without waiting to be asked.',
        'Below are five little decisions to make together. If your plans are already made, use them as a check-in: keep what matters, share what’s left, and let a few things go.',
        'At dinner this week, ask everyone: “What’s one thing we could each do to make Christmas special for someone else?”',
        'You get to enjoy Christmas, too.',
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'Making Christmas Together',
      sections: [
        { heading: 'Choose what matters.', body: 'Ask everyone which traditions they value most. You may discover that the simplest things matter more than elaborate plans.' },
        { heading: 'Share the preparations.', body: 'Give family members meaningful responsibilities from beginning to end, appropriate to their ages and abilities.' },
        { heading: 'Leave room to enjoy it.', body: 'Don’t fill every open day. Keep time for ordinary evenings, rest, and being together.' },
      ],
    },
    conversation: {
      label: 'Ask at dinner this week',
      question: 'What’s one thing we could each do to make Christmas special for someone else?',
      note: 'Everyone answers, grown-ups too. Then pick one or two to do together.',
    },
    invite: {
      title: 'Find Your Family’s Christmas Traditions',
      body: 'Scan the code for this month’s kit and our traditions picker. Tell it your children’s ages, the time you have and your budget, and it suggests three simple activities, each with a part a child can lead. Keep up to three, swap the rest, then print or copy them.',
    },
    calendarNote: 'Add your favorite traditions and important Christmas dates to the family wall calendar. Leave some open space, too.',
    screenNote: 'It comes in the mail with the same plan. Use that copy as it is, or print the one above with your names on it. Either works; there’s nothing to keep in step.',
    letterLinkTop: true,
    accent: 'evergreen',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
