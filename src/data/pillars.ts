/**
 * Resource library pillars: the three content clusters every article belongs to.
 * Strategy and the planned articles: docs/editorial/CONTENT_CLUSTERS.md.
 *
 * Each article names one `pillar` in its frontmatter (src/content/articles/*.mdx)
 * and a tracker id starting with that pillar's `prefix` (e.g. HC-01).
 * The hub (/resources) and each pillar page (/resources/topics/<id>) group
 * articles by this list, in this order. An `id` is part of a public URL, so
 * never rename one; add a new pillar instead.
 */

export interface Pillar {
  id: string;
  /** Tracker id prefix, e.g. 'HC' → HC-01 … */
  prefix: string;
  name: string;
  /** One line for cards and the pillar page intro. */
  summary: string;
  /** Meta description for the pillar page. */
  description: string;
}

export const pillars = [
  {
    id: 'family-planning',
    prefix: 'FP',
    name: 'Family Planning & Routines',
    summary: 'One place for the family’s week: the calendar, a short weekly reset, the home command center, and dinners planned with the grocery list beside them.',
    description: 'How to plan your family’s week: a calendar everyone uses, a home command center, a weekly reset, and meal planning with a grocery list that writes itself.',
  },
  {
    id: 'home-cleaning',
    prefix: 'HC',
    name: 'Simple Home Cleaning',
    summary: 'A short daily reset, one zone a day, one monthly project, and a realistic way to catch up when the week got away from you.',
    description: 'Simple home cleaning routines for busy families: a 15-minute daily reset, weekly zones, a monthly project, and a realistic catch-up plan.',
  },
  {
    id: 'intentional-family-life',
    prefix: 'IF',
    name: 'Intentional Family Life',
    summary: 'Room in a busy week for what matters: family priorities, gratitude, prayer, your own well-being, and work that’s shared fairly.',
    description: 'Simple habits for an intentional family life: weekly priorities, gratitude, prayer, realistic self-care, and sharing the work of running a home.',
  },
] as const satisfies readonly Pillar[];

export type PillarId = (typeof pillars)[number]['id'];

export const pillarIds = pillars.map((p) => p.id) as [PillarId, ...PillarId[]];

export function getPillar(id: PillarId): Pillar {
  const p = pillars.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown pillar: ${id}`);
  return p;
}
