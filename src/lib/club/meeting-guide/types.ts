/**
 * The shape of one month's Family Meeting guide content (src/data/club/meeting-guides/<YYYY-MM>.ts). Content only:
 * authored text by part and stage, plus the ids that let the generator (./generate.ts) match it to a family. Adding a
 * month means writing one of these, never changing the generator.
 *
 * The four parts are the Club's established meeting (src/data/club/meeting-guide.ts, docs/club/FAMILY_MEETING.md):
 * Our Focus (2 min), Let's Talk (3), Everyone's Part (3), Let's Practice (2). They're fixed here so no month can
 * drop or rename one.
 *
 * Tokens the generator fills, only from the family's own data: {family} ("the Rivera family" or "your family"),
 * {activity} (one of her activities, by name or category), {school} ("school", or "lessons" for homeschoolers).
 * Writing rules (tests/club-meeting-guide-generator.test.ts): no "Mom", "Dad" or "parents"; nothing that makes one
 * grown-up the family's reminder or organizer; lines start with a verb so they read after a name ("Sofia: Reads …").
 */
import type { GuideStage } from './stages';

export type PartId = 'focus' | 'talk' | 'parts' | 'practice';
export const PART_ORDER: readonly PartId[] = ['focus', 'talk', 'parts', 'practice'];
export const PART_TITLES: Record<PartId, string> = { focus: 'Our Focus', talk: 'Let’s Talk', parts: 'Everyone’s Part', practice: 'Let’s Practice' };
export const PART_MINUTES: Record<PartId, number> = { focus: 2, talk: 3, parts: 3, practice: 2 };

/** One authored contribution. `requires` drops it for a family it doesn't fit; the next option is used instead. */
export interface Contribution {
  id: string;
  text: string;
  /** Only for Everyone's Part: what finished looks like, in words a child can check. */
  finished?: string;
  requires?: 'activity' | 'school' | 'not-holder' | 'holder';
}

export interface PartContent {
  /** One line: what this part is for. */
  goal: string;
  /** What the person leading it says, read straight off the sheet. */
  say: string;
  /** Options by stage, in order of preference. Siblings in the same stage get different options. */
  byStage: Record<GuideStage, readonly Contribution[]>;
}

export interface GuideAction {
  id: string;
  text: string;
  finished: string;
  /** Recommended first when her priority or one of her challenges is listed here. */
  priorities?: readonly string[];
  challenges?: readonly string[];
  /** Fits only a family with someone 6 or older besides the grown-ups. */
  needsKids?: boolean;
}

export interface GuideMonthContent {
  /** 'YYYY-MM'. */
  month: string;
  title: string;
  subtitle: string;
  /** Before the meeting, in a few minutes. {leader} is who opens the meeting. */
  prepare: readonly string[];
  /** Shown only when the family has a child under 6. */
  prepareLittle?: string;
  /** Replaces a {leader} line when the account holder opens the meeting herself (nobody else can yet). */
  selfLead: string;
  parts: Record<PartId, PartContent>;
  /** Let's Talk: the family's questions. One activity question if she gave an activity, then the rest. */
  questions: {
    withActivity: string;
    generic: string;
    always: readonly string[];
    /** One extra question from her first priority, else her first challenge that has one. */
    byPriority: Record<string, string>;
    byChallenge: Record<string, string>;
  };
  /** Our Focus: why it matters, from her priority, else challenges, else `why`. */
  why: string;
  whyByPriority: Record<string, string>;
  whyByChallenge: Record<string, string>;
  /** The one or two things the family agrees on; the default picks are her matches, then `defaultActions`. */
  actions: readonly GuideAction[];
  defaultActions: readonly string[];
  maxActions: number;
  rhythm: {
    title: string;
    options: readonly { id: string; label: string }[];
    defaultOption: string;
    habits: readonly string[];
  };
}
