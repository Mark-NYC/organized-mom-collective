/**
 * The Family Weekly Reset Builder's agenda and rules (src/components/site/FamilyResetBuilder.astro and
 * family-reset-builder.ts beside it). Not a weekly planner: the plan lives on the wall calendar (its daily schedule,
 * meal plan, grocery list and to-do list). This only shapes a 15-minute conversation around it: five steps with
 * suggested minutes, how each person can take part at their age, one discussion question, and who leads.
 *
 * After the FP-04 article's weekly family reset (src/content/articles/weekly-family-reset.mdx): check the week, agree
 * who's covering this week's rides and preparations, match dinners to the nights, ask who needs help. Timing is a guide: little ones get a shorter
 * version; a big household may need a few more minutes.
 *
 * The rules it keeps:
 * - Only what makes this family's weeks complicated: the concerns she picks change the steps' words, never add forms.
 * - Everyone takes part at their age: a young child points to one thing on the calendar; a teen adds their own plans
 *   and rides; grown-ups cover what the week needs. No second adult is assumed.
 * - This week only: who's handling this week's rides and preparations, never standing jobs or a chore chart (that's
 *   November's Family Ownership Builder; neither depends on the other).
 * - Mom isn't the permanent leader: anyone can lead (a young child by asking the first question), the family can
 *   rotate, or decide together. Adults keep the decisions that need one.
 */
import { ageOf, type Helper } from '../lib/household-helpers';

export type Concern = 'school' | 'activities' | 'transport' | 'meals' | 'chores' | 'appointments' | 'work' | 'other';
export type MeetDay = 'sunday' | 'friday' | 'saturday' | 'other';
export type Leadership = 'one' | 'rotate' | 'together';

export const concernOptions: { id: Concern; label: string }[] = [
  { id: 'school', label: 'School schedules' },
  { id: 'activities', label: 'Sports and activities' },
  { id: 'transport', label: 'Transportation' },
  { id: 'meals', label: 'Meals and groceries' },
  { id: 'chores', label: 'Household responsibilities' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'work', label: 'Work schedules' },
  { id: 'other', label: 'Something else' },
];
export const CONCERNS = concernOptions.map((c) => c.id);
export const dayOptions: { id: MeetDay; label: string }[] = [
  { id: 'sunday', label: 'Sunday' },
  { id: 'friday', label: 'Friday' },
  { id: 'saturday', label: 'Saturday' },
  { id: 'other', label: 'Another day' },
];
export const leadershipOptions: { id: Leadership; label: string; hint: string }[] = [
  { id: 'one', label: 'One person leads', hint: 'Choose who' },
  { id: 'rotate', label: 'Take turns', hint: 'A different person each week' },
  { id: 'together', label: 'Decide together', hint: 'Choose each week' },
];

type Band = 'young' | 'school' | 'teen' | 'adult';
export const bandOf = (h: Helper): Band => {
  if (h.group === 'adult') return 'adult';
  const age = ageOf(h) ?? 8;
  return age <= 5 ? 'young' : age <= 12 ? 'school' : 'teen';
};

export interface ResetStep {
  /** 'gather' | 'week' | 'who' | 'easier' | 'help', or a custom id. */
  key: string;
  title: string;
  minutes: number;
  /** What happens, in a sentence or two. */
  body: string;
  /** How the people here can take part, short, by age band (only the bands present). */
  parts: string[];
}

export interface ResetInput {
  people: Helper[];
  concerns: Concern[];
  /** Her own words for "Something else". */
  other: string;
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** The five steps for this family and these concerns, about 15 minutes in all. */
export function resetAgenda(o: ResetInput): ResetStep[] {
  const bands = new Set(o.people.map(bandOf));
  const adults = o.people.filter((h) => h.group === 'adult');
  const has = (c: Concern) => o.concerns.includes(c);
  const kids = bands.has('young') || bands.has('school') || bands.has('teen');

  // 2. What the week holds: only the kinds of things that make this family's weeks complicated.
  const lookFor = [
    ...(has('school') ? ['school events and early dismissals'] : []),
    ...(has('activities') ? ['practices and games'] : []),
    ...(has('appointments') ? ['appointments'] : []),
    ...(has('work') ? ['work shifts and late days'] : []),
    ...(has('other') && o.other.trim() ? [o.other.trim().toLowerCase()] : []),
  ];
  // 3. Who's handling this week's preparations.
  const owns = [
    ...(has('transport') || has('activities') ? ['each ride and pickup'] : []),
    'getting ready for each activity',
    ...(has('chores') ? ['what has to get done at home before a busy day'] : []),
  ];
  const single = adults.length === 1;

  const steps: ResetStep[] = [
    {
      key: 'gather', title: 'What’s happening this week?', minutes: 3,
      body: 'Gather where everyone can see the wall calendar. Each person shares one thing coming up.',
      parts: [
        ...(bands.has('young') ? ['Little ones point to one thing on the calendar they’re looking forward to.'] : []),
        ...(bands.has('school') ? ['Kids name one thing they need to remember.'] : []),
        ...(bands.has('teen') ? ['Teens share their own plans, practices and anything due.'] : []),
      ],
    },
    {
      key: 'week', title: 'Look at the week ahead', minutes: 4,
      body: lookFor.length ? `Go day by day on the calendar’s daily schedule: ${list(lookFor)}. Add anything missing.` : 'Go day by day on the calendar’s daily schedule. Add anything missing.',
      parts: [
        ...(bands.has('teen') ? ['Teens write their own commitments on the calendar.'] : []),
        ...(adults.length > 1 ? ['Each adult brings updates from the messages they handle.'] : adults.length === 1 && kids ? ['Older kids help check that everything’s written down.'] : []),
      ],
    },
    {
      key: 'who', title: 'Who’s doing what this week?', minutes: 3,
      body: `Who is handling the important preparations this week? Put a name beside ${list(owns)}.`,
      parts: [
        ...(single && (has('transport') || has('activities')) ? ['For rides you can’t cover, decide who to ask: a carpool, a grandparent or a friend.'] : []),
        ...(bands.has('young') ? ['Little ones choose one way to get ready, like putting the library book by the door.'] : []),
        ...(bands.has('school') ? ['Kids say what they need ready for each activity day.'] : []),
        ...(bands.has('teen') ? ['Teens say which rides they need and plan around clashes.'] : []),
      ],
    },
    {
      key: 'easier', title: has('meals') ? 'What about meals?' : 'Make the week easier', minutes: 3,
      body: has('meals')
        ? 'Find the busiest evenings. Write simple dinners in the calendar’s meal plan and what’s missing on its grocery list.'
        : 'Find the busiest day. Decide what can be ready the night before, and add it to the to-do list.',
      parts: [
        ...(has('meals') && (bands.has('school') || bands.has('teen')) ? ['Kids pick one dinner or add to the grocery list.'] : []),
        ...(has('chores') ? ['Look at the to-do list: what has to happen this week?'] : []),
      ],
    },
    {
      key: 'help', title: 'Who needs help?', minutes: 2,
      body: 'Everyone answers: what would help you this week? Make last changes to the calendar, and you’re done.',
      parts: kids ? ['Grown-ups make the final calls that need a grown-up.'] : [],
    },
  ];
  return steps;
}

/** A guide to the length: shorter with little ones, a bit longer for a big household. */
export function resetMinutes(people: readonly Helper[]): { total: number; note: string } {
  const young = people.some((h) => bandOf(h) === 'young');
  if (young) return { total: 15, note: 'With little ones, ten minutes is plenty: keep steps 1, 2 and 5 short.' };
  if (people.length >= 6) return { total: 15, note: 'A big household may need twenty minutes now and then. That’s fine.' };
  return { total: 15, note: 'The times are a guide, not a stopwatch.' };
}

/** One question for this family's ages, for step 1 or 5. */
export function resetQuestion(people: readonly Helper[]): string {
  const bands = new Set(people.map(bandOf));
  if (bands.has('young')) return 'What are you looking forward to this week?';
  if (bands.has('teen')) return 'Is there anything this week that clashes, or that needs a ride?';
  if (bands.has('school')) return 'What’s one thing you need to get ready for this week?';
  return 'What’s one thing happening this week that everyone needs to know about?';
}

/** What leading means for someone, at their age. */
export function leaderNote(h: Helper | undefined): string {
  if (!h) return 'Whoever leads asks the questions and keeps it short.';
  const b = bandOf(h);
  if (b === 'young') return `${h.name} leads by asking the first question and pointing to the calendar. A grown-up helps with the rest.`;
  if (b === 'school') return `${h.name} reads each step aloud and keeps time. Grown-ups make the calls that need a grown-up.`;
  if (b === 'teen') return `${h.name} guides the meeting. Grown-ups make the calls that need a grown-up.`;
  return `${h.name} guides the meeting and makes sure everyone gets a turn.`;
}

/** The day she chose, for the printout ("Sundays at 6:30 pm"). */
export function meetLabel(day: MeetDay, otherDay: string, time: string): string {
  const d = day === 'other' ? otherDay.trim() : dayOptions.find((x) => x.id === day)!.label;
  const plural = d && !/s$/.test(d) && /day$/i.test(d) ? `${d}s` : d;
  return [plural, time.trim() ? `at ${time.trim()}` : ''].filter(Boolean).join(' ');
}
