import type { PlanResource } from '../plan/resource';

export type MayKey = 'morning'|'move'|'create'|'lunch'|'quiet'|'free'|'snack'|'evening';
export type MayEdit = { title?: string; desc?: string; time?: string };
export interface MayOptions {
  start: number;
  quiet: 'independent'|'rest'|'older';
  play: 'outdoors'|'active'|'creative'|'mixed';
  structure: 'relaxed'|'balanced'|'structured';
  days: 'home'|'mixed'|'camp';
  snack: boolean;
}
export interface MayState {
  options: MayOptions;
  edits: Partial<Record<MayKey, MayEdit>>;
  order: MayKey[];
  removed: MayKey[];
  rows: Array<{key: MayKey; title: string; desc: string; time: string}>;
  familyLabel: string;
}
export type MayPlan = PlanResource<MayState>;
