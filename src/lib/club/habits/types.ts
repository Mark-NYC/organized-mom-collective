/**
 * Month-independent habit intelligence (docs/club/HABITS.md). Four layers, kept apart:
 *
 *   1. Family context    ./context.ts      who's home, ages, what she reported, what they already do (and later, progress)
 *   2. Month theme        MonthTheme below  the responsibility outcome a month aims for, and its limits
 *   3. Selection          ./focus.ts, ./recommend.ts   which focus, which behaviors, which habit interventions
 *   4. Presentation       each month's resource (January: src/lib/club/meeting-guide/)
 *
 * Behaviors live in one shared library (src/data/club/habit-library.ts), so every month draws on the same
 * age-appropriate actions, anchors, ownership moves and supports.
 */
import type { GuideStage } from '../meeting-guide/stages';
import type { ProgressStatus } from '../family-plan';

export type HabitPrinciple = 'trigger' | 'stacking' | 'environment' | 'simplicity' | 'ownership' | 'feedback' | 'consistency';

/** When a behavior happens: used to match it to a theme (evenings, mornings…) and to the season. */
export type HabitTime = 'morning' | 'after-school' | 'evening' | 'bedtime' | 'weekly' | 'anytime';

/** One age's version of a behavior. Text never uses a pronoun for the child: {name} only. */
export interface StageHabit {
  /** The one small action, no anchor: "Check tomorrow’s supplies and pack the school bag." */
  action: string;
  /** Moments it could follow. Offered as options to discuss unless the family's own information confirms one. */
  anchors: readonly string[];
  /** One small way the child takes initiative or makes it their own. {name}. */
  ownership: string;
  /** An environmental change or age-appropriate grown-up support, when useful. {name}. */
  support?: string;
  principle: HabitPrinciple;
}

export interface HabitItem {
  /** GROWTH_ITEMS id where there is one, so her stated wishes match directly. */
  id: string;
  category: string;
  /** How her wish reads in a sentence: "You'd like Sofia to take on packing the school bag." No pronouns. */
  wish?: string;
  /** "School things ready": the experiment's short title. */
  title: string;
  times: readonly HabitTime[];
  /** Only while school is in session (excluded in summer). */
  school?: boolean;
  /** Tied to one of the family's own activities: anchored to it, never to a season we assume. */
  activity?: boolean;
  byStage: Partial<Record<GuideStage, StageHabit>>;
  /** For a whole family doing it together (larger families): one routine, adapted by age. */
  /** For several children doing it together: one routine, one set of triggers (the family picks one), and each age's
   * part of that same routine (never a different habit). */
  shared?: { title: string; action: string; ownership: string; support?: string; anchors?: readonly string[]; parts?: Partial<Record<GuideStage, string>> };
}

/** A month's responsibility outcome and limits. Month content supplies it; selection reads it. */
export interface MonthTheme {
  month: string;
  /** School in session this month (school-only behaviors are left out when false). */
  schoolInSession: boolean;
  /** The most experiments the month's resource shows. January: 2. Never a target. */
  maxExperiments: number;
  /** From this many children with a fitting step, one shared routine adapted by age instead of individual ones. */
  sharedFrom: number;
  /** Behaviors this month may suggest (library ids). */
  allowed: readonly string[];
}

/** A theme a family might work on (mornings, evenings…): what points to it, and which behaviors serve it. */
export interface Opportunity {
  id: string;
  title: string;
  opportunity: string;
  discuss: string;
  discover: string;
  priorities: readonly string[];
  challenges: readonly string[];
  /** Library ids, best first. */
  items: readonly string[];
  /** When she named no job: ask instead of picking one (the theme says nothing about which job). */
  askFirst?: string;
}

export interface ExperimentAnchor {
  text: string;
  /** True only when the family's own information establishes the moment (her school or activity days). */
  verified: boolean;
  /** The moments to choose from: the family picks one and keeps it the same each time. */
  options?: readonly string[];
  /** What her information confirms, before the options ("on school nights"). */
  lead?: string;
}

/** One habit experiment: a suggestion to discuss and try, never an assignment. */
export interface HabitExperiment {
  key: string;
  itemId: string;
  /** The child (or children) it's for. Shared routines name everyone they fit. */
  memberIds: string[];
  who: string;
  title: string;
  /** Why this, in her terms: her priority, challenge or wish. Empty for a "to consider" idea. */
  why: string;
  /** Just her wish for this child, when there is one (the focus's reason is shown once, with the focus). */
  wish?: string;
  /** 'need': supported by her intake. 'consider': a common age-appropriate option, not a known need. */
  basis: 'need' | 'consider';
  action: string;
  anchor: ExperimentAnchor;
  ownership: string;
  support?: string;
  /** Shared routines: each child's version. */
  adaptations?: { memberId: string; name: string; action: string }[];
  principle: HabitPrinciple;
  source: 'desired' | 'theme' | 'month';
}

/** What progress check-ins (later) tell selection, by member and behavior. */
export type ProgressMap = Record<string, ProgressStatus>;
export const progressKey = (memberId: string, itemId: string) => `${memberId}:${itemId}`;
