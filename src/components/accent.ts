import type { Accent } from '../data/cleaning';

/** Tailwind classes per calendar color. Full class names so Tailwind can see them. */
export const accentClasses: Record<Accent, { fill: string; rule: string }> = {
  blue: { fill: 'bg-blue', rule: 'border-blue' },
  blush: { fill: 'bg-blush', rule: 'border-blush' },
  green: { fill: 'bg-green', rule: 'border-green' },
  apricot: { fill: 'bg-apricot', rule: 'border-apricot' },
};
