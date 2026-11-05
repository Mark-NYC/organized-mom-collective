/**
 * A month's coordinated tints for its Club printables, from the physical calendar's own month color
 * (src/theme.ts `monthColors`): four subtle steps for the Words of the Week, a wash for the focus, and a deep accent
 * for small labels that keeps readable contrast (at least 4.5:1 on every tint). Family-member marker colors are separate
 * (src/data/club/family-colors.ts) and never come from here.
 */
import { monthColors } from '../../theme';

const IVORY = '#FBF7F1';
const INK = '#3F3B39';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
/** `amount` of `a` over `b` (0..1). */
const mix = (a: string, b: string, amount: number) => { const x = rgb(a); const y = rgb(b); return hex(x.map((v, i) => v * amount + y[i] * (1 - amount))); };
const lum = (h: string) => { const [r, g, b] = rgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const hsl = (h: string): [number, number, number] => {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(hue * 60 + 360) % 360, s, l];
};
const fromHsl = (h: number, s: number, l: number) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return hex([r, g, b].map((v) => (v + m) * 255));
};
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

export interface MonthTints {
  base: string;
  /** Week 1 → 4: lightest to the calendar color itself. */
  weeks: [string, string, string, string];
  wash: string;
  accent: string;
}

/** `month`: 'YYYY-MM' or a 0-based month index. */
export function monthTints(month: string | number): MonthTints {
  const i = typeof month === 'number' ? month : Number(month.slice(5, 7)) - 1;
  const base: string = monthColors[((i % 12) + 12) % 12].hex;
  const weeks = [0.4, 0.6, 0.8, 1].map((a) => mix(base, IVORY, a)) as MonthTints['weeks'];
  // The month's own hue, deepened until small text on the strongest tint reads clearly (never just gray).
  const [h, sat] = hsl(base);
  let accent = base;
  for (let l = 0.4; l >= 0.15 && contrast(accent, base) < 4.5; l -= 0.02) accent = fromHsl(h, Math.max(sat, 0.3), l);
  return { base, weeks, wash: mix(base, IVORY, 0.7), accent };
}
