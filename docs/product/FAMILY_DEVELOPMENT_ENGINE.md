# Family development engine: skills library × development records × weekly meeting

**Status 2026-11-20 (revised after the owner review of PR 515): built on a branch, NOT live.** The code, tests and migration exist; the migration
(`20261207000000_family_development_records.sql`) is **not applied** to production. Until it is, the weekly Family
Meeting behaves exactly as before for every family (the read fails and the layer renders nothing).

Governing doctrine: [RESPONSIBILITY_DEVELOPMENT_FRAMEWORK.md](RESPONSIBILITY_DEVELOPMENT_FRAMEWORK.md) (unchanged by
this work). Resource crosswalk: [RESOURCE_ALIGNMENT.md](RESOURCE_ALIGNMENT.md). Household/meeting architecture:
[UNIFIED_FAMILY_ARCHITECTURE.md](UNIFIED_FAMILY_ARCHITECTURE.md).

> The family owns the decisions. The app remembers the progress. MAWL guides the development. Habits make it stick.

## 1. How the pieces fit

```
skills library (authored, versioned)          family profile (existing)              development records (NEW)
src/lib/family-development/skills.ts          club_households · club_family_members  household_development
43 canonical skill ids, ages as guidance,     club_responsibilities: existing,       one row per child × skill:
MAWL coaching, cues, finish lines, Watch      desired, confirmed (= agreements)      stage, status, cue, finish,
variations, safety                            priority, challenges, activities       note, last check-in
          │                                              │                           household_development_events
          └────────────────────┬─────────────────────────┘                           append-only decision history
                               ▼                                                                │
               engine (pure): src/lib/family-development/engine.ts  ◀────────────────────────────┘
               one next step per child: check in on what they're working on, or one new skill
                               │
                               ▼
     weekly Family Meeting /app/family/meeting (WeeklyMeeting.tsx), Club families only
     Let's Talk: "how's it going?"  ·  Everyone's Part: coaching + the family's choice  ·  Let's Practice: do it now
                               │ explicit taps only
                               ▼
     household_development_decide (record + history)  +  household_agreement_save ("We agreed", existing)
```

**What stays where.** The words the family agreed to remain an agreement in `club_responsibilities`
(`status = 'confirmed'`, `agreed_source = 'skill:<skill id>'`), so Today, Family Responsibilities, the calendar and
the printed resources keep reading one agreement model. The development record adds only what agreements can't
hold: the MAWL stage per child per skill, the habit cue and finish line in the family's words, the status
(active · paused · launched · dismissed) and the history of decisions.

## 2. Audit: what already existed and what was reused

| Need | Existing structure | Used as |
| --- | --- | --- |
| Household, adults, children, ages | `club_households`, `club_family_members` (birth year/month), `household_adults`, `household_id_for` | Authorization and age. No second profile. |
| Two adults, partner access to Club | `household_billing_user` + `club_has_access` (20261128, applied) | Server-side Club check on every write, either adult |
| Agreements | `club_responsibilities` confirmed rows, offline-first sync (20261127, applied) | "We agreed" for a new skill saves through the existing `fam.saveAgreement` with source `skill:<id>` |
| What the family wants a child to take on | `club_responsibilities` `desired` + `item` (onboarding "Growing responsibility") | Strongest recommendation signal (`skillForGrowthItem`) |
| What a child already owns | `existing` rows, confirmed agreements | Exclusion (never duplicate) |
| Priority, challenges | `club_households.priority`, `challenges` | Ranking signals with stated reasons |
| Weekly meeting | `WeeklyMeeting.tsx`, four parts from `MEETING_GUIDE` (PR #513's one-step-at-a-time flow) | The only interface; no new meeting |
| Agreement follow-through | `FollowThrough.tsx` + 20261204 (**not applied**) | Left as is; skips `skill:` agreements when the development layer is on, so nothing is asked twice |
| Club month suggestions | `buildFamilyMeeting` (`family-meeting.ts`) | Still shown for adults and for children without a development step |

**Minimal addition:** two tables and three functions in one additive migration. No existing table, row, function
or policy changes. A new table was needed because "Not now" and "Not for us" must be remembered without
becoming agreements, and because MAWL is per child per skill while an agreement can name several people.

## 3. Data model (migration 20261207, not applied)

`household_development` (one per household × child × skill, `unique (household_id, member_id, skill_id)`):

| Column | Meaning |
| --- | --- |
| `skill_id` | Canonical id from the library. Records survive library updates; an unknown id still shows in the family's words. |
| `title`, `cue`, `finish_line`, `note` | The family's words. Only a `modify` decision changes them (and the agreement's words follow). |
| `stage` | `model` · `assist` · `watch` · `launch`, always family-chosen. **Null** for a suggestion paused or dismissed before it was started: nothing is inferred. |
| `status` | `active` · `paused` · `launched` · `dismissed`. Launched ⇔ stage Launch (DB constraints). |
| `category` | The `club_responsibilities.category` its agreement is filed under. |
| `agreement_id` | The family agreement (a confirmed `club_responsibilities` row) that goes with it. Null for never-started ideas. |
| `last_signal`, `last_value`, `last_check_in_on` | The last "how is it going?" answer: *performance* (can do the steps), *consistency* (happens at the cue without reminders) or *ownership* (still theirs), each strong · partial · not-yet. |
| `variations_practiced` | Times the family said they practiced on a different kind of day (Watch). Counted, never converted into a stage. |
| `library_version`, `revision` | Library version decided under; optimistic concurrency for two adults. |

`household_development_events`: append-only history of every decision (from/to stage and status, answer, note,
what happened to the agreement, who, when). Families can read it; nobody can edit or delete it.

**Functions** (security definer, the household-function pattern used since 20261124):

- `household_development()`: every record with its last 12 events and `agreement_live` (is its agreement on the
  lists right now). Any adult of the household. **No Club check**: a family whose membership lapses keeps and sees
  its history, and its agreements stay on every list (free features).
- `household_development_decide(p, p_base)`: one decision **and its agreement change, in one transaction**.
  Requires a household **and** the household's Club access (`club_has_access(household_billing_user(uid))`) →
  `club_required`. Stale revision → `conflict`; a duplicate the family set aside → `exists`; else `invalid`. Returns
  the record plus the agreement as phones sync it (`household_agreement_json`), so the phone shows it at once.
- `household_development_ensure_agreement(...)`: internal (not callable by users). Links the child's live
  `skill:<id>` agreement if one exists, else creates one with the phone-made id.

### 3a. Agreement lifecycle (owner review of PR 515)

A development record and its agreement never contradict each other: the database changes both in the same
transaction, and the existing agreement functions are not modified (they sync these agreements like any other).

| Decision | Development record | Family agreement (`club_responsibilities`) |
| --- | --- | --- |
| **start** ("We agreed") | created at the family's stage | created (or the child's existing live `skill:` agreement linked) |
| **advance / step-back / stay / check-in** | stage per decision | unchanged: still practicing, or theirs |
| **Launch** (advance from Watch, or start at "It's already theirs") | launched | stays on the list, now as theirs |
| **Revisit a launched skill** (step-back) | active Watch | unchanged |
| **modify** | new words | its text, when and finished follow |
| **pause** ("Pause for now") | paused, stage kept | removed from every list: a tombstone (`deleted_at`), never a hard delete |
| **dismiss** ("Not for us") | dismissed, never suggested again | removed the same way |
| **resume** | active/launched again | a **new** agreement (a removed one is never brought back silently) |
| **agreement removed elsewhere** (Who does what → "We're done with this") | still active; read shows `agreement_live: false` | the meeting asks "Put it back on the list, or pause it here too?" → **restore** (new agreement) or **pause** |
| "Not now" / "Not for us" on a new idea | paused/dismissed, no stage | none is created |

**Retries and two adults.** The phone makes the record id and the agreement id once per card and resends them on
every retry: a repeated start (an answer lost on the way back) returns what was saved; a retried resume/restore
links the same agreement. Two adults agreeing to the same skill for the same child get one record and one agreement:
the second gets the first adult's (`adopted`), and the meeting says so. Other decisions use the revision: the later
adult gets `conflict` and the latest copy. A phone holding an offline edit to an agreement that a pause removed gets
the existing `removed` answer from `household_agreement_save`.

**Authorization:** RLS on both tables (select for the household's adults only); no insert/update/delete grants;
writes only through the function, which resolves the household from `auth.uid()` (never from input), checks the
child belongs to it, is current and is a child, and refuses another household's agreement id. Tested in
`supabase/tests/family-development.sql` (94 checks).

## 4. Recommendation engine (`src/lib/family-development/engine.ts`)

Pure, deterministic, no AI, no network, no clock (the meeting passes today's date). Same family + same day = same
plan. Every suggestion carries its reasons (`why`).

**Per child, at most one step**, in this order:

1. **Check-in that needs attention**: an active record whose last answer was *not yet* or *partly*, or whose
   agreement was removed elsewhere (put it back, or pause it).
2. **Due check-in**: active records weekly (6+ days), launched ones every 4 weeks. Never twice in a day.
3. **No new skill** when the child has a record in Model or Assist (that's where adult time goes), two
   responsibilities in progress (active records **plus other current agreements**), an agreement made in the past
   week (let it settle), or is under 3. Existing agreements come before new skills.
4. **One new skill**, at most **two per meeting for the household**, children with the fewest active records first.

**Candidate filters** (a skill is never suggested when): the child has any record for it (active, paused,
dismissed, launched); the child already owns it (existing row or a `skill:` agreement); it needs adult supervision
and the child is below its typical starting age; the child is more than one year below its typical starting age;
it assumes facts the family didn't give (pets, a yard, a dishwasher, plants; school routines for a homeschool
family); its foundation skill is still in progress (e.g. *Fold* waits while *Sort* is active) **unless the family
said they want it for this child**: their judgment of what a capable child can take on wins over the default
sequence. Nothing in the database enforces a sequence, so a family can always start any skill.

**Ranking** (reasons shown to the family): the family said they want it for this child (+100) · builds on a
launched foundation (+25) · matches the household priority (+40, so it outranks a seasonal match) · matches a stated challenge (+10) · fits the
season (+20) · age fit, as guidance (+15, fading for skills well below the child's age) · a category the child
already owns (−20) · already offered to a sibling this meeting (−8). Score must be positive. Ties: library order.

**Seasons** (`seasonOf`): May 15–Jul 15 summer transition, Jul 16–Sep 15 school start, Dec 15–Jan 31 new year,
otherwise everyday. A season only reorders ideas; it never touches a record.

**MAWL coaching:** the check-in question changes by stage (Model/Assist → performance; Watch → consistency at the
cue; Launch → ownership). Coaching text is the library's own stage guidance. In Watch, a new circumstance
(`watchVariations`) is suggested occasionally: when it's holding at the usual cue, or every other Watch check-in.
After it has held up across at least two varied situations, the hint says Launch is the family's call; it never
proposes it as a default. Two "not yet" answers in a row suggest stepping back or a different cue, without changing
anything.

**Habits:** cue options come from the skill's authored cues plus one anchor from the family's priority ("After
brushing teeth in the morning"), and the family can type their own. No rewards, allowances, treats or screen time
anywhere in the engine or UI (tested). Performance, consistency and ownership are separate answers.

**Safe fallback:** if records can't be read (`records: null`), the plan has `unavailable: true`, no new suggestions
(a dismissed skill must never come back by accident) and the meeting hides the layer.

## 5. In the weekly Family Meeting (Club families only)

**Plan lifecycle** (`src/lib/family-development/meeting-plan.ts`, tested in `tests/family-development-lifecycle.test.ts`
and in the browser): a plan belongs to one signed-in adult, one household, Club access and one day (its key). Same
key: the same plan all meeting, so a decision never swaps the step on screen (live records show each result). New key
(sign-out, another account, another household, access lost, a new day): the old plan is dropped immediately (also
checked at render time), records loaded for an older key are ignored, and a new plan is built only from records loaded
for the new key. Club access is rechecked when the app resumes, the tab becomes visible, another tab signs in or out,
or a write is refused with `club_required`; a new account starts without Club until the database confirms it; a
network failure keeps the last confirmed answer for the same account. Free families: no records are loaded.

**Saving.** Each card does one request at a time; the tapped button reads "Saving…" and repeated taps do nothing. "Saved" ("Added to our plan…") appears only after the database answered, with the agreement it returned (which goes straight onto
the phone's lists through the existing agreement store). A failed save says "Not saved" and the same button retries
with the same ids. Buttons are disabled while a request is out; focus moves to the result message.

| Part | What a Club family sees (`src/components/family/DevelopmentCoach.tsx`) |
| --- | --- |
| Our Focus | Unchanged. |
| Let's Talk | "What we're working on": one stage-appropriate question per child with a due check-in (three answers), plus "We tried it on a different kind of day" in Watch. One tap saves a `check-in`. Then the existing follow-through (minus `skill:` agreements) and the month's questions. |
| Everyone's Part | "One next step each", one divided list (no nested cards). **Active responsibility:** name and age, the skill, a small stage indicator (Learning · Together · Practicing · Their responsibility; the full approved name in its title), one line of coaching, a Watch variation when due, then one primary button, **Keep practicing** (Launch: **Keep it as theirs**). Behind **Change how we're practicing**, only the moves valid for the stage: back one stage (**Show them again** / **Practice together again** / **Coach them again**, with "Back to “…”") and forward (**Next: …**; from Watch, **Hand over responsibility**, next to "Doing it on their own is progress…"). Quiet text actions: **Edit routine**, **Pause this responsibility**. After a saved Launch, and only then: "Great! This is now their responsibility. You can always step back and practice together again if needed." **Suggested skill:** "Suggested next skill", the title, one line of coaching, "When: {cue}", primary **Add to our plan** (record and agreement saved together), **Not now**, and **Customize** for the starting stage (default *I'll show them how*), cue choices and own words, finish line, safety, the reason, and **Don't suggest again**. Then **What we've already agreed (n)** and **Add another responsibility**, collapsed when there are next steps, open otherwise (free families see them as before). A child with a development step gets no month suggestion as well. |
| Let's Practice | Up to two "practice it now" lines for skills in Model/Assist or just agreed. Then the month's practice step as before. |

**Navigation.** The four parts are one compact segmented row (current part filled; "Step n of 4 · 10 minutes together" above). Back/Next stay just above the tab bar and the home-indicator safe area on phones and tablets (in the page flow on desktop, and while the keyboard is open), and never cover content.

MAWL in parents' words (owner decision 2026-11-20; one source: `src/lib/family-development/language.ts`; stored
values unchanged):

| Stage | Parents read |
| --- | --- |
| Model | I'll show them how |
| Assist | We'll do it together |
| Watch | They'll do it, I'll coach |
| Launch | Ready to take full responsibility |

The only way to Launch is the parent's **Hand over responsibility** (or choosing "Ready to take full responsibility"
when agreeing to something the child already owns). "On my own" in a check-in is progress, never a Launch.

Writes are online-only (like follow-through check-ins); errors are shown in place (`club_required`, `conflict` →
reloads the other adult's change, `offline`).

## 6. Onboarding stays light

No questionnaire. The engine reuses onboarding answers (desired growth items, existing responsibilities,
priority, challenges, household preferences) when they exist and says so when they don't ("A starting idea. Tell
us what you'd like {child} to grow into…"). It offers one or two skills per meeting, not an assessment of every
child, and the only extra question ("Where is {child} with this?") is asked only for a skill the family is
agreeing to right then, collapsed, with a sensible default. Every answer can be changed later (`modify`,
`step-back`, `resume`).

## 7. One canonical skill across every resource

Every future resource references the same `skill_id`:

- **Age-based guides and Responsibility Cards:** link each featured job/card to a skill id through the reviewed
  crosswalks in `skills.ts` (`CHORE_CHOICE_TO_SKILL`, `AGE_GUIDE_CARD_IMAGE_TO_SKILL`). Cards teach Model/Assist
  mechanics; the meeting coaches Watch and records Launch. Print artwork and text are not touched until a separate,
  reviewed card audit (RESOURCE_ALIGNMENT.md → Next implementation).
- **Free charts and tools:** keep their own data; when a chart row comes from `choreChoices`, its skill is
  `skillForChoreChoice(id)`. A chart row is never a development record; only a family decision creates one.
- **Seasonal kits (future, not enabled):** select skills with `skillsForContext({ season })` and read the family's
  records so a kit builds on what the child already launched instead of resetting it. No fulfillment change.
- **App features:** read `household_development` through the engine; never write stages outside
  `household_development_decide`.
- **Library changes:** append-only by id; bump `SKILLS_LIBRARY_VERSION`; never rename an id that records use. A
  record keeps its family-worded title, cue and finish line, so a copy edit in the library never rewrites a family's
  words.

The twelve monthly Club resources, their generators, print files, approvals, Responsibility Card artwork, age-guide
PDFs, billing and calendar sync are **unchanged** by this work (tested: the development modules import none of
them).

## 8. Rollout (prepared, not executed)

Production (read-only, 2026-11-20): 20261124, 20261127, 20261128 applied; **20261204 (follow-through) not applied**.
This migration depends only on what production has and was tested on production's exact migration set
(20261130, 20261202–04 left out): `family-development.sql` 94/94 plus the related suites. It needs 20261124, 20261127 and 20261128, which preflight checks.

1. Owner approval.
2. Fresh verified backup (`.github/db-backup-request`, `[db-backup]`), record its ID.
3. `supabase/rollout/family-development/preflight.sql` on production: every `ok = t`; save the snapshot rows.
4. Apply `20261207000000_family_development_records.sql` (one transaction).
5. `verify.sql`: 5/5 `ok = t`; snapshot half of `preflight.sql` again: identical.
6. Smoke test with the owner's Club account: open the weekly meeting, agree one skill, confirm it appears in Who does
   what, reload, pause it, confirm it leaves Who does what and isn't suggested again. Then a free account: no
   development guidance.
7. Record in `docs/ios/MIGRATION_DEPLOYMENT_PLAN.md`.

Rollback: `rollback.sql` (drops the two tables and four functions). Agreements made through it stay as ordinary
agreements on every list; the profile is untouched. Rehearsed locally on production's migration set: preflight
(8/8) → apply → verify (5/5) → snapshot identical (row counts and 10 function fingerprints) → an agreement made →
rollback (the agreement survives) → re-apply → verify (5/5).

## 9. Verification and what is still unverified

**Browser QA** (`scripts/e2e/family-development-qa.mjs`): a website build against the isolated test backend (real
database functions, real migration 20261207, no mocks). 93 checks at 393px, 430px and 1440px (re-run after the approved MAWL wording): signed out, free family,
Club family without and with records, two children, one step per child and no duplicate month suggestion, "We agreed"
saving record + agreement (one each, linked), a failed save (nothing claimed, nothing saved, retry), a lost answer +
retry (still one of each), return later (not suggested again), a Watch check-in (no automatic Launch), pause taking
the agreement off the list, a failed records load (meeting works without the layer), Club access lost and restored
without a reload, sign-out and another account in another tab, all four stages in the approved words, Hand over responsibility (a failed save shows no confirmation; a saved one shows the approved confirmation and keeps the agreement), ownership check-in and step back after Launch, the four parts with Next/Back, no horizontal
overflow, 44px targets, keyboard save with focus on the result, axe WCAG 2.1 AA: no violations. The existing family
end-to-end (`scripts/e2e/family-e2e.mjs`, web) passes too (108 checks), after updating it for #513's one-part-at-a-time
meeting.

Still not verified or connected:
- Migration not applied; the layer is invisible in production until it is.
- iOS simulator not run (this environment has no macOS). The app renders the same page; CI's simulator job or a Mac run
  is still needed.
- Screen reader tested only through axe and focus/role checks, not with VoiceOver.
- The app-wide `of-eyebrow` section label is 10.9px uppercase on every screen; not changed here.
- Month-suggestion agreements (`month:<example>` sources) aren't mapped to skills, so they can't be placed on the
  MAWL path yet.
- The age-guide card crosswalk is from illustration ids, not verified printed cards (unchanged from #514).
- Seasons assume a US school calendar by date; a family-chosen school start date would be better.
- A day change at midnight during an open meeting rebuilds the plan (rare; deliberate).
- Reassigning a skill's agreement to another person in Who does what (the existing edit) leaves the development
  record with the original child; the agreement stays live, so the meeting doesn't flag it. A future "move to …"
  decision could carry the record across.
- The iOS simulator family flow (`ios/App/AppUITests/AppLaunchTests.swift`) now agrees to Maya's development step
  ("Add to our plan: Maya", deterministic through the e2e seed's desired `put-away-laundry`). It runs only on CI push
  builds (macOS); it was replayed in Chromium against the app bundle here, not run in a simulator.
