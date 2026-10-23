/**
 * February kit: Better Together (docs/club/YEAR_ONE_CALENDAR.md → February; mailer in
 * docs/club/mailers/2027-02-better-together.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape, like January, August, October and December: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`): make room for each other. Organizing is for the people, not for getting more done.
 * - The action (`action`, a plain checklist, no dates): Our Family Connection Challenge, three things, each with an
 *   optional "Our idea" line under it (`helperPlacement: 'below'`). The shared-space reset is small and supporting,
 *   tied to a cleaning zone the wall calendar already has.
 * - The tool (`tool`): the Family Connection Planner, a site tool opened inside the Club with the children's ages and
 *   the family's first names: three ideas (a family moment, a one-on-one moment, a simple rhythm); choose one.
 * February is about connection. Not a chore or routine kit; no scores, streaks, reminders or month-long challenge.
 */
import type { KitConfig } from '../types';

const SLUG = '2027-02-better-together';
const QUESTION = 'What’s something you’d love for us to do together more often?';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-02',
  theme: 'Better Together',
  subtitle: 'Less managing life. More enjoying it together.',
  shift: 'The family makes room to enjoy each other, with everyone suggesting and sharing the moments, instead of Mom running every outing.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our Family Connection Challenge',
    intro: 'Three little ways to enjoy each other more this month.',
    items: [
      { text: 'Do something together.', detail: 'Choose one simple activity the whole family can enjoy, like a board game, a walk or cooking dinner. It can be free.' },
      { text: 'Make time for one-on-one.', detail: 'Fifteen minutes with one child or family member counts. Every grown-up takes a turn, not just Mom.' },
      { text: 'Make a shared space more inviting.', detail: 'Reset one spot together, like the living room floor or the game shelf, on that room’s cleaning-zone day.' },
    ],
    helperLabel: 'Our idea',
    helperPlacement: 'below',
  },
  tool: {
    tool: 'connection-planner',
    title: 'Find Your Family’s Connection Moment',
    blurb: 'Simple ideas that fit your family’s ages, time and budget, each with a way to share it, so the planning isn’t all on you.',
    cta: 'Find Something to Do Together',
    note: 'Optional. The challenge works without it.',
  },
  printables: [
    { id: 'connection-challenge', title: 'Our Family Connection Challenge', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your February letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes; if she wants a
    // story of her own, it goes in place of the third paragraph.
    letter: {
      draft: true,
      title: 'Make Room for Each Other',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'It’s possible to spend a whole day caring for your family without really getting to enjoy them. Meals, rides, homework, laundry, bedtime. Everything keeps moving, and at the end of the day you realize you barely sat down together.',
        'That isn’t a failing. It’s what busy weeks do. But it’s also the reason we organize at all: not to get more done, but to make room for the people we love.',
        'Connection doesn’t need a vacation or a perfectly planned family night. It can be a conversation over dinner, fifteen minutes on the floor with one child, or laughing together while you clear the living room.',
        'And it doesn’t all have to come from you. You don’t need to be the family’s entertainment director. Ask everyone for ideas, and let them help make it happen.',
        'The challenge below is three small things. Do one, or all three, whenever they fit.',
        `At dinner this week, ask: “${QUESTION}”`,
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'Make Room for Connection',
      sections: [
        { heading: 'Make ordinary moments count.', body: 'Connection doesn’t always require special plans. Use moments already in the day.' },
        { heading: 'Let everyone contribute.', body: 'Ask children and other family members to suggest activities and help make them happen.' },
        { heading: 'Keep it simple enough to repeat.', body: 'A small family tradition that actually happens is better than an elaborate plan that never does.' },
      ],
    },
    conversation: {
      label: 'For dinner, the car, or a slow evening',
      question: QUESTION,
      prompts: [
        'What’s something that made you laugh this week?',
        QUESTION,
        'What’s one thing you appreciate about someone in our family?',
      ],
      note: 'Everyone answers, grown-ups too.',
      placement: 'after-example',
    },
    invite: {
      title: 'Family Connection Planner',
      body: 'Find simple activities that fit your family’s ages, time, and budget. Scan the code, then tap “Find Something to Do Together”: answer a few questions, choose one of three ideas, and print or copy your plan.',
    },
    calendarNote: 'Choose one moment to enjoy together this month. Put it on the calendar and let everyone help make it happen.',
    screenNote: 'It comes in the mail with the same challenge. Use that copy as it is, or print the one above with your ideas on it. Either works; there’s nothing to keep in step.',
    letterLinkTop: true,
    accent: 'blush',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
