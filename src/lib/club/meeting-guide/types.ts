/**
 * The shape of one month's Family Meeting guide content (src/data/club/meeting-guides/<YYYY-MM>.ts). Content only;
 * the generator (./generate.ts) matches it to a family. Adding a month means writing one of these.
 *
 * The four parts are the Club's established meeting (src/data/club/meeting-guide.ts): Our Focus (2 min), Let's Talk
 * (3), Everyone's Part (3), Let's Practice (2). They're fixed here so no month can drop or rename one. Each maps to
 * one job: Focus = what matters most, Talk = discuss, Everyone's Part = decide, Practice = do.
 *
 * Habit principles (docs/club/PERSONALIZATION.md), used as practical heuristics: every practice has a clear cue
 * ("after breakfast"), ideally stacked on something the child already does; an optional setup that makes it easy (a
 * low hook); one small behavior that fits the stage; support that fades; and a finish line the child can see.
 *
 * Tokens the generator fills, only from the family's own data: {school} ("school", or "lessons" for homeschoolers).
 * Writing rules (tests/club-meeting-guide-generator.test.ts): no "Mom", "Dad" or "parents"; nothing that makes one
 * grown-up the family's reminder or organizer; behaviors start with a verb so they read after a name.
 */
import type { ResponsibilityCategory } from '../../../data/club/family-profile';
import type { GuideStage } from './stages';

export type PartId = 'focus' | 'talk' | 'parts' | 'practice';
export const PART_ORDER: readonly PartId[] = ['focus', 'talk', 'parts', 'practice'];
export const PART_TITLES: Record<PartId, string> = { focus: 'Our Focus', talk: 'Let’s Talk', parts: 'Everyone’s Part', practice: 'Let’s Practice' };
export const PART_MINUTES: Record<PartId, number> = { focus: 2, talk: 3, parts: 3, practice: 2 };

/** The habit lever an adjustment pulls (stored with a plan, so later months can see what was tried). */
export type HabitPrinciple = 'trigger' | 'stacking' | 'environment' | 'simplicity' | 'ownership' | 'feedback' | 'consistency';

/** One stage's version of a responsibility. */
export interface Practice {
  behavior: string;
  /** When: an existing moment it follows ("After breakfast"). */
  cue: string;
  /** A change to the home that makes it easy, done once before the next meeting. */
  setup?: string;
  finished: string;
}

/** A responsibility a person can practice, by stage. Growth items use their GROWTH_ITEMS id. */
export interface PracticeItem {
  id: string;
  category: ResponsibilityCategory;
  byStage: Partial<Record<GuideStage, Practice>>;
}

export interface PartContent {
  /** One line: what this part is for. */
  goal: string;
  /** What the person leading it says, read straight off the sheet. */
  say: string;
}

export interface FamilyFocus {
  title: string;
  /** The question the family discusses about it. */
  discuss: string;
}

export interface Obstacle {
  /** The likely obstacle, offered as a possibility ("might be"), never a diagnosis. */
  obstacle: string;
  principle: HabitPrinciple;
  /** One small adjustment to try. */
  adjustment: string;
}

export interface GuideMonthContent {
  /** 'YYYY-MM'. */
  month: string;
  title: string;
  subtitle: string;
  /** Before the meeting, in a few minutes. {leader} is who opens the meeting. */
  prepare: readonly string[];
  /** Replaces a {leader} line when the account holder opens the meeting herself (nobody else can yet). */
  selfLead: string;
  /** Shown only when the family has a child under 6. */
  prepareLittle?: string;
  parts: Record<PartId, PartContent>;
  /** What matters most: from her priority, then her challenges; `focusDefault` only when she gave neither. */
  focusByPriority: Record<string, FamilyFocus>;
  focusByChallenge: Record<string, FamilyFocus>;
  focusDefault: FamilyFocus;
  /** Priorities and challenges that say the same thing (one focus per group). */
  focusGroups: readonly (readonly string[])[];
  maxFocus: number;
  /** Let's Talk: one question about her week (her own activity if she named one), then the focus questions. */
  questions: { withActivity: string; generic: string };
  /** How little ones join Let's Talk. */
  talkLittle: string;
  /** The obstacle to try a change on, by challenge; `obstacleOpen` asks the family when she named none. */
  obstacles: Record<string, Obstacle>;
  obstacleOpen: string;
  /** Responsibilities: her growth items first, then the month's defaults by stage. */
  practices: readonly PracticeItem[];
  defaults: Partial<Record<GuideStage, readonly PracticeItem[]>>;
  /** Grown-ups: the account holder and other grown-ups. */
  adultHolder: Practice;
  adultOther: readonly Practice[];
  /** How much grown-up support the stage gets at first. */
  support: Record<GuideStage, string>;
  /** Shown for something a person already takes care of: recognize it, add nothing. */
  keepsDoing: string;
  /** Let's Practice: what everyone does right now. */
  tryNow: string;
  /** Before the next meeting: used when the plan has no setups of its own. */
  todosDefault: readonly string[];
  maxTodos: number;
  /** The question each person answers at the next meeting (the start of progress check-ins). */
  checkIn: string;
  rhythm: {
    title: string;
    options: readonly { id: string; label: string }[];
    defaultOption: string;
    habits: readonly string[];
  };
}
