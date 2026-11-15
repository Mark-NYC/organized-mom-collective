# Sunday Setup

**Status (2026-11-15): built on `claude/focused-fermi-re9ddc`, tested; database migration not applied to production
(owner approval).** Free, no Family Meeting Club membership (owner decision, 2026-11-14). Supports the printed 11×17 wall
calendar; it is not a second calendar product.

## The review (about 10 minutes, ideally together)

| Step | Reads (nothing typed twice) | Asks only |
| --- | --- | --- |
| 1. What's happening | The family calendar's week; events nobody is handling come first | "Who's handling it?" (one tap; saved to the shared calendar) |
| 2. Who does what | The family profile's responsibilities (`club_responsibilities`), by person, in their color | Nothing (link to edit once) |
| 3. Dinners | — | Each night's meal and who cooks (blank is fine) |
| 4. Cleaning | The cleaning companion's zone for each day (`src/data/cleaning.ts`, the printed calendar's row names) | Who helps with each day's zone |
| 5. This month's family plan | Club members only: this month's plan (no sales step for anyone else) | Nothing |
| 6. Copy it to the wall calendar | Everything above, one block per day, each line in the right person's color | An optional note; "We're set for the week"; optional one-page print |

Rules followed: the summary is for copying onto the existing wall calendar with each person's pen; the printable is one
plain Letter page; no calendar grid is generated.

## How it's built

| Piece | Where |
| --- | --- |
| Table and functions (not applied) | `supabase/migrations/20261126000000_sunday_setup.sql`: one plan per household per week (dinners, cleaning helpers, note, done); revision-checked saves |
| Database tests (17 checks) | `supabase/tests/sunday-setup.sql` (both adults, stale save, a second "first save", validation, other household's people, isolation, anon) |
| Summary logic (pure) | `src/lib/sunday-setup/summary.ts` (4 tests: planning week, zone names, the day blocks with whose pen, unhandled events) |
| Saving and sync | `src/lib/sunday-setup/client.ts` (`omc:sunday-setup:v1`, mirrored to native storage; pushed with its revision; the other grown-up's earlier save wins and she's told) |
| Screen | `src/components/sunday-setup/SundaySetup.tsx`, `/app/sunday-setup`; from Today ("Sunday Setup" card) and the calendar |
| Demo | `/app/sunday-setup?demo=1`: the made-up family, labeled, never synced |
