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
order, timing or personalization. The only change to the meeting page is an optional block in its side panel (below).

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

**After the meeting.** Today shows *Everyone's Part* for the month: exactly the month's meeting engine output
(`buildFamilyMeeting`) for each person, **without the suggestions**: what each person already does and what the family
agreed ("Agreed by our family", shown first). The cleaning companion (app) shows cleaning and laundry parts from the same
profile. Colors are the household's.

## What it never does

- Saves, assigns or confirms anything. The meeting's rule holds: suggestions stay suggestions and are never shown as
  agreed.
- Adds a step, timer, reminder or new weekly screen.
- Shows a sample family outside a labeled demo (`/app?demo=1` is labeled).

## Open decision for the owner

The meeting says *"Write it down where everyone can see it"* for Everyone's Part. Today the app can show agreed parts
only once they're `confirmed` in the profile, and there is **no way to confirm a part yet**: the browser can't write
`confirmed` (`club_responsibilities_save` accepts only existing/desired). Recording "we agreed" from the meeting page
would be a new action on that page, so it waits for approval. Without it, Everyone's Part shows what each person
already does.
