/**
 * Developmental stages for the Family Meeting guide generator: one deterministic rule from a family member's age (on
 * the first day of the guide's month) to the stage whose authored content they get. No content lives here, so every
 * month's guide (src/data/club/meeting-guides/) shares the same stages.
 */
import { ageInMonth, type FamilyMember } from '../profile';

export type GuideStage = 'toddler' | 'preschool' | 'early' | 'middle' | 'teen' | 'adult' | 'child';

export const GUIDE_STAGES: readonly GuideStage[] = ['toddler', 'preschool', 'early', 'middle', 'teen', 'adult', 'child'];

/** How the stage reads to the family (in the editor; never on the printable). */
export const STAGE_LABEL: Record<GuideStage, string> = {
  toddler: 'Little one (under 3)',
  preschool: 'Preschooler (3–5)',
  early: 'Younger child (6–8)',
  middle: 'Older child (9–12)',
  teen: 'Teen (13 and up)',
  adult: 'Grown-up',
  child: 'Child (age not given)',
};

/** What each stage can do in a meeting: the rules the content is written to, and that the generator enforces. */
export const STAGE_RULES: Record<GuideStage, { leads: 'none' | 'practice' | 'any'; ownsPart: boolean }> = {
  toddler: { leads: 'none', ownsPart: false },
  preschool: { leads: 'none', ownsPart: true },
  early: { leads: 'practice', ownsPart: true },
  middle: { leads: 'any', ownsPart: true },
  teen: { leads: 'any', ownsPart: true },
  adult: { leads: 'any', ownsPart: true },
  child: { leads: 'none', ownsPart: true },
};

export const isGuideStage = (v: unknown): v is GuideStage => typeof v === 'string' && (GUIDE_STAGES as readonly string[]).includes(v);

export function ageOn(member: FamilyMember, month: string): number | null {
  if (member.kind !== 'child' || !Number.isInteger(member.birthYear)) return null;
  return Math.max(0, ageInMonth(member.birthYear!, member.birthMonth, month));
}

/** The stage for a member in a month: adults are grown-ups; children by age; a child with no age is 'child'. */
export function stageFor(member: FamilyMember, month: string): GuideStage {
  if (member.kind === 'adult') return 'adult';
  const age = ageOn(member, month);
  if (age === null) return 'child';
  if (age < 3) return 'toddler';
  if (age < 6) return 'preschool';
  if (age < 9) return 'early';
  if (age < 13) return 'middle';
  return 'teen';
}
