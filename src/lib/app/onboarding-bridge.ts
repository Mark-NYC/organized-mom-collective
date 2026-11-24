/**
 * Read-only bridge from the original five-step Club intake into the two-tab app.
 * Onboarding "existing" and "desired" responsibilities are NOT family agreements.
 * Never create calendar events or silently confirm responsibilities from these answers.
 */
import { GROWTH_ITEMS, RESPONSIBILITY_CATEGORIES, ACTIVITY_CATEGORIES } from '../../data/club/family-profile';
import type { FamilyProfile } from '../club/family-profile';
import type { ResponsibilityCategory } from '../../data/club/family-profile';

export interface GrowthIdea { label: string; category: ResponsibilityCategory }

/** Use what the family already told us it wants a child to learn, before generic age suggestions. */
export function growthIdeas(profile: FamilyProfile | null, memberId: string): GrowthIdea[] {
  if (!profile) return [];
  const matched = profile.responsibilities.filter((r) =>
    r.status === 'desired' && r.item && (!r.ownerIds.length || r.ownerIds.includes(memberId)));
  return matched.flatMap((r) => {
    const choice = GROWTH_ITEMS.find((c) => c.id === r.item);
    return choice ? [{ label: choice.label, category: choice.category }] : [];
  }).filter((idea, i, all) => all.findIndex((x) => x.label === idea.label) === i);
}

/** Existing roles are context, not commitments made in the Family Meeting. */
export function existingRoles(profile: FamilyProfile | null): { label: string; owners: string[] }[] {
  return (profile?.responsibilities ?? []).filter((r) =>
    r.status === 'existing' && (r.ownerIds.length > 0 || r.helperIds.length > 0)).map((r) => ({
    label: r.label?.trim() || RESPONSIBILITY_CATEGORIES.find((c) => c.id === r.category)?.label || 'Helping at home',
    owners: [...new Set([...r.ownerIds, ...r.helperIds])],
  }));
}

/** Context for a conversation, NEVER extra scheduled calendar occurrences. */
export function activityCues(profile: FamilyProfile | null): string[] {
  return (profile?.activities ?? []).map((a) =>
    a.name?.trim() || ACTIVITY_CATEGORIES.find((c) => c.id === a.category)?.label || 'Our week')
    .filter((name, i, all) => all.findIndex((x) => x.toLowerCase() === name.toLowerCase()) === i)
    .slice(0, 3);
}
