/**
 * The contract between a month's printable and the shared Club plan screen (src/components/club/plan/).
 *
 * Each month's printable owns its state and its rules (an engine in src/lib/club/engines/) and publishes a
 * controller on its root element as `clubPlan`. The plan screen, approval and copy mode only ever go through
 * this interface, so the printable is the single source of what prints. After every change the printable
 * dispatches PLAN_CHANGE (bubbling) from its root.
 */
export interface PlanResource<S> {
  /** True once a family has been applied. */
  ready(): boolean;
  state(): S;
  /** Change the plan; the printable repaints and saves to this tab (unless saving is paused). */
  update(change: (s: S) => void): void;
  replace(s: S): void;
  /** Pause saving (a one-time copy) or resume it (saves the current plan). */
  setPersist(on: boolean): void;
  /** Everything that prints, as a stable string: what approval is checked against. */
  fingerprint(): string;
}

export const PLAN_CHANGE = 'club:plan-change';

export type PlanResourceHost<S> = HTMLElement & { clubPlan?: PlanResource<S> };
