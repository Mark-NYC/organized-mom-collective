/**
 * V20 illustration treatment (docs/ios/V20_BASELINE.md → Visual system): the brand's own hand-drawn icons, charcoal
 * line, white-filled interiors (built by scripts/build-illustrated-badges.mjs), on a solid circle in the printed
 * calendar's palette (src/theme.ts monthColors).
 *
 * Color is chosen by MEANING, never decoration, and is the same everywhere: school is always January frost, home and
 * meals always June apricot, and so on. Used for activities, household, cleaning and responsibility illustrations only.
 * Navigation, chevrons, editing controls and other functional icons stay simple and black (Art in v16/shared.tsx).
 */
import { monthColors } from '../../theme';

const C = Object.fromEntries(monthColors.map((m) => [m.name, m.hex])) as Record<string, string>;

export type BadgeName = 'move-play' | 'school-bus' | 'conversation-bubbles' | 'toothbrush' | 'wrapped-gift' | 'family-meeting-around-a-table' | 'backpack' | 'car'
  | 'cooking-pot' | 'spray-bottle-cloth' | 'helping-hands' | 'breakfast-bowl' | 'calendar' | 'home' | 'trash-bin' | 'clothes-hanger' | 'lunchbox' | 'star'
  | 'clock' | 'string-lights' | 'sneakers' | 'book' | 'family-group';

/** One meaning, one calendar color. */
export const BADGE_COLOR: Record<BadgeName, string> = {
  backpack: C.January, 'school-bus': C.January, book: C.January, 'conversation-bubbles': C.January,
  'move-play': C.May, sneakers: C.May,
  'cooking-pot': C.June, lunchbox: C.June, 'breakfast-bowl': C.June, home: C.June,
  'spray-bottle-cloth': C.March, 'trash-bin': C.March, 'clothes-hanger': C.March,
  'family-meeting-around-a-table': C.February, 'family-group': C.February, 'helping-hands': C.February, 'wrapped-gift': C.February,
  toothbrush: C.April,
  calendar: C.November, clock: C.November,
  car: C.August,
  'string-lights': C.December, star: C.December,
};

const MATCH: [RegExp, BadgeName][] = [
  [/soccer|practice|game|swim|sport|meet\b/i, 'move-play'], [/field trip|bus/i, 'school-bus'], [/conference|teacher/i, 'conversation-bubbles'],
  [/dentist|doctor|checkup/i, 'toothbrush'], [/party|birthday|gift/i, 'wrapped-gift'], [/family meeting/i, 'family-meeting-around-a-table'],
  [/drive|ride|pick ?up/i, 'car'], [/dinner|cook|meal/i, 'cooking-pot'], [/lunch/i, 'lunchbox'], [/breakfast/i, 'breakfast-bowl'],
  [/wipe|clean|kitchen|bathroom|counter|zone/i, 'spray-bottle-cloth'], [/trash|recycl/i, 'trash-bin'], [/shoes|coat|entry|hang/i, 'clothes-hanger'],
  [/backpack|school|homework|folder/i, 'backpack'], [/book|read|library/i, 'book'], [/break|holiday|vacation/i, 'string-lights'],
  [/grandma|neighbou?r|dinner at/i, 'home'],
];
export const badgeFor = (text: string): BadgeName => MATCH.find(([re]) => re.test(text))?.[1] ?? 'calendar';

export function Badge({ name, size = 'md' }: { name: BadgeName; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span aria-hidden="true" className={`v20-badge v20-badge--${size}`} style={{ background: BADGE_COLOR[name] }} data-badge={name}>
      <img src={`/assets/icons/ofc/badges/${name}.png`} alt="" decoding="async" />
    </span>
  );
}
