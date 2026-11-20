import { describe, expect, it } from 'vitest';
import {
  DEVELOPMENT_FRAMEWORK_VERSION, MAWL_STAGES,
  ageIsTypical, eligibleForNewSuggestion, familyChoiceResult, nextMawlStage,
  type SkillDefinition,
} from '../src/lib/family-development/framework';

const skill: SkillDefinition = {
  id: 'school-bag', category: 'school-prep', title: 'Pack my bag',
  outcome: 'Prepare school supplies', typicalAge: { from: 6, to: 11 },
  finishLine: 'Everything needed is packed', cueSuggestions: ['After dinner'],
  watchVariations: ['Earlier departure'], seasons: ['school-start', 'everyday'],
};

describe('responsibility development framework v1', () => {
  it('uses the agreed four MAWL stages, not a numeric maturity score', () => {
    expect(DEVELOPMENT_FRAMEWORK_VERSION).toBe(1);
    expect(MAWL_STAGES).toEqual(['model', 'assist', 'watch', 'launch']);
  });
  it('does not auto-promote from Watch without explicit family choice', () => {
    expect(nextMawlStage('watch', 'stay')).toBe('watch');
    expect(nextMawlStage('watch', 'try')).toBe('watch');
    expect(nextMawlStage('watch', 'not-now')).toBe('watch');
    expect(nextMawlStage('watch', 'more-responsibility')).toBe('launch');
  });
  it('allows adults to move backwards and safely holds stage boundaries', () => {
    expect(nextMawlStage('watch', 'easier')).toBe('assist');
    expect(nextMawlStage('assist', 'easier')).toBe('model');
    expect(nextMawlStage('model', 'easier')).toBe('model');
    expect(nextMawlStage('launch', 'more-responsibility')).toBe('launch');
  });
  it('does not mark independent ownership without a family decision', () => {
    expect(familyChoiceResult({ stage: 'watch', status: 'active' }, 'stay')).toEqual({ stage: 'watch', status: 'active' });
    expect(familyChoiceResult({ stage: 'watch', status: 'active' }, 'more-responsibility')).toEqual({ stage: 'launch', status: 'launched' });
  });
  it('respects a dismissal and does not repeat a known skill as new', () => {
    const dismissed = familyChoiceResult({ stage: 'assist', status: 'active' }, 'not-now');
    expect(dismissed).toEqual({ stage: 'assist', status: 'dismissed' });
    expect(eligibleForNewSuggestion('school-bag', [{ skillId: 'school-bag', status: 'dismissed' }])).toBe(false);
    expect(eligibleForNewSuggestion('school-bag', [{ skillId: 'school-bag', status: 'active' }])).toBe(false);
    expect(eligibleForNewSuggestion('school-bag', [{ skillId: 'snacks', status: 'active' }])).toBe(true);
  });
  it('treats typical age as advisory, never an absolute eligibility gate', () => {
    expect(ageIsTypical(8, skill)).toBe(true);
    expect(ageIsTypical(4, skill)).toBe(false);
    expect(ageIsTypical(14, skill)).toBe(false);
    expect(ageIsTypical(null, skill)).toBe(false);
  });
});
