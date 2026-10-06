/**
 * Canonical month colors from the printed Organized Mom Collective calendar.
 * Do not alter these values — they must match print.
 *
 * Used for month-specific UI only (month cells, weekend project, the current
 * month marker). Weekday colors live in src/styles/global.css (@theme).
 */
export const monthColors = [
  { name: 'January', hex: '#CDDDE1', description: 'soft frost blue' },
  { name: 'February', hex: '#E8D2D6', description: 'powder blush' },
  { name: 'March', hex: '#C7DED3', description: 'pale mint' },
  { name: 'April', hex: '#DDD8E8', description: 'washed lilac' },
  { name: 'May', hex: '#D4DFC4', description: 'soft leaf' },
  { name: 'June', hex: '#F1D8A8', description: 'pale apricot' },
  { name: 'July', hex: '#ECCBC2', description: 'faded coral' },
  { name: 'August', hex: '#DCCFAE', description: 'faded wheat' },
  { name: 'September', hex: '#CDD2BC', description: 'muted olive' },
  { name: 'October', hex: '#D8B79F', description: 'soft clay' },
  { name: 'November', hex: '#D5C5B8', description: 'warm mushroom' },
  { name: 'December', hex: '#BBCBC4', description: 'pale evergreen' },
] as const;

/** Month color by JS month index (0 = January). */
export function monthColor(month: number): string {
  return monthColors[((month % 12) + 12) % 12].hex;
}
