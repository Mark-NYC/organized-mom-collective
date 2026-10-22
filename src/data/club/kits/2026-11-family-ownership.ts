/**
 * November kit: Our Family, Our Team (docs/club/YEAR_ONE_CALENDAR.md → November). Planning-phase content: not
 * published, not for sale. The flagship is the Family Ownership Builder (the responsibilities engine over the
 * ownership job library); the team reset is the companion's November project, read from src/data/cleaning.ts.
 */
import { monthlyDeepClean } from '../../cleaning';
import { routes } from '../../../routes';
import { ownershipJobs } from '../libraries/ownership-jobs';
import type { KitConfig, KitItem } from '../types';

const SLUG = '2026-11-family-ownership';
/** src/data/cleaning.ts months are 0-based: 10 is November ("Kitchen + Hosting Prep"). */
const RESET_MONTH = 10;

/** Who can own each of the November project's tasks, by task id. Wording stays in cleaning.ts. */
const resetRules: Record<string, Pick<KitItem, 'minAge' | 'levels' | 'effort'>> = {
  'nov-fridge': { minAge: 8, levels: [[8, 'with-check'], [11, 'owns']], effort: 2 },
  'nov-serving': { minAge: 6, levels: [[6, 'learning'], [8, 'with-check'], [10, 'owns']], effort: 2 },
  'nov-guest': { minAge: 5, levels: [[5, 'learning'], [7, 'with-check'], [9, 'owns']], effort: 1 },
  'nov-table': { minAge: 4, levels: [[4, 'learning'], [6, 'with-check'], [8, 'owns']], effort: 1 },
  'nov-pantry': { minAge: 9, levels: [[9, 'with-check'], [12, 'owns']], effort: 2 },
};

const resetItems: KitItem[] = monthlyDeepClean
  .find((m) => m.month === RESET_MONTH)!
  .tasks.map((t) => ({
    id: t.id,
    title: t.label,
    doneMeans: 'Done once this month, before the first guests arrive.',
    for: 'anyone',
    frequency: 'once',
    section: 'family',
    scope: 'household',
    core: true,
    area: 'kitchen',
    ...(resetRules[t.id] ?? { minAge: 8, levels: [[8, 'with-check'], [11, 'owns']], effort: 2 }),
  }));

export const kit: KitConfig = {
  slug: SLUG,
  month: '2026-11',
  theme: 'Our Family, Our Team',
  shift: 'Every household job has one owner, start to finish, and it isn’t always Mom.',
  engine: 'responsibilities',
  engineVersion: 1,
  items: ownershipJobs(),
  reset: { month: RESET_MONTH, title: 'November Kitchen & Pantry Reset', items: resetItems },
  printables: [
    { id: 'ownership-chart', title: 'Our Family Responsibility Chart', page: 'letter-landscape', kind: 'flagship', component: 'ResponsibilityChart', items: 'items' },
    { id: 'kitchen-pantry-reset', title: 'November Kitchen & Pantry Reset', page: 'letter-portrait', kind: 'reset', component: 'ResetChecklist', items: 'reset' },
    { id: 'who-owns-what', title: 'Who Owns What: Our Team Meeting', page: 'letter-portrait', kind: 'activity', component: 'ConversationCard' },
    {
      id: 'handing-over',
      title: 'Handing Over a Whole Job',
      page: 'letter-portrait',
      kind: 'worksheet',
      component: 'Checklist',
      content: {
        intro: 'For the grown-ups: moving a job to someone else, all of it, so it doesn’t drift back.',
        items: [
          'Name the whole job, from noticing it needs doing to finished.',
          'Write down what “done” looks like, in one sentence.',
          'Show it once, then do it together once.',
          'Hand over the remembering too: where the list lives, when it’s due.',
          'Step back. Done differently is still done.',
          'Pick a day to check in, two weeks from now. Talk about how it’s going, not who forgot.',
          'If it slips, the owner catches up. The job stays theirs.',
        ],
      },
    },
  ],
  mailer: {
    // Megan writes this, in her own words. Nothing here may stand in for it.
    letter: null,
    fieldGuide: {
      title: 'Owning a Job, Not Helping With It',
      sections: [
        { heading: 'Helping vs. owning', body: 'Helping waits to be asked. Owning means noticing it needs doing, doing it and finishing it. The chart gives each job one name so nobody has to ask whose turn it is.' },
        { heading: 'What owning looks like by age', body: 'Little ones are learning: their job, with someone beside them. Next, they do it start to finish and their coach checks. Then it’s theirs completely. Move a job up a level when it’s been done well for a few weeks.' },
        { heading: 'Hand it over once', body: 'Show the job, do it together, then step back. If it’s done differently than you would, it’s still done. Taking it back teaches everyone it was never really theirs.' },
        { heading: 'The week it slips', body: 'Sick days and late practices happen. Skip the lecture: the owner catches up the next day, or the job waits until the weekend. The chart stays the same.' },
      ],
    },
    activity: {
      title: 'The Team Meeting',
      minutes: 20,
      steps: [
        'Everyone sits down together with the chart.',
        'Read each person’s row out loud, starting with the grown-ups.',
        'Everyone picks one job they want to own this month. Swap if two people want the same one.',
        'Talk through what “done” means for each job, in one sentence.',
        'Put the chart where everyone can see it, and pick a day next week to check in.',
      ],
    },
    qrPath: `/club/kits/${SLUG}?source=mailer`,
  },
  related: [routes.choreChart, routes.mentalLoad, routes.fallPantry],
};
