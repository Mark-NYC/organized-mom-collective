/**
 * The Sanity Saver Starter Kit (/starter-kit): the free kit from the old membership site, rebuilt
 * from five of the site's free tools as one guided path: get it out of your head, plan the week,
 * give the plan a home, then hand routines and jobs to the family.
 *
 * Signup: /starter-kit → the starter-kit-signup Edge Function (supabase/functions/_shared/handlers/starter-kit.ts)
 * saves the email (optional, separate marketing consent) and sends one delivery email with the kit link.
 * The kit page (/starter-kit/kit) opens straight after signup either way, even if the email fails.
 *
 * No imports on purpose: the Edge Function bundles this file for the email's step list.
 * Paths must match src/routes.ts (tests/starter-kit.test.ts checks).
 */

export const STARTER_KIT_NAME = 'Sanity Saver Starter Kit';
export const STARTER_KIT_PROMISE = 'Less on your mind. More hands helping.';
export const STARTER_KIT_PATH = '/starter-kit';
export const STARTER_KIT_KIT_PATH = '/starter-kit/kit';

export interface StarterKitStep {
  /** Stable id: analytics (`resource_id`) and the saved "done" ticks. */
  id: string;
  href: string;
  /** The tool's name. */
  tool: string;
  /** The step, in the brand's words. */
  title: string;
  why: string;
  /** When to do it, so the kit spreads across a week instead of one evening. */
  when: string;
  action: string;
  /** /images/tools/previews/<preview>.webp */
  preview: string;
}

export const starterKitSteps: StarterKitStep[] = [
  {
    id: 'mental-load',
    href: '/mental-load-worksheet',
    tool: 'Mental Load Worksheet',
    title: 'Get it out of your head',
    why: 'Write down everything you’re carrying, sort it, and pick one whole job to hand to someone else, start to finish.',
    when: 'Tonight, on your own',
    action: 'Open the worksheet',
    preview: 'mental-load-worksheet',
  },
  {
    id: 'weekly-planner',
    href: '/planner',
    tool: 'Weekly Planner',
    title: 'Put this week on one page',
    why: 'The week’s plans, meals and to-dos in one place, so the plan lives on paper instead of in your memory.',
    when: 'Before the week starts',
    action: 'Plan your week',
    preview: 'planner',
  },
  {
    id: 'command-center',
    href: '/command-center-setup',
    tool: 'Command Center Setup',
    title: 'Give the plan a home',
    why: 'One spot everyone passes: the calendar, a pen, two paper pockets, and a line for who does what.',
    when: 'This weekend',
    action: 'Open the setup sheet',
    preview: 'command-center-setup',
  },
  {
    id: 'routine-chart',
    href: '/routine-chart',
    tool: 'Routine Chart',
    title: 'Let the chart say what’s next',
    why: 'Morning, after-school or bedtime steps your kids can follow on their own, so you’re not the one repeating them.',
    when: 'With your kids',
    action: 'Make a routine chart',
    preview: 'routine-chart',
  },
  {
    id: 'chore-chart',
    href: '/chore-chart',
    tool: 'Chore Chart',
    title: 'Share the jobs',
    why: 'Daily and weekly jobs matched to each child’s age, so helping becomes part of the week, not a favor you ask for.',
    when: 'At a family check-in',
    action: 'Make a chore chart',
    preview: 'chore-chart',
  },
];
