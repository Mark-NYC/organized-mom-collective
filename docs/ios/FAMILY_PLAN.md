# The curated family plan

**One weekly family meeting helps everyone identify what matters, take responsibility, and follow through together.**

The rhythm is: look ahead, identify priorities, agree on responsibilities, follow through, then celebrate and adjust.
The Family Meeting is where the family decides. Today is where those decisions become visible and actionable. This
builds on the two-tab redesign ([TWO_TAB_REDESIGN.md](TWO_TAB_REDESIGN.md)) and keeps its visual system.

## Technical assessment

1. **What already supports this.**
   - The **Family Meeting** (four approved parts) and its week-ahead view.
     - It looks at the family's own events plus only the calendars an adult **shared with the household**, never private ones.
   - **Agreements** (`club_responsibilities`): standing parts each person owns, with "when".
   - **Event responsibilities** (`calendar_event_tasks`, 20261211): one-off "who does what" for an imported event, with a done state, shared by both adults. These are staged behind a tester flag.
   - **Family focus**: `profile.priority`, chosen in a meeting.
   - **The development engine**: quiet next steps; MAWL stays invisible.
   - **Households**: `household_adults` (one or two adults, equal); children are members without accounts.
2. **What was missing.** Nothing could hold a *deliberate choice* of "this matters this week":
   - the profile has a single focus;
   - calendar events have no highlight flag (and imported events are rewritten on every refresh);
   - agreements are standing parts that belong to a person.

   **Smallest safe addition:** one household-scoped table, `household_priorities` (migration **20261212**, not applied). Each row is a highlighted event (a *link*: the family's event + date, or an imported UID + occurrence) or a few words, by week. No other table or schema changes.
3. **Both adults collaborate** through the same records, with no admin role:
   - either adult can highlight, add, remove, and agree on parts;
   - both see one plan on Today;
   - "highlight the same event" finds the existing priority instead of duplicating it;
   - a single parent has the identical experience;
   - children take part in the meeting itself and own their parts without accounts.
4. **Changes:**
   - **Today:** Focus, then **Our priorities this week**, then **Everyone's part today** (short), then the tools.
   - **Family Meeting:** look ahead and highlight in Our Focus; optional getting-ready in Everyone's Part; "We have a plan." at the end.
5. **Unchanged:** these work exactly as before:
   - navigation;
   - the four parts and their content;
   - the calendar and its integrations (the refresher, privacy, sync);
   - cleaning;
   - agreements and the development engine;
   - the Club and its entitlements;
   - billing and permissions.

## Today

1. **Our family focus.** As before: the family's own focus, or this month's topic labeled as prepared (never as agreed).
2. **Our priorities this week** (`OurPriorities`). Up to **three** the family chose (both adults' choices together).
   - **Each item:** its date and time *as the event is now*, and, for imported events with responsibilities, "2 of 3 ready".
   - **A cancelled or deleted event** says "No longer on the calendar"; it never goes stale silently.
   - **If no meeting this week:** the last meeting's priorities show for up to two weeks, labeled "From your last meeting". After that, a plain invitation. No guilt, no backlog.
   - **Before a first meeting:** "In your first Family Meeting, choose up to three…"
3. **Everyone's part today.**
   - Today's trackable responsibilities come first, with check circles.
   - Then **one standing part per person**: the one most recently agreed, with its "when". It has no check circle, because agreements have no done state.
   - About six rows in all; **All of everyone's parts (N)** opens the full list.
4. **Plans · Cleaning · Resources**, then **Next Family Meeting** (unchanged).

## The Family Meeting, still four parts and about ten minutes

| Part | What it does now |
| --- | --- |
| **Our Focus** | Look ahead: "Coming up this week" (the first five, the rest one tap away), each with **Highlight**. Plus "Something else that matters this week" in a few words. Up to three. Nothing is pre-chosen |
| **Let's Talk** | Unchanged: celebrate what went well, this month's questions |
| **Everyone's Part** | **Getting ready for our priorities** (optional, collapsed). For an imported event, the existing event responsibilities (Dad prepares the car, Andrew packs his clothes). For the family's own event, who handles it. Then the development conversation and agreements as before |
| **Let's Practice** | Unchanged |
| **Finish** | **"We have a plan."**: this week's priorities with their getting-ready parts, what was agreed in this meeting, and a link to everyone's parts. **Print our plan** and **See it on Today**. No badges, scores, streaks or confetti |

## Privacy and links

- An imported event can be highlighted only from a calendar **shared with the household**; the database refuses private ones.
- If its calendar is later made private, the priority leaves the other adult's plan; the adult who chose it still sees it.
- A priority is a link to its event. Today and the meeting show the event as it is now: moved, renamed, or "no longer on the calendar". The stored title is only a fallback.

## Final rules (QA pass, 2026-11-23)

**How many priorities.**
- **Three is the normal number. A busy week can hold up to five, never more.**
- The meeting shows nothing extra up to two, then "Three is usually plenty. A busy week can hold up to five." at three or four.
- At five it says "That's 5, the most for one week. Remove one to choose another."
  - Highlight then appears only on the chosen ones (to remove), and Add goes away. No greyed-out buttons.
- If a stale screen tries a sixth, it's refused in words. The database enforces five, under a per-household lock.
- Today shows the top three, then **Show 2 more** in place. "We have a plan." shows them all.
- `priorityRule()` in `MeetingPlan.tsx`; tested in `tests/family-plan.test.ts` and the two-adult e2e.

**Looking ahead without scrolling dozens.**
- Our Focus lists each event **once**: a daily school run is one line, "and 4 more days".
- It shows the first six, with the rest one tap away. It starts with a prompt to read it out loud and ask everyone.

**Collaboration** (confirmed in `scripts/e2e/family-plan-e2e.mjs`, two phones):
- Both adults highlight the same event at the same moment: one priority.
- Both add at the same moment: both kept.
- One removes the other's: gone for both. The other's stale screen removing it too: no error.
- A stale screen adding past five: refused in words.
- A single adult, and a household whose second adult was invited and never joined, get the full experience.
- A partner who was offline sees the current plan when back.
- There's no approval step and no partner permissions: any adult of the household can do anything.

**Privacy and the device** (confirmed in the same e2e and in `tests/family-plan.test.ts`):
- **Moved or renamed at the source:** Today shows the new day; a priority is a link.
- **Cancelled or deleted at the source:** the adult who chose it sees "No longer on the calendar". The other adult sees nothing, never a stale title.
- **Calendar made private, or sharing revoked:** it leaves the other adult's Today, meeting and "We have a plan." (what they would print). That includes an adult who was offline when it changed: back online, it's gone from the screen **and from the device's storage**.
- **Sign-out:** the household's priorities, event responsibilities and imported calendar events are removed from the device (`HOUSEHOLD_CACHES` in `src/lib/account.ts`). Another family signing in on the same device sees nothing of them. Every cache is also keyed to its household.
- **An adult who leaves or changes households:** the database answers for their current household only, so they see nothing of the old one.
- **Remaining, by design:** a device that is **offline** keeps showing what it last loaded, legitimately, until it reconnects. This is the same as the calendar's existing offline copy.

**Today.**
- Order: Focus → Our priorities this week → Everyone's part today → Plans · Cleaning · Resources → Next Family Meeting.
- Everyone's part today shows today's checkable items, then one standing part per person, **children first**, about six rows. "All of everyone's parts (N)" opens the full list.
- A family of eight with 24 agreements still gets six rows.

**"We have a plan."** Each priority once, with its getting-ready parts under it (who, what). Then **What we agreed today** (children first), or one honest line if nothing new was agreed. Print our plan. (Refined below.)

## Pre-pilot refinements (2026-11-23)

**Choosing what matters, on purpose.**
- Our Focus asks **"What matters most this week?"** and then: "Look ahead together. Is there anything we need to prepare for, decide about, or handle as a family?"
- The calendar list shows **one-off** events first.
- Events that repeat during the week (school, preschool, practice) sit under **"Our usual week (N)"**, one tap away. They are grouped, never ranked, and still highlightable. Nothing is chosen for the family.
- A priority can still be written in a few words. Three is normal; up to five.

**"We have a plan." is a summary of this meeting.**
- This week's priorities, three prominently (a busy week's fourth and fifth go on one "Also this week" line). Getting-ready parts sit under their event.
- **What we agreed today:** only responsibilities agreed in this meeting.
- If nothing new was agreed, one line: "Nothing new this week. Everyone keeps the parts they already have." Nothing is invented.
- Then **All of everyone's parts (N)**, a link; the standing list is not repeated on screen.
- **Print our plan** adds everyone's standing parts as a compact list, so the paper copy is the whole plan on about one page. **See it on Today** is kept.

**A first shared win, not a calendar.**
- After household setup, Today shows only **"Start with one thing your family can share."**
  - Who will own it: person chips, children first.
  - What: their words, or up to four age-fit ideas from the existing chore list.
  - **We agreed** saves an ordinary agreement (the same as the meeting's).
- Getting started is now: household → one shared thing → first Family Meeting → the other grown-up (optional, "Skip for now").
- The calendar is no longer a step. It's offered in the meeting when the week is empty, and from the Plans shortcut.
- No calendar, invitation, Club or full meeting is required first.

**Large households.**
- Everyone's part today puts people with the same latest part (same words, same "when") on one row: overlapping initials and "Amara, Cleo and 2 more".
- Six children who each pack their bag are two lines, not six. Still about six rows, with "All of everyone's parts (N)". No completion is invented.

**A focused meeting.**
- While the guided four-step meeting is open, the app's tabs (bottom bar on phones, header tabs on wide screens) are hidden.
- **Exit meeting** stays at the top. Back/Next sit at the bottom, above the home indicator (`env(safe-area-inset-bottom)`).
- With a field focused (keyboard up), Back/Next return to the page flow so they never cover the field.
- Progress is saved at every step, so Exit and Continue pick up the same part.
- The landing, "We have a plan." and every other screen keep the tabs.
- Same CSS on the website, the installed PWA and the iPhone app's web view (`html[data-meeting-active]` in `global.css`).

## Stress tests (simulated households, not research)

These come from the earlier synthetic household simulation. They were used as design stress tests, not as evidence.

| Situation | What happens |
| --- | --- |
| Lives in another calendar | It stays the source; the family only *highlights* what matters. Nothing is written back |
| Second adult doesn't use the app | One adult is a whole household. Nothing waits on the other |
| Single parent | The same plan, the same meeting |
| Kids without phones | They answer in the meeting and own parts by name and color; Today and the printed plan show who does what |
| Different ages, teenagers | Parts are per person. Development suggestions are age-fit (unchanged). A teenager's part is theirs to own |
| Busy, unpredictable weeks | Priorities link to events, so moves and cancellations show. Three at most |
| Missed meetings | The last meeting's priorities show, labeled. Then a plain invitation. Nothing is counted |
| Prefers paper | "Print our plan" at the end of the meeting |
| Many existing responsibilities | Today shows one per person; the full list is one tap away |

## Rollout

1. Merge and deploy. Until **20261212** is applied, priorities don't show (every call fails and the section hides itself). Everything else works as in the two-tab redesign.
2. Apply 20261212 by itself:
   1. Run the backup workflow and confirm the backup is VERIFIED.
   2. Run `supabase/rollout/priorities/preflight.sql`.
   3. Apply the migration.
   4. Run `verify.sql`.
   - Priorities are free and not behind a flag (no billing).
   - Getting ready for imported events uses event responsibilities, which stay behind their own tester flag (EVENT_RESPONSIBILITIES.md).
3. Rollback: `supabase/rollout/priorities/rollback.sql` removes only the priorities.

## Code and tests

| What | Where |
| --- | --- |
| Migration, rollout | `supabase/migrations/20261212000000_household_priorities.sql`, `supabase/rollout/priorities/` |
| App data | `src/lib/app/priorities.ts` (`usePriorities`, `resolve`, `currentPriorities`, `weekOf`). Week items now carry `ref` (`src/lib/family-meeting-support.ts`) |
| Meeting | `src/components/ourweek/MeetingPlan.tsx` (`WeekReview`, `GettingReady`, `PlanSummary`), wired in `WeeklyMeeting.tsx` |
| Today | `OurPriorities` and the shorter `Responsibilities` in `src/components/app/TodayDashboard.tsx` |
| Tests | `supabase/tests/household-priorities.sql` (24 checks, also on production's set); `tests/family-plan.test.ts`; `scripts/e2e/family-plan-e2e.mjs` (two adults, CI family-e2e) |
