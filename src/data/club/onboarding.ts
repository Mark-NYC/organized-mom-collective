/**
 * The family form's choices (/club/start, /club/family). Ids are stored in club_households.preferences, so they're
 * stable; labels can change. The suggested jobs use ages, roles and pets only.
 */
import type { MemberRole } from '../../lib/club/profile';

export const ADULT_ROLES: { id: Exclude<MemberRole, 'child'>; label: string }[] = [
  { id: 'partner', label: 'Partner' },
  { id: 'parent', label: 'Parent' },
  { id: 'grandparent', label: 'Grandparent' },
  { id: 'caregiver', label: 'Caregiver' },
  { id: 'other', label: 'Other grown-up' },
];

/**
 * Retired question ("What matters most right now?", replaced by the profile's step 6, src/data/club/family-profile.ts).
 * No longer asked. Households that answered it keep `preferences.priorities` (the family form passes it through on
 * save); nothing reads it for suggestions. Labels kept so stored ids stay readable.
 */
export const LEGACY_PRIORITIES: { id: string; label: string }[] = [
  { id: 'mornings', label: 'Smoother mornings' },
  { id: 'evenings', label: 'Calmer evenings and dinner' },
  { id: 'tidy-home', label: 'A home everyone keeps up' },
  { id: 'kids-independence', label: 'Kids doing more on their own' },
  { id: 'shared-load', label: 'Grown-ups sharing the load' },
  { id: 'time-together', label: 'More time together' },
];

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Ages the form offers for a child (under 1 to 18). */
export const CHILD_AGES = Array.from({ length: 19 }, (_, n) => n);
