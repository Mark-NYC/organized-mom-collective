/**
 * A family's plan as structured data: what each person is practicing, the family's focus, the obstacle they're
 * working on and what they'll do before the next meeting. Generated each month (src/lib/club/meeting-guide/generate.ts)
 * and saved with the month's resource (club_resource_versions.state → the guide's `plan`), so later months read
 * records, not PDF text. docs/club/PERSONALIZATION.md has the model and the roadmap.
 *
 * Also the rules for the future progress check-in (one optional question on a month's page, every 6–8 weeks): how an
 * answer changes what we suggest next. Pure; nothing here asks, saves or shows anything yet.
 */
import type { HabitPrinciple } from './meeting-guide/types';

/** Where a practice came from. */
export type PracticeSource = 'desired' | 'existing' | 'month' | 'custom';
/** Suggested by us; accepted when she approves the month (or changes it herself). */
export type PracticeStatus = 'suggested' | 'accepted';
/** Progress, from check-ins. `practicing` until the first answer. */
export type ProgressStatus = 'practicing' | 'independent' | 'improving' | 'struggling' | 'retired';

export interface ResponsibilityPractice {
  memberId: string;
  /** GROWTH_ITEMS id, the month's practice id, 'keep:<category>' or 'custom'. */
  itemId: string;
  category: string;
  behavior: string;
  cue: string;
  setup?: string;
  support?: string;
  finished?: string;
  source: PracticeSource;
  status: PracticeStatus;
  progress: ProgressStatus;
  /** 'YYYY-MM' it started. */
  since: string;
}

export interface FamilyPlan {
  v: 1;
  month: string;
  /** One or two, with where each came from (her priority, a challenge, or the month when she gave neither). */
  focus: { id: string; source: 'priority' | 'challenge' | 'month'; title: string }[];
  obstacle: { challengeId: string; obstacle: string; principle: HabitPrinciple | null; adjustment: string | null } | null;
  practices: ResponsibilityPractice[];
  todos: string[];
  meeting: { rhythm: string };
}

// ---- Future check-ins (data foundation only) ----

export type CheckInAnswer = 'on-own' | 'reminders' | 'struggling' | 'moved-on';
/** The optional second question, only after 'struggling': the likely obstacle, in her words. */
export type CheckInBarrier = 'forgets' | 'too-hard' | 'not-set-up' | 'not-interested' | 'schedule' | 'other';

export interface CheckIn {
  memberId: string;
  itemId: string;
  /** 'YYYY-MM-DD'. */
  askedOn: string;
  answer: CheckInAnswer;
  barrier?: CheckInBarrier;
}

/** The habit lever to try for each likely obstacle: one small adjustment, never a reward by default. */
export const BARRIER_PRINCIPLE: Record<CheckInBarrier, HabitPrinciple> = {
  forgets: 'trigger',
  'too-hard': 'simplicity',
  'not-set-up': 'environment',
  'not-interested': 'ownership',
  schedule: 'stacking',
  other: 'consistency',
};

export type NextStep =
  | { kind: 'celebrate'; progress: 'independent' }
  | { kind: 'continue'; progress: 'improving' }
  | { kind: 'adjust'; progress: 'struggling'; principle: HabitPrinciple | null }
  | { kind: 'retire'; progress: 'retired' };

/**
 * What a check-in answer means for next month: success is celebrated (no new work added), improvement keeps
 * practicing, a struggle gets one adjustment for the likely obstacle (none guessed if she didn't say), and anything
 * she has moved on from stops being suggested.
 */
export function nextStep(c: Pick<CheckIn, 'answer' | 'barrier'>): NextStep {
  switch (c.answer) {
    case 'on-own': return { kind: 'celebrate', progress: 'independent' };
    case 'reminders': return { kind: 'continue', progress: 'improving' };
    case 'struggling': return { kind: 'adjust', progress: 'struggling', principle: c.barrier ? BARRIER_PRINCIPLE[c.barrier] : null };
    case 'moved-on': return { kind: 'retire', progress: 'retired' };
  }
}

/** A check-in is due 6–8 weeks after a practice started or was last asked about; never twice in one month. */
export function checkInDue(lastAsked: string | null, since: string, today: string): boolean {
  const from = Date.parse(`${(lastAsked ?? `${since}-01`).slice(0, 10)}T12:00:00Z`);
  const now = Date.parse(`${today}T12:00:00Z`);
  return Number.isFinite(from) && now - from >= 42 * 86400e3;
}
