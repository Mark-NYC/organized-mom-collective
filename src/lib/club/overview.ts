/**
 * A kit's overview: the few things worth doing first, out of the full plan, so she starts with 5–8 actions instead of
 * a long checklist. Shared prep by priority first, then each child's most useful task, so every child in school is
 * represented (up to the room left after three shared tasks). Reads the live chart rows, so her edits (a reassigned or removed task) show here too.
 */
import type { KitItem } from '../../data/club/types';
import type { ChartRow } from './edits';

export function topActions(rows: readonly ChartRow[], items: readonly KitItem[], limits: { minActions: number; maxActions: number }): ChartRow[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ranked = rows
    .map((r) => ({ r, item: r.itemId ? byId.get(r.itemId) : undefined }))
    .filter((x): x is { r: ChartRow; item: KitItem } => x.item?.priority !== undefined)
    .sort((a, b) => a.item.priority! - b.item.priority! || (a.r.rowId < b.r.rowId ? -1 : 1));
  const sharedRows = ranked.filter((x) => x.item.scope === 'household');
  // Each child's best task (lowest priority number), one per child.
  const childBest = new Map<string, ChartRow>();
  for (const x of ranked) if (x.item.scope === 'each' && x.r.ownerId && !childBest.has(x.r.ownerId)) childBest.set(x.r.ownerId, x.r);
  // Keep at least three shared tasks; the rest of the room goes to the children, one each, so big families see everyone.
  const kids = [...childBest.values()].slice(0, Math.max(0, limits.maxActions - Math.min(3, sharedRows.length)));
  const sharedCount = Math.max(0, limits.maxActions - kids.length);
  const picked = [...sharedRows.slice(0, sharedCount).map((x) => x.r), ...kids];
  // Not enough yet: top up from whatever's left, in priority order.
  for (const x of ranked) {
    if (picked.length >= limits.minActions) break;
    if (!picked.includes(x.r)) picked.push(x.r);
  }
  return picked.slice(0, limits.maxActions);
}
