# How the app supports the Family Meeting

The family already has a weekly ritual: the Family Meeting Club's **Family Meeting**. The app adds no second one. There
is no Sunday Setup (removed 2026-11-15 on the owner's direction) and no other weekly review, checklist or step.

## Source of truth (unchanged; changes need the owner's approval)

| What | Where |
| --- | --- |
| The standard Welcome Kit guide: once a week, about ten minutes, four parts | `src/data/club/meeting-guide.ts`, `/club/family-meeting-guide`, `src/components/club/MeetingGuideSheet.astro` |
| The four parts | **Our Focus** (2 min) · **Let's Talk** (3) · **Everyone's Part** (3) · **Let's Practice** (2) |
| Each month's content and the personalization rules | `src/data/club/family-meeting.ts` |
| The prepared monthly meeting (pure engine, reads only) | `src/lib/club/family-meeting.ts`, view rules `src/lib/club/family-meeting-view.ts` |
| The personalized monthly meeting page | `src/components/club/plan/ClubFamilyMeeting.astro` (`/app/club/<month>?view=meeting`) |
| Family members and colors | the one household (`club_family_members`, `src/data/club/family-colors.ts`) |

The standard guide and the personalized monthly pages stay separate, as before. Nothing here changes their wording,
order, timing or personalization. The meeting page gains two optional, screen-only things: the week in its side panel and "We agreed" (below).

## What the calendar adds

All logic is in `src/lib/family-meeting-support.ts` (pure; `tests/family-meeting-support.test.ts`).

**Before the meeting.** Today shows *For your Family Meeting · next 7 days*: how many plans are on the family calendar
in the next seven days, what's **New** or **Changed** in the past week, and how many plans nobody has said they'll
handle yet (something to talk over, not a task). The family calendar marks the same plans New/Changed. "New/Changed" is
from when a plan was last saved (the server's time, or this phone's before it syncs). Nothing is invented: no
timestamp, no mark.

**During the meeting.** Beside the monthly meeting (side panel, screen only, hidden when printing), *This week on our
calendar* lists the next seven days in each person's color, with a link to the calendar. It's for reference during
Let's Talk if the family wants it. It isn't a section, a step or part of the printed guide. Only a signed-in member's
own household calendar; never on a sample.

**During the meeting: "We agreed".** In Everyone's Part on the monthly meeting page (screen only; never on the printed
guide), each suggestion has an optional **We agreed** button. Tapping it saves that part, in the meeting's own words,
for that person: a `confirmed` row in the household's `club_responsibilities`, by stable family-member id, with the
month and the suggestion it came from. The meeting then shows it as *Agreed by our family* (with **Undo**) instead of
suggesting it again. Nothing else on the page changes: the four parts, their order, timing and wording, and every
personalization rule. Signed-in families save to the household (either grown-up); labeled sample families save to the
browser tab only.

**After the meeting.** Only agreements are shown as agreed, never suggestions and never what the family already did
before (the profile's `existing` responsibilities):

| Where | What |
| --- | --- |
| Today | *Everyone's Part* for the month: the agreements the month's meeting shows, by person, in their colors |
| Calendar | *Everyone's part · agreed in our Family Meeting*, a collapsed panel above the week |
| Cleaning (app) | Cleaning and laundry agreements |
| Family → Family Responsibilities | Every agreement, with **Edit or reassign** (words, when, people) and **Remove**; below it, *Already doing* from the family profile (changed on the family page, as before) |

## Storage and access (migration `20261127000000_family_agreements.sql`, not applied)

- Uses the existing `club_responsibilities` table and its `confirmed` status (allowed since it was created; nothing
  could write it). Adds `agreed_text`, `agreed_finished`, `agreed_when`, `agreed_month`, `agreed_source`, `updated_by`;
  a check keeps them on confirmed rows only.
- `household_agreement_save(p)` agrees, edits or reassigns; `household_agreement_remove(id)` removes. Both grown-ups of
  the household (`household_id_for`), per-household lock, owners must be current members of that household, a repeat
  tap never duplicates, only confirmed rows can be edited or removed. No direct table writes (unchanged).
- `club_responsibilities_save` (the profile's existing/desired lists) never touches confirmed rows, so editing the
  family profile keeps every agreement, and agreements never touch the profile.
- `club_family_profile()` also returns the agreement fields.
- Tests: `supabase/tests/family-agreements.sql` (28 checks), plus every existing Club, accounts, household and calendar
  suite with the migration applied.

## The meeting's week, now and later

`meetingWindow(today, meetingDay)` in `src/lib/family-meeting-support.ts`: rolling seven days from today for now. Given
the household's Family Meeting day (0 = Sunday … 6) it returns the week from the next meeting day, so the week before
the meeting is the one the meeting plans. Nothing sets a meeting day yet; when the owner wants it, it's one household
preference and a picker, with no change to the calendar or Today logic.

## What it never does

- Treats a suggestion as a commitment. Only a tap on "We agreed" makes an agreement.
- Adds a step, timer, reminder or new weekly screen.
- Shows a sample family outside a labeled demo (`/app?demo=1` is labeled).
