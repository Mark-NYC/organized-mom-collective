# Monthly Family Meeting engine

A prepared 10-minute meeting that introduces each month's Club resource. We prepare the plan; the family reviews it, agrees on responsibilities and practices together. It never replaces January's ongoing Weekly Family Meeting (January's monthly meeting introduces it).

## On the page

Every Club month page (`/app/club/<month>`) has a **Monthly Tool / Family Meeting** switch at the top; the tool stays the default. `?view=meeting` opens the meeting directly (`routes.clubMeeting(month)`; the Club library links each month's meeting). November's tool isn't on the plan shell, so `/app/club/november` is the meeting alone, with "Monthly Tool" linking to the worksheet generator (previews) or her own `/club/resources/<slug>` (members).

| Where | What |
| --- | --- |
| `src/components/club/plan/ClubFamilyMeeting.astro` | The switch, the meeting (desktop: October's rail beside the guide; below 1100px: one column with a sticky bar of the four sections) and the one-page print. Rendered by `ClubPlanShell` for every month, so no month has its own meeting code |
| `src/lib/club/plan/meeting.ts` | Switching views (`data-plan-view="tool" \| "meeting"` on `.club-plan`) and drawing the guide from the family the page loaded |
| `src/lib/club/family-meeting-view.ts` | Labels (Already doing / Suggested for us / Agreed by our family), reading order, and the print shortening rules |
| `src/lib/club/kit-household.ts` | Now also loads the family profile (onboarding steps 2–6) beside the household; `null` if she hasn't answered or it can't load |
| `src/data/club/samples.ts` | The Rivera and Chen samples carry made-up profile answers, so previews show a personalized meeting |

Switching only hides and shows: the month's editor, its saved plan, approval and editing deadline are untouched (checked by `scripts/club-meeting-qa.mjs`).

**Print.** One portrait US Letter page (`ClubPrintStyles`: in meeting view only `[data-meeting-sheet]` prints, on its own `@page fm-guide`, even beside March's landscape charts). Long content is shortened by fixed rules in `family-meeting-view.ts` instead of shrinking type (smallest printed text 6.4pt labels, 7.8pt notes, 8.6pt+ body): fewer items per person as the family grows, "finished" lines once per distinct suggestion, three columns from seven people, and a few repeat lines dropped. It isn't part of the mailed kit or the fulfillment PDF.

**Audio.** `MeetingMonth.audio` (`src` in `public/`, `minutes`) shows Megan's introduction with a plain `<audio controls preload="none">` in the rail. None is set; no player shows until a real recording exists. Never autoplays.

**Agreement.** Read-only in this release: suggestions are labeled and explained, never saved or confirmed. Accepting a suggestion later means writing a `confirmed` row to `club_responsibilities` (PR #264's table); the browser can't write that status yet (`club_responsibilities_save` accepts only `existing` and `desired`), so it needs a small migration plus duplicate checks. Families change who does what on `/club/family` meanwhile.

**QA.** `PUBLIC_CLUB_ENABLED=true npx astro build && npx astro preview --port 4330`, then `node scripts/club-meeting-qa.mjs http://localhost:4330 --shots=<dir>`: all 12 months, five sample families, a twelve-person family with long names, desktop and mobile, switching, print size and page counts.

| Where | What |
| --- | --- |
| `src/data/club/family-meeting.ts` | One small content definition per month: theme, challenge, principle, why it matters (by priority and challenge), the profile areas that belong to the month, three question templates, age-banded examples with what finished looks like, a two-minute practice, and fallbacks |
| `src/lib/club/family-meeting.ts` | `buildFamilyMeeting({ household, profile, month, resource? })` → `FamilyMeeting`. Pure and deterministic; reads, never saves |
| `tests/club-family-meeting.test.ts` | Rules below, all 12 months, sample snapshots |

## Sections

1. **Our Focus (2 min):** the month's challenge and principle. "Why" comes from her first priority, then her challenges, then a growth area, else a generic line.
2. **Let's Talk (3 min):** three questions. Q1 uses her own activity (name, days) if one belongs to the month, else generic. Q2 is about the tool, for the youngest child's age (under 7 or older), or for grown-ups if there are no children. Q3 uses a growth area she picked, else a job someone already owns, else generic.
3. **Everyone's Part (3 min):** per person, `existing` (owns or helps, from `club_responsibilities` status `existing`), `confirmed` (status `confirmed` only) and `suggested` (the month's resource assignments passed in, or one age-fitting example). Each recommendation has the member id, description, status, when (only if known), what finished looks like, connection to the resource, and a `source`/`sourceId` so the family can accept or adjust it later.
4. **Let's Practice (2 min):** one concrete activity with the month's tool, led by the youngest child who's 3 or older.

## Rules (tested)

- Only the family's own details. Activity names, days and people come from the profile; otherwise the question is generic. No invented interests, activities, pets or jobs.
- Grown-ups get no "when". Children's cues come from the month or from the days of their own activity (school days only for the children she put in school).
- Age bands for every child example; under 3 joins in with no job; cooking steps 12+, own laundry load 9+, stove and knives grown-ups only (matching the April and February resources).
- No "Mom", "Dad" or "parents". One grown-up, a grandparent or two partners all read right.
- The account holder doesn't lead when anyone else can (rotates among other grown-ups and children 9+), and never gets an organizer or reminder job.
- At most one new suggestion per person, and none for someone who already owns this month's kind of job.
- Suggestions are never confirmed. The engine doesn't change the profile or write anything.

## Themes (verified against the current resources)

The app pages (`src/pages/app/club/<month>.astro`) are the source: January Weekly Meeting, February Laundry Guides, March Chore Charts, April Dinner Team, May Summer Day Rhythm, June Snack Station, July Activity Board, August School Day Routines, September Habit Cards, October 5-Minute Reset, November Ownership Plan, December Christmas Mission. `src/data/club/resources.ts` still lists January as Habit Cards and February/March by older titles; it wasn't changed here.

## Later

- Accepting a suggestion would write `club_responsibilities` with status `confirmed` (PR #264's table already supports `suggested` and `confirmed`, `confirmed_at`). No schema change is needed for the engine.
- Adapters from each month's engine state to `resource` assignments (e.g. April roles, March chart jobs), so Everyone's Part can quote the month's own prepared jobs.
- Confirming suggestions (see Agreement).
- `src/data/club/resources.ts` (member resource pages, fulfillment) still uses the earlier January, February, March and September printables; see its header.
