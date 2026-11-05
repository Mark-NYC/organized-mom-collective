/**
 * The shape of one month's Family Meeting companion content (src/data/club/meeting-guides/<YYYY-MM>.ts). Content only;
 * the generator (./generate.ts) matches it to a family. Adding a month means writing one of these.
 *
 * The companion is a menu of ideas for any of the month's meetings, not a completed meeting: the family picks what fits
 * each time, revisits what matters and skips the rest. It's organized under the Club's four established parts (the
 * reusable framework in every Welcome Kit, src/data/club/meeting-guide.ts): Our Focus, Let's Talk, Everyone's Part,
 * Let's Practice. Nothing is assigned or decided for the family.
 *
 * Habit principles (docs/club/PERSONALIZATION.md), used as practical heuristics: a clear cue, ideally stacked on
 * something already done; a setup that makes it easy; a task small enough for the stage; support that fades; a finish
 * line a child can see. Obstacles are possibilities, never diagnoses.
 *
 * Tokens the generator fills, only from the family's own data: {school} ("school", or "lessons" for homeschoolers).
 * Writing rules (tests/club-meeting-guide-generator.test.ts): no "Mom", "Dad" or "parents"; nothing that makes one
 * grown-up the family's reminder or organizer; ideas start with a verb.
 */
import type { ResponsibilityCategory } from '../../../data/club/family-profile';
import type { GuideStage } from './stages';

export type PartId = 'focus' | 'talk' | 'parts' | 'practice';
export const PART_ORDER: readonly PartId[] = ['focus', 'talk', 'parts', 'practice'];
export const PART_TITLES: Record<PartId, string> = { focus: 'Our Focus', talk: 'Let’s Talk', parts: 'Everyone’s Part', practice: 'Let’s Practice' };

/** The habit lever an idea pulls (kept with the plan, so later months can see what was tried). */
export type HabitPrinciple = 'trigger' | 'stacking' | 'environment' | 'simplicity' | 'ownership' | 'feedback' | 'consistency';

/** One stage's version of a responsibility idea. */
export interface Practice {
  behavior: string;
  /** An existing moment it could follow ("After dinner"), for the habit-stacking idea. */
  cue: string;
  /** A change to the home that makes it easy. */
  setup?: string;
}

/** A responsibility idea, by stage. Growth items use their GROWTH_ITEMS id. */
export interface PracticeItem {
  id: string;
  category: ResponsibilityCategory;
  byStage: Partial<Record<GuideStage, Practice>>;
}

export interface FamilyFocus {
  title: string;
  /** One line: what getting better at it could look like for the family. */
  opportunity: string;
  /** A conversation prompt about it, for Let's Talk. */
  discuss: string;
}

export interface Obstacle {
  /** The likely obstacle, offered as a possibility ("might be"), never a diagnosis. */
  obstacle: string;
  principle: HabitPrinciple;
  /** One small adjustment to try, for Let's Practice. */
  adjustment: string;
}

export interface GuideMonthContent {
  /** 'YYYY-MM'. */
  month: string;
  title: string;
  subtitle: string;
  /** How to use the companion with the Welcome Kit framework. */
  howTo: string;
  /** Each part's purpose, in the framework's own words. */
  goals: Record<PartId, string>;
  /** Our Focus: from her priority, then her challenges (one per theme); `focusDefault` only when she gave neither. */
  focusByPriority: Record<string, FamilyFocus>;
  focusByChallenge: Record<string, FamilyFocus>;
  focusDefault: FamilyFocus;
  focusGroups: readonly (readonly string[])[];
  maxFocus: number;
  /** Let's Talk: her week (her own activity if she named one), the focus prompts, then the obstacle prompt. */
  questions: { withActivity: string; generic: string };
  obstacles: Record<string, Obstacle>;
  obstacleOpen: string;
  talkLittle: string;
  maxTalk: number;
  /** Everyone's Part: ideas per child, her growth items first, then the month's defaults by stage. */
  practices: readonly PracticeItem[];
  defaults: Partial<Record<GuideStage, readonly PracticeItem[]>>;
  maxIdeas: number;
  partsNote: string;
  /** How much help a first try needs at each stage. */
  support: Record<GuideStage, string>;
  /** Something a person already does: noticed, not added to. {name}, {area}. */
  keepsDoing: string;
  /** One idea for the grown-ups, shared (after their names). */
  grownUps: string;
  /** Let's Practice: habit ideas. {example} is a cue + behavior from the family's own ideas. */
  practice: { tryNow: string; stack: string; setupLead: string; simplify: string };
  maxPractice: number;
  /** For coming back to a part at a later meeting (the start of progress check-ins). */
  checkIn: string;
}
