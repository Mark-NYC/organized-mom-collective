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
/** Fired on the page root (`.club-plan`) when approval changes, so the desktop rail and the plan screen agree. */
export const PLAN_APPROVAL = 'club:plan-approval';

export type PlanResourceHost<S> = HTMLElement & { clubPlan?: PlanResource<S> };
/**
 * Welcome Kit mode (her first month, /app/club/<month>?welcome=1): WelcomeKitConfirm sets data-plan-welcome on the
 * page root and fires PLAN_WELCOME; the rail and the phone bar then say "Approve for printing", and a click fires
 * PLAN_WELCOME_APPROVE, which records her review and takes her back to her Welcome Kit.
 */
export const PLAN_WELCOME = 'club:plan-welcome';
export const PLAN_WELCOME_APPROVE = 'club:plan-welcome-approve';
export const inWelcomeKit = (root: HTMLElement) => root.hasAttribute('data-plan-welcome');
/**
 * The permanent Welcome resource (/app/club/family-rhythm, ClubPlanShell context="welcome"): not a month, so no
 * editing deadline, no monthly Family Meeting, and her approval is kept on her account. Evergreen: nothing asks her to
 * come back, check in or approve again.
 */
export const isWelcomeResource = (root: HTMLElement) => root.dataset.planContext === 'welcome';
