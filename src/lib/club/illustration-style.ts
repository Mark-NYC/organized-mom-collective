/**
 * Shared Club illustration preference contract.
 *
 * A household default is stored at household.preferences.icon_style.
 * A month's optional override will be stored with that month's existing
 * saved document edits when a resource opts into illustrations in future.
 *
 * No resource, renderer or export is wired to this module yet.
 */
export const ILLUSTRATION_STYLES = ['hand-drawn', 'soft-color'] as const;
export type IllustrationStyle = (typeof ILLUSTRATION_STYLES)[number];
export type IllustrationStyleOverride = IllustrationStyle | null;
export const DEFAULT_ILLUSTRATION_STYLE: IllustrationStyle = 'hand-drawn';

export function isIllustrationStyle(value: unknown): value is IllustrationStyle {
  return value === 'hand-drawn' || value === 'soft-color';
}

/** Return the household choice, or the unchanged classic default. */
export function householdIllustrationStyle(preference: unknown): IllustrationStyle {
  return isIllustrationStyle(preference) ? preference : DEFAULT_ILLUSTRATION_STYLE;
}

/** Resolve a future monthly override without modifying the family preference. */
export function resolveIllustrationStyle(
  householdPreference: unknown,
  monthlyOverride?: unknown,
): IllustrationStyle {
  return isIllustrationStyle(monthlyOverride)
    ? monthlyOverride
    : householdIllustrationStyle(householdPreference);
}

/**
 * Future month controls can store just this nullable field alongside their
 * existing document edits. null means "Use family default".
 * Keep overrides out of household.preferences so one month never changes another.
 */
export interface MonthIllustrationPreference {
  icon_style_override?: IllustrationStyleOverride;
}
