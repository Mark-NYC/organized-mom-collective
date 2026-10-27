# October Club: mobile UX/UI audit and recommended design

Route: `/app/club/october` · Audited 2026-10-27 at 375×667, 390×844 and 768×1024 (Chromium, dev build), plus source.
Scope: mobile and tablet (< 1100px) only. Desktop (≥ 1100px) and all Cleaning pages stay untouched.
Status: **audit only, nothing implemented.**

Files involved:

- `src/pages/app/club/october.astro`: route, three mobile panels, desktop rail, ~500 lines of CSS, page script
- `src/components/club/OctoberSundayReset.astro`: printable, editor dialog, personalization engine (also used by `/club/october-preview`)
- `src/lib/club/deadline.ts`: second-Sunday cutoff
- `src/lib/club/store.ts`, `ClubGate.tsx`, `ClubMonthAccess.tsx`: household and document storage (account or sample)
- `supabase/migrations/20261023000000_club_core.sql`, `20261025000000_club_october_kit.sql`: documents, access, mailing (not applied live)

---

## 1. Top five findings, ranked by severity

### 1. The "prepared" plan has no family in it (critical)

The route never loads a household. `OctoberSundayReset` waits for `omc:club-preview-household`, which only `ClubPrototypeNav` and `ClubMonthAccess` send, and neither is on `/app/club/october`. What actually renders:

- Front of printable, "Everyone has a part": *"Choose a preview family to see prepared roles."*
- Back, fall jobs: *"No fall jobs selected. Restore a task in Make Changes."*
- Review row "Our family roles": *"Prepared family assignments"* (placeholder string)
- Editor sections 2 and 3: empty

The page's whole promise ("Your prepared October kit", "Look over your family's prepared rhythm") is false on screen, and Mom can approve and print a sheet with no names on it. Every other finding is secondary.

### 2. Approval, versions and saves are claimed but not real (critical: trust)

- **Edits** save to `sessionStorage`. Close the tab and they're gone. The editor says "✓ Changes save automatically for this family".
- **Approve** writes a timestamp to `sessionStorage` that nothing reads. Reload and she's back on the unreviewed screen.
- **"Create a New Version"** opens the same editor on the same single state. It edits the version she just "reviewed", while the copy beneath says *"A new version can be edited and printed without changing the version you reviewed."* That is untrue.
- **Approval wording differs on every surface.** Mobile: "Approve This Version" → "Version Reviewed". Tablet and desktop: "Approve preview" → "Preview acknowledged on this screen only". Three different disclaimers say roughly the same thing.
- **The backend has no approval model.** `club_documents` holds one live `edits` row per doc, with no approved revision or frozen edition. `club_can_open` returns `edit` for as long as access lasts, so there is no server-side edit lock at the cutoff.

### 3. Print from mobile outputs only one side (high: functional bug)

`.club-mobile-kit[data-kit-side="front"] .osr-back{display:none!important}` (october.astro:95) has no media guard and beats the print rule `.club-mobile-kit .osr-back{display:flex!important}` on specificity. A Chromium print of the mobile page produced **1 page**: front only, or back only if she last tapped Back. Desktop prints 2. The product is a two-sided sheet. Confirm on iOS Safari, but the CSS bug is unambiguous.

### 4. Three stacked UIs and nine CSS override layers (high: fragility)

The route ships three different experiences:

- **< 640px:** new three-panel flow (Review → Print Preview → Version Reviewed)
- **640–1099px:** the older preview-first layout: title, Front/Back, viewer, "Make changes / Approve preview / 🖨", and an unlabeled "348 days 16 hours 15 minutes". This is what a large phone in landscape or any tablet gets.
- **≥ 1100px:** locked desktop

To make the panels work, the script **moves the live printable DOM between parents**: into the proof slot, back out on `beforeprint`, back in on `afterprint`. It also uses `window.dispatchEvent(new Event('resize'))` as a message bus. The page CSS has **236 `!important`s across 26 media blocks**. Each commit added a new layer instead of replacing the previous one; the comments say so ("Mobile review, simplified…", "Native mobile review…").

The review screen reads its summary by scraping `textContent` out of the hidden paper (`[data-osr-summary-trigger]`, `.osr-person strong`) instead of reading state.

### 5. The edit model fights the "one small change" path (high: effort)

- Each of the four review rows has a ✎. All four open **the same full modal at the top**; none jumps to its section.
- "Three simple steps" shows a ✎ but the steps can't be edited anywhere.
- Opening the editor silently switches the underlying panel to Print Preview. Closing it jumps back to Review, so she has to tap "Review Print Preview" again to reach Approve.
- Weekly roles are free-text inputs. Who owns a role can't be changed, and names are editable only through `contenteditable` on the scaled paper (text ≈ 5px on a phone), with pencil glyphs.
- "Restore all fall jobs" wipes her fall edits with no confirm or undo.
- **The editing deadline is invisible on phones.** `.kit-desktop-rail` is `display:none` below 640px, so the countdown never shows. On tablet it shows "348 days…" with no label.

### Also found (medium/low)

| Area | Issue |
| --- | --- |
| Accessibility | Panel switches move no focus (focus is lost to `body` when the panel hides) and announce nothing. Done-screen glyphs `▤ ▣ ›` aren't `aria-hidden`, so screen readers read "black square". The expanded viewer has no focus trap. Row accessible names ("WEEKLY RHYTHM Sunday after lunch") don't say they edit. Enlarge button is 38px. 10px uppercase eyebrows everywhere. |
| Orientation | Month label "OCTOBER" is injected into the shared header with a CSS `::after` (not real text, no year), while the printable says "OCTOBER 2027" and today is October 2026. |
| Wasted payload | `FamilyActivityCalendar` (hidden "Try the Wall Calendar" tab) and the desktop rail render on every phone. |
| Content of record | The kit config for 2027-10 (`2027-10-home-works-together.ts`, doc `fall-reset`, "Our Fall Home Reset") doesn't match what this page renders (Sunday Reset with a fall example). Decide which one is October before wiring persistence. |
| Cutoffs conflict | `club_kits.mailer_cutoff_at` for October 2027 is **2027-09-15**, before the kit releases (10-01) and before the editing cutoff (second Sunday = **2027-10-10 23:59 ET**). Also, an editing cutoff mid-month means the October resource lands in the third week of October. That's a product blind spot worth a deliberate decision. |
| Error/loading/empty | None designed: no loading state, no "couldn't load your family", no no-access state, and the empty-family state is printable copy ("Choose a preview family"). |
| Duplicate actions | "Print a Copy" appears on Review, Proof ("Print / Save PDF") and Done ("Print Another Copy"), plus "Review Printable Again". There are four print-related buttons across three screens. |

---

## 2. The five scenarios, as built today

| Scenario | Today | Taps | Verdict |
| --- | --- | --- | --- |
| **A. Effortless approve** | Review (generic rows) → Review Print Preview → scroll the proof, toggle Back → Approve → "Version Reviewed" | 3–4 | Fast, but she approves an empty sheet, and the approval disappears on reload. |
| **B. One small edit** | Tap "Weekly rhythm" → panel flips to proof behind a full modal → pick time → Done → back on Review → Review Print Preview → Approve | 6 | Two hidden context switches. Changing one role: the section is empty (no family). Even with a family, she can edit role text but not who owns it. |
| **C. Several edits** | One long modal. Fall jobs show 3 fields + owner select each. | 10+ | Works with a family loaded, but edits are lost when the tab closes, and "Restore all" is a trap. |
| **D. Return to print** | Lands on Review, not her approved state. sessionStorage is gone in a new session, so she gets the generic default, and print gives one side only. | — | **Fails.** |
| **E. Variation** | "Create a New Version" edits the reviewed version in place. | — | **Fails, and the copy says otherwise.** |

The two-minute test: on paper, A takes under 30 seconds. In practice A–E all fail on data, persistence or honesty before UX polish even matters.

---

## 3. Challenging the architecture

| Question | Answer |
| --- | --- |
| Should Review and Edit be one screen? | **Yes.** The review list *is* the editor. Each row shows the real value and opens a focused sheet for that one thing. The separate "editor" modal goes away. |
| Inline or focused editor? | **Focused bottom sheet, one item at a time.** Inline inputs on a phone mean keyboard jumps and mis-taps in a list. A sheet with 1–3 controls (chips for time, a person picker for owner, one text field) saves on change and closes. Never edit on the paper. |
| Separate confirmation screen? | **No.** Approve is a one-tap state change on the same screen: the button becomes "Approved ✓" and the status line updates, with a 5-second Undo toast. The Done screen and its "Keep using this tool" menu go away. |
| Print preview: step or secondary view? | **Secondary.** A live thumbnail of the front and back sits at the top of the plan, so she always sees the real design without a step. Tap it for a full-screen viewer (swipe front/back, Print). Approving doesn't require opening it. |
| When should the countdown appear? | **Never as a ticking timer.** Show a quiet status line with the date: "Changes open until Sun, Oct 10 · 11:59 PM ET". It escalates only in the last 72 hours ("2 days left to make changes"), then the last 24 hours ("Changes close tonight at 11:59 PM ET"). Minutes ticking down adds mental load, the opposite of the promise. |
| Approve for mailing vs print a copy? | **Different verbs, different places.** *Approve* is the sticky primary button and is about the mailed edition. *Print* is an icon/secondary action that always prints exactly what's on screen and never changes approval state. Once fulfillment is real, the approve button reads "Approve for mailing". Until then it reads "Looks good", and one honest banner covers the page (see §6). |
| After the deadline? | The screen becomes read-only: **"Your October edition is set."** Rows lose their chevrons. Primary becomes "Print a copy"; secondary is "Make an edited copy". |
| Variations without clutter? | **One mailed edition plus at most three named copies**, in a "Your copies" list that appears only once at least one copy exists. A copy is a separate document row and never mails. See §6. |
| **Do we need explicit approval at all?** (push) | **Recommend: default to yes-by-default.** What mails is the plan as it stands at the cutoff, prepared version plus her edits. "Approve" means "I've checked it": it stops reminders and shows ✓. The fastest path is then **zero taps**, which is the real expression of "less on your mind". If the owner wants mail-only-if-approved, keep the same UI and change only the status copy and the cutoff job. **Owner decision.** |

---

## 4. Recommended end-to-end flow

```
Club tab ─► October plan (one screen)
              │  status line · live thumbnail · rhythm · roles · fall jobs
              │
              ├─ tap a row ─────► Edit sheet (that one item) ─► auto-save ─► back to plan
              ├─ tap thumbnail ─► Full-screen proof (front/back, Print) ─► close
              ├─ Approve ───────► same screen, "Approved ✓" + Undo toast
              ├─ Print icon ────► native Print / Save PDF (both sides, current version)
              └─ ⋯ Make a separate copy ─► Copy view (banner: "won't change your mailed edition")

After cutoff:  October plan (read-only edition) ─► Print a copy | Make an edited copy ─► Copy view
Return visit:  Club tab ─► October plan, restored to its saved state (approved ✓ / copies listed)
```

One route, one screen plus two overlays (edit sheet, proof viewer). No panels and no DOM moves. Applies to every width under 1100px, so tablets and landscape phones get it too.

---

## 5. Annotated mobile wireframes (390px)

The `[Tab bar]` is the existing app nav (64px plus safe area). The sticky action bar sits directly above it.

### W1. Plan: open, not yet approved (the default)

```
┌──────────────────────────────────────┐
│ organized family.                    │  existing header (remove CSS "OCTOBER" hack)
├──────────────────────────────────────┤
│ OCTOBER 2027 · YOUR FAMILY PLAN      │  eyebrow 11px, real text, includes year
│ Our Family Sunday Reset              │  H1 serif 30px, the only H1
│ Prepared for the Rivera family       │  15px soft: proves it's personal
│                                      │
│ ○ Changes open until Sun, Oct 10,    │  status line 14px, no timer
│   11:59 PM ET                        │
│ ┌──────────┐ ┌──────────┐            │
│ │ FRONT    │ │ BACK     │  See full  │  live thumbnails (~150px tall), real render;
│ │ ▒▒▒▒▒▒▒▒ │ │ ▒▒▒▒▒▒▒▒ │  size  ›   │  whole strip is one button → W5
│ └──────────┘ └──────────┘            │
│                                      │
│ Sunday rhythm                        │  section label 13px/600, sentence case
│ ┌──────────────────────────────────┐ │
│ │ Sunday after lunch     Change ›  │ │  row 56px min, whole row tappable
│ └──────────────────────────────────┘ │
│ Weekly roles · everyone has a part   │
│ ┌──────────────────────────────────┐ │
│ │ Mom   Review our shared plans…  ›│ │  one row per member, name 15/600,
│ │ Dad   Own transportation…       ›│ │  role 14px truncated to 2 lines
│ │ Ava   Check school days; spot…  ›│ │
│ │ Leo   Prepare clothes, bag…     ›│ │
│ └──────────────────────────────────┘ │
│ Fall example · do once               │
│ ┌──────────────────────────────────┐ │
│ │ Check warmer clothes · Ava      ›│ │  job · owner
│ │ Sort summer clothes · Leo       ›│ │
│ │ Check seasonal gear · Dad       ›│ │
│ └──────────────────────────────────┘ │
│ ⋯ Make a separate copy               │  quiet text link, last
├──────────────────────────────────────┤
│ [   LOOKS GOOD · APPROVE   ] [ 🖨 ]  │  sticky: primary 52px + 52px print icon
├──────────────────────────────────────┤  (labelled "Print or save PDF" for AT)
│ [Tab bar]                            │
└──────────────────────────────────────┘
```

"Three simple steps" is fixed content, so it is not a row. It's visible in the thumbnail. No disclaimers sit inside the list.

### W2. Plan: approved, still before the cutoff

```
│ ✓ Approved Oct 27. You can still     │  status line swaps; sage tick
│   change it until Sun, Oct 10.       │
│ …rows unchanged, still editable…     │
├──────────────────────────────────────┤
│ [      ✓ APPROVED (disabled)  ] [🖨] │  primary becomes a state, not an action
```

Editing after approval sets the status to "You changed something since approving", and the primary returns to "Approve changes". Never silent.

### W3. Edit sheet: Sunday rhythm

```
├──────────────────────────────────────┤  sheet over dimmed plan, drag handle
│ ───                                  │
│ When does your family reset?    ✕    │  H2 serif 22px
│ ┌─────────────┐ ┌─────────────┐      │  reuse .osr-choice-grid chips, 52px
│ │After breakfast│ │After church │      │
│ └─────────────┘ └─────────────┘      │
│ ┌─────────────┐ ┌─────────────┐      │
│ │After lunch ✓│ │Sunday evening│     │
│ └─────────────┘ └─────────────┘      │
│ Something else  [______________]     │  one field, appears on tap
│ [            DONE            ]       │  saves on change; Done just closes
```

Tapping a chip saves immediately and closes after about 300ms. That makes scenario B **two taps**.

### W4. Edit sheet: a person's weekly role (same shape for a fall job)

```
│ Ava's weekly role               ✕    │
│ ( ) Check school and activity days;  │  2–3 age-appropriate suggestions from
│     spot what I need            ✓    │  the existing weeklyRole() logic
│ ( ) Prepare clothes, bag, belongings │
│ ( ) Write my own…  [_____________]   │
│ ──────────────────────────────────── │
│ Name on the sheet  [ Ava         ]   │  replaces contenteditable-on-paper
│ [            DONE            ]       │
```

Fall job sheet: **Who** (person chips, not a `<select>`), **Job** (text), **What done looks like** (text), and "Remove from this month" with Undo. The bulk "Restore all fall jobs" button is removed.

### W5. Full-screen proof (secondary view)

```
┌──────────────────────────────────────┐
│ ✕ Close          [Front | Back]      │  segmented, 44px; swipe also switches
│ ┌──────────────────────────────────┐ │
│ │                                  │ │  true letter render, fit-to-width,
│ │     (actual printable page)      │ │  pinch-zoom allowed
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ [        PRINT OR SAVE PDF       ]   │  prints BOTH sides of the current version
└──────────────────────────────────────┘
```

A `<dialog>` with a focus trap, Escape to close, and focus returned to the thumbnail.

### W6. Last 72 hours / last day

```
│ ● 2 days left to make changes        │  sage-tinted bar; same position as status line
│ ● Changes close tonight, 11:59 PM ET │  (≤ 24h)
```

Optional later: one reminder email or push 72h before the cutoff, only if not approved (needs backend).

### W7. After cutoff (edition set)

```
│ OCTOBER 2027 · YOUR FAMILY PLAN      │
│ Our Family Sunday Reset              │
│ ✓ Your October edition is set.       │
│   [Mailed Oct 14 | Mailing soon]     │  only show mailed status when real
│ [thumbnails]                         │
│ Rows: same content, no chevrons      │  read-only, still readable
│ Your copies                          │  only if ≥ 1 exists
│ ┌──────────────────────────────────┐ │
│ │ Grandma's house · Nov 2        › │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ [    PRINT A COPY    ] [ EDITED COPY]│  primary print; secondary forks a copy
```

### W8. Copy view

```
│ ← October plan                       │
│ COPY · PRINTING ONLY                 │  eyebrow makes the mode unmistakable
│ Grandma's house               Rename │
│ ┌ This copy won't change your ───────┐
│ │ mailed October edition.            │  one line, persistent, not dismissible
│ └────────────────────────────────────┘
│ [thumbnails] [same rows, editable]   │
├──────────────────────────────────────┤
│ [   PRINT THIS COPY   ]   [ ⋯ ]      │  ⋯ = Delete copy
```

### W9. System states

| State | Shows |
| --- | --- |
| Loading | Title, a skeleton status line, grey thumbnails and three grey row groups. No spinner-only screen. Copy: "Preparing your family's plan…" |
| No family profile yet | "Add your family to see your prepared plan" → one button to the Family form. Never render an unpersonalized printable. |
| No access to this month | Reuse the `ClubMonthAccess` denied message. |
| Load or save failed | Inline row error: "Couldn't save. Try again" plus retry. On `ConflictError`: "Updated on another device. Showing the latest." |
| Prototype (no persistence or fulfillment) | One slim banner under the header on every state: **"Preview: changes stay on this device. Nothing is mailed."** It replaces all three current disclaimers. |

---

## 6. Deadline, approval and variations: the model

**Edition states** (derive from data, never from which screen she's on):

```
prepared ──edit──► edited ──approve──► approved ──edit──► edited-after-approval
    └──────────────────────┴──────────── cutoff (2nd Sun, 11:59:59 PM ET) ──► set (read-only)
                                                                              └─► copies (0–3)
```

- **Cutoff** comes from `clubEditingDeadline(month)`, already correct and tested. Phrasing by time left: more than 72h shows the date only; 72h–24h shows "N days left"; under 24h shows "tonight"; after the cutoff the plan is set. Recompute on `visibilitychange`, not every 15s.
- **Enforcement** has to be server-side before the UI says "set". Add a cutoff check to `club_document_save` (refuse if `now() > editing_cutoff_at`) and add `editing_cutoff_at` to `club_kits`. Reconcile it with `mailer_cutoff_at`; today they disagree by almost a month.
- **Approval** lives with the document: add `approved_revision int` and `approved_at timestamptz` to `club_documents`. "Approved" means `approved_revision = revision`. An edit bumps the revision, so the UI correctly shows "changed since approving" with no extra logic.
- **Mailed edition**: at the cutoff, a job copies the doc row to `doc = '<doc>--edition'` (read-only via RLS) and the mailing export reads only that row. The printable re-renders from the frozen edits with the same engine version. `engine_version` is already stored.
- **Copies**: `doc = '<doc>--copy-<n>'`. The doc-key regex (`^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 60) already allows this, so no schema change is needed. Put the name in `edits.meta.name`. Cap at 3 and auto-name them ("Copy · Nov 2"). Copies are never read by the mailing.
- **Before persistence ships**, keep the same UI on the sample store (`sampleStore` already mirrors revisions and conflicts) with the prototype banner. Never show "Approved for mailing" or "Mailed" without a backend record behind it.

---

## 7. Component hierarchy and information architecture

```
/app/club/october  (AppLayout)
└─ ClubMonthAccess(slug)             ← loads household + access; fixes finding #1
   ├─ ≥1100px: existing desktop rail + preview (unchanged)
   └─ <1100px: OctoberPlanMobile
      ├─ PlanHeader          eyebrow (month+year) · H1 · "Prepared for …"
      ├─ EditionStatus       one line; state machine above; prototype banner slot
      ├─ ProofThumbs         two scaled renders of the real .osr-paper → opens ProofViewer
      ├─ PlanSection "Sunday rhythm"   → PlanRow
      ├─ PlanSection "Weekly roles"    → PlanRow × members
      ├─ PlanSection "Fall example"    → PlanRow × active jobs
      ├─ CopiesList          (only when copies exist)
      ├─ StickyActions       primary (Approve / Approved / Print a copy) + Print icon
      ├─ EditSheet           single <dialog>; body = RhythmEditor | RoleEditor | JobEditor
      └─ ProofViewer         <dialog> full screen; front/back; Print
```

**State:** extract the October engine out of `OctoberSundayReset.astro` into `src/lib/club/engines/october-sunday-reset.ts`. That covers `State`, `weeklyRole`, `fallTemplates`, `defaultFallJobs`, `nameOf`, `setup`, and load/save via `ClubStore.documents/saveDocument`. The printable and the mobile plan both *subscribe* to that one state. No textContent scraping, no `resize` events as messages.

**Printing:** one print path. A single hidden print root (both `.osr-paper` sides, native 816×1056) that is never moved. The thumbnails and viewer are separate scaled clones rendered from the same state. `beforeprint`/`afterprint` DOM juggling goes away.

---

## 8. Visual specifics (mobile)

| Element | Spec |
| --- | --- |
| Type | One H1 (`--font-serif`, 30px/1.15, -0.02em). Sheet titles serif 22px. Section labels sans 13px/600 sentence case. Row value 15–16px; meta 13–14px `--color-warm-soft`. Eyebrow 11px/.16em, the **only** all-caps text on screen. Minimum body size 14px; drop the 10px labels. |
| Spacing | 4/8 scale. 20px side gutter (existing `#main` `px-5`). 28px between sections, 8px label-to-group. |
| Cards | One hairline-bordered white group per section on the ivory page (`--color-warm-rule`). No nested cards, shadows or radii above 3px; keep the brand's square edges. |
| Rows | Full-width button, min 56px, 16px padding. Right side: "Change ›" text in sage, not a ✎ glyph. Accessible name: "Change Sunday rhythm, currently Sunday after lunch". |
| Buttons | Primary `--color-warm-button`, white, 52px, 3px radius, uppercase .75rem/.12em (brand style). Secondary: 1px ink outline. Icon button 52×52 with a text label for AT. One primary per screen. |
| Sticky bar | `position:fixed`, bottom `calc(64px + env(safe-area-inset-bottom))`, ivory at 98%, top hairline. Hidden while a sheet is open or the keyboard is up. Page bottom padding matches its height. |
| Thumbnails | 2-up, about 150px tall, white paper on `#f1f2f2`, 1px rule. Real render, never an image mock. |
| Color | Sage only for state (✓, active chip, "Change"); charcoal for actions; ivory surfaces. Warning state is sage-tinted, not red. Nothing is ever really wrong. |
| Motion | Sheet slide 200ms. Honor `prefers-reduced-motion`. |
| Focus/keyboard | Visible 2px outline, sheets trap focus, Escape closes, focus returns to the invoking row, status changes in an `aria-live="polite"` region. |

---

## 9. Reuse

- `OctoberSundayReset` printable markup, `.osr-paper` styling, `fit()` scaling and its print CSS (the desktop path proves it).
- Engine logic in `OctoberSundayReset.astro`'s script: `weeklyRole`, `fallTemplates`, `defaultFallJobs`, `nameOf`, `setup`. Extract it, don't rewrite it.
- `clubEditingDeadline` and its test.
- `ClubGate` / `ClubMonthAccess` (household, access, sample vs account) and `ClubStore.documents/saveDocument` with `ConflictError`.
- `.osr-choice-grid` chip styling for the rhythm sheet. `.osr-dialog` base for sheets.
- The new flow's `.kit-review-card` row styling (a good base for `PlanRow`) and `.kit-flow-primary/secondary`.
- `family-app-brand.css` tokens; the app `Nav` tab bar as the only back navigation.
- Front/back segmented control behavior (aria-pressed).

## 10. Remove

In `src/pages/app/club/october.astro`:

- The three-panel flow (`[data-mobile-flow]` review/proof/done markup) and its script: `showPanel`, the proof-slot `appendChild` moves, the `beforeprint`/`afterprint` juggling, `updateReview` textContent scraping, the `sessionStorage` "reviewed-preview" write.
- CSS blocks scoped to `max-width:1099px` / `639px`: compact viewer (lines ~331–365), "Mobile review, simplified" grid (~367–431), the ≤639 floating action bar and header `::after "OCTOBER"` hack (~439–482), the native flow block (~537–575), and the ≤1099 order/`display:contents` rules (~248, 256–265). That's about 250 lines and most of the 236 `!important`s.
- `.kit-enlarge` / `.kit-viewer-close` / `.kit-expanded` overlay, replaced by `ProofViewer`.
- Guard the `[data-kit-side]` hide rule (line 95) with `@media screen`. This is the print bug fix and should ship on its own first.

In `OctoberSundayReset.astro`, gated so `/club/october-preview` and desktop are unaffected:

- Don't render the "Try the Wall Calendar" tab/panel on the app route (prop).
- Mobile-only `@media(max-width:700px)` fixed `.osr-actions` bar and `.osr-jump-edit` (unused on this route).
- `contenteditable` editing on the paper at < 1100px. Names and cue move to sheets.
- Editor copy "edit printed wording directly using the pencil marks on the preview" (an instruction we shouldn't need).

---

## 11. Incremental plan (each step shippable, desktop and Cleaning untouched)

Guardrails for every PR:

- All new CSS is scoped to `@media screen and (max-width:1099px)` under a new root class.
- Desktop markup is unchanged.
- No edits to `src/pages/app/cleaning*`, `Nav.astro` or shared Cleaning CSS.
- Screenshot diff at 1440 and 1100 before and after each PR.
- `npm run build` must pass.

| # | Change | Risk | Proves |
| --- | --- | --- | --- |
| 0 | **Print fix**: `@media screen` guard on the side-hide rule. Verify 2-page PDF from mobile in Chromium plus iOS Safari. | Tiny | Mom can print both sides today. |
| 1 | **Load the family**: wrap the route in `ClubMonthAccess` (sample store in preview). Add loading, no-family and denied states. Remove the "Choose a preview family" string from print. | Low; desktop gains real names too (intended) | Finding #1 fixed; scenario A becomes truthful. |
| 2 | **Honesty pass**: one prototype banner. Remove "Create a New Version" and "Version Reviewed" claims. Rename approve to "Looks good". | Low | Nothing misleading ships while 3–6 land. |
| 3 | **Extract engine** to `engines/october-sunday-reset.ts` with subscribe/load/save through `ClubStore`. Printable consumes it. Desktop renders identically (diff screenshots). | Medium; touches shared component | One source of truth; edits persist across sessions. |
| 4 | **New mobile plan** (`OctoberPlanMobile`, W1/W3/W4/W5/W9) for < 1100px. Delete the three-panel flow and the CSS layers in §10 in the same PR. | Medium | Scenarios A–C in ≤ 2 taps per edit. |
| 5 | **Edition status + cutoff**: `EditionStatus` with the time-left rules; read-only "set" state driven by the date (UI only; banner still says preview). | Low | W2/W6/W7 visible. |
| 6 | **Backend** (owner approval required; migrations aren't applied live): `editing_cutoff_at` + save refusal after cutoff, `approved_revision/approved_at`, `--edition` freeze job, reconcile `mailer_cutoff_at`. | High; data | Approval and lock are real. Only then switch the label to "Approve for mailing". |
| 7 | **Copies** (`--copy-n` docs, CopiesList, W8). | Low–medium | Scenarios D and E pass without touching the edition. |

---

## Owner decisions needed

1. **Default-mail vs approve-to-mail.** Recommended: the plan at cutoff mails, and approval is reassurance.
2. **Which product is October 2027**: the kit config's *Fall Home Reset* or this page's *Sunday Reset*.
3. **Cutoff timing**: second Sunday of the kit's month puts mailers in the third week; `mailer_cutoff_at` currently says Sep 15. Pick one rule and make both columns follow it.
4. **Copy cap** (recommended 3) and whether copies are allowed before the cutoff (recommended yes, behind ⋯).
