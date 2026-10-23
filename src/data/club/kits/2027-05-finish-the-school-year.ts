/**
 * May kit: Finish the School Year Well (docs/club/YEAR_ONE_CALENDAR.md → May; mailer in
 * docs/club/mailers/2027-05-finish-the-school-year.md). Planning-phase content: not published, not for sale.
 *
 * The three-part shape, like the other three-part kits: one letter, one action, one optional tool.
 * - The letter (`mailer.letter`): you don't have to wrap up everything yourself; the school year belongs to the kids, too.
 * - The action (`action`, a plain checklist, no dates): Our School Year Wrap-Up, five steps each with a sentence, and
 *   an optional helper on each. It works whether school ends in May or June, with no last-day date.
 * - The tool (`tool`): the School Year Wrap-Up Builder, a site tool opened inside the Club with the family's first
 *   names and children's ages: what to finish before the last day and after it, a suggested day for each (August's
 *   countdown dates) and who can do it.
 * May is the opposite of August: August gets ready for the start, May finishes well. No summer planning (June), no
 * school planner, no first-day routines or supply shopping. The back of the letter keeps a few memories: the Five
 * Favorites Rule and three reflection prompts.
 */
import type { KitConfig } from '../types';

const SLUG = '2027-05-finish-the-school-year';
const QUESTION = 'What’s one thing you’re proud of from this school year?';

export const kit: KitConfig = {
  slug: SLUG,
  month: '2027-05',
  theme: 'Finish the School Year Well',
  subtitle: 'Less end-of-year chaos. More ready for summer.',
  shift: 'The family closes out the school year together, each child finishing their own, instead of Mom remembering every form, book and backpack.',
  engine: 'planning',
  engineVersion: 1,
  items: [],
  action: {
    kind: 'checklist',
    title: 'Our School Year Wrap-Up',
    intro: 'Five little things to finish the year together.',
    note: 'Start wherever you are. Some children finish in May, others in June; these work either way.',
    items: [
      { text: 'Check the calendar.', detail: 'Add remaining school events, celebrations, and important dates.' },
      { text: 'Handle the loose ends.', detail: 'Check library books, forms, borrowed supplies, and anything that needs to be returned.' },
      { text: 'Sort school papers.', detail: 'Choose a few favorite pieces of artwork or schoolwork to keep, and recycle what isn’t needed.' },
      { text: 'Reset school gear.', detail: 'Empty backpacks and lunchboxes, sort reusable supplies, and put things away.' },
      { text: 'Celebrate the year.', detail: 'Have each child share something they learned, enjoyed, or accomplished.' },
    ],
    helperLabel: 'Who’s helping?',
  },
  tool: {
    tool: 'school-wrap-up',
    title: 'Make Your School Year Closeout Plan',
    blurb: 'Enter your child’s last day of school, and we’ll help you figure out what needs to happen before and after.',
    cta: 'Build Our School Year Plan',
    note: 'Optional. The wrap-up works without it.',
  },
  printables: [
    { id: 'school-wrap-up', title: 'Our School Year Wrap-Up', page: 'letter-portrait', kind: 'flagship', component: 'Action' },
    { id: 'letter', title: 'Your May letter', page: 'letter-portrait', kind: 'worksheet', component: 'Letter' },
  ],
  mailer: {
    // A draft for Megan to approve or rewrite in her own words. No invented stories, numbers or quotes.
    letter: {
      draft: true,
      title: 'You Don’t Have to Wrap Up Everything Yourself',
      greeting: 'Hi friend,',
      namedGreeting: 'Hi {name},',
      body: [
        'The end of the school year can feel a little like another holiday season. There are concerts and class parties, library books to return, forms to sign, and a pile of papers that somehow grew all year. It’s easy for one person to end up remembering all of it.',
        'The school year belongs to your kids, too. They can help finish it well.',
        'Children can gather their own things, check for borrowed books, sort their papers and choose the few pieces worth keeping. Grown-ups can share the forms and the final-day details, so no one is coordinating everything alone.',
        'It doesn’t have to be perfect. Every school year ends a little differently, so start wherever you are. The goal is to finish the season together, notice how much your children have grown, and head into summer with fewer loose ends.',
        `At dinner this week, ask: “${QUESTION}”`,
      ].join('\n\n'),
      signoff: 'Megan',
    },
    fieldGuide: {
      title: 'Close the Year, Keep What Matters',
      sections: [
        { heading: 'Finish the loose ends.', body: 'Return what belongs to school and bring home what belongs to your child.' },
        { heading: 'Let your child help sort.', body: 'Invite children to choose favorite schoolwork and decide what they’re ready to let go of.' },
        { heading: 'Celebrate their growth.', body: 'Take a moment to notice what each child learned or accomplished.' },
      ],
    },
    tip: {
      title: 'The Five Favorites Rule',
      body: 'When the school papers come home, invite your child to choose five favorites worth keeping. Five is a suggestion, not a strict limit: it just makes choosing easier.',
    },
    reflection: {
      title: 'My School Year',
      note: 'For your child to fill in, then keep with their five favorites.',
      prompts: ['My favorite memory this year was…', 'Something new I learned was…', 'Something I’m proud of is…'],
    },
    invite: {
      title: 'Build Your School Year Wrap-Up Plan',
      body: 'Tell us when school ends, and we’ll help you figure out what to finish, when to do it, and who can help. Scan the code, then tap “Build Our School Year Plan.”',
    },
    calendarNote: 'Add the remaining school events and your closeout dates to the family calendar so everyone can see the plan.',
    screenNote: 'It comes in the mail with the same wrap-up. Use that copy as it is, or print the one above with your names on it. Either works; there’s nothing to keep in step.',
    letterLinkTop: true,
    accent: 'school',
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
};
