# Club plan pages: shared architecture

How a month's personalized printable becomes a plan page in the cleaning companion website (`/app/club/<month>`).
September (Sunday Reset, two sheets, plus the activity calendar demo in a second tab), October (Daily Reset, two
sheets), January (Habit Cards, one sheet), February (laundry guides: one sheet per readiness level in use, so one
or two) March (Our Family Rhythm, one sheet), April (Dinner Team, two sheets), May (Summer Day Rhythm, one
sheet), June (Snack Station, one sheet), July (Activity Board, one sheet), August (School Day Routines, one sheet) and
December 2026 (Christmas Mission, two sheets drawn as SVG by the worksheet layout) use it. (Until Oct 2026 the Sunday Reset was October's and the Daily Reset September's.) Every remaining month should too, without copying page code.

## The split

| Layer | Shared or per month | Where |
| --- | --- | --- |
| Page shell: family loading, gates, proof, print rules | Shared | `src/components/club/plan/ClubPlanShell.astro` |
| Plan screen below 1100px: header, approval status, editing deadline, preview card, action bar, edit sheet, toast, copy mode | Shared | `src/components/club/plan/ClubPlanScreen.astro` + `src/lib/club/plan/screen.ts` |
| Rules: state shape, defaults, family-derived names, limits, what prints, fingerprint | **Per month** (engine) | `src/lib/club/engines/<month-resource>.ts` |
| The printable artwork and its desktop editor | **Per month** | `src/components/club/<MonthResource>.astro` |
| The month's rows and edit sheets on the plan screen | **Per month** (adapter) | `src/components/club/<Month>PlanMobile.astro` |
| Desktop experience at 1100px and wider | **Per month**, unchanged | the month's page and printable |
| Desktop rail at 1100px and wider (October's layout: back link, title, editing window, Make changes / Approve / Download and print, whose family, the month's details, how to use it), one approval shared with the plan screen | Shared, used by every app month page | `src/components/club/plan/ClubPlanDesktop.astro` + `src/lib/club/plan/desktop.ts`, approval in `src/lib/club/plan/status.ts` |

The month owns content and personalization. The shared layer owns everything a family sees around it.

## Files

`src/lib/club/plan/`

- `resource.ts`: the `PlanResource<S>` contract and the `club:plan-change` event (`PLAN_CHANGE`).
- `family.ts`: `startPlanFamily(root)` loads the family through `loadKitHousehold` (sample or signed-in household, never a sample in her place), fills the gate otherwise, and sends `omc:club-preview-household` to the printable. `onPlanFamily(root, cb)` runs now if the family is known, else once it is.
- `storage.ts`: `planKey(sample, householdId)`, `readScoped(raw, key, valid)` and `tabStorage` (sessionStorage).
- `proof.ts`: `mountPrintableProof(root)` (full-screen printable, Front/Back switch, Esc, focus containment via `inert`) and `printPlan()`.
- `screen.ts`: `mountPlanScreen({ root, host, approvalKey, render })` returns `{ resource, readOnly, copying, openSheet, closeSheet, doneButton, toast, refresh }`.
- `dom.ts`: `el(tag, props, ...children)` for building rows and sheets.

`src/components/club/plan/`

| Component | What it renders |
| --- | --- |
| `ClubPlanShell` | The `.club-plan` root, `ClubFamilyGate`, `ClubFamilyMeeting` (the Monthly Tool / Family Meeting switch and the month's meeting, docs/club/FAMILY_MEETING.md), slot `desktop`, `ClubPrintableProof` around slot `printable`, slot `mobile`, `ClubPrintStyles` |
| `ClubFamilyGate` | Loading, empty, signed-out, denied and error states; nothing else shows until the family is ready |
| `ClubPlanScreen` | The plan screen; slot `title` and the default slot for the month's sections |
| `ClubPlanStatus` | Approval line and editing deadline |
| `ClubActionBar` | Primary button (approve / approved / approve changes / print a copy), print button, copy-mode Done |
| `ClubEditSheet` | The focused editing sheet (`<dialog>`), plus the chip, field and choice styles sheets use |
| `ClubPrintableProof` | The proof overlay below 1100px; `display: contents` on desktop |
| `ClubPrintStyles` | Print rules for every plan page |

## Markers

| Marker | On | Meaning |
| --- | --- | --- |
| `data-plan-state` | `.club-plan` | `loading`, `ready`, `empty`, `signed-out`, `denied`, `error` |
| `data-plan-for` | `.club-plan` | `<sample>:<householdId>`, the family this tab's plan belongs to |
| `data-plan-view` | `.club-plan` | `tool` (default) or `meeting`; printing follows it |
| `data-meeting-sheet` | the meeting's printed guide | Printed only in the meeting view, never with the tool's sheets |
| `data-plan-sheet="front\|back\|sheet"` | each printed page in the printable | What prints, and what the thumbnails clone |
| `data-plan-sheet-end` | the last sheet only | No page break after it (no blank page) |
| `data-plan-proof-body`, `data-plan-proof-scroll` | the printable's wrappers | The proof's frame and scroller |
| `data-plan-open-proof`, `data-plan-print`, `data-plan-primary`, `data-plan-copy` | buttons anywhere | Delegated by `proof.ts` and `screen.ts` |
| `data-plan-source` | any element | Filled by the page with "Sample family…" / "Prepared for…" |

## The PlanResource contract

The printable publishes a controller on its root element as `clubPlan`, and dispatches a bubbling `club:plan-change`
after every change. The plan screen reads and writes only through it, so the screen and the printed sheet come from
one state and can't disagree.

```ts
interface PlanResource<S> {
  ready(): boolean;               // the family is applied
  state(): S;                     // the current plan
  update(change: (s: S) => void): void;  // edit, save, repaint, dispatch
  replace(s: S): void;            // used when a copy is finished
  setPersist(on: boolean): void;  // off during "print a copy"
  fingerprint(): string;          // what prints; approval is checked against it
}
```

Months extend it for their own needs (`OsrPlan` adds `members` and `nameOf`; `JhcPlan` adds `members`). The fingerprint
covers **only what prints**: January's covers the active cards, so a hidden second card never invalidates an approval.

## Storage

- Plan: sessionStorage at the month's `storageKey`, as `{ current: '<sample>:<householdId>', state }`. A different family
  in the same tab starts fresh instead of seeing another family's plan. One family per printable per tab.
- **A signed-in member's plan is also saved to her account** (`src/lib/club/plan/account.ts`, started by
  `startPlanFamily`): her saved version of the month (`club_resource_versions` through `club_resource_get` /
  `club_resource_save`, the same row her copy at `/club/resources/<slug>` and the mailing read) holds this page's
  `storageKey` entry beside any entry her copy saved. Before the printable reads its family, her saved entry goes into
  the tab (none yet: her copy's entry for the same tool, if any, and the printable's own validation decides); after she
  clicks or types, every change the printable writes to that key saves (debounced, revision-checked; a conflict stops
  saving and says so). Opening a page never saves. Printables don't change. Samples and previews stay tab-only.
  Like a change on her copy, a saved change clears that month's approval for printing (`club_resource_save`).
  Tests: `tests/club-plan-account.test.ts`, `node scripts/club-onboarding-e2e.mjs --only=months`.
- Approval (prototype): sessionStorage at `omc:preview:<resource>:approval`, holding the fingerprint and date.
- A month on the shared personalization foundation (March, May, August) also keeps the profile snapshot it was
  prepared from in its state (docs/club/PERSONALIZATION_FOUNDATION.md), so the owner's print view, which loads her
  household but not her profile, prints exactly what she approved.
- Nothing is written to localStorage. January removes its old localStorage keys (`key`, `key:count`,
  `key:automatic-names`) on load.
- Keys in use: `omc:club:september-sunday-reset:v1` (`omc:preview:september-sunday-reset:approval`),
  `omc:club:september-calendar:v1` (the calendar demo, per family), `omc:club:october-daily-reset:v1`
  (`omc:preview:october-daily-reset:approval`; reads the earlier September page's `omc:preview:september-room-reset:v2`
  once for the same family), `omc:club:march-chore-charts:v2` (`omc:preview:march-chore-charts:approval`),
  `omc:preview:january-habit-cards:v3` plus its `…:approval`; `omc:club:<month>-app:v1` for April, May, June, July,
  August and December, each with `omc:preview:<resource>:approval` (`april-dinner`, `may-summer-rhythm`,
  `june-snack-station`, `july-activity-board`, `august-school-routines`, `december-christmas-mission`). Each reads
  its earlier page's key once for the same family.
  The January printable is also used outside a plan page (`/preview/january-habit-cards`, `/club/tools/habit-builder`,
  `/club/kits/<slug>`): there it keeps its own key, tab-only as well, with no family scope.

## Printing

`ClubPrintStyles` prints the `[data-plan-sheet]` pages and the elements that contain them, nothing else, each sheet
8.5 × 11 in with a page break after every sheet except `data-plan-sheet-end`. The rules use `:not(#plan-print)` to
outrank a printable's own id-scoped `!important` print rules without new override layers. `@page` is the
printable's own.

**Safari / WebKit.** WebKit sizes print pages from the document width: page height = document width × printable
height ÷ printable width (after the header and footer iOS always prints), with a minimum shrink of 1.25. An 8.5in
document on a Letter page slices each sheet across two pages. The shell pads `html` by 0.625in each side in WebKit only
(`@supports (hanging-punctuation: first)`), a 9.75in document, so each 11in sheet fits one page whenever the printable
area is at least 1.128 times as tall as it is wide (Letter and A4 with default margins). Modeled in
`tests/club-plan-print.test.ts` for one-sheet and two-sheet printables. Not yet confirmed on an iPhone.

## Editing deadline and approval

- Deadline: `clubEditingDeadline(kit.month)` (second Sunday, 11:59:59 PM ET), passed to `ClubPlanScreen`. Shows the date
  until 72 hours remain, then the weekday, "tonight" on the day, then read-only. In dev, `?preview-date=` overrides now.
- Approval is a **prototype in this tab**. The screen says "preview only" ("on this device" for a member); nothing is mailed. A member's plan itself saves to her account (Storage, above).

## Adding a month

1. **Engine** `src/lib/club/engines/<resource>.ts`: state type, `fresh…State`, an `is…State` guard, defaults read from the
   kit or content data (never retyped), family-derived names that don't overwrite her edits, field limits, a
   fingerprint over what prints, and a `…Plan extends PlanResource<State>` type. Unit test it beside the file.
2. **Printable** `src/components/club/<MonthResource>.astro`: keep the artwork and desktop editor as they are. Mark each
   printed page `data-plan-sheet` and the last `data-plan-sheet-end`. Read state through the engine; store it with
   `readScoped`/`tabStorage` scoped by `planKey`; listen for `omc:club-preview-household` (and read
   `window.__ofcPreviewHousehold` if it already came); publish `clubPlan`; dispatch `PLAN_CHANGE` after each change.
3. **Adapter** `src/components/club/<Month>PlanMobile.astro`: `<ClubPlanScreen deadline kicker sheets previewNote>`
   with a `title` slot and the month's sections, built from `cp-*` rows. Its script calls `mountPlanScreen` with the
   month's approval key and a `render(state)` that draws the rows; tapping a row calls `ui.openSheet(title, …)` with
   `cp-chip`/`cp-field` controls that call `ui.resource.update(…)`. Respect `ui.readOnly`.
4. **Page** `src/pages/app/club/<month>.astro`: `<ClubPlanShell kitSlug month sides? storageKey>` with the desktop
   experience in slot `desktop` (or the printable's own desktop layout), the printable in slot `printable` inside a
   `data-plan-proof-body` / `data-plan-proof-scroll` pair, and the adapter in slot `mobile`.
5. **Check** at 375, 390 and 768 (plan, every sheet, proof, approve, changes after approval, copy, empty family,
   another sample family) and 1100 / 1440 desktop; print from the proof, the viewport and desktop; page count equals
   sheet count; `npx vitest run tests/club-plan-print.test.ts` covers the new printable's sheet markers.
6. Add the route and storage keys to `README.md`.

## Not built yet (decided, separate work)

- Account persistence (`saveDocument`, an `approved_revision` per household and edition), a server-side cutoff lock,
  and the edition freeze at the cutoff.
- Up to three saved variations per resource. Today "print a copy" is a one-off that isn't saved.
- Mail by default: the plan mails as shown whether or not she approves. When that's live the status "Not approved yet"
  should read like "Mails as shown. Approve when you've checked it." Mailing, billing and fulfillment are not connected.
- Unlimited printing is already the behavior.

## February

`/app/club/february`: `FebruaryLaundryGuides.astro` (the approved guide artwork from `assets/icons/ofc/february/`, its
desktop editor and the sheets), `FebruaryPlanMobile.astro`, rules in `src/lib/club/engines/february-laundry.ts`. Age in
February 2027 suggests each child's guide (9 and up: "I Can Do My Own Laundry"; younger: "My Clothes, My Job");
Mom can change any child's level. One page per level in use, children at the same level named together on it.
Laundry days (one or more, or "As needed") print on every guide; a named machine operator prints in the callout
(Mom/Dad for the first two parents, other grown-ups by name; the default keeps the original wording). Tab-only
`omc:club:february-laundry-app:v1` with `omc:preview:february-laundry:approval`; the earlier page's
`omc:club:february-laundry:v2` edits are read once for the same family, then removed.

## March

`/app/club/march`: **Our Family Rhythm**, one portrait Letter sheet for the whole family. One family, two or three
shared moments, everyone owns their part. Header "OUR FAMILY RHYTHM", the family name (`familyTitle`, as January),
"Same moments. Everyone has a part." and a legend of everyone with their January color. Then each moment the family
already shares ("After Dinner", with "Cue: Dinner finishes → Our kitchen reset"), its rows (a narrow bar in the owner's
color, or equal bands for siblings sharing a row; the name in that color's ink; the approved March icon; the job), and
a finish line written from the jobs actually on it ("Finished when: the table is cleared and the floor is swept.").
The one or two NEW habits get a pale March wash, bold words and a "New habit" tag, and are repeated in "Our New
Habits"; established jobs show plainly as context. Footer: "When the moment comes, we each know our part." **No
rewards, points, streaks, percentages, checkboxes or tracking.**

Rules: `src/lib/club/engines/march-family-rhythm.ts` (pure; cue → action → finish). Five shared moments (after
breakfast, before we head out, when we get home, after dinner, after brushing teeth), each with its own job library.
Every job has to make sense at its moment (`fitsCue`): nothing that must happen before the cue, and no kitchen jobs at
bedtime; her typed jobs are checked the same way and refused with the reason.

**Ownership** (`ownershipOf`), with no schema change (an optional `share` on a row):
- `individual`: one person, one row.
- `parallel_individual`: a personal job several people each do for themselves ("Lay out tomorrow's clothes"). Stored as
  ONE ROW PER PERSON, so changing, removing or making a habit of one child's never touches another's. The sheet may put
  them on one line, marked "each their own" (`MomentView.rows`); the editor and habit picker list each person
  separately (`MomentView.parts`).
- `joint`: one shared outcome several people work on together ("Put the shared toys away together"): one row, every
  owner, `share: 'joint'`, printed "together". Only when she chooses it; never inferred from a shared moment or a
  shared title, and never recommended (the family page doesn't say what's shared).
Saved plans are read in these terms without losing anything (`cleanPlan`): an earlier `together` is joint; several
owners on a household job she saved stays joint; a grouped personal job becomes one row per person (the first keeps the
row id and any habit on it); a copy of the same job (the same person's, or the same household job) is folded in.

How the plan is prepared, for any household (no family is special-cased): the smallest set of meaningful jobs.
1. Two moments from her priority and challenges (no children: breakfast and dinner); a third offered, off.
2. Each moment holds as many household jobs as the people who can take part call for (`householdBudget`: 1 for a
   one-person home, 2 for up to three, 3 for up to six, 4 at most), never one per person. In order: what someone
   already takes care of (leaving room for the moment's essential jobs), a job she wished a child would take on, the
   essential jobs (to the child with the fewest parts so far, then the youngest who can), grown-ups for what only a
   grown-up can do or no child could take (no grown-up part at bedtime), then optional jobs if room remains.
3. A personal routine job (the bedtime hamper, clearing your own breakfast plate) only for children ten and under with
   no part in that moment, or a child she wished it for; a moment she turned on never comes up empty.
4. ONE new habit by default: a job she named for a particular child, else one she named for anyone, else the most
   meaningful new job. A second only when she named a job for a different child too. Never something already theirs,
   a personal routine far below a child's age, or a shared row.

`validatePlan` checks every plan: duplicates (`jobKey` normalizes words and drops trailing numbers, so "… game 0" and
"… game 2" are one job; another child's own copy of a personal job isn't a duplicate), jobs that can't follow their
moment, owners who aren't in the family, a personal job with several owners on one row, several owners without
`share: 'joint'`, long labels, crowded moments, jobs that make someone everyone's reminder ("Remind everyone…", also
refused when typed), and habits that point nowhere or at an established job. The prepared plan for the sample
families and 300 generated households (1–9 people, any ages, with and without pets) passes every check (unit tests).
Saved plans are cleaned on load (`cleanPlan`): a copy of a job already in the same moment is merged into it.

The finish line is written from the moment's current jobs every time it's drawn (`finishLine`; a typed job gets an
observable phrase from its own words, `finishOf`), so an edit can never leave it stale. "This week, we're practicing"
says each habit as a sentence (`habitSentence`: "Mateo practices sweeping under the table after dinner."; "my" becomes
"their", never a guessed pronoun) with "Practice together at first. Then let them take the lead."

Sheet, desktop editor and controller: `MarchFamilyRhythm.astro` (`data-plan-sheet="front"`). Header, moments, practice
and footer are one composition centered on the page; five size steps follow how much the plan holds (a one-person plan
prints large, a seven-person three-moment plan tight), and on screen it steps down further if words run long, so it
always prints on one page. Editor (`src/lib/club/march-rhythm-editor.ts`, the same in the desktop dialog and the phone
sheet), never a long form: **Our moments** (choose another moment, her words, turn one on or off; turning off a moment
that holds jobs asks first and can be undone); **Who owns what** at three levels: every moment as a card (who does what,
"Edit responsibilities"), one moment's jobs as compact rows (icon, job, owners in their colors, Edit, Remove with a
confirmation and Undo), and one job (suggestions from that moment's list or her words, who owns it, when, new habit;
Done, Cancel, Remove); **New habits**. A job being edited is a draft until Done: the dialog and the sheet refuse to close
over it (×, the backdrop or Escape) and say why. Phones: `MarchPlanMobile.astro`, a reference view of the same plan (each
moment, who owns what with "each"/"together", the finish line, this week's practice) with the three edit rows and a
"Change … jobs" link under each moment.

Saved under the earlier chore charts' keys, `omc:club:march-chore-charts:v2` with
`omc:preview:march-chore-charts:approval`, so account saves and approvals keep their place. State is `{ v: 3, plan?,
profile? }` (`isRhythmState`); an earlier chore-chart state is upgraded on load (`fromLegacy`): a child who had a
matching chore keeps it as an established part. The profile snapshot is saved with the plan, so the owner's print view
prepares the same sheet. The earlier March page, Spring Prep (`MarchSpringPrep.astro`, unchanged), stays at
`/app/club/march/spring-prep`; `MarchTabs.astro` links the two and keeps `?sample`. The kit page and
`/club/march-preview` still describe Spring Prep. The prototype at `/app/club/family-chore-chart-prototype` is kept
as the design reference.

## May

`/app/club/may`: Our Summer Day, one Letter-size reusable rhythm of flexible anchors (`MaySummerRhythm.astro` in
`planMode`, `MayPlanMobile.astro`, rules `src/lib/club/engines/may-summer-rhythm.ts`, moved out of the printable's
script). Prepared on the shared personalization foundation, ages as of May 2027: quiet time by ages, Move & Play and
free-time ideas from the children's sports, lessons and clubs on her family page (by name), and the family's jobs on
the anchors they belong to, with names on the sheet ("Sofia, Mateo and Elena · Make my bed", "Luis · Make dinner").
She edits who helps in the desktop editor's Who helps and in each block's phone sheet (shared owner editor). The
summer rule no longer sends the kids to Mom: "Check the rhythm before asking what's next." A long family plan
tightens the sheet's spacing (`msr-dense`) rather than run off the page. Tab-only `omc:club:may-app:v1` now also
holds `parts` (her who-helps changes) and `snapshot`.

**When it happens** (August's timing model, shared in `src/lib/club/personalize/when.ts`: the clock helpers and the
trigger checks; August re-exports them unchanged), plus a third state. Each block's right-hand box shows a large clock
time, a short trigger with a small arrow ("→ After lunch", two lines at most, cut at a whole word), or nothing
(**Flexible**). No WHEN pill. A rhythm, not a checklist: a trigger is only a real, naturally occurring event (a meal,
waking, coming home or inside, brushing teeth), never the end of another block ("After quiet time", "After afternoon
play"), because a chain of those makes every block wait on the one before and a change of plans stalls the day.
Defaults (`defaultKind`, given the blocks' order): Morning Start 8:00 AM and Lunch & Reset 12:00 PM by the clock,
Quiet Time "After lunch" (when lunch comes first), everything else Flexible. Relaxed days drop the clock; more
structured days time the daytime blocks; camp days time the morning and the program, and Home & Snack starts "When we
get home"; Evening Reset is Flexible. `defaultTrigger` is only the first suggestion when she chooses Trigger (a real
event that fits the block). Saved per block as `edits[key].when` ('time' | 'trigger' | 'flexible') and
`edits[key].trigger` (kept exactly as she chose it); a block keeps her time and trigger while it shows something else,
so switching back restores them and the day's colors (they follow the time of day) never move. Evening Reset stays one
fluid block: its time or trigger is when the evening begins, never a deadline per job, and its jobs are never checked
against each other. `mayIssues` says what doesn't add up: a time earlier than the timed block before it; a trigger
that's vague, a deadline or condition, the block itself, a later block, or only the end of the block before it
(`chain`, `WEAK_TRIGGER`). Moving blocks (`moveBlock`) keeps times in order like August: two timed blocks trading
places trade times; triggers and flexible blocks move with their block. Saved plans keep her choices (`readEdit`,
`whenOf`): an explicit choice always wins; from before triggers, a time she set stays a time (not on a relaxed day,
which never printed times) and her wording for a block's jobs becomes its trigger.

Editing (`src/lib/club/may-editor.ts`, the same in the desktop dialog and the phone sheet): **Our day** (the kind of
day, structure, morning start, quiet time, play; the blocks in order with their names, earlier/later, on or off;
restore the prepared rhythm, with a confirmation), **When it happens** (Time, Trigger or Flexible per block; Time shows a
time field, Trigger shows real events, the best fit first, and her own words, Flexible shows nothing to set; only the
chosen control shows, and a trigger block stays compact until she changes it), **Activities & responsibilities** (one block at a time: its
activities and the shared owner editor). Changes show live and save as she goes; Done keeps them, Cancel puts the plan
back as it was when the editor opened. Clicking a block's time or trigger on the sheet opens When it happens at that
block. Phones: a reference view of the same plan (each block's time or trigger, activities and who helps, the summer
rule) with the three edit rows.

## August

`/app/club/august`: Back to School Without the Scramble (`AugustSchoolRoutines.astro` in `planMode`,
`AugustPlanMobile.astro`, rules `src/lib/club/engines/august-school-routines.ts` and, for the charts,
`src/lib/club/engines/august-routine-chart.ts`). Three pages a family, never a page per child:

- `plan`: the family's back-to-school plan (four panels: Before the First Day, The Night Before, School Mornings,
  After School; every job with names), when any child is 3 to 17 in August 2027.
- `morning` and `after`: the family's Morning Routine and After-School Routine, shared by all the school-aged children,
  in the approved reference design (sage header with the family name, a large Georgia title, italic subtitle and the
  children's names in their January colors; "Check the chart. Do the next thing."; up to eight softly tinted rows of
  number, hand-drawn icon, step, WHEN trigger and time; the completion banner). A step only some children do (feeding
  the pet, a practice bag on practice days, practicing lessons) names them in their colors; a step for everyone names
  no one.

Every step can have a **time** (when it's expected) and a **trigger** (the familiar event that starts it without a
reminder). The chart shows **one of them per row**, in the same white box on the right (times large, triggers up to
two centered lines): each chart has a mode, the morning **times** and after school **triggers** by default
(`setChartMode`), and any step can show the other instead (`setShowOther`); nothing to set per row otherwise. Both
values are kept, so switching never loses one. **Fewer, smarter triggers:** the numbered sequence already says what
comes next, so the only prepared triggers are the routine's starting event (after school: "When I walk in the door")
and steps that happen only on some days, with the days from her family page ("Pack my swim team bag" · On Mon, Wed &
Fri; "On robotics days" without days; clubs get "Get ready for…", never an assumed bag). Every other box is empty;
she can type a trigger on any step. `stepIssues` checks only what shows: triggers that restate the step, say nothing,
just name the step before, are a deadline or condition ("Before screen time") rather than a starting event, or point
at a later step; and times out of order or past the out-the-door time.
A trigger needing a third line is measured at print size off screen and flagged in the editors (no character limit).
The morning is timed back from the out-the-door time (school start on her family page minus 20 minutes; a 7:50 sample
marked as a default otherwise, editable as "Out the door by"). Reordering keeps times in order (the times stay with the
slots). Desktop: the
shared rail beside the sheets, with the routine editor (tabs, the Times/Triggers switch, out-the-door time, per-step name, time, trigger,
show the other, who it's for, move, add, remove). Phones: the same controls per chart. Icons are the
icon-library art cleaned of its alpha haze for print (`public/images/club/routine-icons/`,
`scripts/prepare-routine-chart-icons.py`), feeding pets the March art. Standalone uses (a member's copy, the kit page,
`/club/august-preview`) print the two charts. Tab-only `omc:club:august-app:v1` holds the family board
(`boards.family`), `plan` (her plan changes) and `profile` (the snapshot); the earlier per-child boards are dropped.

## September and October

`/app/club/september`: the Sunday Reset (`SeptemberSundayReset.astro`, `SeptemberPlanMobile.astro`, rules
`src/lib/club/engines/sunday-reset.ts`, ages as of September 2027) with a second tab, Try the Wall Calendar: the free
`/try-the-calendar` tool (`FamilyActivityCalendar.astro`, design unchanged) embedded with the family's names (Mom/Dad
for the first two parents, others by name, archived members left off), starting on September 2027, kept in this
tab per family, PNG download as on the public page. Printing always prints the Sunday Reset's two sheets; the
inactive Sunday Reset panel is hidden with a class, because Tailwind's layered `[hidden]` rule would beat the print
rule. On phones a section opens the calendar full screen.

`/app/club/october`: the Daily Reset (`OctoberDailyReset.astro` with `planMode`, `OctoberPlanMobile.astro`, rules
`src/lib/club/engines/daily-reset.ts`, ages as of October 2027): one cue, two or three jobs by the youngest child's age,
a person for each job, front for the kids and back for the parent.
