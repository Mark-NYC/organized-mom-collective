/**
 * January kit: A Fresh Start, Together (docs/club/YEAR_ONE_CALENDAR.md → January; mailer in
 * docs/club/mailers/2027-01-fresh-start-together.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape, like August, October and December: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`): you don't need a whole new routine. Choose one thing, not all of them.
 * - The action (`action`, a plain checklist, no dates): Our One-Thing Family Reset, five steps, with the family's one
 *   thing written above them (`action.focus`); online, a short plan on step 2 and an optional start day on step 4.
 * - The tool (`tool`): the Family Habit Builder, a site tool opened inside the Club with the family's first names and
 *   its one thing: one habit statement, tied to something they already do, and a seven-day practice card.
 * January improves one recurring rhythm. Not a decluttering month, not a responsibility overhaul, not a 30-day
 * program: no streaks, scores or reminders. The family calendar holds the start day and the check-in.
 */
import type { KitConfig } from '../types';
import { habitAreas } from '../../family-habits';

const SLUG = '2027-01-fresh-start-together';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-01',
  theme: 'Our Family Habit Cards',
  subtitle: 'Build the habit. Lose the reminder.',
  shift: 'Instead of Mom repeatedly prompting the same routine, the family attaches one useful action to something already happening and places a reminder where that action takes place.',
  engine: 'routines',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our Family Habit Plan',
    intro: 'One daily frustration. One existing cue. One small action.',
    items: [
      { text: 'Choose one frustration.', detail: 'What’s one part of everyday family life that isn’t working well?' },
      { text: 'Use a habit that already happens.', detail: 'After breakfast, coming home, or brushing teeth: pick one reliable cue.' },
      { text: 'Choose the next small action.', detail: 'Give each person a realistic part that follows that cue.' },
      { text: 'Place the reminder where it happens.', detail: 'The child sees the card at the point of action, not on a chart Mom manages.' },
      { text: 'Try it for seven days.', detail: 'No points or streaks. Keep the cue if it works, adjust if it does not.' },
    ],
    focus: {
      label: 'What is your family’s one thing?',
      printLabel: 'Our one thing this month',
      // The habit builder's own areas, so the tool opens on the one she chose.
      suggestions: habitAreas.map((a) => ({ id: a.id, label: a.label })),
      planAt: 1,
      planLabel: 'Our simpler plan',
      startAt: 3,
      startLabel: 'Start day (optional)',
    },
  },
  tool: {
    tool: 'habit-builder',
    title: 'Make Your Habit Reminder Card',
    blurb: 'Tie one small action to something you already do, then place the reminder where it happens.',
    cta: 'Make Our Habit Card',
    note: 'Optional. The reset works without it.',
  },
  printables: [
    { id: 'one-thing-plan', title: 'Our Family Habit Plan', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your January letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'You Don’t Need a Whole New Routine',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'January has a way of asking for everything at once. New schedules, new goals, a new system for the mail, the meals and the mornings. It can feel like the whole house needs fixing before February.',
        'It doesn’t. Most families don’t need an overhaul. Sometimes one part of the day working better is enough to make the whole house feel calmer.',
        'So this month, choose one thing. Maybe it’s the rush to get out the door, or backpacks and shoes all over the house, or a kitchen that stays messy after dinner. Maybe it’s bedtime, or reminding everyone about the same things every day. Not all of them. Just one.',
        'Then ask your family to help solve it. The reset below is five small steps, and the last one is simply trying your plan for a week.',
        'At dinner this week, ask everyone: “What’s one part of our day that we could make easier for everyone?”',
        'One small change, made together, is a fresh start.',
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'Small Changes That Stick',
      sections: [
        { heading: 'Start with something small.', body: 'A five-minute habit the family actually practices is better than an ambitious plan nobody follows.' },
        { heading: 'Connect it to something you already do.', body: 'Attach the new habit to a familiar part of the day, such as breakfast, arriving home, or finishing dinner.' },
        { heading: 'Let everyone play a part.', body: 'The goal isn’t for Mom to supervise another routine. Give each person a clear responsibility that fits their ability.' },
      ],
    },
    story: {
      title: 'The kitchen after dinner',
      body: 'Every night the kitchen stays a mess, and one person cleans it after everyone else leaves the table. The family’s plan: after dinner, everyone spends five minutes resetting the kitchen. One clears plates, one wipes the table, one loads the dishwasher. After seven days, they check in and decide what to keep.',
    },
    conversation: {
      label: 'Ask at dinner this week',
      question: 'What’s one part of our day that we could make easier for everyone?',
      note: 'Everyone answers, grown-ups too. Then choose one together.',
      placement: 'after-example',
    },
    invite: {
      title: 'Build Your Family Habit',
      body: 'Scan the code for this month’s kit and our Family Habit Builder. Choose the daily problem, an existing anchor and who participates. Print a habit reminder card and put it right where the action happens.',
    },
    calendarNote: 'Choose your start day and a day to check in together. Write both on your family calendar.',
    screenNote: 'It comes in the mail with the same reset. Use that copy as it is, or print the one above with your one thing and plan on it. Either works; there’s nothing to keep in step.',
    letterLinkTop: true,
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
