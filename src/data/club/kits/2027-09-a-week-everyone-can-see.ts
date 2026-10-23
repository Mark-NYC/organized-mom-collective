/**
 * September kit: A Week Everyone Can See (docs/club/YEAR_ONE_CALENDAR.md → September; mailer in
 * docs/club/mailers/2027-09-a-week-everyone-can-see.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape, like the other three-part kits: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`): you don't have to remember everything; the family calendar is everyone's.
 * - The action (`action`, a plain checklist): Our First 15-Minute Family Meeting, five steps with suggested minutes,
 *   the meeting day and time written above them (`action.focus`).
 * - The tool (`tool`): the Family Weekly Reset Builder, a site tool opened inside the Club with the family: a
 *   personalized 15-minute meeting guide to keep by the wall calendar, with who leads.
 * September makes the existing wall calendar collaborative. Not a weekly planner or a second calendar (the plan stays
 * on the wall), and not the paid Weekly Reset System.
 */
import type { KitConfig } from '../types';

const SLUG = '2027-09-a-week-everyone-can-see';
const QUESTION = 'What’s one thing happening this week that everyone needs to know about?';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-09',
  theme: 'A Week Everyone Can See',
  subtitle: 'One family. One calendar. Everyone knows the plan.',
  shift: 'The family looks at the week together in a 15-minute meeting around the wall calendar, everyone owning their part, instead of Mom carrying the plan in her head.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our First 15-Minute Family Meeting',
    intro: 'One short conversation. One shared plan.',
    note: 'The minutes are a guide. With little ones, keep it shorter; a big household may need a little longer.',
    items: [
      { text: 'Gather around the calendar. (3 min)', detail: 'Everyone where they can see the wall calendar. Each person shares one important thing coming up.' },
      { text: 'Look at the week ahead. (4 min)', detail: 'School, appointments, practices, family events. Add anything missing to the calendar.' },
      { text: 'Decide who’s doing what. (3 min)', detail: 'Rides, getting ready for activities, important jobs. A whole job each, not reminders.' },
      { text: 'Make the week easier. (3 min)', detail: 'On the busiest days: simple meals in the meal plan, the grocery list, what can be ready ahead.' },
      { text: 'Ask who needs help. (2 min)', detail: 'Everyone says what they need. Make final changes to the calendar, and you’re done.' },
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
  tool: {
    tool: 'family-reset',
    // Placeholder copy in the brand voice (the brief's section on the digital kit didn't arrive): for the owner to confirm.
    title: 'Make Your Family Weekly Reset',
    blurb: 'Tell us who’s taking part, what makes your weeks busy, and when you’ll meet. We’ll make a 15-minute guide to keep by the calendar.',
    cta: 'Build Our Weekly Reset',
    note: 'Optional. The meeting below the letter works without it.',
  },
  printables: [
    { id: 'family-meeting', title: 'Our First 15-Minute Family Meeting', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your September letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
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
        'The meeting below takes about fifteen minutes. Start this week.',
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
        { heading: 'Short beats perfect.', body: 'Fifteen minutes most weeks does more than an hour now and then.' },
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
      title: 'Make Your Family Weekly Reset',
      body: 'Tell us who’s taking part and what makes your weeks busy. We’ll make a one-page, 15-minute meeting guide to keep beside the calendar. Scan the code, then tap “Build Our Weekly Reset.”',
    },
    calendarNote: 'Keep the meeting guide beside the calendar. Write the week’s plans, meals, groceries and to-dos where everyone can see them.',
    screenNote: 'It comes in the mail with the same meeting. Use that copy as it is, or print the one above with your meeting day on it. Either works; there’s nothing to keep in step.',
    letterLinkTop: true,
    accent: 'calendar',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
