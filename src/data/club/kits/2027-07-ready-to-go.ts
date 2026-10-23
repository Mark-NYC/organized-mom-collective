/**
 * July kit: Ready to Go (docs/club/YEAR_ONE_CALENDAR.md → July; mailer in docs/club/mailers/2027-07-ready-to-go.md).
 * Planning-phase content: not published, not for sale.
 *
 * The three-part shape, like the other three-part kits: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`): they can get themselves ready, a little at a time; adults keep the safety items.
 * - The action (`action`, a plain checklist): Our Ready-to-Go Challenge, five steps for one outing, with where you're
 *   going and when written above them (`action.focus` with `whenLabel`).
 * - The tool (`tool`): the Family Packing & Independence Builder, a site tool opened inside the Club with the family's
 *   first names and children's ages and the outing she chose: a list for each person, a shared list with owners,
 *   Pack, Check, Unpack.
 * July is getting ready for outings. Not a trip planner or itinerary (where and when go on the wall calendar), not
 * June's summer rhythm, not August's back-to-school preparation.
 */
import type { KitConfig } from '../types';
import { outingOptions } from '../../packing';

const SLUG = '2027-07-ready-to-go';
const QUESTION = 'What’s one thing you think you could get ready by yourself before we leave?';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-07',
  theme: 'Ready to Go',
  subtitle: 'Less packing for Mom. More independence for everyone.',
  shift: 'Everyone packs, checks and unpacks their own things for one outing, with grown-ups sharing the safety items and supplies, instead of Mom packing for everyone.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our Ready-to-Go Challenge',
    intro: 'One outing. Everyone gets ready together.',
    note: 'Any outing counts, near or far. One successful outing is enough.',
    items: [
      { text: 'Choose one upcoming outing.', detail: 'A camp day, pool visit, road trip, sleepover, or family activity.' },
      { text: 'Figure out what everyone needs.', detail: 'Make a short list of personal and shared supplies.' },
      { text: 'Let everyone pack their own things.', detail: 'Give children age-appropriate ownership, with help where needed.' },
      { text: 'Check together before leaving.', detail: 'Make sure important items are packed and adults verify essential supplies.' },
      { text: 'Unpack when you get home.', detail: 'Everyone puts away their own belongings and helps reset shared supplies.' },
    ],
    focus: {
      label: 'Where we’re going',
      printLabel: 'Where we’re going',
      // The builder's own outing types, so the tool opens on the one she chose.
      suggestions: outingOptions.filter((o) => o.id !== 'custom').map((o) => ({ id: o.id, label: o.label })),
      suggestionsLabel: 'Outings',
      whenLabel: 'When',
    },
  },
  tool: {
    tool: 'packing',
    title: 'Make Your Family’s Packing Lists',
    blurb: 'Tell us where you’re going, who’s coming, and how long you’ll be away. We’ll help everyone get ready.',
    cta: 'Build Our Packing Lists',
    note: 'Optional. The challenge works without it.',
  },
  printables: [
    { id: 'ready-to-go', title: 'Our Ready-to-Go Challenge', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your July letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'They Can Get Themselves Ready',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'Getting everyone out the door can feel like a project. Before an outing even starts, someone has to remember the swimsuits, snacks and water bottles. Often, that someone is Mom.',
        'But children can learn to get themselves ready, one small step at a time. A six-year-old can gather a swimsuit, towel and water bottle from a picture list. An older child can pack a camp bag and check it on their own. Teenagers can take care of more of their own things, while grown-ups share the supplies, the driving and anything to do with safety.',
        'Nobody needs to be independent overnight. They just need chances to practice. And when everyone gets home, they can unpack their own bags instead of leaving them by the door.',
        'Pick one outing this month and try the challenge below.',
        `At dinner this week, ask: “${QUESTION}”`,
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'Raising Kids Who Can Get Themselves Ready',
      intro: 'Independence grows one bag at a time. Start with what your child can carry, and let the rest be practice.',
      sections: [],
    },
    framework: {
      steps: [
        { word: 'Pack', text: 'Gather your things.' },
        { word: 'Check', text: 'Make sure you have what you need.' },
        { word: 'Unpack', text: 'Put everything away when you get home.' },
      ],
    },
    ageGuide: {
      title: 'Getting ready, by age',
      note: 'Starting points, not rules. Grown-ups keep medicine, documents and safety items.',
      rows: [
        { ages: '3–5', jobs: 'Find a few things from a picture list; carry their own bag' },
        { ages: '6–9', jobs: 'Gather a short list, check the boxes, then show a grown-up' },
        { ages: '10–12', jobs: 'Pack a whole bag and check their own list' },
        { ages: '13+', jobs: 'Plan and pack their own things; bring medicine to a grown-up' },
      ],
    },
    tip: {
      title: 'Before your next outing',
      body: 'Check your family’s go-to travel bag, water bottles, and reusable supplies so they’re ready for next time.',
    },
    conversation: {
      label: 'Ask at dinner this week',
      question: QUESTION,
      placement: 'after-example',
    },
    invite: {
      title: 'Make Your Family’s Packing Lists',
      body: 'Choose where you’re going and who’s coming. We’ll create packing lists that help everyone get ready: a list for each person and a short shared one. Scan the code, then tap “Build Our Packing Lists.”',
    },
    calendarNote: 'Add your upcoming outings and trips to the family calendar. Let everyone know when they’ll need to have their bags ready.',
    screenNote: 'It comes in the mail with the same challenge. Use that copy as it is, or print the one above with your outing on it. Either works; there’s nothing to keep in step.',
    letterLinkTop: true,
    accent: 'travel',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
