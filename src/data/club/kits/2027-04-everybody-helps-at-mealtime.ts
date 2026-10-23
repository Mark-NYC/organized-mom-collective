/**
 * April kit: Everybody Helps at Mealtime (docs/club/YEAR_ONE_CALENDAR.md → April; mailer in
 * docs/club/mailers/2027-04-everybody-helps-at-mealtime.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape, like the other three-part kits: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`): dinner is everyone's job, the thinking included.
 * - The action (`action`, a plain checklist, no dates): Our Family Dinner Team, five steps, with the meal written
 *   above them (`action.focus`) and an optional helper or note on each step.
 * - The tool (`tool`): the Family Meal Responsibility Planner, a site tool opened inside the Club with the family's
 *   first names and children's ages: who plans, preps, serves and cleans up, the same each day or rotating.
 * April shares the work around meals. Not a meal planner or recipe service: the meals themselves go in the wall
 * calendar's meal-plan section, the groceries in its grocery list; the planner shows who keeps them filled.
 */
import type { KitConfig } from '../types';

const SLUG = '2027-04-everybody-helps-at-mealtime';
const QUESTION = 'What’s one part of mealtime you could take responsibility for this week?';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-04',
  theme: 'Everybody Helps at Mealtime',
  subtitle: 'Less on Mom’s plate. Everyone has a place at the table.',
  shift: 'The family shares one meal from choosing it to cleaning up, everyone with a part, instead of Mom planning, cooking and clearing alone.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our Family Dinner Team',
    intro: 'One meal. Everyone has a part.',
    note: 'Any meal counts: a weeknight dinner, a weekend breakfast, a simple lunch. Little ones can carry napkins; that’s a part.',
    items: [
      { text: 'Choose a meal together.' },
      { text: 'Share the preparation.' },
      { text: 'Get the table ready.' },
      { text: 'Enjoy the meal together.' },
      { text: 'Share the cleanup.' },
    ],
    helperLabel: 'Who’s helping?',
    focus: {
      label: 'Which meal?',
      printLabel: 'The meal we’re making',
      // Ideas to tap, not a menu: she can type any meal.
      suggestions: [
        { id: 'tacos', label: 'Taco night' },
        { id: 'pasta', label: 'Pasta and salad' },
        { id: 'breakfast-for-dinner', label: 'Breakfast for dinner' },
        { id: 'pizza', label: 'Homemade pizza' },
        { id: 'soup', label: 'Soup and sandwiches' },
        { id: 'sheet-pan', label: 'Sheet-pan dinner' },
      ],
      suggestionsLabel: 'Ideas',
      whenLabel: 'When we’re having it',
    },
  },
  tool: {
    tool: 'meal-team',
    title: 'Make a Family Meal Responsibility Plan',
    blurb: 'Tell us who’s helping and which meals you want to share. We’ll create a simple responsibility plan for your family.',
    cta: 'Build Our Mealtime Plan',
    note: 'Optional. The dinner team works without it.',
  },
  printables: [
    { id: 'dinner-team', title: 'Our Family Dinner Team', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your April letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'Dinner Is Everyone’s Job',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'Somebody has to decide what’s for dinner. Somebody checks the fridge, writes the list, starts the cooking and notices when the milk runs out. In a lot of homes, that somebody is Mom, every night, whether anyone sees it or not.',
        'Mealtime is one of the easiest places to change that. Everybody eats, so everybody can help.',
        'A five-year-old can set out the napkins. An eight-year-old can wash the vegetables or clear the table. A teenager can cook one dinner a week. The grown-ups can share the planning, not just the cooking. Nobody needs to be a chef; Mom just shouldn’t be carrying every meal in her head.',
        'This month, start with one meal. Choose it together, give everyone a part, and sit down to enjoy it. The steps are below.',
        `At dinner this week, ask: “${QUESTION}”`,
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'Everyone Has a Place at the Table',
      intro: 'Every meal has three parts. Share each one.',
      sections: [
        { heading: 'Before the meal.', body: 'Choose it, check what you have, wash, stir, set out the plates. Planning counts as a job, too.' },
        { heading: 'During the meal.', body: 'Pour the drinks, pass the dishes, and sit down together. Phones can wait.' },
        { heading: 'After the meal.', body: 'Everyone clears their own plate. Then one person loads, one wipes, one puts the leftovers away.' },
      ],
    },
    ageGuide: {
      title: 'Kitchen jobs by age',
      note: 'Suggestions, not rules. You know your children.',
      rows: [
        { ages: '3–5', jobs: 'Napkins and spoons, carry their own plate, rinse fruit' },
        { ages: '6–9', jobs: 'Set the table, wash vegetables, clear, wipe the table' },
        { ages: '10–12', jobs: 'Write the grocery list, make a simple side, load the dishwasher' },
        { ages: '13+', jobs: 'Cook one meal with help nearby, wash the pots, help plan the week' },
      ],
    },
    tip: {
      title: 'A five-minute pantry check',
      body: 'Before writing this week’s grocery list, check what you already have and add only what’s missing.',
    },
    conversation: {
      label: 'Ask at dinner this week',
      question: QUESTION,
      note: 'Everyone answers, grown-ups too.',
      placement: 'after-example',
    },
    invite: {
      title: 'Make Your Family Meal Responsibility Plan',
      body: 'Choose who’s helping and which meals you want to share. We’ll help divide the jobs. Scan the code, then tap “Build Our Mealtime Plan.”',
    },
    calendarNote: 'Use the meal-planning and grocery-list sections of your wall calendar to keep the plan visible. Let your family’s responsibility chart show who handles each part.',
    screenNote: 'It comes in the mail with the same steps. Use that copy as it is, or print the one above with your meal and names on it. Either works; there’s nothing to keep in step.',
    letterLinkTop: true,
    accent: 'table',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
