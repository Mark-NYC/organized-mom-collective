/**
 * March kit: Spring Clean as a Team (docs/club/YEAR_ONE_CALENDAR.md → March; mailer in
 * docs/club/mailers/2027-03-spring-clean-together.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape, like the other three-part kits: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`): this house belongs to all of us; taking care of it can, too.
 * - The action (`action`, a plain checklist, no dates): Our One-Room Family Reset, five steps, with the space and
 *   when written above them (`action.focus` with `whenLabel`) and an optional helper on each step.
 * - The tool (`tool`): the Family Spring Cleaning Builder, a site tool opened inside the Club with the family's first
 *   names and children's ages and the room she chose: safe jobs for each person, in time-boxed sessions.
 * March is one seasonal cleaning project, done together. Not ongoing chores (October and November), and not the wall
 * calendar's own cleaning zones or monthly projects: it divides the work of one of them.
 */
import type { KitConfig } from '../types';
import { cleaningRooms } from '../../spring-cleaning';

const SLUG = '2027-03-spring-clean-together';
const QUESTION = 'What’s one space in our home we could make better together?';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-03',
  theme: 'Spring Clean as a Team',
  subtitle: 'Less cleaning for Mom. More helping hands.',
  shift: 'The family resets one room together in a short session, everyone with a real job, instead of Mom spending the weekend cleaning alone.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our One-Room Family Reset',
    intro: 'One room. Thirty minutes. Everyone has a part.',
    note: 'Thirty minutes is a starting point. With little ones, try 15; if you want more, do another room another day. One room is enough.',
    items: [
      { text: 'Choose one room or shared space.' },
      { text: 'Have everyone choose one job they can handle.' },
      { text: 'Set a timer for 30 minutes.' },
      { text: 'Work together and put things back where they belong.' },
      { text: 'Enjoy the result and decide if you want to tackle another space.' },
    ],
    helperLabel: 'Who’s helping?',
    focus: {
      label: 'Which room or space?',
      printLabel: 'The space we’re resetting',
      // The builder's own rooms, so the tool opens on the one she chose.
      suggestions: cleaningRooms.map((r) => ({ id: r.id, label: r.label })),
      suggestionsLabel: 'Rooms to choose from',
      whenLabel: 'When we’re doing it',
    },
  },
  tool: {
    tool: 'spring-cleaning',
    title: 'Make a Family Cleaning Plan',
    blurb: 'Tell us which rooms you want to tackle, who’s helping, and how much time you have. We’ll divide the work into manageable sessions.',
    cta: 'Build Our Cleaning Plan',
    note: 'Optional. The one-room reset works without it.',
  },
  printables: [
    { id: 'one-room-reset', title: 'Our One-Room Family Reset', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your March letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'This House Belongs to All of Us',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'Spring has a way of making you want to open every window, empty every closet and start fresh. That’s a good instinct. But getting the house ready for a new season shouldn’t mean one person spends the weekend cleaning while everyone else gets the weekend off.',
        'This house belongs to all of us. Taking care of it can belong to all of us, too.',
        'Everyone can do something real. A four-year-old can collect the toys and put the shoes where they go. A ten-year-old can dust the shelves and sort the books. A teenager can vacuum or change the sheets. The grown-ups take the jobs that need a step stool or a strong cleaner. Nobody has to do it perfectly.',
        'The reset below is one room, thirty minutes, and a part for everyone. With little ones, try fifteen. One room is enough.',
        `At dinner this week, ask: “${QUESTION}”`,
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'Your Spring Reset Field Guide',
      sections: [
        { heading: 'Start with one room.', body: 'A visible win is more encouraging than an unfinished whole-house project.' },
        { heading: 'Give everyone a real job.', body: 'Assign manageable responsibilities that people can complete with increasing independence.' },
        { heading: 'Work in short sessions.', body: 'Set a timer, work together, and stop when the session is finished.' },
      ],
    },
    checklist: {
      title: 'Not sure where to start?',
      note: 'Ideas for choosing a focus, not four more projects. Pick one, or none.',
      items: ['Outgrown clothes and shoes', 'Toys, games and books', 'Paperwork and school papers', 'Unused household items'],
    },
    conversation: {
      label: 'Ask at dinner this week',
      question: QUESTION,
      note: 'Everyone answers, grown-ups too. Then pick one space together.',
      placement: 'after-example',
    },
    invite: {
      title: 'Build Your Family Spring Cleaning Plan',
      body: 'Choose your rooms, who’s helping, and how much time you have. We’ll help divide the work: safe jobs for each person, in short sessions, one room per printed page. Scan the code, then tap “Build Our Cleaning Plan.”',
    },
    calendarNote: 'Choose one cleaning session and put it on your wall calendar so everyone knows when it’s happening.',
    screenNote: 'It comes in the mail with the same reset. Use that copy as it is, or print the one above with your room and names on it. Either works; there’s nothing to keep in step.',
    letterLinkTop: true,
    accent: 'spring',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
