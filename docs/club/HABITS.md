# Habit intelligence (month-independent)

How the Club turns a family's own answers into one or two small habit experiments, for any month. January's
Family Focus (formerly the Family Meeting Companion) is the first resource that uses it (docs/club/PERSONALIZATION.md).

## Four layers

| Layer | Where | Reusable? |
| --- | --- | --- |
| Family context and stated priorities | `src/lib/club/habits/context.ts` | Yes. Children (age, stage, what they already do, her wishes for them, her named activities, school), her priority and challenges, open wishes, and progress from later check-ins |
| Monthly theme and responsibility outcome | `MonthTheme` + `Opportunity[]` in each month's content (January: `src/data/club/meeting-guides/2027-01.ts`) | The shape is shared; each month fills it in |
| Selection of behaviors and habit interventions | `src/lib/club/habits/focus.ts`, `recommend.ts`; behaviors in `src/data/club/habit-library.ts` | Yes |
| Presentation in the monthly resource | January: `src/lib/club/meeting-guide/generate.ts`, `MeetingGuidePrintable.astro` | No, per resource |

## Genuinely reusable rules

- **Focus scoring** (`scoreOpportunities`): her priority 3, each matching challenge 2, a wish she named for a child 2,
  an open wish 1, plus impact, readiness and habit potential. Only what she reported counts; ties go to her top priority.
- **Fit** (`fits`): a behavior needs a version for the child's stage, must be allowed this month, can't be something the
  child already does, school-only behaviors are skipped when school is out, and activity behaviors need an activity she
  named for that child.
- **The fewest experiments that matter** (`recommendHabits`): her wish for a child first, then open wishes, then the
  focus's own behaviors. The best one, and a second only for a different child and a different kind of job, up to the
  month's maximum. Never one per child to include everyone.
- **Focus from wishes alone** stays with those wishes (no unexplained jobs for siblings).
- **Larger families** (`sharedFrom` children with a fitting behavior): one shared routine, adapted by age.
- **Anchors**: options to discuss, unless her information confirms one: school nights for a child she listed in
  school, or the evenings before an activity she named (on the days she gave). Never a season or an activity's schedule
  we assume.
- **Ownership and support** on every experiment, from the library, by stage.
- **Progress** (`ProgressMap`, from future check-ins): independent or retired → not suggested again, recognized;
  struggling → the simpler version of the same behavior. Never a guess at why.
- **Too little intake** (`starterHabits`): the month's shared habit and at most one idea clearly marked "to consider".
- **Suggestions are not commitments**: experiments are saved as `SuggestedIdea`; only a family's choice makes a
  `Commitment` (src/lib/club/family-plan.ts).

## January-specific

- Its opportunities (mornings, evenings, school, schedules, reminders, home, laundry, sharing) and their copy.
- `theme`: school in session, at most two experiments, shared routine from four children, all library behaviors allowed.
- The starter: the Family Meeting habit, plus the calendar check as the one idea to consider.
- Presentation: one focus, three conversation starters, experiments under Everyone's Part, one-page layout.

## Using it in another month

1. Write the month's content: a `MonthTheme` (e.g. July: `schoolInSession: false`, `maxExperiments: 1`) and its
   `Opportunity[]` (e.g. "I'm bored!" → items that build initiative).
2. Add any new behaviors to the shared library (with stage versions, anchors, ownership and support). Reuse existing
   ones where they fit.
3. Call `familyContext` → `scoreOpportunities` → `recommendHabits` (or `starterHabits`) and present the result in the
   month's own resource. Pass progress from check-ins once they exist.

Tests: `tests/club-habits.test.ts` shows the same logic handling a preschooler's simple routine, a teen's seasonal
activity, five children sharing one challenge, school versus summer, and progress. January's own behavior is in
`tests/club-meeting-guide-generator.test.ts`.

## Optional weekly check-ins: future plan (not built)

**Goal.** After a Family Meeting, Mom can answer one optional question per habit the family *chose*:
"How did Sofia do with packing her school bag this week?" No reminders, streaks, rewards, daily tracking or
admin work for her: skipping a check-in changes nothing.

**States, and where each already lives.** Suggestions and commitments stay separate records
(`src/lib/club/family-plan.ts`); nothing becomes a commitment because it was shown, kept or printed.

| State | Meaning | Today |
| --- | --- | --- |
| Suggested | The Club recommends an experiment | `SuggestedIdea` (`status: 'suggested'`) in the month's saved `plan` |
| Kept | Mom left it on the printable | `kept` / not `hidden` in the guide state (review only; **not** a commitment) |
| Chosen | The family decided to practice it | `commit(idea, chosenVia, on)` → `Commitment` (`status: 'accepted'`) |
| Practicing | Working on it | `Commitment.progress = 'practicing'` |
| Established | Doing it on their own | `progress = 'independent'` |
| Adjusted | Still needs reminders, or not working yet: change the cue or setup | `progress = 'improving'` or `'struggling'` + barrier |
| Stopped | The family moved on | `progress = 'retired'` |

**Answers → what happens next** (`nextStep`, `BARRIER_PRINCIPLE`):

- *Doing it independently* → `independent`: celebrate on the next Family Focus; the engine already recognizes it
  (`ctx.progress`, "already takes care of") and adds nothing new automatically.
- *Improving, still needs reminders* → `improving`: keep the habit; next month's card offers a clearer single cue or
  the stage's environmental support (`principle: 'trigger' | 'environment'`).
- *Not working yet* → ask one follow-up for the likely barrier (forgets, too hard, not set up, not interested,
  schedule); `struggling` already gives the simpler stage version, and the barrier picks the principle to change.
- *Didn't try it / chose something else* → **not a failure**. Today `moved-on` retires it; add a separate
  `not-tried` answer that leaves progress untouched (or returns the idea to a suggestion).

**Minimum still needed (when we build it).**

1. Data: a `Commitment` store per household (one small table, or the month's saved state) holding commitments and
   their check-in history; the `not-tried` answer; `checkInDue` changed from every 6–8 weeks to "after a meeting,
   optional", never nagging.
2. UI: a "We chose this" action next to a kept idea (the only way a commitment is created), and one optional
   check-in card per active commitment on Club Home after the week's meeting. No list to manage.
3. Engine: pass stored progress into `familyContext(..., { progress })` (already supported), and make `improving`
   prefer the stage's support or a single confirmed anchor.

Nothing here adds onboarding questions, and future months read these records, not PDF text.
