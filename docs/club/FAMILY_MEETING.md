# Monthly Family Meeting engine

A prepared 10-minute meeting that introduces each month's Club resource. We prepare the plan; the family reviews it, agrees on responsibilities and practices together. This is the engine only: no page yet. It never replaces January's ongoing Weekly Family Meeting (January's monthly meeting introduces it).

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
- Adapters from each month's engine state to `resource` assignments (e.g. April roles, March chart jobs) belong with the meeting page.
