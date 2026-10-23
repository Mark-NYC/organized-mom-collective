/**
 * October kit: A Home That Works Together (docs/club/YEAR_ONE_CALENDAR.md → October; mailer in
 * docs/club/mailers/2027-10-home-works-together.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape, like August: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`): you shouldn't be the only one noticing what needs doing.
 * - The action (`action`, a plain checklist, no dates): Our Fall Home Reset, five little things, done in a weekend
 *   or across the month, with an optional helper on each line.
 * - The tool (`tool`): the site's chore chart (/chore-chart), opened inside the Club for the child she picks.
 * October resets the physical home and starts one owned job each; November (Our Family, Our Team) builds the
 * ongoing shared responsibilities. The family calendar says when; nothing here schedules.
 */
import type { KitConfig } from '../types';
import { routes } from '../../../routes';

const SLUG = '2027-10-home-works-together';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-10',
  theme: 'A Home That Works Together',
  subtitle: 'Little jobs. Shared responsibility. A home ready for the season ahead.',
  shift: 'Before the holidays, the family resets a few spaces together, and each person starts owning one job.',
  engine: 'responsibilities',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our Fall Home Reset',
    intro: 'Five little things to make home work better before the busy season.',
    items: [
      { text: 'Clear outgrown coats, shoes, and seasonal clothes.' },
      { text: 'Get the entryway ready for jackets, backpacks, and shoes.' },
      { text: 'Restock household essentials before colder weather.' },
      { text: 'Choose one cluttered area and reset it together.' },
      { text: 'Give each family member one job they can own this season.' },
    ],
    helperLabel: 'Who’s helping?',
    editable: true,
  },
  tool: {
    tool: 'chore-chart',
    title: 'Give everyone a job they can own',
    blurb: 'Choose one realistic responsibility for each family member. Make a simple chart so everyone knows their part.',
    cta: 'Make a Family Chore Chart',
    note: 'Optional. The wall calendar says when; the chart shows everyone their part.',
    // One job each, like the reset's fifth line; the full week of chores is a tap away in the chart.
    start: 'one-job',
  },
  printables: [
    { id: 'fall-reset', title: 'Our Fall Home Reset', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your October letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'Not the only one noticing',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'Someone in every home notices things. The jacket that doesn’t fit anymore. The shoes piling up by the door. The last roll of paper towels. If that someone is usually you, you’re not alone, and you don’t have to be the only one.',
        'A family works better when everyone knows what they can contribute. Not because someone asked them to help, but because a job is theirs.',
        'October is a good time to start. The holidays aren’t here yet, and a few small changes now make November and December lighter. The Fall Home Reset below is five little things. Do them in one weekend or spread them across the month, and put a name beside each one.',
        'At dinner this week, or when you sit down with the family calendar, ask everyone: “What’s one thing around our home you think you could take care of without being reminded?” Then let them.',
        'Here’s to a home that works together.',
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'From Helping Mom to Owning a Job',
      intro: 'Helping means waiting to be asked. Owning a job means it’s yours from start to finish: you notice it needs doing, you do it, and you know when it’s done.',
      sections: [
        { heading: 'Start small.', body: 'Choose one responsibility the person can realistically manage.' },
        { heading: 'Make it clear.', body: 'Everyone should understand what “done” looks like.' },
        { heading: 'Let them own it.', body: 'Mom shouldn’t have to remember and remind every time. The job, and the remembering, are theirs.' },
      ],
    },
    story: {
      title: 'An eight-year-old owns the entryway',
      body: 'Every afternoon, shoes go in the basket and backpacks go on their hooks. Done means the floor by the door is clear before dinner. If it slips, the chore chart on the wall is the reminder, not Mom.',
    },
    conversation: {
      label: 'Ask at dinner this week',
      question: 'What’s one thing around our home you think you could take care of without being reminded?',
      note: 'Or when you sit down with the family calendar. Everyone answers, grown-ups too.',
      placement: 'after-example',
    },
    invite: {
      title: 'Make a Family Chore Chart',
      body: 'Scan the code for our chore chart: it starts with jobs that fit each child’s age, so everyone can see their part at a glance.',
    },
    calendarNote: 'Choose a time this month for your family reset. Put it on the wall calendar so everyone knows the plan.',
    screenNote: 'It comes in the mail with the same reset list. Use that copy as it is, or print the one above with your names on it. Either works; there’s nothing to keep in step.',
    letterLinkTop: true,
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
  related: [routes.choreChart],
};
