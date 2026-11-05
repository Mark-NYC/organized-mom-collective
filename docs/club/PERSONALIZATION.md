# Family Meeting guide and personalization

The Club is a family responsibility system, not a name-insertion service: a few priorities, one age-fitting part per
person, one obstacle to work on, small actions, and progress remembered over time. January 2027 is the first
resource built this way.

## January: the Monthly Family Focus

Families get two things:

1. **The reusable framework**: the Welcome Kit's one-page Family Meeting guide (`src/data/club/meeting-guide.ts`,
   `/club/family-meeting-guide`). The four parts, every month. Unchanged.
2. **Our Family Focus**: `/app/club/january`, one personalized page the family brings to its Family Meeting. It is
   **not** organized under the four meeting parts; it reinforces the month's practical resource. Nothing on it is
   assigned.

One US Letter page when it fits at the normal type size; a second only when a family's content needs it.

| Section | What's on it |
| --- | --- |
| Family identity | Month and family name, "Our Family Focus", and every member's name beside their marker color |
| Our shared focus | One focus from her answers (January's Family Meeting habit when she gave too little), one encouraging line, and her answers behind it, once |
| Small habits worth trying | **One or two experiments** (never assignments): who (with their colors), her wish behind it, the action, when (confirmed by her answers, or "When, your pick:" options), an ownership move and a support. Groups for shared routines or a shared activity show each child's own version. At most two "already does" lines, then the grown-ups' question |
| Our Words of the Week | Four authored words, one per week, for the calendar's Word of the Week space (`focusPage.words` in the month's content). A fifth week can repeat one |
| Bring it to your Family Meeting | Talk about the focus · choose · celebrate · adjust · add it to the wall calendar |

**Grouping** (`src/lib/club/habits/recommend.ts`): individual experiments for smaller families; children who share a
named activity are grouped by the activity, whatever their ages; otherwise a shared routine from `theme.sharedFrom`
children (January: 3), or 4 when she named a wish inside the focus. Adaptations keep each child's ability level.

**Colors** (`src/data/club/family-colors.ts`): marker colors auto-assigned children first, saved by member id in
`preferences.colors` when she changes them on her family page, so they stay the same every month. Always shown with the
name (readable in grayscale). Saving a choice needs migration `20261120000000_club_household_colors.sql`; until it is
applied the site saves families without colors and they stay auto-assigned.

**Her review** (Make changes): each suggestion has **Keep it**, **Change it** (title, action, when) and **Skip it**.
Skipped ideas come off the printed page; her "when" counts as confirmed. Saved in the guide state
(`hidden`, `edits`, `kept`), included in the approval fingerprint. A kept suggestion is still not a commitment:
commitments are only created by `commit()` (`src/lib/club/family-plan.ts`).

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
2. **One focus.** Other well-supported opportunities stay in the rationale for a later meeting or month.
3. **One possible starting point per child** for that focus: her wish for that child, her unassigned wishes, then the
   focus's own steps at their age (unless the focus doesn't say which job, like fewer reminders: then the children are
   asked). A child who already handles the area is recognized and asked to show how. No line is printed twice.
4. **Let's Talk** brings the children in: the focus conversation, her obstacle as a possibility (or a question that
   explores it with options), and one question asking the children 6+ which starting point they'd try first.
5. **Let's Practice**: the family writes its own habit experiment; then one adjustment worth trying (her obstacle's,
   or the setup that makes a starting point easier when the page already applies the obstacle's principle) and one way
   to keep it going without adding work.
6. **Too little intake** (no priority, challenges or wishes): no manufactured personalization. The focus is starting
   the Family Meeting habit (a regular meeting stacked on a weekly routine), and the children are asked later.

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
