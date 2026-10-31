/** Hand-drawn monochrome artwork exclusively for the free chore chart. */
const svgs = import.meta.glob<string>('../../assets/icons/ofc/updatedicons/svg/*.svg', { eager: true, query: '?url', import: 'default' });
const march = import.meta.glob<string>('../../assets/icons/ofc/march/*.webp', { eager: true, query: '?url', import: 'default' });
const icons: Record<string, string> = {
  'brush-my-teeth': 'toothbrush', 'get-dressed': 'shirt', 'wash-my-hands': 'washing-hands',
  'pack-my-backpack': 'backpack', 'get-ready-for-bed': 'pajamas',
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

/** Match starter chores that are not part of the 16-card responsibility library. */
export function choreLineIconForText(text: string): string | null {
  const value = text.toLowerCase();
  const matches: Array<[RegExp, string]> = [
    [/toy|playroom/, 'toys-away'],
    [/bed|sheet|linen/, 'made-bed'],
    [/tooth|hygiene/, 'toothbrush'],
    [/backpack|school material|school supplies|school clothes/, 'backpack'],
    [/clothes|dressed|closet/, 'folded-clothes'],
    [/laundry|hamper/, 'laundry-basket-with-clothes'],
    [/dishwasher|dishes|table|kitchen cleanup/, 'dish'],
    [/trash|garbage/, 'trash-bin'],
    [/vacuum|floor|mop/, 'vacuum-cleaner'],
    [/dust|wipe|sink|bathroom|clean/, 'spray-bottle-cloth'],
    [/meal|dinner|cook|grocer|snack/, 'cooking-pot'],
    [/books|homework|study/, 'book'],
    [/plant|outdoor/, 'tree'],
    [/pet/, 'basket'],
    [/schedule|plan|tomorrow|week/, 'calendar'],
    [/morning|personal care/, 'morning-start'],
  ];
  for (const [test, name] of matches) {
    if (!test.test(value)) continue;
    const src = svgs[`../../assets/icons/ofc/updatedicons/svg/${name}.svg`] ??
      march[`../../assets/icons/ofc/march/${name}.webp`];
    if (src) return src;
  }
  return null;
}
