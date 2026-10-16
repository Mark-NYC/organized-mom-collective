/**
 * The free 30-Minute Weekly Starter Kit (/starter-kit), still called the Sanity Saver Starter Kit
 * inside the brand. The printed business card promises: "Take back control in 30 minutes. Stop
 * feeling constantly behind. Get your FREE 30-Minute Weekly Starter Kit." So the kit is one
 * 30-minute weekly reset in four timed steps, built on existing free tools (filled in on screen,
 * nothing to print), plus two optional bonus tools for later.
 *
 * The free kit is a quick weekly reset; the printed wall calendar is the ongoing family system.
 * Nothing here recreates the calendar.
 *
 * Signup: /starter-kit → the starter-kit-signup Edge Function (supabase/functions/_shared/handlers/starter-kit.ts)
 * saves the email (optional, separate marketing consent) and sends one delivery email with the kit link.
 * The kit page (/starter-kit/kit) opens straight after signup either way, even if the email fails.
 *
 * No imports on purpose: the Edge Function bundles this file for the email's step list.
 * Paths must match src/routes.ts (tests/starter-kit.test.ts checks). Step minutes must add up to
 * KIT_MINUTES (also checked).
 */

/** The brand's internal name for the kit. */
export const STARTER_KIT_NAME = 'Sanity Saver Starter Kit';
/** The offer as printed on the business card. */
export const STARTER_KIT_OFFER = '30-Minute Weekly Starter Kit';
export const STARTER_KIT_PROMISE = 'Less on your mind. More hands helping.';
export const STARTER_KIT_PATH = '/starter-kit';
export const STARTER_KIT_KIT_PATH = '/starter-kit/kit';
export const KIT_MINUTES = 30;

export interface StarterKitStep {
  /** Stable id: analytics (`resource_id`) and the saved "done" ticks. */
  id: string;
  minutes: number;
  title: string;
  /** Two or three short, concrete instructions. */
  todo: string[];
  /** What she has when the step is done. */
  outcome: string;
  /** The free tool for this step; the family check-in needs none. */
  tool?: { name: string; href: string; action: string; preview: string };
  /** Shown on the page instead of a tool (the check-in questions). */
  questions?: string[];
}

export const starterKitSteps: StarterKitStep[] = [
  {
    id: 'mental-load',
    minutes: 5,
    title: 'Clear your head',
    todo: [
      'Set a 5-minute timer.',
      'List everything you’re carrying: appointments, tasks, forms, worries. Messy is fine.',
      'Don’t sort or solve anything yet.',
    ],
    outcome: 'Everything is out of your head and where you can see it.',
    tool: { name: 'Mental Load Worksheet', href: '/mental-load-worksheet', action: 'Open the worksheet', preview: 'mental-load-worksheet' },
  },
  {
    id: 'weekly-planner',
    minutes: 10,
    title: 'Plan your week',
    todo: [
      'Add the fixed things first: appointments, practices, pickups.',
      'Jot down a few easy dinners.',
      'Circle the 3 things that matter most. The rest can wait.',
    ],
    outcome: 'A realistic plan for the next seven days.',
    tool: { name: 'Weekly Planner', href: '/planner', action: 'Open the planner', preview: 'planner' },
  },
  {
    id: 'chore-chart',
    minutes: 10,
    title: 'Share the load',
    todo: [
      'Look at your list from step 1. Pick 2–3 jobs someone else could own.',
      'Give each job to one person, start to finish. Not “help Mom”, but “your job”.',
      'Pick your child’s age in the chore chart for ideas that fit.',
    ],
    outcome: 'You’re no longer the default person for everything.',
    tool: { name: 'Chore Chart', href: '/chore-chart', action: 'Open the chore chart', preview: 'chore-chart' },
  },
  {
    id: 'family-check-in',
    minutes: 5,
    title: 'Get everyone on the same page',
    todo: ['Gather everyone for 5 minutes: dinner, the car, or before bed.', 'Ask these three questions and listen:'],
    questions: ['What’s happening this week?', 'Who’s responsible for what?', 'Where do we need to help each other?'],
    outcome: 'Your family knows the plan and starts owning their part.',
  },
];

/** Optional next steps, not part of the 30 minutes. */
export const starterKitBonuses = [
  { id: 'command-center', name: 'Command Center Setup', why: 'Make the weekly plan visible in one spot everyone passes.', href: '/command-center-setup', action: 'Open the setup sheet', preview: 'command-center-setup' },
  { id: 'routine-chart', name: 'Routine Chart', why: 'Help kids build independent morning, after-school or bedtime habits.', href: '/routine-chart', action: 'Make a routine chart', preview: 'routine-chart' },
];
