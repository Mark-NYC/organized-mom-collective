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
import { monthlyDeepClean } from '../../cleaning';
const springPrep = monthlyDeepClean.find((project) => project.month === 2)!;

const SLUG = '2027-03-spring-clean-together';
const QUESTION = 'What’s one space in our home we could make better together?';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-03',
  theme: 'Our Family Spring Prep',
  subtitle: 'Five familiar spring jobs, with a clear owner and a finish line for each.',
  shift: 'March teaches independent ownership rather than adding cleaning chores: each existing companion task includes its owner, supplies, get-ready cue, action and self-check.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our Family Spring Prep',
    intro: 'Five optional March tasks. One named owner, supplies and three clear steps for each: get ready, do the job, check it is done.',
    note: 'These are the same optional Spring Prep tasks in /app. Do one task on a weekend that fits, or skip it. Nobody has to finish all five.',
    items: springPrep.tasks.map((task) => ({ text: task.label })),
    helperLabel: 'This job is mine',
  },
  printables: [
    { id: 'spring-prep-family-plan', title: 'Our Family Spring Prep', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
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
      title: 'How We Hand Off a Job',
      sections: [
        { heading: 'Start with one room.', body: 'A visible win is more encouraging than an unfinished whole-house project.' },
        { heading: 'Give everyone a real job.', body: 'Give each job one age-appropriate owner and a clear finish line. Younger children own a smaller, safe part.' },
        { heading: 'Work in short sessions.', body: 'The owner gathers supplies, does the work, checks the result and puts supplies away. No ongoing tracking or reminders.' },
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
      title: 'Review Your Family Spring Prep Sheet',
      body: 'See suggested age-appropriate owners for the same five companion tasks, adjust names if needed, and print one sheet with supplies and three-step handoffs.'
    },
    calendarNote: 'Spring Prep is the same optional monthly project in /app. Choose one weekend task if it fits; no separate plan or deadline.',
    screenNote: 'This printable matches the companion’s March Spring Prep project. Printed checkmarks do not currently sync with /app.',
    letterLinkTop: true,
    accent: 'spring',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
