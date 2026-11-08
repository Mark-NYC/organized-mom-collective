# Shared family personalization foundation

One way for every monthly resource to use the family's saved profile, built from January's architecture
(docs/club/PERSONALIZATION.md) and used first by **March** (Family Chore Charts), **May** (Our Summer Day) and
**August** (Back to School Without the Scramble). The other nine months still prepare from names and ages only;
moving one over is the checklist at the end. There is one personalization engine, not one per month: each month
keeps its own content, layout and rules (its engine in `src/lib/club/engines/`) and asks the foundation who's in the
family, what they already do, and who should own each of its jobs.

## What it does

| Need | Where | Rule |
| --- | --- | --- |
| The family for a month | `src/lib/club/personalize/family.ts` → `familyContext` | People by stable member id, archived left out, ages on the first day of the resource's month and January's age stages (`meeting-guide/stages.ts`); the account holder marked |
| Her profile answers (steps 2–6) | `familySnapshot`, `existingFor`, `wishedFor`, `activitiesOf`, `schoolStartFor` | Who already owns or helps with an area, which child she wished a job for, each person's activities and days, when school starts. Answers naming someone who left don't count |
| Saved means settled | `FamilySnapshot` in the month's state, `settledSnapshot` | Once a plan has a snapshot it's rebuilt from it, never from newer answers; newer answers come in only when she restores the prepared plan. The owner's print view (household, no profile) prints what she approved |
| Who does what | `src/lib/club/personalize/assign.ts` → `assignTasks` | Deterministic (stable hash, never random or AI). Each task is `one` owner, `each` (everyone's own copy) or `together`; `who` is child, adult or any, gated by age. The current owner keeps an area, then a child she wished it for, then whoever has the most room by age; her answers lead unless that piles one person half a job past the lightest. The account holder leans last (`HOLDER_LEAN`). Nobody able: no owner, and the month leaves it off the page |
| Her changes | `src/lib/club/personalize/edits.ts` | January's Keep / Change / Skip as `TaskEdits` by task id: owners (more than one is fine, never none), her wording, leave it off. Stored in the month's state, so they survive regeneration; people who leave drop out |
| Editing on desktop and phone | `src/lib/club/personalize/editor.ts` → `taskEditor`, styles `src/styles/club-personalize.css` | One editor for dialogs and edit sheets: name chips (44px), wording, "Leave it off", "Use the prepared version". It only reports choices; the month's `clubPlan.update` applies them, so sheet, rail and phone stay one plan |
| The profile reaching the printable | `src/lib/club/plan/family.ts` | `omc:club-preview-household` now carries `profile` beside `household` (null in the owner's print view) |

Limited or missing information: with no profile answers every query answers "nothing known" and the month prepares
from ages alone; a child with no birth year is planned as a young child (assign: 6) and never given more; a job
nobody can do yet isn't printed; a family with no children still gets a complete, honest page where the month has
one (March: the grown-ups' charts; August: the family routine; May: the day with the grown-ups' jobs).

## Shared marks: the WHEN cue, owner colors, DONE WHEN

One implementation, used by January, March, May and August (and every month after): `src/lib/club/personalize/marks.ts`
with `src/styles/club-marks.css`. Never re-create these per month.

| Mark | What it is | Rules |
| --- | --- | --- |
| `habitCue(text)` | `[clock] WHEN After breakfast`: the approved hand-drawn monochrome clock (`assets/icons/ofc/updatedicons/svg/clock.svg`), a small uppercase WHEN, charcoal text on a warm neutral (`#F3EEE7`) | Directly below the responsibility it applies to (or once for a section where one moment is unmistakably shared: May's anchors, March's weekly jobs, August's routine panels). A habit trigger, never a due date or a clock time; short; prefers an existing daily event |
| `ownerTag(name, color)` / `ownerTags` | The person's marker dot and their name in the same hue | Always the name with the color. "Everyone" is one neutral tag |
| `doneLine(text)` | `DONE WHEN …` | The completion standard, once per section where it fits |

Reading order everywhere: **the responsibility, its owner, its WHEN, then DONE WHEN.** Small rows put owner and WHEN on
one line under the job rather than crowd the page.

**Cue vocabulary and rules** (`src/lib/club/personalize/cues.ts`): one list of moments (`CUE`) so the same moment reads
the same everywhere. `cueFor` keeps a cue true to her answers: no school-day cue ("When I get home", "After school",
"After homework") for a child who isn't in school (not of school age, or the family homeschools, unless a school
activity names them), no cue about the kids for a family without children. Every prepared cue is editable (the shared
editor's "When" field, March's editor, May's block editors); a chore she typed gets `DEFAULT_CUE` ("After dinner").

**Member colors** (`src/lib/club/personalize/colors.ts`): January's one assignment, reused exactly. Canonical source:
`memberColors()` in `src/data/club/family-colors.ts`: her saved choices by stable member id in
`household.preferences.colors` (migration `20261120000000_club_household_colors.sql`), then the eight marker tokens
(`MARKER_COLORS`) auto-assigned children first in family order. `familyColors` only adds `ink`, the same hue darkened
until 10px type reads at 4.5:1 or better on white and the palest panel tints, and `NEUTRAL_COLOR` for anyone without a
color (a typed name). `familyContext(...).colors` carries them to every month. Saved colors never move when people are
reordered, added or removed; auto colors are made permanent the first time she saves her family page (it saves
everyone's current color), so adding someone later shifts nobody. Every dot prints exactly (`print-color-adjust`).

Where they show: March, each chart's name and dot plus a short rule under the header (the chart's own palette and
icons unchanged), and initials on the phone rows; Spring Prep, each owner's name and dot (ownership copy and artwork
unchanged); May, every job on an anchor with its owners' colors (the rhythm-block tints unchanged); August, every job's
owners with "Each child", "Together" or "Grown-up job" beside them (the four panel tints unchanged), each routine's name,
and the phone avatars; January, the WHEN line on its habit cards now uses the shared cue (its colors were already the
source and are unchanged).

## The three months

**March, Family Chore Charts.** Charts for every child and every participating grown-up, the same landscape layout
and hand-drawn icons. Daily: each child's own jobs plus a fair share of the household jobs, one owner each; the
grown-ups take what no child can do yet and the grown-up jobs. Weekly: one job per weekday from the calendar's cleaning
zone, grown-ups taking the grown-up-sized jobs in turn, children the hardest they can do. No rewards, points, stars,
streaks or percentages. The family editor can leave a grown-up's chart off.

**May, Our Summer Day.** The same anchors, layout and icons. Quiet time by ages, activities from interests (by name:
"Soccer practice", "Piano for fun"), and the family's jobs printed on the anchor they belong to with names. The summer
rule no longer points at Mom.

**August, Back to School Without the Scramble.** A new first sheet, the family plan, in the routine's own visual
language (numbered circles, tinted panels, hand-drawn icons): before the first day, the night before, school mornings,
after school, every job with names; then the existing "My School Day" routine for every school-aged child, timed back
from the school start on her family page.

## Tests

- Unit: `src/lib/club/personalize/personalize.test.ts` (the foundation), `src/lib/club/engines/march-chore-charts.test.ts`,
  `may-summer-rhythm.test.ts`, `august-school-routines.test.ts`. Families: one child (Okafor, a preschooler), two
  school-aged children and one grown-up with no profile (Brooks), mixed ages with a full profile (Rivera), four
  children and three grown-ups (Chen), limited intake (Goering), no children (Hughes).
- Shared marks: `src/lib/club/personalize/colors-cues.test.ts` (January's colors carried through, a customized color in
  March, May and August, reorder and add without shifts, neutral fallback, ink contrast, cue rules).
- Browser, by hand on a build: `node scripts/club-personalized-months-qa.mjs <dist> <out>` (Playwright installed
  globally: `NODE_PATH=$(npm root -g)`). Every month × family at 1440 and 390: names on the sheets, nothing clipped,
  no broken images, nothing cut off inside a panel, the WHEN cue's computed style identical in every month, no "Mom" on a sheet, no rewards language on March, one US Letter PDF page per sheet, a phone edit
  that changes the printed sheet, approval, and both still there after a reload.

## Moving another month over

1. In its engine, build the family with `familyContext(members, prefs, '<YYYY-MM>', state.profile)` and list the
   month's jobs as `PlanTask`s (owner rules: `areas` from step 3, `wishes` from step 4, ages). Prepare with
   `assignTasks`, then `withEdits(prepared, state.<edits>, ctx)`; leave unowned tasks off the page.
2. Add `profile?: FamilySnapshot` (and the edits) to its state, checked with `isFamilySnapshot` / `isTaskEdits`, and
   include the printed names in its fingerprint.
3. In its printable, read `detail.profile` from `omc:club-preview-household`, keep `latest = familySnapshot(profile)`,
   and `settle()` (`settledSnapshot(state.profile, latest)`) on load, update and replace, as March and August do.
4. Use `taskEditor` in its desktop dialog and phone sheets; import `src/styles/club-personalize.css`.
5. Unit test the five family shapes above; add the month to `scripts/club-personalized-months-qa.mjs`.

## Not done here

- No server-side snapshot or cutoff lock (the plan still saves through the existing per-month resource save).
- January keeps its own `GuideProfile` snapshot; it could move onto `FamilySnapshot` later without changing what prints.
- Kit pages and `/club/march-preview` still describe Spring Prep (unchanged, out of scope).
