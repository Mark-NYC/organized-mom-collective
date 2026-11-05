# Family Meeting guide and personalization

The Club is a family responsibility system, not a name-insertion service: a few priorities, one age-fitting part per
person, one obstacle to work on, small actions, and progress remembered over time. January 2027 is the first
resource built this way.

## January: the Family Meeting Companion

Families get two things:

1. **The reusable framework**: the Welcome Kit's one-page Family Meeting guide (`src/data/club/meeting-guide.ts`,
   `/club/family-meeting-guide`). The four parts, every month. Unchanged.
2. **The January companion**: `/app/club/january`, a personalized **menu of ideas** under the same four parts, for
   whichever meetings the family holds in January. Not a completed meeting, not a weekly curriculum: they use what
   fits each time, come back to what matters and skip the rest. Nobody leads anything on it, nothing is assigned, and
   no decision is filled in.

Two US Letter pages (fixed, so printing and the mailed copy never vary):

| Part | What's on it | Limits |
| --- | --- | --- |
| 1 · Our Focus | One or two priorities from her priority and challenges (one per theme), each with what getting better could look like. Only with no answers: the month's purpose | 1, a second only with its own evidence |
| 2 · Let's Talk | Conversation starters: her week (her own named activity), one per focus, and what gets in the way (a possibility from her challenges, or an open question). How little ones join | ≤ 4 |
| 3 · Everyone's Part | Under each child's name, ideas to choose from (plain actions, no pronouns): what she said she'd like that child to take on, in their age's version, then the month's. How much help a first try needs. What a child already does is noticed, not suggested again. Under 3 joins in. For the grown-ups: a conversation about helping without taking over (no job); what a grown-up other than the account holder already does is noticed | 1 per child (2 to choose from, ages 6+, only when ownership is her obstacle); no line printed twice; every child 3+ appears (idea, recognition or a question) |
| 4 · Let's Practice | One thing worth trying (her obstacle's adjustment, or the setup that makes an idea easier) and one way to keep it going without adding work. A tip the page already applies is left out | ≤ 2 |
| Coming back to it | How to revisit a part at a later meeting (the seed of check-ins) | 1 line |

Families of 5–6 children and 7+ get fixed tighter layouts, never smaller than 10px text.

### Selection (how the companion decides what to print)

`src/lib/club/meeting-guide/generate.ts`, deterministic, tested against ten family situations and every
priority × challenge combination (`tests/club-meeting-guide-generator.test.ts`); quality report:
`docs/club/JANUARY_QUALITY.md` (`npx vite-node scripts/meeting-guide-quality.ts`).

1. **Score each opportunity** in the month's content (mornings, evenings, school, schedules, reminders, home, laundry,
   sharing) against what she reported:
   *relevance* (her top priority 3, each matching challenge 2, a wish she named for a child 2, an unassigned wish 1),
   *impact* (priority 2, challenge 1), *readiness* (children 3+ with a fitting step they don't already do, up to 2) and
   *habit potential* (1 for a cue-ready step or an adjustment for an obstacle she named). Only opportunities she gave
   evidence for count; ties go to her top priority.
2. **One focus.** A second only with 4+ points of its own evidence (answers the first didn't use) and three quarters
   of the first's score.
3. **One idea per child** for that focus: her wish for that child, her unassigned wishes, then the focus's own steps at
   their age (unless the focus doesn't say which job, like fewer reminders: then the children are asked). A child who
   already handles the area is recognized and asked to show how. Two ideas only when the obstacle she reported is about
   ownership, for children 6+, so they choose. No line is printed twice.
4. **Let's Talk** brings the children in: the focus conversation, her obstacle as a possibility (or a question that
   explores it with options), and one discovery question per idea naming the children 6+ it fits.
5. **Let's Practice**: one adjustment worth trying (her obstacle's, or the setup that makes an idea easier when the
   page already applies the obstacle's principle) and one way to keep it going without adding work.
6. **Too little intake**: no guesses. The children are asked, and January's own habit (a regular meeting stacked on a
   weekly routine) is offered.

**Make changes** (desktop rail, or any row on the phone): untick any idea to take it off the page, or plan for a
child's age differently (an age not given, a child ahead or behind). Names, ages and answers come from `/club/family`;
changes there regenerate the companion.

### Code

| What | Where |
| --- | --- |
| Age stages and their rules (who leads, who owns a part) | `src/lib/club/meeting-guide/stages.ts` |
| Monthly content contract | `src/lib/club/meeting-guide/types.ts` |
| January's content | `src/data/club/meeting-guides/2027-01.ts` (registry: `index.ts`) |
| Generator (pure, deterministic) | `src/lib/club/meeting-guide/generate.ts` |
| Saved choices + profile copy + plan | `src/lib/club/meeting-guide/state.ts` |
| Structured plan and check-in rules | `src/lib/club/family-plan.ts` |
| Printable, editor, controller | `src/components/club/MeetingGuidePrintable.astro`, `src/lib/club/meeting-guide/printable.ts` |
| Phone screen | `src/components/club/MeetingGuideMobile.astro` |
| Tests / samples / browser QA | `tests/club-meeting-guide-generator.test.ts`, `docs/club/samples/january-meeting-*.md` (`npx vite-node scripts/meeting-guide-samples.ts`), `scripts/meeting-guide-qa.mjs` |

### Habit principles in the content

Practical heuristics, not diagnoses. Every idea has a **cue** it could follow ("After dinner", "Coming in the door"),
often a **setup** that makes it easy (a hook at their height), a **behavior** small enough for the stage, and
**support** that fades ("together at first, then let them lead"). Obstacles are offered as "might be" with one
adjustment tied to a principle (trigger, environment, simplicity, ownership, consistency). No rewards by default;
resistance is never read as laziness.

### Adding February (or any month)

1. Write `src/data/club/meeting-guides/2027-02.ts` as a `GuideMonthContent`: the parts' goals, focus and obstacle maps
   for the ids that matter that month, practices by growth item and stage, stage defaults and the practice tips.
   Reuse January's practices where they fit; the month's own resource decides what's relevant.
2. Add it to `GUIDE_MONTHS` in `index.ts`.
3. If the month's page should show the guide, put `<MeetingGuidePrintable month="2027-02" />` and
   `<MeetingGuideMobile>` in its plan shell, as `src/pages/app/club/january.astro` does. Months with their own tool
   keep it and can show the guide beside it later.
4. Add fixtures/expectations to the tests, regenerate samples, run `scripts/meeting-guide-qa.mjs`.

No generator change is needed unless the month needs a new kind of rule.

## Family information: what exists and where

| Category | Today | Stored in |
| --- | --- | --- |
| **A. Durable**: members, names, ages, roles, household | Onboarding step 1 | `club_family_members`, `club_households` |
| A. Broad activities | Step 2 (category only required) | `club_activities` |
| A/B. Who already takes care of what | Step 3 | `club_responsibilities` `status='existing'` |
| B. What she'd like each child to take on | Step 4 | `club_responsibilities` `status='desired'` (`item`, `owner_ids` = for which child) |
| B. Family-wide challenges and first priority | Steps 5–6 | `club_households.challenges`, `.priority` (+ notes) |
| B. This month's focus, obstacle and the ideas offered per child | **The companion's plan** (new) | `club_resource_versions.state['omc:club:january-family-meeting:v1'].state.plan` (`FamilyPlan`) |
| C. Timely: schedules, seasons, progress | Not collected; by design | Future (below) |

Nothing new is asked at onboarding. Detailed schedules and seasons are deliberately not collected to get started.

### The plan record (src/lib/club/family-plan.ts)

Two kinds of record, kept apart in the types so one can't become the other by accident:

- **`SuggestedIdea`** (`status: 'suggested'`): what the Club offered. January saves every idea it offered per child
  (`memberId`, `itemId`, `category`, `behavior`, `cue`, `setup`, `support`, `source`, `offered` month), plus the
  family's one or two `focus` items and the `obstacle`. **A suggestion is not a commitment**: it has no progress, is
  never checked in on, and showing it, approving the printable for mailing or saving it never turns it into one.
- **`Commitment`** (`status: 'accepted'`): a responsibility the family chose, created only by `commit()` from the
  family's own choice (at a meeting, on the page, or at a check-in). Only commitments carry `progress` and
  `lastCheckedOn`, and `checkInDue` accepts only them. Nothing creates commitments yet.

The plan is written with her companion from her first click or key press (approving counts) and on every change, in
the month's saved resource (no migration for January). When check-ins start, commitments move into
`club_responsibilities` (below).

## Roadmap (not built)

1. **Persist practices as responsibilities** (when check-ins start). One additive migration on
   `club_responsibilities`: `behavior text`, `cue text`, `setup text`, `progress text check (progress in ('practicing',
   'independent','improving','struggling','retired'))`, `source_month date`, `last_checked_at timestamptz`, and
   `status = 'confirmed'` on approval (the table already has it). Plus `club_responsibility_checkins (id,
   responsibility_id, household_id, asked_on date, answer text, barrier text, created_at)` for history. RLS like the
   rest of the profile; written through one `security definer` RPC. Duplicate checks by member + item. Only a
   family's choice writes a row (a `Commitment`); suggested ideas stay in the month's saved resource.
2. **Progress check-ins.** One optional question on a month's page every 6–8 weeks (`checkInDue`): "How is Eli doing
   with …?" On his own / improving, still needs reminders / struggling / moved on; after "struggling", one optional
   likely-obstacle question. `nextStep` already encodes the response: celebrate without adding work, keep practicing,
   one adjustment for the named obstacle (`BARRIER_PRINCIPLE`), or retire it. The next month's generator reads
   `progress` to reinforce, simplify or replace a practice.
3. **Habit coaching improvements.** More stage versions per growth item; adjustments per check-in barrier; second part
   only for a child whose first is `independent`.
4. **Seasonal and monthly intelligence.** Each month's content answers: what's changing for this family, what each
   child can take on, what the family decides together, what resource helps them follow through. May (summer rhythm),
   June (make my own snack), July (I'm bored), August (back to school), September (Habit Cards) reuse the same profile,
   plan and check-ins with their own content; existing resource specs stay the source for each month.
5. **Smart Family Inbox and calendar import.** Forwarded school/sports emails and Google Calendar → extracted
   commitments in a review feed → approved events → the Sunday look-ahead and the paper calendar. It would feed
   category C (timely) by adding dated items to `club_activities` (or a sibling `club_events` table with `source`,
   `starts_at`, `status = suggested/approved`), which the generator already reads for its Let's Talk question.
   Nothing in the current structures needs to change for it.
6. **Optional AI phrasing** behind `GuideRefiner` (generate.ts): may only rephrase a generated guide, never add facts.
