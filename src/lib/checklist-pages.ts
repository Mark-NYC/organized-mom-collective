/**
 * Data shape for multi-page fill-in checklists (src/components/site/ChecklistPages.astro): US Letter portrait
 * pages of sections, each section a list of groups. Field ids come from position (page, section, group,
 * item), so reordering starter items shifts saved entries.
 */

export interface ChecklistGroup {
  title: string;
  /** Item columns on the printed page (phones always use one). */
  cols?: 1 | 2 | 3;
  /** Starter items; an empty string is a blank line to write in. */
  items?: string[];
  /** priority: dashed rose box. timeline: sage box. step: a numbered step box (set `step`). */
  variant?: 'priority' | 'timeline' | 'step';
  /** The number shown on a `step` group. */
  step?: number;
  /** A lined notes box instead of items. */
  notes?: string;
}

export interface ChecklistSection {
  title: string;
  groups: ChecklistGroup[];
}

export interface ChecklistPage {
  /** Fill-in fields under the title, e.g. family name and school year. */
  info?: { field: string; label: string; placeholder: string }[];
  sections: ChecklistSection[];
}

export const blanks = (n: number) => Array.from({ length: n }, () => '');
