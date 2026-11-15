/**
 * One color per person, everywhere, for good (docs/ios/HOUSEHOLD_ARCHITECTURE.md → Colors pinned).
 *
 * Colors nobody picked are auto-assigned in family order (memberColors in src/data/club/family-colors.ts), so adding a
 * child or archiving someone used to shift other people's colors. Once the calendar, Sunday Setup, cleaning and the
 * Club all show them, a color has to stay put. On every save the app pins a color for each person:
 *   1. a color she picked (sent in this save, or saved before) wins;
 *   2. otherwise the color this person is already being shown, worked out from the family as it was BEFORE the change;
 *   3. a new person gets a color nobody has (pinned by the save after they get an id).
 * Never overwrites a saved color. The database merges colors too (household_save_core), so an older page that leaves
 * colors out can't wipe them.
 */
import { memberColors, isMarkerColor } from '../../data/club/family-colors';
import type { Household } from '../club/profile';

type Colors = Record<string, string>;
const savedColors = (h: Pick<Household, 'preferences'> | null | undefined): Colors =>
  ((h?.preferences as { colors?: Colors } | undefined)?.colors ?? {});

/**
 * The colors to send with a save.
 * @param before  the household as it was loaded (null for a brand-new family)
 * @param memberIds ids of the existing people in this save (new people have no id yet)
 * @param sent    colors in the preferences being saved (her explicit choices)
 */
export function pinMemberColors(before: Pick<Household, 'members' | 'preferences'> | null, memberIds: string[], sent: Colors = {}): Colors {
  const out: Colors = {};
  const saved = savedColors(before);
  const shown = before ? memberColors(before) : {};
  for (const id of memberIds) {
    const pick = isMarkerColor(sent[id]) ? sent[id] : isMarkerColor(saved[id]) ? saved[id] : shown[id]?.id;
    if (pick) out[id] = pick;
  }
  return out;
}

/** People in a saved household who still have no pinned color (new people, right after their first save). */
export function unpinned(h: Pick<Household, 'members' | 'preferences'>): string[] {
  const saved = savedColors(h);
  return h.members.filter((m) => !m.archived && !isMarkerColor(saved[m.id])).map((m) => m.id);
}
