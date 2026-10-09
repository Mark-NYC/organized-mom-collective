/**
 * Resource library pillars: the three content clusters every article belongs to.
 * Strategy and the planned articles: docs/editorial/CONTENT_CLUSTERS.md.
 *
 * Each article names one `pillar` in its frontmatter (src/content/articles/*.mdx)
 * and a tracker id starting with that pillar's `prefix` (e.g. CR-01).
 * The hub (/resources) and each pillar page (/resources/topics/<id>) group
 * articles by this list, in this order. An `id` is part of a public URL, so
 * never rename one; add a new pillar instead.
 */

export interface Pillar {
  id: string;
  /** Tracker id prefix, e.g. 'FS' → FS-01 … */
  prefix: string;
  name: string;
  /** One line for cards and the pillar page intro. */
  summary: string;
  /** Meta description for the pillar page. */
  description: string;
}

export const pillars = [
  {
    id: 'family-schedules',
    prefix: 'FS',
    name: 'Family Schedules & Routines',
    summary: 'One place for who goes where, a short weekly reset, and daily routines that run on habit instead of reminders.',
    description: 'How to organize your family’s week: one calendar everyone uses, a short weekly reset, and simple routines that share the mental load.',
  },
  {
    id: 'cleaning-routines',
    prefix: 'CR',
    name: 'Cleaning Routines',
    summary: 'A short daily reset, one zone a day, and a monthly project, so the house never needs a whole Saturday.',
    description: 'Simple cleaning routines for busy families: a daily reset, weekly zones, a monthly home project, and chores the whole family can share.',
  },
  {
    id: 'meal-planning',
    prefix: 'MP',
    name: 'Meal Planning',
    summary: 'Dinners decided once a week, with the grocery list written right beside them and a backup for chaotic nights.',
    description: 'Weekly meal planning for busy families: fewer dinner decisions, a grocery list built from the plan, and backups for the nights that go sideways.',
  },
] as const satisfies readonly Pillar[];

export type PillarId = (typeof pillars)[number]['id'];

export const pillarIds = pillars.map((p) => p.id) as [PillarId, ...PillarId[]];

export function getPillar(id: PillarId): Pillar {
  const p = pillars.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown pillar: ${id}`);
  return p;
}
