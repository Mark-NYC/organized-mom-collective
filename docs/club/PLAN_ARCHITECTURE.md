# Club plan pages: shared architecture

How a month's personalized printable becomes a plan page in the cleaning companion website (`/app/club/<month>`).
September (Sunday Reset, two sheets, plus the activity calendar demo in a second tab), October (Daily Reset, two
sheets), January (Habit Cards, one sheet), February (laundry guides: one sheet per readiness level in use, so one
or two) March (family chore charts: one sheet per child), April (Dinner Team, two sheets), May (Summer Day Rhythm, one
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

## Storage (until account persistence exists)

- Plan: sessionStorage at the month's `storageKey`, as `{ current: '<sample>:<householdId>', state }`. A different family
  in the same tab starts fresh instead of seeing another family's plan. One family per printable per tab.
- Approval (prototype): sessionStorage at `omc:preview:<resource>:approval`, holding the fingerprint and date.
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
- Approval is a **prototype in this tab**. The screen says "preview only"; nothing is mailed or saved to an account.

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

`/app/club/march`: family chore charts, one landscape chart per child (11 × 8.5 in): the child's name, Weekly Chore
Chart, "My jobs, start to finish.", only the child's own daily chores (up to eight, no blank rows) with a box per
day, one weekly job per weekday with one box or a dashed "Day off", and one ownership line ("My jobs are finished
when I've done the work and put everything away."). **No rewards, stars, points or thresholds**; charts saved with
the old reward fields keep their chores and drop the rewards (`applyFamily`). Sizes follow the number of daily
chores; one to three chores (the youngest) switch to a stacked layout with larger rows and the week as seven
tiles. Icons: `src/data/club/march-chore-icons.ts` maps every chore to one of 24 files in
`assets/icons/ofc/march/` (see the README there); until a file exists the chore shows its responsibility-library
illustration if it has one, otherwise no picture. Renamed and typed chores have no icon. `MarchChoreCharts.astro`
(the sheets and the desktop editor), `MarchPlanMobile.astro`, rules `src/lib/club/engines/march-chore-charts.ts`,
editor panels shared by the desktop dialog and the phone sheets in `src/lib/club/march-chore-editor.ts`. Ages as of
March 2027 prepare each chart: daily chores by age (pets first when the family has them), weekly chores matched to
the wall calendar's cleaning zone for that day in `src/data/cleaning.ts` (the zone shows in the editor, not on the
chart), and the three tool palettes. Children only. The free chore chart (`/chore-chart`) is separate and unchanged.

Printing: the sheets are landscape (1056 × 816, `data-plan-width="1056"` so the plan screen's thumbnails scale
them). Where the browser supports named pages (`page`: Chrome, Edge, Firefox), the script adds
`@page mcc-chart { size: letter landscape }` as the last stylesheet and sets `html[data-mcc-print="landscape"]`; the
charts then print one per landscape Letter page, upright in a saved PDF. (It must be the last stylesheet: in
Chromium a later stylesheet's plain `@page` size, the shared portrait rule, beats an earlier named page.)
Elsewhere (Safari) each chart is turned a quarter on the shared portrait page, so the paper still comes out
landscape. The shared print rules are unchanged. Tab-only `omc:club:march-chore-charts:v2` with
`omc:preview:march-chore-charts:approval`. The earlier March page, Spring Prep (`MarchSpringPrep.astro`,
unchanged), stays at `/app/club/march/spring-prep`; `MarchTabs.astro` links the two and keeps `?sample`. The kit
page and `/club/march-preview` still describe Spring Prep.

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
