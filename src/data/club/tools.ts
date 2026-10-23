/**
 * The site's own tools that a Club kit can open, inside the Club (docs/club/KIT_TEMPLATE.md → Tools). One
 * implementation per tool: the Club page hosts the same component as the public page (no Club copy), with the Club's
 * layout (no site navigation, no trackers) and a handoff (src/lib/tool-handoff.ts) carrying a child's name and age
 * and a starting choice, so she doesn't type what her family profile already says.
 *
 * To add one: give the tool's component a `handoff` mode that reads readToolHandoff(id) (see RoutineChart.astro and
 * src/components/site/routine-chart.ts), add a page at src/pages/club/tools/<id>.astro, and list it here.
 */
import { routes } from '../../routes';

export interface ClubTool {
  id: string;
  /** The Club page that hosts it. */
  path: string;
  /** The public page with the same tool, or null while it's a Club-only tool (the component is still the site's). */
  publicPath: string | null;
  /** Opened for one person at a time: the kit asks who it's for. */
  perChild: boolean;
  /** Who the kit offers: children (3 and up) only, or the grown-ups too. */
  people?: 'children' | 'everyone';
  /** A family tool (not per person) that gets the children's ages from the family profile. */
  familyAges?: true;
  /** A family tool that gets the family's first names (adult or not) for choosing who takes part. */
  familyPeople?: true;
  /** Starting choices the kit can offer before opening (the tool's own ids). */
  variants?: { id: string; label: string }[];
  /** Its name on the Club page ("Sofia’s chore chart"), lowercase after the name. */
  title: string;
  /** One line under the title: what she does with it. */
  intro: string;
}

export const clubTools = {
  'routine-chart': {
    id: 'routine-chart',
    path: routes.clubTool('routine-chart'),
    publicPath: routes.routineChart,
    perChild: true,
    variants: [
      { id: 'morning', label: 'Morning' },
      { id: 'afterschool', label: 'After school' },
    ],
    title: 'Routine chart',
    intro: 'Tap illustrated steps, put them in order, add times, then download it to print. It saves in this browser.',
  },
  'chore-chart': {
    id: 'chore-chart',
    path: routes.clubTool('chore-chart'),
    publicPath: routes.choreChart,
    perChild: true,
    people: 'everyone',
    title: 'Chore chart',
    intro: 'Add more jobs only when the first one sticks, or use the full week of chores for their age. Change anything, then download it to print. It saves in this browser.',
  },
  'traditions-picker': {
    id: 'traditions-picker',
    path: routes.clubTool('traditions-picker'),
    // No public page yet: the component is a site tool (src/components/site/TraditionsPicker.astro), ready for one.
    publicPath: null,
    perChild: false,
    familyAges: true,
    title: 'Family Christmas Traditions Picker',
    intro: 'Answer what you like and skip the rest. Keep one to three ideas, swap the others, then print or copy your picks. It saves in this browser.',
  },
  'habit-builder': {
    id: 'habit-builder',
    path: routes.clubTool('habit-builder'),
    // No public page yet: the component is a site tool (src/components/site/HabitBuilder.astro), ready for one.
    publicPath: null,
    perChild: false,
    familyPeople: true,
    title: 'Family Habit Builder',
    intro: 'Three questions, one habit. Change any words, then download your seven-day practice card or copy it. It saves in this browser.',
  },
  'connection-planner': {
    id: 'connection-planner',
    path: routes.clubTool('connection-planner'),
    // No public page yet: the component is a site tool (src/components/site/ConnectionPlanner.astro), ready for one.
    publicPath: null,
    perChild: false,
    familyAges: true,
    familyPeople: true,
    title: 'Family Connection Planner',
    intro: 'Answer what you like and skip the rest. Choose one idea, swap or edit any, then print or copy your plan. It saves in this browser.',
  },
  'spring-cleaning': {
    id: 'spring-cleaning',
    path: routes.clubTool('spring-cleaning'),
    // No public page yet: the component is a site tool (src/components/site/SpringCleaningBuilder.astro), ready for one.
    publicPath: null,
    perChild: false,
    familyPeople: true,
    title: 'Family Spring Cleaning Builder',
    intro: 'Choose the rooms, who’s helping and how long a session is. Change any job or who has it, then print one room at a time. It saves in this browser.',
  },
  'meal-team': {
    id: 'meal-team',
    path: routes.clubTool('meal-team'),
    // No public page yet: the component is a site tool (src/components/site/MealTeamPlanner.astro), ready for one.
    publicPath: null,
    perChild: false,
    familyPeople: true,
    title: 'Family Meal Responsibility Planner',
    intro: 'Choose who’s helping and which meals you want to share. Change any job or who has it, then print your chart. It saves in this browser.',
  },
  'school-wrap-up': {
    id: 'school-wrap-up',
    path: routes.clubTool('school-wrap-up'),
    // No public page yet: the component is a site tool (src/components/site/WrapUpBuilder.astro), ready for one.
    publicPath: null,
    perChild: false,
    familyPeople: true,
    title: 'School Year Wrap-Up Builder',
    intro: 'Enter when school ends and what applies. We’ll suggest what to finish, when, and who can help. Change anything, then print. It saves in this browser.',
  },
  'screen-time': {
    id: 'screen-time',
    path: routes.clubTool('screen-time'),
    publicPath: routes.screenTime,
    perChild: true,
    title: 'Screen time agreement',
    intro: 'Agree together on when screens are on, what comes first, where devices go and how screen time ends, and what grown-ups agree to. Change any line, then download it to print and sign. It saves in this browser.',
  },
  packing: {
    id: 'packing',
    path: routes.clubTool('packing'),
    // No public page yet: the component is a site tool (src/components/site/PackingBuilder.astro), ready for one.
    // The public /travel-checklist stays the trip-level checklist it is.
    publicPath: null,
    perChild: false,
    familyPeople: true,
    title: 'Family Packing & Independence Builder',
    intro: 'Choose where you’re going, who’s coming and how long. Everyone gets their own list, with a short shared one. Change anything, save it for next time, then print. It saves in this browser.',
  },
} satisfies Record<string, ClubTool>;

export type ClubToolId = keyof typeof clubTools;
export const clubToolById = (id: string): ClubTool | undefined => (clubTools as Record<string, ClubTool>)[id];
