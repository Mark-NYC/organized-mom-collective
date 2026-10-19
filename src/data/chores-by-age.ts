/**
 * Chores for kids by age (IF-03, /resources/chores-for-kids-by-age): one source for the article's lists, its
 * on-page infographic and the printable renders (scripts/render-printables.mjs → the Pinterest PNG and the PDFs).
 * Starting points, not milestones: every child is ready at a different time, and the article says so.
 *
 * `own`: jobs most children this age can do on their own once they've practiced them with you.
 * `help`: jobs they can do with you beside them, or with an adult handling one part (knives, the stove, cleaners).
 * `highlights`: the infographic's examples, short enough for one line; each one is in `own` or `help` in full.
 * `illustration`: an id from src/data/responsibilities.ts (the real Responsibility Cards artwork, title + art only).
 *
 * No imports on purpose: the render script loads this file directly with Node's type stripping.
 */
export type AgeBandId = '2-3' | '4-5' | '6-8' | '9-12';

export interface AgeBand {
  id: AgeBandId;
  /** "Ages 2–3" */
  label: string;
  /** "2–3" for the infographic's big numerals. */
  range: string;
  /** One line on what this age is about. */
  focus: string;
  own: string[];
  help: string[];
  highlights: { text: string; help?: boolean }[];
  illustration: string;
  /** Band accent: a fixed responsibility category color or the brand rose wash. */
  color: string;
}

export const ageBands: AgeBand[] = [
  {
    id: '2-3',
    label: 'Ages 2–3',
    range: '2–3',
    focus: 'Doing it beside you',
    own: [
      'Put toys back in their bin',
      'Put dirty clothes in the hamper',
      'Throw their own trash away',
      'Put books back on a low shelf',
    ],
    help: [
      'Wipe up small spills with a cloth',
      'Wash hands before meals, on a step stool',
      'Carry their cup or plate to the counter',
      'Help feed a pet: you measure, they pour',
      'Match socks from the clean laundry',
      'Water a plant from a small cup',
      'Put unbreakable groceries on a low shelf',
    ],
    highlights: [
      { text: 'Put toys in their bin' },
      { text: 'Clothes in the hamper' },
      { text: 'Wipe up small spills', help: true },
      { text: 'Help feed a pet', help: true },
    ],
    illustration: 'put-toys-away',
    color: '#F3DEDD',
  },
  {
    id: '4-5',
    label: 'Ages 4–5',
    range: '4–5',
    focus: 'Small jobs, start to finish',
    own: [
      'Pull up the covers and put the pillow back',
      'Get dressed in clothes laid out the night before',
      'Put toys away before dinner or bed',
      'Hang up their coat and put shoes away',
      'Clear their own plate and cup',
      'Put napkins and spoons on the table',
      'Put dirty clothes in the hamper',
    ],
    help: [
      'Feed a pet, with you checking the amount',
      'Sort laundry into lights and darks',
      'Put clean clothes in drawers they can reach',
      'Unload unbreakable dishes and spoons (you take the knives)',
      'Dust low shelves with a cloth',
    ],
    highlights: [
      { text: 'Pull up the covers' },
      { text: 'Clear their plate' },
      { text: 'Set out napkins' },
      { text: 'Sort lights and darks', help: true },
    ],
    illustration: 'set-the-table',
    color: '#F1D8A8',
  },
  {
    id: '6-8',
    label: 'Ages 6–8',
    range: '6–8',
    focus: 'Owning a routine',
    own: [
      'Make their bed',
      'Get dressed and brush teeth using a routine chart',
      'Pack their backpack for tomorrow',
      'Set and clear the table',
      'Put clean clothes in their drawers',
      'Feed the pet',
      'Clear their bedroom floor before bed',
      'Empty small trash cans into the big one',
    ],
    help: [
      'Unload the dishwasher (you put away sharp knives)',
      'Wipe the bathroom sink and counter',
      'Vacuum their room',
      'Make a simple lunch or snack',
    ],
    highlights: [
      { text: 'Make their bed' },
      { text: 'Pack their backpack' },
      { text: 'Set and clear the table' },
      { text: 'Unload the dishwasher', help: true },
    ],
    illustration: 'make-my-bed',
    color: '#D4DFC4',
  },
  {
    id: '9-12',
    label: 'Ages 9–12',
    range: '9–12',
    focus: 'Real jobs for the family',
    own: [
      'Pack their own lunch and backpack',
      'Load or unload the dishwasher',
      'Fold and put away their own laundry',
      'Take out the trash and recycling',
      'Strip and remake their bed',
      'Vacuum or sweep a room',
      'Wipe the bathroom sink, counter and mirror',
      'Check the family calendar for their own activities and gear',
    ],
    help: [
      'Run the washer and dryer',
      'Clean the toilet and tub with a cleaner you’ve chosen',
      'Cook a simple dinner, with an adult nearby for the stove',
      'Plan one family dinner and write its grocery list',
    ],
    highlights: [
      { text: 'Pack their own lunch' },
      { text: 'Fold their laundry' },
      { text: 'Take out the trash' },
      { text: 'Cook a simple dinner', help: true },
    ],
    illustration: 'help-with-laundry',
    color: '#CDDDE1',
  },
];

/** The free starter chart and the infographic files (public/), made by scripts/render-printables.mjs. */
export const printables = {
  starterChart: { href: '/downloads/kids-responsibility-chart.pdf', toolId: 'responsibility-chart' },
  infographicPdf: { href: '/downloads/chores-for-kids-by-age-infographic.pdf', toolId: 'chores-by-age-infographic' },
  infographicPng: { href: '/images/pinterest/IF-03-save-1000x1500.png', toolId: 'chores-by-age-infographic' },
} as const;
