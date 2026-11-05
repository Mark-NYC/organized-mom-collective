/**
 * The shape of one month's Family Meeting companion content (src/data/club/meeting-guides/<YYYY-MM>.ts): copy, the
 * month's theme and opportunities. Behaviors come from the shared habit library (src/data/club/habit-library.ts) and
 * selection is month-independent (src/lib/club/habits/); this file only describes what a month supplies.
 *
 * The four parts are the Club's established meeting (src/data/club/meeting-guide.ts): Our Focus, Let's Talk,
 * Everyone's Part, Let's Practice. Writing rules (tests/club-meeting-guide-generator.test.ts): no "Mom", "Dad" or
 * "parents"; nothing that makes one grown-up the family's reminder; children's lines use the name, not a pronoun.
 */
import type { HabitPrinciple, MonthTheme, Opportunity } from '../habits/types';

export type { HabitPrinciple, Opportunity };
export type PartId = 'focus' | 'talk' | 'parts' | 'practice';
export const PART_ORDER: readonly PartId[] = ['focus', 'talk', 'parts', 'practice'];
export const PART_TITLES: Record<PartId, string> = { focus: 'Our Focus', talk: 'Let’s Talk', parts: 'Everyone’s Part', practice: 'Let’s Practice' };

/** Something to try for an obstacle she reported, offered as a possibility. */
export interface Obstacle {
  obstacle: string;
  principle: HabitPrinciple;
  adjustment: string;
}

export interface GuideMonthContent {
  month: string;
  title: string;
  subtitle: string;
  howTo: string;
  goals: Record<PartId, string>;
  theme: MonthTheme;
  opportunities: readonly Opportunity[];
  fallback: Opportunity;
  /** Families who told us too little: the month's shared habit, and one age-appropriate idea to consider. */
  starter: { sharedId: string; considerId?: string };
  ownWordsDiscuss: string;
  obstacles: Record<string, Obstacle>;
  talkLittle: string;
  /** Hands the experiments to the children: {names}. */
  invite: string;
  weekQuestion: { withActivity: string; generic: string };
  experimentsLabel: string;
  experimentsNote: string;
  considerNote: string;
  starterNote: string;
  /** Before anchor options that aren't confirmed by her information. */
  anchorOptions: string;
  keepsDoing: string;
  showHow: string;
  partsDiscover: string;
  grownUps: string;
  practice: { tryNow: string; adjustmentLead: string; sustain: Record<'reminders' | 'default', string> };
  checkIn: string;
  /** The Monthly Family Focus page. */
  focusPage: {
    title: string;
    /** What the month's practical resource is about, in one line (the Focus reinforces it, never duplicates it). */
    monthPurpose: string;
    /** Four authored Words of the Week, one short family question each, for the calendar's Word of the Week space. */
    words: readonly { word: string; question: string }[];
    wordsNote: string;
    /** Bring it to your Family Meeting: a few short prompts. */
    bringIt: readonly string[];
  };
}
