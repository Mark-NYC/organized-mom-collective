/**
 * November kit: Our Family, Our Team (docs/club/YEAR_ONE_CALENDAR.md → November; mailer in
 * docs/club/mailers/2026-11-family-ownership.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape: one letter, one action, one guide. November helps September's weekly rhythm stick and takes
 * the next step toward shared ownership, wherever the family is:
 * - The letter (`mailer.letter`): it's okay to start again.
 * - The action (`action`, three paths): Our Family's Next Step. The family circles where it is and writes one next
 *   step and when it'll try it. No chart, no new worksheets.
 * - The guide (`coach`): the Family Rhythm & Ownership Guide, a short guided conversation in the kit itself that ends
 *   in one plan: a first family meeting, a restart, shared leadership, or handing off one whole job.
 * - The bonus (`bonus`): September's kit, for members who weren't there for it. A link to the real kit, not a copy.
 *
 * The first November design, the Family Ownership Builder (a chart for everyone), is kept, unregistered, in
 * src/data/club/libraries/family-ownership-builder.ts. The guide still uses its job library for age-suited handoffs.
 */
import { routes } from '../../../routes';
import { ownershipJobs } from '../libraries/ownership-jobs';
import type { KitConfig } from '../types';

const SLUG = '2026-11-family-ownership';
const QUESTION = 'What’s one thing that would help our family work better together this week?';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2026-11',
  theme: 'Our Family, Our Team',
  subtitle: 'Make the plan together. Learn to share the load.',
  shift: 'Wherever your family is right now, take one next step together: a first meeting, an easier one to keep, or one whole job handed over.',
  engine: 'responsibilities',
  engineVersion: 2,
  // The ownership job library: the guide's handoff offers the version of a job that suits the person's age.
  items: ownershipJobs(),
  action: {
    kind: 'paths',
    title: 'Our Family’s Next Step',
    intro: 'You don’t need a perfect system. Just one useful next step. Circle the one that fits.',
    items: [],
    paths: [
      {
        label: 'We’re just getting started',
        step: 'Have one short family meeting.',
        lines: ['Choose a day and time.', 'Gather around the wall calendar.', 'Talk about what’s coming this week.', 'Let everyone add something.', 'Use September’s meeting guide if it helps.'],
      },
      {
        label: 'We started, but got off track',
        step: 'Make the meeting easier to repeat.',
        lines: ['Choose one change:', 'Put the meeting guide where everyone sees it.', 'Tie it to something you already do.', 'Make it shorter.', 'Give someone else a part in leading.'],
      },
      {
        label: 'We’re ready to share more ownership',
        step: 'Hand off one whole responsibility.',
        lines: ['Pick something an adult still manages alone.', 'Choose who can begin to own it.', 'Agree on what finished looks like.', 'Practice it together.', 'Then let them own it.'],
      },
    ],
    blanks: ['Our family’s next step', 'When we’ll try it'],
  },
  coach: {
    id: 'rhythm-ownership',
    title: 'Family Rhythm & Ownership Guide',
    intro: 'A few quick questions about how your family’s planning is going, then one next step made for your family, ready to print. About three minutes.',
    cta: 'Find Our Family’s Next Step',
  },
  bonus: {
    slug: '2027-09-a-week-everyone-can-see',
    title: 'Your Bonus: A Week Everyone Can See',
    blurb: 'A simple 15-minute family meeting guide to help everyone see the week ahead and share the plan.',
    cta: 'Open My Bonus September Kit',
    note: 'Your Club membership includes helpful resources from previous months, too.',
  },
  printables: [
    { id: 'next-step', title: 'Our Family’s Next Step', page: 'letter-portrait', kind: 'flagship', component: 'NextStep' },
    { id: 'letter', title: 'Your November letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'It’s Okay to Start Again',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'Most of us start a new family routine with good intentions. We gather around the calendar, make a plan, and hope everyone will join in.',
        'Then life gets busy. Someone forgets, the meeting gets skipped, and Mom starts managing everything again. That’s normal. New habits take a few tries in every family.',
        'The answer usually isn’t a better planner or a bigger system. Sometimes it’s a more realistic meeting time, a reminder everyone can see, clearer roles, or a smaller first step. And when your weekly plan is working, the next step is helping each person own something that matters, start to finish.',
        'Whether you’ve been doing this for months or you’re just getting started, you can take one small step together this week. Below are three places to start. Circle the one that fits your family.',
        `At dinner this week, ask: “${QUESTION}”`,
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'Make the Rhythm Stick',
      sections: [
        { heading: 'Make it visible.', body: 'Keep the meeting guide beside the family calendar.' },
        { heading: 'Connect it to an existing habit.', body: 'Meet after dinner or at another time the family is already together.' },
        { heading: 'Share the leadership.', body: 'Let different family members take turns guiding the meeting.' },
        { heading: 'Start small.', body: 'A five-minute meeting that happens is better than an elaborate one that doesn’t.' },
      ],
    },
    framework: {
      title: 'Ready for the Next Step?',
      intro: 'Helping waits to be asked. Owning means noticing a job needs doing, doing it and finishing it. Hand one over in four steps:',
      steps: [
        { word: 'Show it', text: 'Do the job while they watch, and show what finished looks like.' },
        { word: 'Do it together', text: 'Practice it side by side, once or twice.' },
        { word: 'Hand it over', text: 'Let them manage it, with support that fits their age.' },
        { word: 'Check in', text: 'After a week, ask what’s working and what needs adjusting.' },
      ],
    },
    conversation: {
      label: 'Ask at dinner this week',
      question: QUESTION,
      placement: 'after-example',
    },
    bonus: {
      title: 'New to the Club? We’ve got you.',
      body: 'Your membership includes our September digital kit, A Week Everyone Can See, with a simple family meeting guide to help you get started.',
    },
    invite: {
      title: 'Find Your Family’s Next Step',
      body: 'Scan the code for the Family Rhythm & Ownership Guide: a few quick questions, then one next step made for your family, ready to print.',
    },
    calendarNote: 'Write your next step on the family calendar, on the day you’ll try it, where everyone can see it.',
    screenNote: 'It comes in the mail with the same three paths: circle one on that copy, or use the guide above for a plan made for your family. Either works.',
    accent: 'team',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
  related: [routes.choreChart, routes.mentalLoad],
};
