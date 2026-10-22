/** How the Club's pages and printables say frequencies, ownership levels and sections. */
import type { ChartSection, Frequency, OwnershipLevel } from './types';

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: 'Every day',
  weekdays: 'School days',
  'twice-weekly': 'Twice a week',
  weekly: 'Once a week',
  'as-needed': 'When it comes up',
  once: 'Once this month',
};

export const LEVEL_LABEL: Record<OwnershipLevel, string> = {
  learning: 'Learning it',
  'with-check': 'Theirs, with a check',
  owns: 'Owns it',
};

/** The coach line under a child's job ("Learning with Luis", "Luis checks"). */
export const coachLine = (level: OwnershipLevel | null, coach: string | null) =>
  !coach || !level || level === 'owns' ? null : level === 'learning' ? `Learning with ${coach}` : `${coach} checks`;

export const SECTION_LABEL: Record<ChartSection, string> = {
  family: 'For the family',
  space: 'My space',
  self: 'Taking care of me',
};

/** '2026-11' → 'November 2026' */
export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`;
}
