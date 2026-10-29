/**
 * January 2027 Habit Cards: the rules behind the one-sheet printable (src/components/club/JanuaryHabitCards.astro)
 * and the mobile plan (JanuaryPlanMobile.astro). Pure functions only; both read the same state through the
 * printable's controller, so the screen and the sheet can't disagree (including when only one card is active).
 *
 * Saved per family in this tab only (src/lib/club/plan/storage.ts): { current: '<sample>:<householdId>', state }.
 */
import type { PlanResource } from '../plan/resource';
import type { PlanMember } from './sunday-reset';

export interface Habit {
  name: string;
  anchor: string;
  action: string;
  place: string;
  /** Who the card is for, printed as "FOR …". */
  who: string;
}

export interface HabitState {
  /** Four prepared habits; the sheet prints the first `count`. */
  habits: Habit[];
  count: 1 | 2;
  /** The family-derived card names last applied, so later profile changes never overwrite her own names. */
  autoNames: string[];
}

export const HABIT_DEFAULTS: readonly Habit[] = [
  { name: 'My morning', anchor: 'After I finish breakfast', action: 'I put my dishes away.', place: 'By the breakfast table', who: 'THE FAMILY' },
  { name: 'My backpack', anchor: 'After I put on my shoes', action: 'I grab my backpack.', place: 'Next to my shoes', who: 'THE FAMILY' },
  { name: 'My bedroom', anchor: 'After I get dressed', action: 'I put my pajamas away.', place: 'On my dresser', who: 'THE FAMILY' },
  { name: 'Our kitchen', anchor: 'After we finish dinner', action: 'We clear the table together.', place: 'By the kitchen table', who: 'THE FAMILY' },
];

export const HABIT_LIMITS: Record<keyof Habit, number> = { name: 42, anchor: 85, action: 105, place: 70, who: 40 };

export const freshHabitState = (): HabitState => ({
  habits: HABIT_DEFAULTS.map((h) => ({ ...h })),
  count: 2,
  autoNames: HABIT_DEFAULTS.map((h) => h.name),
});

export const isHabitState = (x: unknown): x is HabitState => {
  const s = x as HabitState;
  return Boolean(s) && (s.count === 1 || s.count === 2) && Array.isArray(s.habits) && s.habits.length === 4 && Array.isArray(s.autoNames)
    && s.habits.every((h) => h && (['name', 'anchor', 'action', 'place', 'who'] as const).every((k) => typeof h[k] === 'string'));
};

/** Card names from the family: the children's first names where the card fits them. */
export function familyCardNames(members: readonly PlanMember[]): string[] {
  const kids = members.filter((m) => m.kind === 'child' && !m.archived);
  return [
    kids[0] ? `${kids[0].firstName}’s morning` : 'My morning',
    kids[1] ? `${kids[1].firstName}’s backpack` : kids[0] ? `${kids[0].firstName}’s backpack` : 'My backpack',
    kids[2] ? `${kids[2].firstName}’s bedroom` : kids[0] ? `${kids[0].firstName}’s bedroom` : 'My bedroom',
    'Our kitchen',
  ];
}

/** Apply family names to cards she hasn't renamed. Mutates and returns `state`. */
export function applyFamilyNames(state: HabitState, members: readonly PlanMember[]): HabitState {
  const next = familyCardNames(members);
  state.habits.forEach((h, i) => {
    if (h.name === state.autoNames[i] || h.name === HABIT_DEFAULTS[i].name) h.name = next[i];
  });
  state.autoNames = next;
  return state;
}

export const clip = (field: keyof Habit, value: string) => value.replace(/\s+/g, ' ').slice(0, HABIT_LIMITS[field]);

export function setHabit(state: HabitState, index: number, patch: Partial<Habit>): HabitState {
  const habit = state.habits[index];
  if (!habit) return state;
  for (const [k, v] of Object.entries(patch) as [keyof Habit, string][]) habit[k] = clip(k, v);
  return state;
}

export function setCount(state: HabitState, count: 1 | 2): HabitState {
  state.count = count;
  return state;
}

/** The printed owner line. */
export const ownerLine = (who: string) => 'FOR ' + (who.trim() || 'THE FAMILY').toUpperCase();

/** What prints: the active cards only. Approval is checked against this. */
export const habitFingerprint = (s: HabitState) =>
  JSON.stringify([s.count, s.habits.slice(0, s.count).map((h) => [h.name, h.anchor, h.action, h.place, h.who])]);

// ------------------------------------------------------------------ the habit finder

export interface FinderSuggestion { name: string; anchor: string; action: string; place: string; alternates: string[] }

export const FINDER_SUGGESTIONS: Record<string, FinderSuggestion> = {
  'Getting out the door': { name: 'Ready to go', anchor: 'Before going to bed', action: 'We put our shoes and backpacks by the door.', place: 'By the front door', alternates: ['We put everything we need for tomorrow by the door.', 'We check our bags before bedtime.'] },
  'Putting things away': { name: 'Put it back', anchor: 'When we finish using something', action: 'We put it back where it belongs.', place: 'Near the play area', alternates: ['We put toys away before starting something else.', 'We hang up coats and put shoes away when we get home.'] },
  'Cleaning up after meals': { name: 'Clear our place', anchor: 'After eating', action: 'We take our own dishes to the kitchen.', place: 'By the dining table', alternates: ['We put our plates in the sink after eating.', 'We wipe our place at the table after eating.'] },
  'Getting ready for bed': { name: 'Ready for tomorrow', anchor: 'After brushing our teeth', action: 'We lay out tomorrow’s clothes.', place: 'On the dresser', alternates: ['We put dirty clothes in the hamper before bed.', 'We put pajamas on after brushing our teeth.'] },
  'Starting homework': { name: 'Homework first', anchor: 'After our afternoon snack', action: 'We get out our homework and begin.', place: 'At the homework spot', alternates: ['We put our homework on the table after school.', 'We pack completed homework into our backpacks.'] },
  'Knowing what comes next': { name: 'Check our plan', anchor: 'Before asking what’s next', action: 'We look at our family calendar.', place: 'Beside our calendar', alternates: ['We look at our routine card before asking for help.', 'We check what comes next after breakfast.'] },
};
export const FINDER_PROBLEMS = Object.keys(FINDER_SUGGESTIONS);
export const FINDER_WHO = ['The kids', 'One child', 'Mom', 'Dad', 'Mom and Dad', 'Everyone'];

export interface HabitChoice { problem: string; action: number; who: string }

export const finderActions = (problem: string) => {
  const base = FINDER_SUGGESTIONS[problem];
  return base ? [base.action, ...base.alternates] : [];
};

export function suggestionFor(choice: HabitChoice) {
  const base = FINDER_SUGGESTIONS[choice.problem];
  return { ...base, action: finderActions(choice.problem)[choice.action] ?? base.action };
}

/** Use the finder's habits: they become the first cards, and the sheet prints exactly that many. */
export function applyFinder(state: HabitState, choices: HabitChoice[]): HabitState {
  choices.slice(0, 2).forEach((c, i) => {
    const s = suggestionFor(c);
    state.habits[i] = { name: s.name, anchor: s.anchor, action: s.action, place: s.place, who: c.who };
  });
  state.count = choices.length >= 2 ? 2 : 1;
  return state;
}

/** The printable's controller, published on its `.jhc` root as `clubPlan` (src/lib/club/plan/resource.ts). */
export interface JhcPlan extends PlanResource<HabitState> {
  members: () => PlanMember[];
}
