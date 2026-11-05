/**
 * The shape of one month's Family Meeting companion content (src/data/club/meeting-guides/<YYYY-MM>.ts). Content only;
 * the generator (./generate.ts) scores it against a family's intake and picks the few things worth printing.
 *
 * The companion is a menu of ideas for any of the month's meetings, not a completed meeting, under the Club's four
 * established parts (the reusable framework in every Welcome Kit, src/data/club/meeting-guide.ts). Nothing is
 * assigned or decided for the family.
 *
 * Content is organized by **opportunity** (a theme a family might work on: mornings, schedules, …). Each opportunity
 * lists the intake answers that point to it, the responsibilities that serve it and how to talk about it. The generator
 * picks the family's strongest one (docs/club/PERSONALIZATION.md → Selection), then the smallest intervention.
 *
 * Habit principles, used as practical heuristics, not diagnoses: a clear cue stacked on an existing routine, a change
 * to the home that makes it easier, a step small enough for the stage, support that fades, choice, and noticing
 * progress without adding work.
 *
 * Tokens the generator fills, only from the family's own data: {name} (a child), {school} ("school", or "lessons" for
 * homeschoolers), {activity} (her own named activity). Writing rules (tests/club-meeting-guide-generator.test.ts): no
 * "Mom", "Dad" or "parents"; nothing that makes one grown-up the family's reminder; children's lines use the name,
 * not a pronoun.
 */
import type { ResponsibilityCategory } from '../../../data/club/family-profile';
import type { GuideStage } from './stages';

export type PartId = 'focus' | 'talk' | 'parts' | 'practice';
export const PART_ORDER: readonly PartId[] = ['focus', 'talk', 'parts', 'practice'];
export const PART_TITLES: Record<PartId, string> = { focus: 'Our Focus', talk: 'Let’s Talk', parts: 'Everyone’s Part', practice: 'Let’s Practice' };

/** The habit lever an idea pulls (kept with the plan, so later months can see what was tried). */
export type HabitPrinciple = 'trigger' | 'stacking' | 'environment' | 'simplicity' | 'ownership' | 'feedback' | 'consistency';

/** One stage's version of a responsibility. */
export interface Practice {
  /** The small habit to try, with its cue (and setup) written in: "Pack the bag after dinner and hang it by the door." */
  try: string;
  /** The existing moment it follows, for the structured plan. */
  cue: string;
  /** The change to the home it relies on, if any (for the structured plan and the Practice section). */
  setup?: string;
  principle: HabitPrinciple;
}

/** A responsibility, by stage. Growth items use their GROWTH_ITEMS id. */
export interface PracticeItem {
  id: string;
  category: ResponsibilityCategory;
  /** A discovery question that brings the child into the problem: "Ask {name} what usually gets forgotten." */
  ask: string;
  byStage: Partial<Record<GuideStage, Practice>>;
}

/** Something to try for an obstacle she reported, offered as a possibility. */
export interface Obstacle {
  obstacle: string;
  principle: HabitPrinciple;
  adjustment: string;
}

/** A theme a family might work on this month. */
export interface Opportunity {
  id: string;
  title: string;
  /** What getting better could look like. */
  opportunity: string;
  /** The conversation that opens it. */
  discuss: string;
  /** A discovery question when she named no obstacle for it: we ask instead of guessing. */
  discover: string;
  /** Intake answers that point here (PRIORITIES ids, CHALLENGES ids). */
  priorities: readonly string[];
  challenges: readonly string[];
  /** Responsibilities that serve it (PracticeItem ids), best first. */
  items: readonly string[];
  /**
   * When she named no job for a child: ask instead of picking one for them (the theme says nothing about which job).
   * {names}. Without it, the theme's own steps are offered at each child's age.
   */
  askFirst?: string;
}

export interface GuideMonthContent {
  /** 'YYYY-MM'. */
  month: string;
  title: string;
  subtitle: string;
  howTo: string;
  /** Each part's purpose, in the framework's own words. */
  goals: Record<PartId, string>;
  opportunities: readonly Opportunity[];
  /** When the intake points nowhere: the month's own purpose. */
  fallback: Opportunity;
  /** Her own words for "something else" (priority note): shown as the focus with this discussion prompt. */
  ownWordsDiscuss: string;
  obstacles: Record<string, Obstacle>;
  practices: readonly PracticeItem[];
  /** How children join the meeting when nothing else fits them. */
  talkLittle: string;
  /** Invites the children into solving it (ownership), for Let's Talk, when there are no per-idea questions. */
  invite: string;
  /** Let's Talk with a schedules focus: her week, using her own activity. */
  weekQuestion: { withActivity: string; generic: string };
  /** A child who already takes care of something: noticed, and asked to show how (no new job). {name}, {area}. */
  keepsDoing: string;
  showHow: string;
  /** Above the children's ideas: they're suggestions, not jobs. */
  partsNote: string;
  /** Everyone's Part when no child has an idea (too little intake): ask instead of guessing. {names}. */
  partsDiscover: string;
  /** How much help a first try needs at each stage. */
  support: Record<GuideStage, string>;
  /** For the grown-ups: a conversation about helping without taking over. */
  grownUps: string;
  /** Let's Practice: the one adjustment (lead), and how to keep it going without adding work. */
  practice: { adjustmentLead: string; sustain: Record<'reminders' | 'default', string>; meetingHabit: string };
  /** For coming back to it at a later meeting (the start of progress check-ins). */
  checkIn: string;
  /** Let's Practice: the one habit the family chooses and writes in (never filled in for them). */
  experiment: { title: string; prompt: string; fields: readonly string[] };
}
