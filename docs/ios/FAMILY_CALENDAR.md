# Family calendar

**Status (2026-11-14): built on `claude/focused-fermi-re9ddc`, tested; database migration not applied to production
(owner approval).** Free: no Family Meeting Club membership needed (owner decision, 2026-11-14). In the iPhone app's tab
bar (Today · Calendar · Cleaning · Club · Account). On the website the page exists at `/app/family-calendar` but isn't
linked until the owner decides.

## What it does

- One week at a time, like the printed 11×17 wall calendar: each day's plans, the people each one is for (their color
  from the one family profile), and who's handling it ("Luis handles it").
- Add and edit in a sheet: name, day, time or all day, repeats (every week on chosen days, every day, every month on the
  date, every year; optional end date), who it's for, who's handling it, notes. Delete one day of a repeat or all of it.
- New events start with a time (most family plans have one); All day is one tap.
- "Add our usual week from the family profile" turns the typical week entered during family setup (`club_activities`)
  into weekly events, once, so nobody types it twice.
- Works with no signal and with no account ("Saved on this phone"). Signed in with a household, it's shared by both
  grown-ups and syncs.
- `?demo=1` shows a made-up family, labeled "Demo · Not a real family", in its own storage, never synced.

## How it's built

| Piece | Where |
| --- | --- |
| Table and functions (not applied) | `supabase/migrations/20261125000000_family_calendar.sql` |
| Database tests (39 checks) | `supabase/tests/family-calendar.sql` via `scripts/test-household-sql.sh` (CI job `household-db`) |
| Repeats, dates, labels | `src/lib/calendar/recurrence.ts` (13 tests: DST, leap day, 31st, every-2-weeks pairs) |
| Offline-first sync rules | `src/lib/calendar/store.ts` (11 tests, incl. two phones against a fake server) |
| Browser/app glue | `src/lib/calendar/client.ts` (`omc:calendar:v1`, mirrored to native storage; never in `account_saves`) |
| Screen | `src/components/calendar/FamilyCalendar.tsx`, `src/pages/app/family-calendar.astro` |

**Time:** wall-clock local date + time + time zone, never UTC instants, so "4:15 on Mondays" stays 4:15 across DST.

**Sync safety:** event ids are made on the phone (a retried save can't duplicate); every save carries the revision it
started from and a stale one is refused (`conflict`), so one grown-up never silently overwrites the other: theirs is
kept, this phone's change is set aside and named on screen ("changed by the other grown-up first"). Deletes are
tombstones so the other phone hears about them. Pull uses a 5-minute overlap and merges by revision.

## Not in this milestone (prepared, not built)

- **Google Calendar** (read the calendars she picks, write only to a calendar the app creates): `source` values and the
  `calendar_connections` design are in `docs/ios/schema-draft.sql`; nothing implemented.
- **AI Family Inbox** (forwarded school and activity email → suggested events, approval required): designed in
  `docs/ios/OMC_APP_ROADMAP.md` §2.4; nothing implemented.
- Moving a single occurrence (only skip one or change all); push reminders.
