/**
 * June kit: Summer With a Plan (docs/club/YEAR_ONE_CALENDAR.md → June; mailer in
 * docs/club/mailers/2027-06-summer-with-a-plan.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape with one intentional exception: two optional tools instead of one.
 * - The letter (`mailer.letter`): summer doesn't need a schedule for every hour; a few shared rhythms will do.
 * - The action (`action`, a plain checklist, no dates): Our Summer Family Agreement, four decisions, each with a line
 *   to write what the family chose.
 * - The toolkit (`toolkit`): two of the site's own tools, each opened inside the Club and each optional on its own:
 *   the routine chart's Summer type (the Summer Rhythm Builder, /routine-chart) and the screen time tool's family
 *   agreement (/screen-time-contract). No Club copies; improvements reach the public pages too.
 * June is ordinary summer days. Camps, trips and plans stay on the wall calendar; no summer planner, no activity
 * grid, no school-day routines (August), no connection plans (July).
 */
import type { KitConfig } from '../types';

const SLUG = '2027-06-summer-with-a-plan';
const QUESTION = 'What would make this summer really good for each of us?';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-06',
  theme: 'Summer With a Plan',
  subtitle: 'More freedom for the kids. Less managing for Mom.',
  shift: 'The family agrees on a few summer rhythms, screen expectations and jobs together, instead of Mom answering “what are we doing?” all day.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our Summer Family Agreement',
    intro: 'Four little decisions for a summer everyone can enjoy.',
    note: 'Sit down together for ten or fifteen minutes. Write what you decide on the lines; you can change it later.',
    items: [
      { text: 'Choose our daily anchors.', detail: 'Two or three predictable moments: getting ready, lunch, quiet reading or an evening reset. Not every hour.' },
      { text: 'Agree on screen-time expectations.', detail: 'When screens are available, what happens first, and how screen time ends.' },
      { text: 'Share summer responsibilities.', detail: 'A job for everyone that keeps going when school is out.' },
      { text: 'Choose something fun.', detail: 'Ask everyone what they’d love to do. Pick one realistic plan and put it on the calendar.' },
    ],
    helperLabel: 'We decided',
    helperPlacement: 'below',
  },
  toolkit: {
    title: 'Your Summer Toolkit',
    intro: 'Two optional tools. Each works on its own: use one, both, or neither. The agreement above works without them.',
    tools: [
      {
        tool: 'routine-chart',
        title: 'Summer Rhythm Builder',
        blurb: 'Create a simple daily rhythm that helps your kids know what to expect.',
        cta: 'Build Our Summer Rhythm',
        start: 'summer',
      },
      {
        tool: 'screen-time',
        title: 'Family Screen Time Agreement',
        blurb: 'Set clear expectations together so screens don’t become a daily argument.',
        cta: 'Make Our Screen Agreement',
        start: 'agreement',
      },
    ],
  },
  printables: [
    { id: 'summer-agreement', title: 'Our Summer Family Agreement', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your June letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'Summer Doesn’t Need a Schedule for Every Hour',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'There’s something wonderful about summer: later mornings, unhurried afternoons, an adventure nobody planned. That freedom is worth protecting.',
        'But summer can wear a family out when one person is expected to entertain everyone, manage the screens, settle the arguments and remind every child about every job, whether that person is home all day or fitting it around work.',
        'The answer isn’t a schedule for every hour. It’s a few simple rhythms everyone agrees on, so everyone knows what to expect.',
        'Kids can have freedom and still help keep the house running. They can enjoy screens and respect the limits you choose together. They can be bored for a while without anyone rushing to fix it.',
        'The four decisions below take about fifteen minutes together. The goal is a summer that works for the whole family, including Mom.',
        `At dinner this week, ask: “${QUESTION}”`,
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'A Little Structure. A Lot of Summer.',
      sections: [
        { heading: 'Keep a few predictable anchors.', body: 'Children benefit from knowing what to expect without needing every hour scheduled.' },
        { heading: 'Agree before the argument.', body: 'Discuss screens and household responsibilities together before conflicts arise.' },
        { heading: 'Leave room for boredom.', body: 'Children don’t need Mom to provide an activity every time they have nothing to do.' },
      ],
    },
    card: {
      title: 'When I’m Bored…',
      ideas: ['Read something', 'Make or draw something', 'Play outside', 'Build something', 'Help someone', 'Invite someone to play'],
    },
    tip: {
      title: 'Before the summer adventures begin',
      body: 'Check water bottles, sunscreen, swim gear, and the supplies your family regularly takes outdoors.',
    },
    invite: {
      title: 'Your Summer Toolkit',
      body: 'Two optional tools on this month’s page. Scan the code; use either one, or both.',
      tools: [
        { title: 'Build Your Summer Rhythm', body: 'A simple daily flow that fits your family’s summer.' },
        { title: 'Make Your Family Screen Agreement', body: 'Agree on screen-time expectations before the daily negotiations begin.' },
      ],
    },
    calendarNote: 'Add camps, activities, trips, and family plans to your calendar. Let the summer rhythm handle the ordinary days in between.',
    screenNote: 'It comes in the mail with the same agreement. Use that copy as it is, or print the one above with what you decided on it. Either works; there’s nothing to keep in step.',
    letterLinkTop: true,
    accent: 'summer',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
