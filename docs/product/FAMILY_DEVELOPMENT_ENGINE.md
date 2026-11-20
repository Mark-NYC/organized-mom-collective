# Family development engine: skills library × development records × weekly meeting

**Status 2026-11-20: built on a branch, NOT live.** The code, tests and migration exist; the migration
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
| `title`, `cue`, `finish_line`, `note` | The family's words. Only a `modify` decision changes them. |
| `stage` | `model` · `assist` · `watch` · `launch`, always family-chosen. **Null** for a suggestion paused or dismissed before it was started: nothing is inferred. |
| `status` | `active` · `paused` · `launched` · `dismissed`. Launched ⇔ stage Launch (DB constraints). |
| `last_signal`, `last_value`, `last_check_in_on` | The last "how is it going?" answer: *performance* (can do the steps), *consistency* (happens at the cue without reminders) or *ownership* (still theirs), each strong · partial · not-yet. |
| `variations_practiced` | Times the family said they practiced on a different kind of day (Watch). Counted, never converted into a stage. |
| `library_version`, `revision` | Library version decided under; optimistic concurrency for two adults. |

`household_development_events`: append-only history of every decision (from/to stage and status, answer, note,
who, when). Families can read it; nobody can edit or delete it.

**Functions** (security definer, the household-function pattern used since 20261124):

- `household_development()`: every record with its last 12 events. Any adult of the household. **No Club check**:
  a family whose membership lapses keeps and sees its history.
- `household_development_decide(p, p_base)`: one decision. Requires a household **and** the household's Club access
  (`club_has_access(household_billing_user(uid))`) → `club_required` otherwise. Revisions → `conflict`; duplicates →
  `exists`; anything else malformed → `invalid`.

| Decision | Effect |
| --- | --- |
| `start` | New record at the stage the family chose (required). Choosing Launch records something the child already owns. |
| `pause` / `dismiss` | "Not now" / "Not for us", new or existing. Never suggested again until the family resumes it. |
| `resume` | Paused/dismissed → active (or launched). A never-started idea needs the family's stage. |
| `advance` | Exactly one stage up, from active only. Watch → Launch is the only way to Launch an existing record. |
| `step-back` | Exactly one stage down; a launched record becomes active Watch. |
| `stay`, `check-in` | No stage change; record the week's answer and date. |
| `modify` | Title, cue, finish line. |

**Authorization:** RLS on both tables (select for the household's adults only); no insert/update/delete grants;
writes only through the function, which resolves the household from `auth.uid()` (never from input), checks the
child belongs to it, is current and is a child. Tested in `supabase/tests/family-development.sql` (56 checks: free
vs Club, partner, other household, no household, anon, direct writes refused, history immutable, lapsed membership).

## 4. Recommendation engine (`src/lib/family-development/engine.ts`)

Pure, deterministic, no AI, no network, no clock (the meeting passes today's date). Same family + same day = same
plan. Every suggestion carries its reasons (`why`).

**Per child, at most one step**, in this order:

1. **Check-in that needs attention**: an active record whose last answer was *not yet* or *partly*.
2. **Due check-in**: active records weekly (6+ days), launched ones every 4 weeks. Never twice in a day.
3. **No new skill** when the child has a record in Model or Assist (that's where adult time goes) or two active
   records, or is under 3.
4. **One new skill**, at most **two per meeting for the household**, children with the fewest active records first.

**Candidate filters** (a skill is never suggested when): the child has any record for it (active, paused,
dismissed, launched); the child already owns it (existing row or a `skill:` agreement); it needs adult supervision
and the child is below its typical starting age; the child is more than one year below its typical starting age;
it assumes facts the family didn't give (pets, a yard, a dishwasher, plants; school routines for a homeschool
family); its foundation skill is still in progress (e.g. *Fold* waits while *Sort* is active).

**Ranking** (reasons shown to the family): the family said they want it for this child (+100) · builds on a
launched foundation (+25) · matches the household priority (+30) · matches a stated challenge (+10) · fits the
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

`WeeklyMeeting.tsx` builds the plan **once**, when the household, profile and records are first all loaded, so a
decision mid-meeting never swaps the step on screen. Free families: no records are loaded, nothing changes.

| Part | What a Club family sees (`src/components/family/DevelopmentCoach.tsx`) |
| --- | --- |
| Our Focus | Unchanged. |
| Let's Talk | "What we're working on": one stage-appropriate question per child with a due check-in (three answers), plus "We tried it on a different kind of day" in Watch. One tap saves a `check-in`. Then the existing follow-through (minus `skill:` agreements) and the month's questions. |
| Everyone's Part | "One next step each": for a check-in, the stage coaching, a Watch variation when due, the hint, and **Stay here · next stage (named in plain words, e.g. "It's theirs now") · Make it easier · Pause for now · Change the cue or finish line**. For a new skill: the reasons, cue choices, editable finish line, "Where is {child} with this?" (defaults to *We'll show them first*), and **We agreed · Not now · Not for us**. A child with a development step gets no month suggestion as well. |
| Let's Practice | Up to two "practice it now" lines for skills in Model/Assist or just agreed. Then the month's practice step as before. |

MAWL in parents' words: Showing how · Doing it together · Practicing, you nearby · Theirs now.

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
(20261130, 20261202–04 left out): household suite 56/56, plus the existing suites.

1. Owner approval.
2. Fresh verified backup (`.github/db-backup-request`, `[db-backup]`), record its ID.
3. `supabase/rollout/family-development/preflight.sql` on production: every `ok = t`; save the snapshot rows.
4. Apply `20261207000000_family_development_records.sql` (one transaction).
5. `verify.sql`: 5/5 `ok = t`; snapshot half of `preflight.sql` again: identical.
6. Smoke test with the owner's Club account: open the weekly meeting, agree one skill, reload, confirm it shows as a
   check-in next week (or change the date in a test account), pause one, confirm it isn't suggested again.
7. Record in `docs/ios/MIGRATION_DEPLOYMENT_PLAN.md`.

Rollback: `rollback.sql` (drops the two tables and three functions; agreements and the profile stay). Rehearsed
locally: preflight → apply → verify → snapshot identical → rollback → re-apply → verify.

## 9. Not yet connected or verified

- Migration not applied; the layer is invisible in production until it is.
- No rendered-browser QA of the new meeting UI yet (phone 393px and desktop), and no axe pass; unit and SQL tests
  only. Needs `scripts/club-qa.mjs`-style screenshots with a Club test account.
- The iPhone app gets the same component (it renders the same page) but hasn't been run in the simulator.
- `FollowThrough`'s existing "On my own → owns it now" wording predates MAWL and reads like Launch; for
  non-skill agreements it is unchanged. Worth an owner decision.
- Month-suggestion agreements (`month:<example>` sources) aren't mapped to skills, so they can't be placed on the
  MAWL path yet; a reviewed crosswalk from month example ids to skill ids is the next small step.
- The age-guide card crosswalk is from illustration ids, not verified printed cards (unchanged from #514).
- Seasons assume a US school calendar by date; a family-chosen school start date would be better.
