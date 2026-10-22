/**
 * The month's action (three-part kits): which lines are checked off and who's helping with each, saved as the kit's
 * own document (its printable id, e.g. 'countdown'). Nothing is assigned; a blank helper is fine.
 */

export interface ActionState {
  done: boolean[];
  helpers: string[];
}

export const MAX_HELPER = 40;

/** Saved JSON → state for `lines` lines, dropping anything malformed. */
export function readAction(json: unknown, lines: number): ActionState {
  const o = (json && typeof json === 'object' ? json : {}) as { done?: unknown; helpers?: unknown };
  const done = Array.isArray(o.done) ? o.done : [];
  const helpers = Array.isArray(o.helpers) ? o.helpers : [];
  return {
    done: Array.from({ length: lines }, (_, i) => done[i] === true),
    helpers: Array.from({ length: lines }, (_, i) => (typeof helpers[i] === 'string' ? (helpers[i] as string).replace(/\s+/g, ' ').slice(0, MAX_HELPER) : '')),
  };
}
