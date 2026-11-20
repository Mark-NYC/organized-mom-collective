/**
 * Organized Family responsibility-development doctrine.
 * See docs/product/RESPONSIBILITY_DEVELOPMENT_FRAMEWORK.md.
 *
 * Pure, side-effect-free contracts for future personalization. No data is stored
 * here and nothing is connected to billing, existing monthly printables, or
 * the current Family Meeting until separately reviewed.
 */
export const DEVELOPMENT_FRAMEWORK_VERSION = 1 as const;

export const MAWL_STAGES = ['model', 'assist', 'watch', 'launch'] as const;
export type MawlStage = (typeof MAWL_STAGES)[number];

export const FAMILY_CHOICES = [
  'try',
  'easier',
  'more-responsibility',
  'stay',
  'not-now',
] as const;
export type FamilyChoice = (typeof FAMILY_CHOICES)[number];

export type DevelopmentStatus = 'active' | 'paused' | 'launched' | 'dismissed';
export type SeasonContext = 'summer-transition' | 'school-start' | 'new-year' | 'everyday';

export interface SkillDefinition {
  id: string;
  category: string;
  title: string;
  outcome: string;
  /** Guidance only. Not a gate, grade or automatic promotion rule. */
  typicalAge?: { from?: number; to?: number };
  requiresAdultSupervision?: boolean;
  finishLine: string;
  cueSuggestions: readonly string[];
  watchVariations: readonly string[];
  seasons: readonly SeasonContext[];
}

export interface SkillDevelopment {
  memberId: string;
  skillId: string;
  /** An explicit family decision, not automatically calculated from age. */
  stage: MawlStage;
  status: DevelopmentStatus;
  cue?: string;
  finishLine?: string;
  /** When known, family-confirmed context or observation, not inferred competence. */
  familyNote?: string;
}

export interface SuggestedDevelopmentStep {
  skillId: string;
  memberId: string;
  suggestedStage: MawlStage;
  cue: string | null;
  finishLine: string;
  watchVariation?: string;
  basis: 'family-choice' | 'family-progress' | 'age-and-season' | 'generic';
}

/** An explicit choice wins. Never infer promotion from age or a completed check-in. */
export function nextMawlStage(stage: MawlStage, choice: FamilyChoice): MawlStage {
  const index = MAWL_STAGES.indexOf(stage);
  switch (choice) {
    case 'more-responsibility': return MAWL_STAGES[Math.min(index + 1, MAWL_STAGES.length - 1)];
    case 'easier': return MAWL_STAGES[Math.max(index - 1, 0)];
    default: return stage;
  }
}

/**
 * Family choices control whether something is recommended again.
 * "not-now" explicitly suppresses automatic repeat suggestions.
 */
export function familyChoiceResult(
  previous: Pick<SkillDevelopment, 'stage' | 'status'>,
  choice: FamilyChoice,
): Pick<SkillDevelopment, 'stage' | 'status'> {
  if (choice === 'not-now') return { stage: previous.stage, status: 'dismissed' };
  if (choice === 'stay') return previous;
  const stage = nextMawlStage(previous.stage, choice);
  return { stage, status: stage === 'launch' && choice === 'more-responsibility' ? 'launched' : 'active' };
}

/** Never suggest a duplicate skill or restart one a family paused/dismissed/launched. */
export function eligibleForNewSuggestion(skillId: string, records: readonly Pick<SkillDevelopment, 'skillId' | 'status'>[]): boolean {
  return !records.some((r) => r.skillId === skillId);
}

/** A typical age band is guidance, not an eligibility prohibition. */
export function ageIsTypical(age: number | null, skill: SkillDefinition): boolean {
  if (age === null || !Number.isFinite(age)) return false;
  return (skill.typicalAge?.from === undefined || age >= skill.typicalAge.from)
    && (skill.typicalAge?.to === undefined || age <= skill.typicalAge.to);
}
