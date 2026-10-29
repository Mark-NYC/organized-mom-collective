# Club plan pages: shared architecture

How a month's personalized printable becomes a plan page in the cleaning companion website (`/app/club/<month>`).
October (Sunday Reset, two sheets), January (Habit Cards, one sheet), February (Connection Cards, one sheet),
March (Spring Prep, one sheet), April (Dinner Team, two sheets), May (Summer Day Rhythm, one sheet), June (Snack
Station, one sheet), July (Activity Board, one sheet), August (School Day Routines, one sheet) and December 2026 (Christmas Mission, two sheets drawn as SVG by the worksheet layout) use it. Every remaining month should too, without copying page code.

**Status (2026-10-28).** October is the approved reference, and its desktop layout is now the shared rail
(`ClubPlanDesktop`): every app month page (December–August and October) uses it, with one approval shared by the rail and
the plan screen. October's page still carries viewer rules for its printable's own document frame. September and
November have no `/app/club/<month>` page yet (the Club hub links their `/club/<month>-preview` pages).

## The split

| Layer | Shared or per month | Where |
| --- | --- | --- |
| Page shell: family loading, gates, proof, print rules | Shared | `src/components/club/plan/ClubPlanShell.astro` |
| Plan screen below 1100px: header, approval status, editing deadline, preview card, action bar, edit sheet, toast, copy mode | Shared | `src/components/club/plan/ClubPlanScreen.astro` + `src/lib/club/plan/screen.ts` |
| Desktop at 1100px and wider: October's left rail (title, editing window, Make changes, Approve, Download and print, whose family) and the scrolling printable column | Shared | `src/components/club/plan/ClubPlanDesktop.astro` + `src/lib/club/plan/desktop.ts` |
| Rules: state shape, defaults, family-derived names, limits, what prints, fingerprint | **Per month** (engine) | `src/lib/club/engines/<month-resource>.ts` |
| The printable artwork and its desktop editor (dialogs, typing on the sheet) | **Per month** | `src/components/club/<MonthResource>.astro` |
| The month's rows and edit sheets on the plan screen | **Per month** (adapter) | `src/components/club/<Month>PlanMobile.astro` |
| The month's details in the desktop rail (default slot) and what Make changes opens | **Per month** | the month's page |

The month owns content and personalization. The shared layer owns everything a family sees around it.

## Files

`src/lib/club/plan/`

- `resource.ts`: the `PlanResource<S>` contract and the `club:plan-change` event (`PLAN_CHANGE`).
- `family.ts`: `startPlanFamily(root)` loads the family through `loadKitHousehold` (sample or signed-in household, never a sample in her place), fills the gate otherwise, and sends `omc:club-preview-household` to the printable. `onPlanFamily(root, cb)` runs now if the family is known, else once it is.
- `storage.ts`: `planKey(sample, householdId)`, `readScoped(raw, key, valid)` and `tabStorage` (sessionStorage).
- `proof.ts`: `mountPrintableProof(root)` (full-screen printable, Front/Back switch, Esc, focus containment via `inert`) and `printPlan()`.
- `screen.ts`: `mountPlanScreen({ root, host, approvalKey, render })` returns `{ resource, readOnly, copying, openSheet, closeSheet, doneButton, toast, refresh }`.
- `desktop.ts`: `mountPlanDesktop({ root, host, approvalKey, edit, render?, lock? })` for the rail: countdown, Make changes
  (`edit`), approval, whose family and how changes are kept; `lock(true)` past the cutoff stops typing on the printable.
- `status.ts`: the prototype approval (`readApproval`, `writeApproval`, `approvalState`) and `planNow()` (dev
  `?preview-date=`), shared by `screen.ts` and `desktop.ts`. A change fires `PLAN_APPROVAL` on the page root, so the rail
  and the plan screen always agree.
- `dom.ts`: `el(tag, props, ...children)` for building rows and sheets.

`src/components/club/plan/`

| Component | What it renders |
| --- | --- |
| `ClubPlanShell` | The `.club-plan` root, `ClubFamilyGate`, slot `desktop`, `ClubPrintableProof` around slot `printable`, slot `mobile`, `ClubPrintStyles` |
| `ClubPlanDesktop` | October's desktop rail, for slot `desktop`; with it the root becomes the rail + printable grid at 1100px and wider. Props `deadline`, `kicker`, `instructions`; slot `title`; default slot for the month's details (`cpd-details`, `cpd-block`, `cpd-rows`, `cpd-link`, `cpd-hint`) |
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
- Keys in use: `omc:preview:october-sunday-reset:v2`, `omc:preview:january-habit-cards:v3`, plus `…:approval` for each;
  `omc:club:february-app:v1` with `omc:preview:february-connection-cards:approval` (February reads the earlier
  page's name-based `omc:club:february-mobile:v1:<family>` once and maps names back to people); `omc:club:march-app:v1` with `omc:preview:march-spring-prep:approval` (March reads the earlier page's
  `omc:club:march-mobile:v1:<family>` once); `omc:club:april-app:v1` with `omc:preview:april-dinner:approval` (April reads the earlier April page's
  `{ profile, meal, … }` shape once, for the same family); `omc:club:may-app:v1` with `omc:preview:may-summer-rhythm:approval`; `omc:club:june-app:v1` with
  `omc:preview:june-snack-station:approval` (June reads the earlier `{ profile, state }` shape once and maps its
  index-and-name levels to members); `omc:club:july-app:v1` with `omc:preview:july-activity-board:approval`
  (July reads the earlier page's localStorage plan once for the same family, then removes it); `omc:club:august-app:v1`
  with `omc:preview:august-school-routines:approval` (August reads the earlier `{ profile, boards, active }` localStorage
  routines once for the same family, then removes them); `omc:club:december-app:v1` with
  `omc:preview:december-christmas-mission:approval` (the earlier December page stored nothing).
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
4. **Page** `src/pages/app/club/<month>.astro`: `<ClubPlanShell kitSlug month sides? storageKey>` with
   `<ClubPlanDesktop slot="desktop">` (the month's details in its default slot), the printable in slot `printable` inside a
   `data-plan-proof-body` / `data-plan-proof-scroll` pair, and the adapter in slot `mobile`. Its script calls
   `mountPlanDesktop` with the same approval key as the adapter. The printable takes a `planMode` prop that leaves out
   its own page chrome (intro, controls, floating buttons) and scopes its standalone layout and print rules to
   `:not([data-adc-plan])`-style selectors at the source, so no page-level overrides are needed. Restores are scoped
   (one part of the plan, explained beside the button, with undo), never a silent reset of everything.
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
