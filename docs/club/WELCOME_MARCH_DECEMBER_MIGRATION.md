# Welcome Kit, March and December restructure: migration tracker

**Source of truth for this project.** Read this before editing any code for it. Update it after every phase. Don't
rely on chat history. Started 2026-11-08 from `main` at `9d113b9`.

| Phase | Scope | Status | PR |
| --- | --- | --- | --- |
| 1 | Architecture audit and migration plan (this document) | COMPLETE (approved and merged 2026-11-08) | [#430](https://github.com/Mark-NYC/organized-mom-collective/pull/430) |
| 2 | Family Rhythm becomes the permanent Welcome resource and the Welcome Kit print | IN PROGRESS (2a → 2b → 2c → 2d, one PR each) | see §12 |
| 3 | March becomes Spring Clean as a Team | NOT STARTED (needs Phase 2 tested and verified) | – |
| 4 | Family Values moves to December 2027 | NOT STARTED (needs Phase 2 COMPLETE; D7–D9 deferred to Phase 4) | – |

Statuses: NOT STARTED · IN PROGRESS · BLOCKED · READY FOR REVIEW · COMPLETE. COMPLETE means tested, merged and, where
it touches the database or Edge Functions, applied with the owner's go-ahead.

---

## 1. Product decisions and non-negotiables

The target:

- **Welcome:** a personalized **Our Family Rhythm** that gives Mom an immediate practical win, available the day she
  joins, whatever the month, and printed in her Welcome Kit in place of the Family Vision print.
- **March:** **Spring Clean as a Team**: one cleaning project, thirty minutes, everyone has a part. Front: the plan.
  Back: illustrated job guides for only the jobs on her plan. One double-sided 8.5 × 11 sheet, no cutting.
- **December:** the **Family Values** print (today's "Family Vision") as a December gift, to keep or to bless another
  family, fitted to the Christmas Mission without growing the mailing.

Non-negotiables (from the brief and CLAUDE.md):

1. One Family Rhythm implementation. No second engine, no copied March page, no new chore-chart generator.
2. Keep March Family Rhythm's approved design, recommendation logic, validation, ownership semantics
   (`individual` / `parallel_individual` / `joint`), January colors and member ids, habits, finish lines, icons,
   desktop and phone editing, print styling.
3. Use the saved family profile. Editing is optional. No new questionnaire; at most one focused question, only if no
   equivalent exists (it does: see §5.2).
4. No points, streaks, rewards, tracking or dashboards.
5. Never overwrite a historical welcome order, an approved print, a saved plan, member colors or ids.
6. Don't touch Stripe pricing or subscriptions, calendar checkout, other months, the cleaning companion, member
   access rules or unrelated public pages.
7. A browser print preview is not fulfillment. Fulfillment means the owner's print view, the queue, readiness,
   admin actions, CSV and emails all handle the new item.
8. Don't replace March until the Welcome resource is proven. Don't remove Family Values from the Welcome Kit until the
   Welcome Family Rhythm is proven.
9. Separate PR per phase. Customer copy says "website" or "cleaning companion", never "app".
10. **Permanent guardrails (owner, 2026-11-08):** no mailed Welcome Family Rhythm when the first fulfilled monthly
    resource already gives the household a daily rhythm (May, August), and the Welcome Family Rhythm is evergreen, not
    homework. Full wording in §11.1; implemented as 2d before any automated Welcome fulfillment.
11. **Print assumptions are configurable (D6).** Target: premium uncoated, letter, flat. Stock, finish and sides for
    each Welcome Kit item live in one config (2c), shown on the admin packing list and marked unvalidated until the
    owner confirms them with the printer.

## 2. Current architecture (audited 2026-11-08)

### 2.1 Signup → Welcome Kit (what exists)

| Step | Where | Notes |
| --- | --- | --- |
| Checkout | `/club#offer` → Stripe Checkout; `supabase/dashboard/club-billing.ts` | Out of scope. Founding members (before Jan 2027): $0 now, first month January 2027 |
| Orders created | `supabase/migrations/20261106000000_club_welcome_vision.sql`, `20261108000000_club_welcome_kit.sql` | First paid invoice creates two `club_fulfillment_orders`: `welcome_vision` and the `monthly_resource` of `first_paid_month`. `club_fulfillment_one_welcome`: one live welcome order per household |
| Sign in, family, profile steps 2–6, address | `/club/welcome` (`ClubWelcome.tsx`, `FamilyForm.tsx`, `FamilySetup.tsx`); `src/lib/club/onboarding.ts` (`nextStep`) | Steps and storage: `docs/club/FAMILY_PROFILE.md`; profile migration `20261109000000_club_family_profile.sql` |
| Kit hub | `/club/welcome-kit` (`WelcomeKitHub.tsx`, `WelcomeKitItems.tsx`, `KitPreview.tsx`, `WelcomeKitBar.tsx`) | Three cards: print, Family Meeting guide, first month. `KIT_ORDER = ['print','guide','first']` |
| Family Vision print | `/club/family-vision` (`FamilyVisionPrint.astro` + `FamilyVisionAccess.tsx`); public preview `/club/family-vision-preview` | Family name + one of 20 values (`club_vision_valid`) + watercolor (`assets/icons/ofc/vision/`). Letter portrait, one sheet. Approved server-side (`club_welcome_approve`), stored in `club_fulfillment_orders.personalization` (`{family_name, value}`, ≤ 2000 bytes) |
| Family Meeting guide | `/club/family-meeting-guide`, `src/data/club/meeting-guide.ts` | Standard insert, same for everyone, never a step |
| First month | `/app/club/<month>?welcome=1` (`WelcomeKitConfirm.tsx` in `ClubPlanShell`) | Device-only review (`markFirstResourceReviewed`), then "Prepare My Welcome Kit" → `club_fulfillment_approve` + `kit_submitted` email |
| Readiness | `club_fulfillment_queue` view (latest in `20261110000000_club_welcome_kit_approvals.sql`) | `needs_profile → needs_address → mail_paused → needs_vision → needs_resource → needs_confirmation → needs_pdf → ready`; one readiness per package (`in_welcome_kit`, `kit_partner_id`, `kit_submitted_at`, `kit_ship_by`) |
| Admin | `/admin/club → Fulfillment → Welcome Kits` (`src/components/admin/ClubAdmin.tsx`, `supabase/dashboard/club-admin.ts`) | `club_admin_set_welcome_kit` moves both halves together; "Print view" per item; CSV one row per package |
| Emails | `supabase/functions/_shared/club/emails.ts` (welcome, `kit_reminder` ×2, `kit_submitted` to the owner) | All name "Family Vision print" |

**PDF and printing: there is no PDF generation, print API or mail-house integration for the Club.** The owner opens the
item's print view (`/club/family-vision?fulfillment=<order>` or `/app/club/<month>?fulfillment=<order>`,
`startFulfillment` in `src/lib/club/plan/family.ts`, which restores her saved version), uses the browser's Save as PDF,
clicks "Mark PDF ready" (`pdf_status` flag only; no file is stored), then marks printed and mailed by hand. Gelato
(`supabase/GELATO.md`, PR #286) is the shop's, not the Club's. `provider` / `provider_ref` columns exist, unused.

### 2.2 Saved plans

- Every monthly tool keeps its plan in a sessionStorage key and mirrors it to `club_resource_versions` (one row per
  `household_id, kit_id`, ≤ 64 KB, `revision`, `approved_at`) through `club_resource_get` / `club_resource_save`
  (`src/lib/club/plan/account.ts`). Saving clears `approved_at`; saving is refused once that month's order is printed,
  mailed or approved in a kit.
- `club_kits`: `slug` must match `YYYY-MM-…`, **`month` is NOT NULL and UNIQUE**, and access is `club_can_open(uid,
  kit_id)` from entitlements. **A month-independent resource can't live in `club_kits` / `club_resource_versions`
  without breaking those rules.** This drives D1.

### 2.3 March today

| File | Role | Month-specific? |
| --- | --- | --- |
| `src/lib/club/engines/march-family-rhythm.ts` (803 lines) | Pure engine: anchors, job library, `prepare`, `ownershipOf`, `validatePlan`, `cleanPlan`, `fromLegacy`, `restorePlan`, habits, finish lines, fingerprint | **Only `KIT_MONTH = '2027-03'`** (line 42), used once (line 195) to compute ages via `familyContext`. Everything else is reusable as is |
| `src/components/club/MarchFamilyRhythm.astro` | Sheet, desktop editor dialog, `clubPlan` controller | Takes `storageKey` prop. Sheet header is month-free ("Our Family Rhythm"); the editor kicker says "Make it yours · March" (line 23), needs a prop |
| `src/components/club/MarchPlanMobile.astro` | Phone reference view and edit rows | Gets `deadline` from the page |
| `src/lib/club/march-rhythm-editor.ts` | Shared editor (dialog and sheet) | No |
| `src/pages/app/club/march.astro` | Page: `ClubPlanShell kitSlug="2027-03-spring-clean-together"`, `ClubPlanDesktop` rail, `MarchTabs` | Yes: kit, deadline (`clubEditingDeadline('2027-03')`), "March · Kit preview", storage `omc:club:march-chore-charts:v2`, approval `omc:preview:march-chore-charts:approval` |
| `src/components/club/MarchTabs.astro` | Family rhythm / Spring Prep tabs | Yes |
| `src/pages/app/club/march/spring-prep.astro` + `MarchSpringPrep.astro` | Spring Prep: the companion's March deep-clean tasks from `src/data/cleaning.ts` (`monthlyDeepClean` month 2: baseboards, vents, winter gear, curtains, donate) with owners, supplies, "done" lines and child-safety notes | Yes. Not on the shared shell, tab-only, "preview only", not saved to the account, not fulfilled |
| `src/data/club/kits/2027-03-spring-clean-together.ts` | Kit config: draft letter, "Our One-Room Family Reset" checklist, `tool: 'spring-cleaning'` | The kit's slug/title still say spring clean; the registry title (`src/data/club/resources.ts`) says "Our Family Rhythm" |
| `src/data/spring-cleaning.ts`, `src/components/site/SpringCleaningBuilder.astro`, `spring-cleaning-builder.ts` | Family Spring Cleaning Builder: rooms, jobs with `minutes`, `minAge`, `adultOnly`, body/product tags, 15/30/60-minute sessions, fair assignment, "Needs someone" | No. **The ready-made rules engine for Phase 3** |
| Family Meeting | `ClubFamilyMeeting` in `ClubPlanShell` (`kitMonth`), `src/data/club/family-meeting.ts` (March entry routes to `/app/club/march`) | Per month |
| `/club/march-preview`, kit page | Still describe Spring Prep | Yes |

### 2.4 December today: two Decembers, neither delivered to a member yet

| | December 2026 | December 2027 |
| --- | --- | --- |
| Kit row (prod) | `2026-12-christmas-mission`, draft | `2027-12-christmas-family-affair`, draft |
| Built resource | **Christmas Mission**: `/app/club/december` on the shared shell (`DecemberMissionPrototype.astro`, `DecemberPlanMobile.astro`, engine `december-christmas-mission.ts`, pages `src/lib/december/layout.ts`). Two single-sided sheets: the kids' mission + a card sheet they cut and fold. Plan state is just which kids and which grown-up helper | Kit config only (`src/data/club/kits/2027-12-christmas-family-affair.ts`): letter (draft), "Our Family Christmas Plan" checklist, Traditions Picker tool. **No `/app/club` tool, not in `clubResources`** |
| Who gets it | Nobody: owner decision 2026-10-31, founding members start January 2027; no Nov/Dec 2026 resources | The first December any member reaches |

The Club year in `src/data/club/resources.ts` runs Nov 2026 → Oct 2027, so "December" in the member's year strip is the
2026 Mission. **Phase 4 targets December 2027. Do not edit the 2026 rows.**

The December substitution (a first-month December became the welcome print) is retired for new members since
20261108; older substituted rows still ship as promised. Nothing in production uses it.

### 2.5 Production state (read-only queries, 2026-11-08)

- Migrations applied through `20261113000000_club_household_icon_style` (incl. `20261108` welcome kit, `20261109`
  profile, `20261110` approvals, `20261120` colors as `20261107153101`).
- 10 households, 5 onboarded, 4 with a step-6 priority.
- Welcome orders: 7 `welcome_vision` (5 pending, 1 skipped; 3 personalized), paired with 6 January 2027 orders.
  **2 kits submitted and waiting on PDFs**, 1 waiting on confirmation, 2 on profiles, 1 skipped.
- `club_resource_versions`: 2 rows, both January 2027 (1 approved). **No saved March plans exist in production.**
- Whether these are test or real households wasn't checked (Stripe mode not verified). Treat all as real.

## 3. Target architecture

### 3.1 One Family Rhythm, two contexts

```
march-family-rhythm.ts  ──►  family-rhythm.ts (engine, month passed in)
                               ├─ Welcome context: /app/club/family-rhythm  (permanent, every member)
                               └─ March context:   /app/club/march          (until Phase 3 replaces it)
MarchFamilyRhythm.astro ──►  FamilyRhythm.astro   (same sheet, same editor, props: storageKey, context, kicker)
MarchPlanMobile.astro   ──►  FamilyRhythmMobile.astro
march-rhythm-editor.ts  ──►  family-rhythm-editor.ts
```

- Rename by `git mv` with thin re-exports at the old paths (so imports, tests and the QA scripts keep working), or keep
  the March file names and import them from the Welcome page. Either way, one source. Decide in Phase 2 by diff size;
  **re-exports preferred** so `march.astro` doesn't change in Phase 2.
- Engine change: `KIT_MONTH` becomes a parameter of the function that builds the context (`prepare(…, { month })`),
  default `'2027-03'` so March is byte-identical. Welcome passes the month she opened it, then the saved profile
  snapshot (`settledSnapshot`) keeps the plan stable, as March already does.
- Priority mapping (`suggestedAnchors`) already reads step 6 (`priority`) and step 5 (`challenges`). Phase 2 also lets
  the priority pick the **default new habit** (today it's the wished job, then "most meaningful"). Small, tested
  change; March gets it too (same engine).

### 3.2 Welcome storage (recommended; D1)

New, additive, household-scoped table, not a fake kit:

```sql
club_welcome_plans (
  household_id uuid primary key references club_households on delete cascade,
  resource text not null default 'family-rhythm' check (resource in ('family-rhythm')),
  state jsonb not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 65536),
  revision int not null default 1,
  approved_at timestamptz,
  approved_fingerprint text,
  updated_at timestamptz not null default now()
)
```

- RPCs `club_welcome_plan_get()`, `club_welcome_plan_save(p_state, p_revision)` (same revision/no-op rules as
  `club_resource_save`), `club_welcome_plan_approve(p_fingerprint)`. RLS on, grants revoked, owner-only, like
  `club_core`. Admin reads only through the fulfillment print view.
- Access: any household with Club access (`club_me().access`), regardless of month. Exact predicate to be copied from
  how `/club/welcome-kit` gates today, not invented.
- `src/lib/club/plan/account.ts` gets a second backend for this table (same debounce, conflict and "only her changes
  save" rules). The shell needs a `context="welcome"` mode that skips `kitSlug` entitlement checks and the monthly
  deadline.
- Tab key `omc:club:welcome-family-rhythm:v1`, approval keyed by the server row (not a device-only key).

### 3.3 Welcome Kit fulfillment (recommended; D2, D3)

- New `fulfillment_type 'welcome_rhythm'` (check constraint widened additively; `club_fulfillment_one_welcome`
  becomes "one live welcome order of either type per household").
- **Approved snapshot on the order:** at her approval, the approved plan state is copied into the order (a new
  `approved_state jsonb` column, or `personalization` with its 2000-byte cap raised for this type only). The print view
  `/app/club/family-rhythm?fulfillment=<order>` renders that snapshot, never the live plan, so edits after approval
  can't change what mails and a reprint is identical. Editing after approval clears approval and kit confirmation
  (same as today's months) until the kit is approved for print; after that the mailing copy is locked but she can
  keep editing and printing at home.
- **Cutover:** a switch (`club_settings` row or a migration-time constant, see D3) decides which type the first
  paid invoice creates. Before the switch: `welcome_vision`, exactly as today. After: `welcome_rhythm`. Existing
  orders are never converted.
- Readiness: `needs_vision` gets a sibling `needs_rhythm`; pairing, `club_admin_set_welcome_kit`, reminders, the
  `kit_submitted` email, admin rows and CSV branch on type. Packing list: Family Rhythm · Family Meeting guide · first
  month.
- Onboarding: `KIT_ORDER` stays three items; item 1 becomes "Your Family Rhythm" for a `welcome_rhythm` order and
  stays "Family Vision Print" for a `welcome_vision` one. `onboarding.ts`, `WelcomeKitHub`, `WelcomeKitItems`,
  `KitPreview`, `kitNext`, `Dashboard`, `AppKitLibrary`, `ClubResourceAccess`, `ClubGate` branch on the order's type.

### 3.4 Independence

- Welcome never reads or writes March's keys (`omc:club:march-chore-charts:v2`) or March's `club_resource_versions`
  row, and March never reads Welcome's. Opening March doesn't seed from Welcome. (Open: D4, should March pre-fill from
  her Welcome plan while March still is Family Rhythm? Recommended **no**: Phase 3 replaces it anyway.)
- The Welcome page has no editing deadline, no monthly Family Meeting tab, no month kicker.

## 4. Data and persistence implications

| Change | Kind | Risk |
| --- | --- | --- |
| `club_welcome_plans` + 3 RPCs | Additive table | Low. Rollback: drop table/functions (no other object depends on them until the queue does) |
| `fulfillment_type` adds `welcome_rhythm`; one-welcome index covers both | Constraint widen + index replace | Medium: index replaced in the same transaction; verify no household has a live order of both types (none can today) |
| Order snapshot column | Additive column | Low |
| `club_fulfillment_queue`, `club_admin_set_welcome_kit`, reminder and kit functions | `create or replace` | **High**: these are live. Rehearse with `scripts/rehearse-club-rollout.sh` and `supabase/rollout/*` like 20261110; capture a production fingerprint first |
| Cutover switch | Additive setting | Low |
| `PRIORITIES` gains `bedtime` (only if D5 = yes) | Data file + `club_focus_save` validation if it checks ids | Low |
| Phase 3 March: new state key, old key read-only | Client | Low (no saved March plans in prod) |
| Phase 4 December 2027: new resource registry entry; Values personalization stored on the December plan state | Client + `club_resource_versions` (normal monthly path) | Low |

Never: rewrite `personalization` on existing `welcome_vision` orders, touch `entitlements.fulfilled_by`, or change
member ids/colors.

## 5. Onboarding and approval implications

### 5.1 Journey after Phase 2 (new enrollments only)

Tell us about your family (unchanged, steps 1–6) → **Your Family Rhythm** (prepared from the profile; view, optional
changes, **Approve for printing**, Download and print) → Family Meeting guide (unchanged) → first month (unchanged)
→ Confirm your Welcome Kit (unchanged). Club Home links to the Family Rhythm permanently.

Existing members (any type of welcome order) also see the Family Rhythm in Club Home as a digital resource; it isn't
added to their mailing (D2).

### 5.2 The pain-point question: already asked

Step 6 (`PRIORITIES` in `src/data/club/family-profile.ts`: "the one thing she'd love to stop managing alone") is the
equivalent of the brief's question and the engine already reads it:

| Brief's choice | Existing step-6 id | Moments today (`suggestedAnchors`) |
| --- | --- | --- |
| Morning routines | `mornings` | breakfast, dinner (+ leave offered) |
| After-school responsibilities | `school-stuff` | home, dinner (+ teeth) |
| Dinner and kitchen cleanup | `evenings` | dinner, teeth (+ breakfast) |
| Bedtime routines | **none** (closest: `evenings`) | – |
| Shared-space clutter | `tidying` | dinner, teeth (+ breakfast) |

Recommendation: **no new question.** Optionally add one `bedtime` choice to step 6 (D5). A skipped step 6 falls back
to challenges, then ages, as today.

### 5.3 Approval

Family Rhythm approval is server-side (like the Vision print, unlike today's device-only month review), so the
"Prepare My Welcome Kit" gate can trust it across devices.

## 6. Printing and fulfillment implications

- One Letter sheet replaces one Letter sheet, so the package's sheet count is unchanged (Rhythm 1 + guide 1 + January 2).
- **Paper stock (D6):** target premium uncoated, letter, flat; configurable and unvalidated until the owner confirms
  it with the printer (§1 item 11). No mail-house contract is documented in the repo.
- Print path is the owner's browser print view → Save as PDF → Mark PDF ready. Phase 2 must make
  `?fulfillment=<order>` work for `welcome_rhythm` and print the approved snapshot, verified one page per sheet
  (`tests/club-plan-print.test.ts`, `scripts/club-personalized-months-qa.mjs`).
- The 2 submitted kits and every other `welcome_vision` order ship with the Vision print as promised.
- No claim of automated printing or mailing anywhere in copy or docs.

## 7. Dependencies and order

```
Phase 1 (docs) ─► D1–D4 decided
  ─► 2a engine: month param + priority→habit (no UI change; March unchanged)         [PR]
  ─► 2b Welcome page /app/club/family-rhythm on the shell, welcome context, storage   [PR, migration not applied]
  ─► 2c fulfillment: welcome_rhythm type, snapshot, queue, admin, emails, onboarding  [PR, migration rehearsed]
  ─► owner applies migration + deploys functions + flips cutover                      [owner]
  ─► Phase 2 COMPLETE (acceptance §10.2 passed on production-like data)
        ├─► Phase 3 March Spring Clean as a Team (independent of Phase 4)
        └─► Phase 4 December 2027 Family Values (needs Vision removed from new kits = 2c cutover)
```

Phase 2 may land as one PR if 2a–2c stay reviewable; split if the diff passes ~1,500 lines.

## 8. Phase-by-phase checklist

### Phase 1: audit (COMPLETE)

- [x] Trace signup → kit → print → fulfillment (§2.1)
- [x] Audit March engine, page, phone view, editor, Spring Prep, kit config, builder (§2.3)
- [x] Audit both Decembers and the substitution (§2.4)
- [x] Audit shared plan architecture, personalization, colors, storage, account save (§2.2, §3)
- [x] Read-only production counts (§2.5)
- [x] Open PRs reviewed: #424, #425 (March) are already in `main` (0 unmerged commits) and can be closed; #268 is
      1,600+ commits behind, don't build on it; #251/#253 (December 2026) predate the current page; nothing else
      touches the Welcome Kit
- [x] Tracker and plan written
- [x] Owner reviewed and approved D1–D6 (D7–D9 deferred; D10 approved in principle)

### Phase 2: Welcome Family Rhythm

- [x] 2a Engine moved to `src/lib/club/engines/family-rhythm.ts` (`march-family-rhythm.ts` re-exports it). A plan's
      ages come from `RhythmState.month` (optional, `YYYY-MM`, validated, saved with the plan, cleared by "start over");
      absent = March 2027, so every March plan reads exactly as before. `monthOf`, `rhythmContext` exported. Snapshot of
      March recorded before the move (`family-rhythm-march-snapshot.test.ts`, separate commit) and unchanged after
- [ ] 2b: the priority-led default habit and `bedtime` (D5) (moved from 2a so 2a changes nothing March prints)
- [x] 2a Tests (`family-rhythm.test.ts`): Welcome month ages; small (1 adult), large (2 adults + 5 kids), no kids, teens only; individual,
      parallel and joint rows; colors stable across reorder/add; 300 generated households still pass `validatePlan`
- [ ] 2b Shared components (re-exports), `context="welcome"` in `ClubPlanShell` (no deadline, no meeting tab, no
      `kitSlug` entitlement), page `/app/club/family-rhythm`, `routes.ts`, `ClubNav`/Club Home link, README routes and keys
- [ ] 2b Storage: `club_welcome_plans` migration + RPCs + `account.ts` backend; sample families tab-only
- [ ] 2b Desktop 1100/1440 and phone 375/390/768: edit, save, reload, other device, approve, print one page
- [ ] 2c `welcome_rhythm` type, snapshot, cutover switch, queue/readiness, admin actions, CSV, print view, reminders,
      emails, onboarding branch, Welcome Kit hub card
- [ ] 2c Tests: `supabase/tests/club-membership.sql` (new enrollment gets `welcome_rhythm`; existing `welcome_vision`
      untouched; approve → snapshot; edit after approval clears; kit approved locks; reprint identical),
      `tests/club-onboarding.test.ts`, `tests/club-billing-e2e.test.ts`, `scripts/club-onboarding-e2e.mjs`
- [ ] 2d Welcome overlap exception (§11.1 guardrail 1): classify by the first fulfilled monthly resource; no Rhythm
      in the mailing for May/August; no duplicate welcome orders; pairing, readiness and email copy tested; digital
      access kept. Before any automated Welcome fulfillment or cutover
- [ ] Rehearsal on a production replay (`scripts/rehearse-club-rollout.sh`), rollback script, verify script
- [ ] March regression: `/app/club/march` unchanged (screens + print), `npm run test:club`, January regressions

### Phase 3: March, Spring Clean as a Team

- [ ] Brief: project choice rules (one room from `src/data/spring-cleaning.ts`, scaled to ~30 minutes, jobs ≤ people
      who can safely help, never filler), reuse of builder assignment rules and Spring Prep safety notes
- [ ] Job guide library (what to do / how / finished looks like; age wording; adult or supervised flag) keyed to
      builder job ids; illustrations from the approved Club hand-drawn set (list gaps, don't generate)
- [ ] Engine `src/lib/club/engines/march-spring-clean.ts`, printable (front plan, back guides for her jobs only),
      phone adapter, page on the shell, new storage key; old Family Rhythm key left in place, unread
- [ ] Spring Prep tab retired (redirect `/app/club/march/spring-prep` → `/app/club/march`), `MarchTabs` removed; kit
      config, registry title, `/club/march-preview`, kit page and Family Meeting March entry updated
- [ ] Tests: households 1–9 people, toddlers only, teens, no kids; adult-only jobs never to children; print = 2 pages
      (one sheet, duplex); March independent of Welcome

### Phase 4: December 2027, Family Values gift

- [ ] Brief and D7–D9 decided
- [ ] Extract the Vision artwork into a shared component used by `/club/family-vision` (historical orders, unchanged)
      and the December resource
- [ ] December 2027 tool on the shell (`2027-12-christmas-family-affair` slug, registry entry), Mission pages reused
      from the 2026 component without editing the 2026 page
- [ ] "Keep for our family" and "Share with another family" variants; gift copy never states the recipient's values
- [ ] Remove Family Vision from public Club copy, privacy page wording, emails for new members only after cutover
- [ ] Tests: December 2027 coexistence with the Mission; sheet count; 2026 page unchanged; historical `welcome_vision`
      print view unchanged

## 9. Risks and rollback

| Risk | Mitigation | Rollback |
| --- | --- | --- |
| Live queue/kit functions break new or pending kits | Rehearse on a production replay; fingerprint first; keep `welcome_vision` paths byte-identical | Rollback SQL restoring captured definitions (pattern: `supabase/rollout/rollback.sql`); cutover switch back to `welcome_vision` |
| A pending Vision kit silently becomes a Rhythm kit | Cutover only affects orders created after it; tests assert existing orders keep their type | Nothing to undo if the rule holds |
| Engine refactor changes March output | Snapshot every fixture's prepared plan and fingerprint before the change | Revert 2a |
| Welcome edits leak into March (or the reverse) | Distinct keys and tables; test asserts no cross-read | Revert 2b |
| Mailed Rhythm differs from what she approved | Print view reads the order's snapshot; fingerprint check | Reprint from the snapshot |
| Sample family data saved to an account | Existing rule: samples tab-only (`loadKitHousehold`); test for the welcome backend | – |
| Copy promises the Rhythm before it's live | Public copy changes ship with the cutover, not before | Revert copy |
| December mailing grows silently | D7 decided before any December build | – |

## 10. Test and acceptance checklist

### 10.1 Always run

`npm run check`, `npm test`, `npm run test:club`, `npm run test:admin-sql`,
`npm run build`, `node scripts/club-onboarding-e2e.mjs` (and `--only=months`),
`node scripts/club-personalized-months-qa.mjs <dist> <out>`. Known failures: `docs/club/KNOWN_TEST_FAILURES.md`.

### 10.2 Phase 2 acceptance

A new member completes onboarding, immediately sees a personalized Family Rhythm on `/app/club/family-rhythm`, can
change it or not, approves it, prints one page, returns to it from Club Home on another device, and her kit's print
view shows exactly what she approved. Every existing order, approval and saved plan is unchanged. March is unchanged.

### 10.3 Phase 3 acceptance

March prints one double-sided sheet: a 30-minute project with owned, age-safe jobs on the front and guides for only
those jobs on the back. No daily chart. No overlap with the Welcome Family Rhythm.

### 10.4 Phase 4 acceptance

New Welcome Kits contain no Family Values print. December 2027 offers it as keep-or-give within the agreed sheet
count, alongside the Christmas Mission. Historical Vision orders still print.

## 11. Product decisions

Options as proposed in Phase 1. The owner's decisions (2026-11-08) are in §11.1 and override the recommendations below.

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | Where the Welcome plan is saved | (a) new `club_welcome_plans` table; (b) a fake `club_kits` row (breaks unique month and entitlement rules); (c) inside the welcome order's `personalization` | **(a)**: permanent, month-free, survives the order |
| D2 | Do existing members get the Rhythm in the mail? | (a) digital only for existing members, printed only in new Welcome Kits; (b) also mail it to existing members (cost) | **(a)** |
| D3 | Pending, unsubmitted Vision kits at cutover (today: 1 waiting on confirmation, 2 on profiles) | (a) keep Vision, as promised; (b) switch to Rhythm if she hasn't approved the print | **(a)**: no promised item changes; the 2 submitted kits keep Vision in any case |
| D4 | Should March pre-fill from her Welcome plan while March is still Family Rhythm? | No / yes | **No**: Phase 3 replaces March |
| D5 | Add a `bedtime` choice to step 6? | Yes (one choice, additive) / no | **Yes**, only if the owner wants bedtime as a distinct priority |
| D6 | Paper stock and printing for the Rhythm in the kit | Same stock as the Vision print / standard | Owner checks with the printer; no fulfillment constraint is assumed |
| D7 | How Family Values fits December 2027 | (a) replaces the Mission's cut-and-fold card sheet: the family gives a personalized Values print to the family they're blessing; their own copy is a digital keep-print; 2 sheets, no cutting; (b) third sheet added to the mailing (cost); (c) digital-only optional gift beside the unchanged Mission | **(a)** if the owner accepts changing the card sheet; otherwise **(c)**. Never (b) without a cost decision |
| D8 | Which December 2027 concept survives | The built Mission (2026 component) vs. the 2027 config (Christmas plan checklist + Traditions Picker) | **The Mission + Values gift**, under the existing 2027 slug; the 2027 config's checklist retired or kept as the letter's back |
| D9 | What the gift variant says | Our family's chosen value ("From our family to yours: Kindness") vs. a value for them | **Our value, given**: never claims the recipient's values or uses their details |
| D10 | Spring Prep's fate | Retire (redirect) / keep as a digital extra | **Retire** in Phase 3; its jobs and safety notes feed the guide library |

## 11.1 Owner decisions and implementation guardrails (approved 2026-11-08)

- **D1 APPROVED:** separate household-scoped `club_welcome_plans` storage. Do not use a fabricated monthly kit.
- **D2 APPROVED:** existing members have digital access to Family Rhythm, not another physical mailing.
- **D3 APPROVED:** all existing Vision orders retain the originally promised Vision print, including pending orders; never convert orders at cutover.
- **D4 APPROVED:** Welcome and March plans are independent; no March prefill.
- **D5 APPROVED:** add a bedtime choice to the existing onboarding priority question, with no new question.
- **D6 TARGET:** premium uncoated paper. Stock and printer compatibility must be verified; no unverified production assumptions are hardcoded.
- **D7–D9 DEFERRED:** December 2027 configuration, Mission integration and gift language are not yet finally approved. Do not implement Phase 4 on presumed decisions.
- **D10 APPROVED IN PRINCIPLE:** retire standalone Spring Prep only after its valuable tasks, safety guidance and content are carried into the new March resource.

### Permanent launch guardrails

1. **Avoid overlapping welcome routines.** A member whose *first fulfilled monthly resource* already gives the household a daily rhythm (particularly May Summer Day or August School Day Routines) should not also receive a competing mailed Welcome Family Rhythm. Classify based on the first actual eligible fulfillment, not merely signup calendar month. Document and implement the exception as a separate focused follow-up **before any automated Welcome fulfillment or new-rhythm cutover is activated**. The Family Rhythm stays available digitally in every case. The conditional path must not generate duplicate welcome print orders; its effect on welcome-package order pairing, email copy and readiness must be tested.
2. **Evergreen, not homework.** The welcome Family Rhythm remains an optional ongoing reference. No mandatory progress tracking, periodic check-ins, reapprovals or automated prompts asking Mom to refresh her plan. An initial print approval is still required for any mailed copy; later voluntary edits can be supported without interfering with an already approved fulfillment snapshot.

### Implementation authorization boundaries

- Phase 2a, 2b and 2c each require a reviewable PR and tracker update. Phase 3 cannot start before Phase 2 is tested and verified.
- Do **not** apply production database migrations, deploy production functions, change live checkout, flip fulfillment switches or activate automatic mail handling without explicit owner authorization.
- Protect existing Vision orders and all historical approval snapshots. Run before/after March snapshot tests for 2a.

## 12. PR links and completion log

| Phase | PR | Status | Notes |
| --- | --- | --- | --- |
| 1 | [#430](https://github.com/Mark-NYC/organized-mom-collective/pull/430) | COMPLETE (merged) | Docs only; no product code, schema or data changed. Production queried read-only (aggregates) |
| 2a | Engine refactor (branch `claude/epic-noether-i7st9u`) | READY FOR REVIEW | PR link added once opened |

### Phase 1 log (2026-11-08)

- Completed: §2–§11.
- Changed files: this document; a pointer in `docs/club/WELCOME_KIT.md`.
- Tests: none needed (docs only).
- Owner review 2026-11-08: architecture approved; decisions and guardrails in §11.1.
- Next phase depends on: approved D1–D4; a production fingerprint before any `create or replace` of kit functions.

### Phase 2a log (2026-11-08)

- Completed: engine moved to `family-rhythm.ts` with `month` on the state; old path re-exports; README and
  PLAN_ARCHITECTURE point at the new file.
- Changed files: `src/lib/club/engines/family-rhythm.ts` (moved from `march-family-rhythm.ts`), `march-family-rhythm.ts`
  (re-export), `family-rhythm.test.ts`, `family-rhythm-march-snapshot.test.ts` + `__snapshots__/`, README,
  PLAN_ARCHITECTURE, this tracker.
- Tests: March snapshot (23 cases: every sample family, 12 fixture households, 120 generated households, an edit
  sequence with a save round trip, the legacy chore-chart migration) recorded on the old engine, passing unchanged;
  `family-rhythm.test.ts` 9 passed; `src/lib/club/engines` + `personalize` 201 passed; `npm run check` 0 errors;
  `astro build` passes, and `/app/club/march` and `/app/club/march/spring-prep` HTML match `main`'s (only Astro's
  random island uids differ). Full `vitest run`: 53 failures, every one also failing on `main` by name (main also
  fails the known slow `club-edits` property test); no new failures. Pre-existing failures have grown since
  `KNOWN_TEST_FAILURES.md` (42 on 2026-10-30) and aren't part of this project.
- Decisions: the priority-led habit moved to 2b so 2a changes nothing March prints.
- Next (2b): stacked on 2a.
