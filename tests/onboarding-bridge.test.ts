import { describe, expect, it } from 'vitest';
import { activityCues, existingRoles, growthIdeas } from '../src/lib/app/onboarding-bridge';
import type { FamilyProfile } from '../src/lib/club/family-profile';

const profile: FamilyProfile = {
  setupDone: ['week', 'responsibilities', 'growth', 'challenges', 'priority'],
  setupCompleted: true,
  challenges: ['remembering'],
  priority: 'mornings',
  activities: [
    { category: 'sports', name: 'Soccer practice', memberIds: ['child-a'], days: [2] },
    { category: 'school', memberIds: [], days: [1, 2, 3, 4, 5] },
    { category: 'sports', name: 'Soccer practice', memberIds: ['child-a'], days: [4] },
  ],
  responsibilities: [
    { id: 'existing-1', status: 'existing', category: 'transportation', label: 'School pickup', ownerIds: ['adult'], helperIds: [] },
    { id: 'desired-1', status: 'desired', category: 'school-prep', item: 'pack-school-bag', ownerIds: ['child-a'], helperIds: [] },
    { id: 'desired-2', status: 'desired', category: 'cleaning', item: 'tidy-room', ownerIds: [], helperIds: [] },
    { id: 'confirmed-1', status: 'confirmed', category: 'meals', ownerIds: ['adult'], helperIds: [], agreement: { text: 'Dinner dishes' } },
  ],
};

describe('original onboarding answers feed the new shared family plan without being promoted to agreements', () => {
  it('uses a child-specific growth goal, plus unassigned goals, but not another child\'s', () => {
    expect(growthIdeas(profile, 'child-a')).toEqual([
      { label: 'Packing their school bag', category: 'school-prep' },
      { label: 'Keeping their room picked up', category: 'cleaning' },
    ]);
    expect(growthIdeas(profile, 'child-b')).toEqual([{ label: 'Keeping their room picked up', category: 'cleaning' }]);
  });
  it('shows existing roles as background only, not a new agreement', () => {
    expect(existingRoles(profile)).toEqual([{ label: 'School pickup', owners: ['adult'] }]);
  });
  it('keeps weekly activities as deduplicated discussion cues without creating calendar events', () => {
    expect(activityCues(profile)).toEqual(['Soccer practice', 'School or homeschool']);
  });
  it('handles missing answers without invented responsibilities', () => {
    expect(growthIdeas(null, 'child-a')).toEqual([]);
    expect(existingRoles(null)).toEqual([]);
    expect(activityCues(null)).toEqual([]);
  });
});
