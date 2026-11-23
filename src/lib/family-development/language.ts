/**
 * Parent-facing language for the development engine. One source for the weekly Family Meeting, check-ins, buttons
 * and confirmations. The stored values stay 'model' · 'assist' · 'watch' · 'launch'.
 *
 * Two-tab redesign (docs/ios/TWO_TAB_REDESIGN.md): the stages are INVISIBLE. No screen shows a stage's name, a stage
 * indicator or a progression; parents see what to do next ("Do it together…") and choose actions ("Ready to do it
 * together"). MAWL_LABEL stays for the engine's internal wording and records, never rendered as a label.
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

/** The action that moves one stage forward, by the current stage, in plain words (no stage names). Launch has none. */
export function advanceLabel(stage: MawlStage): string | null {
  switch (stage) {
    case 'model': return 'Ready to do it together';
    case 'assist': return 'Ready to try it while you coach';
    case 'watch': return HAND_OVER_LABEL;
    case 'launch': return null;
  }
}

/** The action that moves one stage back, by the current stage, in plain words. Model has none. */
export function stepBackLabel(stage: MawlStage): string | null {
  return practiceBackLabel(stage);
}

/** Where a new responsibility starts, asked as how much help the child needs at first (never as a stage). */
export function startChoices(firstName: string): { stage: MawlStage; label: string }[] {
  return [
    { stage: 'model', label: `Show ${firstName} how first` },
    { stage: 'assist', label: 'We’ll do it together' },
    { stage: 'watch', label: `${firstName} can mostly do it; I’ll coach` },
    { stage: 'launch', label: `${firstName} already owns it` },
  ];
}

/** Internal short names (logs, tests). Never rendered: the redesign shows no stage indicator. */
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
