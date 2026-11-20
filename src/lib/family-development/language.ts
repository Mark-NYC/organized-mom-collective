/**
 * Parent-facing MAWL language (owner decision 2026-11-20, PR 515). One source for every screen that names a stage:
 * the weekly Family Meeting, development coaching, check-ins, buttons and confirmations. The stored values stay
 * 'model' · 'assist' · 'watch' · 'launch'.
 *
 * Doing something on their own is progress (a check-in answer). Taking full responsibility is Launch: a separate,
 * explicit family decision ("Hand over responsibility"), never inferred from a check-in.
 */
import type { MawlStage } from './framework';

export const MAWL_LABEL: Record<MawlStage, string> = {
  model: 'I’ll show them how',
  assist: 'We’ll do it together',
  watch: 'They’ll do it, I’ll coach',
  launch: 'Ready to take full responsibility',
};

/** The one action that moves a child from Watch to Launch. */
export const HAND_OVER_LABEL = 'Hand over responsibility';

/** Shown only after the database confirmed the Launch decision. */
export const LAUNCH_CONFIRMATION = 'Great! This is now their responsibility. You can always step back and practice together again if needed.';

/** In Watch: doing it independently is not the same as taking full responsibility. */
export const WATCH_DISTINCTION = 'Doing it on their own is progress. Handing over responsibility is a separate choice you make, when you’re ready.';

/** The button that moves one stage forward, by the current stage. Launch has none. */
export function advanceLabel(stage: MawlStage): string | null {
  switch (stage) {
    case 'model': return `Next: ${MAWL_LABEL.assist}`;
    case 'assist': return `Next: ${MAWL_LABEL.watch}`;
    case 'watch': return HAND_OVER_LABEL;
    case 'launch': return null;
  }
}

/** The button that moves one stage back, by the current stage. Model has none. */
export function stepBackLabel(stage: MawlStage): string | null {
  switch (stage) {
    case 'model': return null;
    case 'assist': return `Step back: ${MAWL_LABEL.model}`;
    case 'watch': return `Step back: ${MAWL_LABEL.assist}`;
    case 'launch': return `Step back: ${MAWL_LABEL.watch}`;
  }
}
