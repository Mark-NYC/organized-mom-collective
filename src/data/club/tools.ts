/**
 * The site's own tools that a Club kit can open, inside the Club (docs/club/KIT_TEMPLATE.md → Tools). One
 * implementation per tool: the Club page hosts the same component as the public page (no Club copy), with the Club's
 * layout (no site navigation, no trackers) and a handoff (src/lib/tool-handoff.ts) carrying a child's name and age
 * and a starting choice, so she doesn't type what her family profile already says.
 *
 * To add one: give the tool's component a `handoff` mode that reads readToolHandoff(id) (see RoutineChart.astro and
 * src/components/site/routine-chart.ts), add a page at src/pages/club/tools/<id>.astro, and list it here.
 */
import { routes } from '../../routes';

export interface ClubTool {
  id: string;
  /** The Club page that hosts it. */
  path: string;
  /** The public page with the same tool (the source of truth for how it works). */
  publicPath: string;
  /** Opened for one child at a time: the kit asks who it's for. */
  perChild: boolean;
  /** Starting choices the kit can offer before opening (the tool's own ids). */
  variants?: { id: string; label: string }[];
}

export const clubTools = {
  'routine-chart': {
    id: 'routine-chart',
    path: routes.clubTool('routine-chart'),
    publicPath: routes.routineChart,
    perChild: true,
    variants: [
      { id: 'morning', label: 'Morning' },
      { id: 'afterschool', label: 'After school' },
    ],
  },
} satisfies Record<string, ClubTool>;

export type ClubToolId = keyof typeof clubTools;
export const clubToolById = (id: string): ClubTool | undefined => (clubTools as Record<string, ClubTool>)[id];
