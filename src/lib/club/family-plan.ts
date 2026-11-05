/**
 * A family's plan as structured data, generated each month (src/lib/club/meeting-guide/generate.ts) and saved with the
 * month's resource (club_resource_versions.state → the companion's `plan`), so later months read records, not PDF
 * text. docs/club/PERSONALIZATION.md has the model and the roadmap.
 *
 * Two kinds of record, kept apart on purpose:
 *   - SuggestedIdea: something the Club offered (January offers up to two per child). It is not a family commitment:
 *     it has no progress, is never checked in on, and nothing tracks it.
 *   - Commitment: a responsibility the family chose. Only a commitment has progress and check-ins. It is created only
 *     from the family's own choice (`commit`), never from a suggestion being shown, approved for printing or saved.
 *
 * Also the rules for the future progress check-in (one optional question on a month's page, every 6–8 weeks). Pure;
 * nothing here asks, saves or shows anything yet.
 */
import type { HabitPrinciple } from './meeting-guide/types';

/** Progress, from check-ins. `practicing` until the first answer. Commitments only. */
export type ProgressStatus = 'practicing' | 'independent' | 'improving' | 'struggling' | 'retired';

export interface SuggestedIdea {
  memberId: string;
  /** GROWTH_ITEMS id or the month's idea id. */
  itemId: string;
  category: string;
  behavior: string;
  cue: string;
  setup?: string;
  support?: string;
  /** From her own answers (desired) or the month's content. */
  source: 'desired' | 'month';
  status: 'suggested';
  /** 'YYYY-MM' it was offered. */
  offered: string;
}

export interface Commitment {
  memberId: string;
  /** The idea it came from, or 'custom' for the family's own words. */
  itemId: string;
  category: string;
  behavior: string;
  cue?: string;
  status: 'accepted';
  /** How it was chosen: at a meeting, on the page, or at a check-in. */
  chosenVia: 'meeting' | 'page' | 'check-in';
  /** 'YYYY-MM-DD'. */
  since: string;
  progress: ProgressStatus;
  lastCheckedOn?: string;
}

export interface FamilyPlan {
  v: 1;
  month: string;
  /** One or two, with where each came from (her priority, a challenge, or the month when she gave neither). */
  focus: { id: string; source: 'priority' | 'challenge' | 'growth' | 'month'; title: string }[];
  obstacle: { challengeId: string; obstacle: string; principle: HabitPrinciple | null; adjustment: string | null } | null;
  /** Offered, not chosen. */
  ideas: SuggestedIdea[];
}

/** The only way a commitment is made: the family chose this idea (or its own words). */
export function commit(idea: Pick<SuggestedIdea, 'memberId' | 'itemId' | 'category' | 'behavior' | 'cue'>, chosenVia: Commitment['chosenVia'], on: string): Commitment {
  return { memberId: idea.memberId, itemId: idea.itemId, category: idea.category, behavior: idea.behavior, ...(idea.cue ? { cue: idea.cue } : {}), status: 'accepted', chosenVia, since: on, progress: 'practicing' };
}

// ---- Future check-ins (commitments only) ----

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

/**
 * Whether to ask about a commitment: 6 weeks after it started or was last asked about, never for a retired one. Takes
 * a Commitment only, so a suggested idea can't be checked in on.
 */
export function checkInDue(c: Pick<Commitment, 'status' | 'since' | 'progress' | 'lastCheckedOn'>, today: string): boolean {
  if (c.status !== 'accepted' || c.progress === 'retired') return false;
  const from = Date.parse(`${(c.lastCheckedOn ?? c.since).slice(0, 10)}T12:00:00Z`);
  const now = Date.parse(`${today}T12:00:00Z`);
  return Number.isFinite(from) && now - from >= 42 * 86400e3;
}
