/**
 * Family-member colors for every Club resource, read through January's one assignment (src/data/club/family-colors.ts
 * → memberColors): her saved choices by stable member id in household.preferences.colors, then the remaining marker
 * colors in family order. Nothing here assigns a color; it only adds what printing needs:
 * - `ink`: the same hue darkened until small text reads at 4.5:1 or better on white and on the palest panel tints,
 *   so a name can be printed in its color (orange or pink marker ink is too light for 10px type).
 * - a neutral fallback for anyone without a color (a typed name, a member the saved plan no longer knows).
 * Color is never the only identity: every use prints the name beside it (./marks.ts → ownerTag).
 */
import { memberColors, type MarkerColor } from '../../../data/club/family-colors';
import type { Household } from '../profile';
import { contrast } from '../month-tints';

export interface MemberColor extends MarkerColor {
  /** Readable text color in the same hue. */
  ink: string;
}

/** The palest backgrounds names sit on in the migrated months (August's wheat panel, May's morning tint). */
const PAPERS = ['#FFFFFF', '#F4ECD9', '#F8E8B5'];
const CHARCOAL = '#2B2826';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v * (1 - t) + y[i] * t)); };

/** The marker color, darkened toward charcoal only as far as small text needs. */
export function inkOf(hex: string): string {
  for (let t = 0; t <= 1; t += 0.05) {
    const ink = mix(hex, CHARCOAL, t);
    if (PAPERS.every((p) => contrast(ink, p) >= 4.5)) return ink;
  }
  return CHARCOAL;
}

/** Anyone without a color: warm charcoal, still paired with the name. */
export const NEUTRAL_COLOR: MemberColor = { id: 'neutral', label: 'Neutral', hex: '#9A918B', ink: '#4D4544' };

/** Everyone's color by member id, exactly as January assigns it. */
export function familyColors(h: Pick<Household, 'members' | 'preferences'>): Record<string, MemberColor> {
  return Object.fromEntries(Object.entries(memberColors(h)).map(([id, c]) => [id, { ...c, ink: inkOf(c.hex) }]));
}

export const colorFor = (colors: Readonly<Record<string, MemberColor>> | undefined, id: string | undefined): MemberColor =>
  (id && colors?.[id]) || NEUTRAL_COLOR;
