/**
 * The family form's choices (/club/start, /club/family). Ids are stored in club_households.preferences, so they're
 * stable; labels can change. Priorities are hers to name what matters; they don't change the suggested jobs
 * (the engine uses ages, roles and pets only), and the form says so.
 */
import type { MemberRole } from '../../lib/club/profile';

export const ADULT_ROLES: { id: Exclude<MemberRole, 'child'>; label: string }[] = [
  { id: 'partner', label: 'Partner' },
  { id: 'parent', label: 'Parent' },
  { id: 'grandparent', label: 'Grandparent' },
  { id: 'caregiver', label: 'Caregiver' },
  { id: 'other', label: 'Other grown-up' },
];

export const PRIORITIES: { id: string; label: string }[] = [
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
