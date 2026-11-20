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

/** The small stage indicator on a card. The approved MAWL_LABEL stays the stage's full name. */
export const STAGE_SHORT: Record<MawlStage, string> = {
  model: 'Learning',
  assist: 'Together',
  watch: 'Practicing',
  launch: 'Their responsibility',
};

/**
 * One short line of coaching per stage, in the family's words. It never quotes the skill's title (titles are written
 * as the child says them, "Reset my bedroom") and never guesses a child's pronouns.
 */
export function coachLine(stage: MawlStage, firstName: string): string {
  switch (stage) {
    case 'model': return `Show ${firstName} how it’s done, step by step, and what finished looks like.`;
    case 'assist': return `Do it together, and hand ${firstName} one more step each time.`;
    case 'watch': return `Let ${firstName} do it while you observe. Help them notice anything they miss, especially when the routine changes.`;
    case 'launch': return `It’s ${firstName}’s responsibility now. Notice it and say thanks.`;
  }
}

/** A new skill starts with Model: the first thing to do, in one line. */
export const suggestCoachLine = (firstName: string) =>
  `Start by showing ${firstName} how it’s done. Practice together before asking them to try it alone.`;

/** The one obvious next action on an active responsibility (it keeps the stage). */
export const keepLabel = (stage: MawlStage) => (stage === 'launch' ? 'Keep it as theirs' : 'Keep practicing');

/** The quieter "move back one stage" action, named for where it goes, with the stage's full name as detail. */
export function practiceBackLabel(stage: MawlStage): string | null {
  switch (stage) {
    case 'model': return null;
    case 'assist': return 'Show them again';
    case 'watch': return 'Practice together again';
    case 'launch': return 'Coach them again';
  }
}
