/**
 * Family member colors: one familiar marker color per person, the same on the family profile, the monthly Family
 * Focus and (with her own pens) the wall calendar. Auto-assigned in family order, so nothing new is asked during
 * onboarding; she can change any of them on her family page. Saved by stable member id in
 * household.preferences.colors (supabase/migrations/20261120000000_club_household_colors.sql).
 *
 * Strong, recognizable pen colors so they print and photocopy well; every use shows the name too (and a letter
 * code), so nothing depends on color alone.
 */
import type { Household } from '../../lib/club/profile';

export interface MarkerColor { id: string; label: string; hex: string }

export const MARKER_COLORS: readonly MarkerColor[] = [
  { id: 'blue', label: 'Blue', hex: '#2B6CB0' },
  { id: 'green', label: 'Green', hex: '#2F855A' },
  { id: 'purple', label: 'Purple', hex: '#6B46C1' },
  { id: 'pink', label: 'Pink', hex: '#C53F7E' },
  { id: 'orange', label: 'Orange', hex: '#D9661F' },
  { id: 'teal', label: 'Teal', hex: '#18808B' },
  { id: 'red', label: 'Red', hex: '#C53030' },
  { id: 'brown', label: 'Brown', hex: '#8B5A2B' },
];

export const isMarkerColor = (v: unknown): v is string => typeof v === 'string' && MARKER_COLORS.some((c) => c.id === v);
export const markerColor = (id: string | undefined) => MARKER_COLORS.find((c) => c.id === id) ?? MARKER_COLORS[0];

/**
 * Everyone's color: her saved choices first, then the remaining colors in family order (children first, since they
 * use the calendar most; then grown-ups), so the assignment doesn't change from month to month.
 */
export function memberColors(h: Pick<Household, 'members' | 'preferences'>): Record<string, MarkerColor> {
  const saved = (h.preferences as { colors?: Record<string, string> }).colors ?? {};
  const people = h.members.filter((m) => !m.archived);
  const ordered = [...people.filter((m) => m.kind === 'child'), ...people.filter((m) => m.kind !== 'child')];
  const out: Record<string, MarkerColor> = {};
  const used = new Set<string>();
  for (const m of ordered) if (isMarkerColor(saved[m.id]) && !used.has(saved[m.id])) { out[m.id] = markerColor(saved[m.id]); used.add(saved[m.id]); }
  let i = 0;
  for (const m of ordered) {
    if (out[m.id]) continue;
    while (i < MARKER_COLORS.length && used.has(MARKER_COLORS[i].id)) i++;
    out[m.id] = MARKER_COLORS[i % MARKER_COLORS.length];
    used.add(out[m.id].id);
    i++;
  }
  return out;
}
