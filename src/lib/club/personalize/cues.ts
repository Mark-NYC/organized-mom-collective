/**
 * Habit cues: the existing daily event a recurring responsibility follows ("After breakfast", "When I get home"),
 * printed with the shared WHEN mark (./marks.ts → habitCue). One vocabulary for every month, so the same moment reads
 * the same everywhere, and one set of rules so a cue never contradicts what the family profile says:
 * - a school-day cue ("When I get home", "After homework", "After school") is never given to a child her answers
 *   say isn't in school; they get the same moment of a home day instead;
 * - a cue about the children ("When the kids wake up") is never given to a family without children.
 * Every prepared cue is a suggestion she can change; an unknown one gets a sensible default (`DEFAULT_CUE`).
 * Never a due date or a clock time.
 */
import { inSchool, personOf, type FamilyContext } from './family';

export const CUE = {
  wake: 'When I wake up',
  dressed: 'After I get dressed',
  breakfast: 'After breakfast',
  lunch: 'After lunch',
  snack: 'After snack',
  home: 'When I get home',
  school: 'After school',
  homework: 'After homework',
  beforeDinner: 'Before dinner',
  dinner: 'After dinner',
  bed: 'Before bed',
  everyoneHome: 'When everyone’s home',
  schoolOut: 'When school lets out',
  unpack: 'After unpacking',
  kidsUp: 'When the kids wake up',
  kidsDown: 'After the kids are in bed',
  lunchtime: 'At lunchtime',
  dinnertime: 'At dinnertime',
  ready: 'When everyone’s ready',
} as const;

/** For a job with no cue of its own (a chore she typed): a moment almost every family shares, and she can change it. */
export const DEFAULT_CUE = CUE.dinner;

const SCHOOL_DAY: readonly string[] = [CUE.home, CUE.school, CUE.homework, CUE.schoolOut];

/** A cue that fits this person, as far as her answers say (see the rules above). */
export function cueFor(ctx: FamilyContext, cue: string, memberId?: string): string {
  const p = memberId ? personOf(ctx, memberId) : undefined;
  if (p?.kind === 'child' && SCHOOL_DAY.includes(cue) && !inSchool(ctx, p.id)) return CUE.lunch;
  if (!ctx.children.length && cue === CUE.kidsUp) return CUE.wake;
  if (!ctx.children.length && cue === CUE.kidsDown) return CUE.bed;
  return cue;
}

/** One cue for several people: the shared one when it fits them all, otherwise the one that fits most of them. */
export function sharedCue(ctx: FamilyContext, cue: string, memberIds: readonly string[]): string {
  const each = memberIds.map((id) => cueFor(ctx, cue, id));
  if (!each.length) return cueFor(ctx, cue);
  const count = (c: string) => each.filter((x) => x === c).length;
  return [...new Set(each)].sort((a, b) => count(b) - count(a))[0];
}
