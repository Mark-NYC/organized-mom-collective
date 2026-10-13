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
  /** Days before the page's date field; the computed date shows after the title. */
  due?: number;
  /** The number shown on a `step` group. */
  step?: number;
  /** A lined notes box instead of items. */
  notes?: string;
}

export interface ChecklistSection {
  title: string;
  /** Groups side by side on the printed page (phones stack them). */
  groupCols?: 2 | 3;
  groups: ChecklistGroup[];
}

export interface ChecklistPage {
  /** Fill-in fields under the title, e.g. family name and school year. */
  info?: { field: string; label: string; placeholder: string; type?: 'text' | 'date' }[];
  sections: ChecklistSection[];
}

export const blanks = (n: number) => Array.from({ length: n }, () => '');
