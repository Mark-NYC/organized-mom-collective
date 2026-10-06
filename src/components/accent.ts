import type { Accent } from '../data/cleaning';

/** Tailwind classes per calendar color. Full class names so Tailwind can see them. */
export const accentClasses: Record<Accent, { tint: string; dot: string; border: string }> = {
  blue: { tint: 'bg-blue-tint', dot: 'bg-blue', border: 'border-blue' },
  blush: { tint: 'bg-blush-tint', dot: 'bg-blush', border: 'border-blush' },
  green: { tint: 'bg-green-tint', dot: 'bg-green', border: 'border-green' },
  apricot: { tint: 'bg-apricot-tint', dot: 'bg-apricot', border: 'border-apricot' },
};
