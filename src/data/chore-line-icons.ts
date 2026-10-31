/** Hand-drawn monochrome artwork exclusively for the free chore chart. */
const svgs = import.meta.glob<string>('../../assets/icons/ofc/updatedicons/svg/*.svg', { eager: true, query: '?url', import: 'default' });
const march = import.meta.glob<string>('../../assets/icons/ofc/march/*.webp', { eager: true, query: '?url', import: 'default' });
const icons: Record<string, string> = {
  'brush-my-teeth': 'toothbrush', 'get-dressed': 'shirt', 'wash-my-hands': 'washing-hands',
  'pack-my-backpack': 'backpack', 'get-ready-for-bed': 'pajamas', 'comb-my-hair': 'shirt',
  'make-my-bed': 'made-bed', 'put-toys-away': 'toys-away', 'put-clothes-away': 'folded-clothes',
  'tidy-my-desk': 'tidy-desk', 'clean-my-floor': 'vacuum-cleaner', 'set-the-table': 'dish',
  'clear-the-table': 'clear-dishes', 'help-with-laundry': 'laundry-basket-with-clothes',
  'wipe-the-counters': 'wipe-surface', 'take-out-the-trash': 'trash-bin',
};
export function choreLineIcon(id: string): string | null {
  const name = icons[id];
  if (!name) return null;
  return svgs[`../../assets/icons/ofc/updatedicons/svg/${name}.svg`] ??
    march[`../../assets/icons/ofc/march/${name}.webp`] ?? null;
}
