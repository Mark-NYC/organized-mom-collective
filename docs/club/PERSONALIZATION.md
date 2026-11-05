# Family Meeting guide and personalization

The Club is a family responsibility system, not a name-insertion service: a few priorities, one age-fitting part per
person, one obstacle to work on, small actions, and progress remembered over time. January 2027 is the first
resource built this way.

## The January guide (live)

`/app/club/january` is the family's personalized **Our First Family Meeting** guide, on the shared Club plan shell
(sign-in, family loading, saved plans, Welcome Kit approval, fulfillment print view and printing all unchanged).

Two US Letter pages, in the Club's four established parts:

| Page | Part | Job | What it holds |
| --- | --- | --- | --- |
| 1 | Before we start | prepare | Three or four lines; who opens the meeting |
| 1 | 1 · Our Focus (2 min) | what matters | The opening line, then **one or two** things that matter most, from her priority and challenges (one per theme). Only with no answers: the month's purpose |
| 1 | 2 · Let's Talk (3 min) | discuss | Her week (her own named activity if any), one question per focus, how little ones join; **one** possible obstacle with one thing to try, or an open question if she named none |
| 2 | 3 · Everyone's Part (3 min) | decide | **One part per person**: what she said she wants that child to take on, in their stage's version, with a cue (when), a finish line and how much help to give. Something they already do is recognized, not added to. Under 3 joins in |
| 2 | 4 · Let's Practice (2 min) | do | Everyone tries the first step now |
| 2 | Before our next meeting | do | At most two to-dos, from the plan's own setups (a low hook, picture labels), else the month's defaults; the check-in question for next time |
| 2 | Our meeting rhythm | repeat | Same day each month (her choice), three habits |

Writing lines appear only where there's room (up to five people). Families of 6–7 and 8+ get fixed tighter layouts,
never smaller than 10px text; 12 people with long names fit on two pages.

**Make changes** (desktop rail, or any row on the phone): each child's stage (for an age not given or a child ahead or
behind), each person's part (her answers first, then the month's, or her own words), who leads each part, and the
meeting day. Names, ages and answers come from `/club/family`; changes there regenerate the guide.

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

Practical heuristics, not diagnoses. Every practice carries a **cue** stacked on something the child already does
("After dinner", "Coming in the door"), an optional **setup** that makes it easy (a hook at their height), a
**behavior** small enough for the stage, **support** that fades ("together the first week, then let them lead"), and a
**finish line** they can see. Obstacles are offered as "might be" with one adjustment tied to a principle (trigger,
environment, simplicity, ownership, consistency). No rewards by default; resistance is never read as laziness.

### Adding February (or any month)

1. Write `src/data/club/meeting-guides/2027-02.ts` as a `GuideMonthContent`: the four parts' lines, focus and obstacle
   maps for the ids that matter that month, practices by growth item and stage, stage defaults, to-dos and rhythm.
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
| B. This month's practices, focus, obstacle, to-dos | **The guide's plan** (new) | `club_resource_versions.state['omc:club:january-family-meeting:v1'].state.plan` (`FamilyPlan`) |
| C. Timely: schedules, seasons, progress | Not collected; by design | Future (below) |

Nothing new is asked at onboarding. Detailed schedules and seasons are deliberately not collected to get started.

### The plan record (`FamilyPlan`, src/lib/club/family-plan.ts)

Per person: `memberId`, `itemId` (growth item or the month's), `category`, `behavior`, `cue`, `setup`, `support`,
`finished`, `source` (desired / existing / month / custom), `status` (suggested / accepted), `progress` (practicing /
independent / improving / struggling / retired) and `since` (month). Per family: one or two `focus` items with their
source, the `obstacle` (challenge id, principle, adjustment), `todos`, meeting `rhythm`. It's written with her guide
from her first click or key press (approving counts) and on every change, so later months read records, not PDF text.

It lives in the month's saved resource for now: no migration was needed for January. When a second month reads it, or
check-ins start, it moves into `club_responsibilities` with the minimum additions below.

## Roadmap (not built)

1. **Persist practices as responsibilities** (when check-ins start). One additive migration on
   `club_responsibilities`: `behavior text`, `cue text`, `setup text`, `progress text check (progress in ('practicing',
   'independent','improving','struggling','retired'))`, `source_month date`, `last_checked_at timestamptz`, and
   `status = 'confirmed'` on approval (the table already has it). Plus `club_responsibility_checkins (id,
   responsibility_id, household_id, asked_on date, answer text, barrier text, created_at)` for history. RLS like the
   rest of the profile; written through one `security definer` RPC. Duplicate checks by member + item.
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
