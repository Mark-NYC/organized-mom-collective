/**
 * January kit: Our First Family Meeting (owner decision 2026-11-16: January is the basic, personalized Family Meeting
 * introduction; Habit Cards are September). Mailer in docs/club/mailers/2027-01-fresh-start-together.md.
 * Planning-phase content: not published, not for sale.
 *
 * One meeting everywhere: the four parts and ten minutes of the Welcome Kit's standard guide
 * (src/data/club/meeting-guide.ts). The part names and minutes below are read from it, so January can't drift into a
 * second format again (it used to print a longer, five-step meeting beside the four-part guide).
 * - The letter (`mailer.letter`): you don't have to remember everything; the family calendar is everyone's.
 * - The action (`action`, a plain checklist): the four parts, with January's own words for each.
 * - The member page (the QR code's destination): /app/club/january, the family's personalized Our Family Focus and
 *   January's own four-part meeting. No separate tool: the Weekly Reset Builder (a different, five-step weekly ritual)
 *   is the public website's, not January's.
 * January makes the existing wall calendar collaborative. Not a weekly planner or a second calendar.
 */
import type { KitConfig } from '../types';
import { MEETING_GUIDE } from '../meeting-guide';

const SLUG = '2027-01-fresh-start-together';
const [FOCUS, TALK, PART, PRACTICE] = MEETING_GUIDE.parts;
const MINUTES = MEETING_GUIDE.parts.reduce((n, p) => n + p.minutes, 0);
const step = (p: { title: string; minutes: number }) => `${p.title}. (${p.minutes} min)`;
const QUESTION = 'What’s one thing happening this week that everyone needs to know about?';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-01',
  theme: 'Our First Family Meeting',
  subtitle: 'One family. One calendar. Everyone knows the plan.',
  shift: 'The family looks at the week together in a short weekly Family Meeting around the wall calendar, everyone owning their part, instead of Mom carrying the plan in her head.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our First Family Meeting',
    intro: 'One short conversation. One shared plan.',
    note: `About ${MINUTES} minutes. With little ones, keep it shorter.`,
    items: [
      { text: step(FOCUS), detail: 'Everyone where they can see the wall calendar. This month: everyone knows what’s coming this week.' },
      { text: step(TALK), detail: `“${QUESTION}” Everyone answers, the youngest first.` },
      { text: step(PART), detail: 'Rides, getting ready for activities, a simple meal on the busiest day. A whole job each, not reminders.' },
      { text: step(PRACTICE), detail: 'Look at the week ahead together and add anything missing to the calendar.' },
    ],
    focus: {
      label: 'Our family meeting day and time',
      printLabel: 'Our family meeting day and time',
      // The builder's own meeting days, so the guide opens on the one she chose.
      suggestions: [
        { id: 'sunday', label: 'Sunday evening' },
        { id: 'friday', label: 'Friday after dinner' },
        { id: 'saturday', label: 'Saturday morning' },
      ],
      suggestionsLabel: 'Ideas',
    },
  },
  printables: [
    { id: 'family-meeting', title: 'Our First Family Meeting', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your January letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'You Don’t Have to Remember Everything',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'When life gets busy, it’s easy for one person to become the keeper of everyone’s schedule. Mom remembers the appointments, checks the school emails, knows who’s picking up whom, thinks about dinner, and reminds everyone what comes next.',
        'Even with a calendar on the wall, she can still be the only one carrying the plan.',
        'A family calendar works best when the whole family uses it, and a short weekly meeting is a simple way to start. Everyone sees what’s coming, adds what they know, and takes their part. Children learn to look ahead to their own activities and get their things ready. The grown-ups in the house own whole jobs instead of waiting to be told.',
        'Mom doesn’t need to be the family’s walking calendar. The calendar can do that, for everyone.',
        'The meeting below takes about ten minutes. Start this week.',
        `At dinner this week, ask: “${QUESTION}”`,
      ].join('\n\n'),
      signoff: 'Megan',
    },
    // Back of the letter: placeholder copy in the brand voice (the brief's back-page section didn't arrive).
    fieldGuide: {
      title: 'The Calendar Is Everyone’s',
      sections: [
        { heading: 'Everyone brings something.', body: 'Each person adds what they know: a practice, a form, a late day at work.' },
        { heading: 'Owners, not reminders.', body: 'A ride or a job belongs to someone, start to finish, so nobody has to chase it.' },
        { heading: 'Short beats perfect.', body: 'Ten minutes most weeks does more than an hour now and then.' },
      ],
    },
    ageGuide: {
      title: 'Taking part, by age',
      note: 'Starting points. Grown-ups make the calls that need a grown-up.',
      rows: [
        { ages: '3–5', jobs: 'Point to one thing on the calendar they’re looking forward to' },
        { ages: '6–9', jobs: 'Name one thing to remember and get their own bag ready' },
        { ages: '10–12', jobs: 'Read the week aloud, lead a step, pack for their activities' },
        { ages: '13+', jobs: 'Add their own plans, flag clashes, say which rides they need' },
      ],
    },
    tip: {
      title: 'Take turns leading',
      body: 'The meeting doesn’t have to be Mom’s. A young child can lead by asking the first question; a teen can guide the whole thing.',
    },
    conversation: {
      label: 'Ask at dinner this week',
      question: QUESTION,
      placement: 'after-example',
    },
    invite: {
      title: 'See Your Family’s Focus',
      body: 'Your January page is made from your answers: one shared focus, conversation starters and a part each person could take on. Scan the code to open it.',
    },
    calendarNote: 'Keep the meeting guide beside the calendar. Write the week’s plans, meals, groceries and to-dos where everyone can see them.',
    screenNote: 'It comes in the mail with the same four-part meeting as your Family Meeting guide. Use that copy as it is, or print the one above with your meeting day on it.',
    letterLinkTop: true,
    accent: 'calendar',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
