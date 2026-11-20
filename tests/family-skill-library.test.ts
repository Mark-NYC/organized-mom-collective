import { describe, expect, it } from 'vitest';
import { choreChoices } from '../src/data/chore-recommendations';
import { skills, skillById, skillForChoreChoice, skillForCardIllustration, skillsForContext,
  unmappedChoreChoiceIds, AGE_GUIDE_CARD_IMAGE_TO_SKILL, CHORE_CHOICE_TO_SKILL, SKILLS_LIBRARY_VERSION } from '../src/lib/family-development/skills';

const ageGuideArtwork = [
  24,29,22,23,28,30,33,41,38,
  25,39,33,34,36,35,31,38,30,
  27,31,35,32,40,37,36,34,39,
];

describe('curated responsibility skill library', () => {
  it('is versioned, uniquely identified and has substantive teachable MAWL and habit details', () => {
    expect(SKILLS_LIBRARY_VERSION).toBe(1);
    expect(skills.length).toBeGreaterThanOrEqual(35);
    expect(new Set(skills.map(s => s.id)).size).toBe(skills.length);
    for (const skill of skills) {
      expect(skill.category.length).toBeGreaterThan(2);
      expect(skill.title.length).toBeGreaterThan(3);
      expect(skill.outcome.length).toBeGreaterThan(10);
      expect(skill.finishLine.length).toBeGreaterThan(10);
      expect(skill.cueSuggestions.length).toBeGreaterThan(0);
      expect(skill.watchVariations.length).toBeGreaterThan(0);
      expect(skill.naturalPayoff.length).toBeGreaterThan(10);
      expect(skill.model.length).toBeGreaterThan(10);
      expect(skill.assist.length).toBeGreaterThan(10);
      expect(skill.watch.length).toBeGreaterThan(10);
      expect(skill.launch.length).toBeGreaterThan(10);
      expect(skill.seasons.length).toBeGreaterThan(0);
      if (skill.requiresAdultSupervision) expect(skill.safety?.length).toBeGreaterThan(10);
      expect(skill.typicalAge?.from).toBeGreaterThanOrEqual(2);
    }
  });

  it('covers every currently published modern chore choice without changing its data', () => {
    expect(unmappedChoreChoiceIds()).toEqual([]);
    expect(Object.keys(CHORE_CHOICE_TO_SKILL).sort()).toEqual(choreChoices.map(c => c.id).sort());
    for (const choice of choreChoices) {
      const skill = skillForChoreChoice(choice.id);
      expect(skill).not.toBeNull();
      expect(skill!.typicalAge!.from!).toBeLessThanOrEqual(choice.minAge);
      if (choice.safety) expect(skill!.safety).toBeTruthy();
    }
  });

  it('maps every image in the existing three age-specific card guide layouts', () => {
    for (const illustration of new Set(ageGuideArtwork)) {
      expect(skillForCardIllustration(illustration), String(illustration)).not.toBeNull();
      expect(AGE_GUIDE_CARD_IMAGE_TO_SKILL[illustration]).toBeTruthy();
    }
    for (const [number, id] of Object.entries(AGE_GUIDE_CARD_IMAGE_TO_SKILL)) {
      const skill = skillById(id);
      expect(skill).not.toBeNull();
      expect(skill!.cardIllustrationId).toBe(Number(number));
    }
  });

  it('seasons change suggestion order, not the curated set or family MAWL stage', () => {
    const summer = skillsForContext({ season: 'summer-transition', age: 8, limit: 43 });
    const school = skillsForContext({ season: 'school-start', age: 8, limit: 43 });
    expect(new Set(summer.map(s => s.id))).toEqual(new Set(school.map(s => s.id)));
    expect(summer.some(s => s.id === 'snack')).toBe(true);
    expect(school.some(s => s.id === 'school-bag')).toBe(true);
    expect(skillsForContext({ season: 'summer-transition', categories: ['food-independence'] }).map(s => s.id)).toContain('snack');
    expect(skillsForContext({ season: 'everyday', limit: 0 })).toEqual([]);
  });

  it('keeps hazardous work explicitly adult-supervised', () => {
    for (const id of ['load','own-laundry','dishwasher','dinner-help','dinner','bath','pet-care']) {
      expect(skillById(id)?.requiresAdultSupervision, id).toBe(true);
      expect(skillById(id)?.safety, id).toBeTruthy();
    }
  });

  it('does not guess unknown skill or artwork aliases', () => {
    expect(skillById('unknown')).toBeNull();
    expect(skillForChoreChoice('made-up')).toBeNull();
    expect(skillForCardIllustration(999)).toBeNull();
  });
});
