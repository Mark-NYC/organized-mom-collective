# Connected calendars (Google Calendar and calendar links)

**Status (2026-11-18): built and tested on `claude/cool-fermat-z5612m`. Not live.** The migration is not applied, the
`calendar-connect` Edge Function is not deployed, no Google OAuth client exists, and the scheduled sync is not set up.
Each needs the owner's approval (Rollout, below). Free, like the family calendar; no Club membership, billing, mailer
or subscription code is touched.

Goal: families bring the calendars they already keep (Google, school, sports teams) into Organized Family instead of
retyping them, see them beside the events they make here, and plan the week with all of it in the Family Meeting.

## What a parent can do

- **Connect Google Calendar** (read-only). Her main calendar shows right away; she turns on any others in Calendars.
- **Add a calendar link**: school, league, TeamSnap/GameChanger, Outlook or iCloud "share a link", or Google's secret
  address; anything that gives an `.ics` / `webcal://` link. Checked for updates every two hours.
- **Choose per calendar**: show it or not; **Only me** (default) or **Our family**; and **whose calendar it is**
  (Sofia's soccer → Sofia's color). Each adult connects and controls only their own.
- **See it all in one place**: week, month and agenda views, Today, and the Family Meeting's "This week on our
  calendar", with the family's own events. Connected events have a striped color bar and their calendar's name
  ("Google · Ana", "Lincoln Elementary · view only").
- **Open an imported event** to see when, where, which calendar, and **Open in Google Calendar**. Imported events can't
  be edited or deleted here in this phase; they change where they came from. Family-owned events keep working exactly
  as before (create, edit, delete, repeats, offline, conflicts).
- **Reconnect** when Google stops sharing (password change, access removed); **Remove** a connection (Google access is
  revoked too; its copied events disappear; family events untouched).

## Who sees what (enforced in the database)

| | Her own calendars | The other adult's **shared** calendars | The other adult's **private** calendars | Another household |
| --- | --- | --- | --- | --- |
| Events | everything | everything, except events marked private there → **"Busy"** (no title, place or notes) | nothing | nothing |
| "Open in Google" link | yes | no | — | — |
| Settings, status, connection | yes | name only | nothing | nothing |
| Refresh token / feed link | never (server only) | never | never | never |

Sharing is worked out on every read from `household_adults`, so an adult who leaves the household stops sharing at
once. Tested in `supabase/tests/calendar-connections.sql`.

## How it's built

| Piece | Where |
| --- | --- |
| Tables, RLS, functions (not applied) | `supabase/migrations/20261205000000_calendar_connections.sql` |
| Edge Function (OAuth, feeds, sync) | `supabase/functions/calendar-connect/index.ts` → `_shared/handlers/calendar.ts` |
| Parsing and safety (pure, shared) | `supabase/functions/_shared/calendar/`: `ics.ts` + `rrule.ts` (feeds), `google.ts`, `tz.ts`, `feed-url.ts` (SSRF), `fetch-feed.ts`, `secrets.ts` (AES-GCM, PKCE) |
| Browser/app glue | `src/lib/calendar/connected.ts` (`omc:calendar-connected:v1`, the signed-in adult's copy only) merged into `useCalendar().all` (`src/lib/calendar/client.ts`) |
| Screens | `src/components/calendar/ConnectedCalendars.tsx` (Calendars sheet, read-only event sheet), `FamilyCalendar.tsx`; `/app/calendar-connected` (where Google returns inside the app's Safari sheet) |
| Family Meeting | `weekAhead()` in `src/lib/family-meeting-support.ts` takes the merged list: free meeting (`WeeklyMeeting.tsx`), Today, Club Home tiles and the Club month meeting page (`src/lib/club/plan/meeting.ts`, display only). One calendar for everyone; nothing separate for Club members |
| Rollout SQL | `supabase/rollout/calendar-integration/`: `preflight.sql`, `verify.sql`, `schedule.sql`, `rollback.sql` |

**Imported events are a separate, read-only copy** (`calendar_imported_events`), never rows in `calendar_events`, so no
sync can change or delete a family-owned event, and the family calendar's offline outbox never sees them.

**Google**: authorization code + PKCE, server-side. Scopes `calendar.calendarlist.readonly`,
`calendar.events.readonly`, `openid email`; never write scopes. `access_type=offline`; the refresh token is sealed
(AES-256-GCM, `CALENDAR_TOKEN_KEY`, bound to the connection id) before it reaches the database, in a table no signed-in
user can read. OAuth state is random, server-stored, single-use, 10 minutes. Events are read with `singleEvents=true`,
so Google expands repeats, moved and cancelled occurrences in the calendar's own zone; each occurrence has a stable id.
In the iPhone app the consent page opens in an in-app Safari sheet (Google refuses web-view sign-in) and returns to
`/app/calendar-connected`; the calendar refreshes when the sheet closes.

**Links (.ics)**: `webcal://` → `https://`; refused if not http(s), with credentials, odd ports, or pointing at a
private network (literal IPs, `.local`, DNS answers, and every redirect hop checked); 15 s timeout, 5 MB cap; ETag /
Last-Modified so unchanged feeds cost a 304. The link is sealed like a token (feed links are often secret); the
household sees only the host. Parser handles folding/escapes, TZID (IANA, Outlook Windows names, mozilla prefixes),
UTC and floating times, all-day spans, DURATION, RRULE (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY with
ordinals, BYMONTHDAY incl. negative, BYMONTH, BYSETPOS, WKST), EXDATE, RDATE, RECURRENCE-ID overrides, STATUS:CANCELLED,
duplicate UIDs (SEQUENCE), CLASS:PRIVATE. Not expanded (first occurrence kept): HOURLY/MINUTELY, BYWEEKNO, BYYEARDAY,
BYHOUR. Custom VTIMEZONE blocks with non-standard names fall back to the calendar's X-WR-TIMEZONE, then the family's zone.

**Time zones**: imported timed events are stored as instants and shown on the device's clock (her family's zone);
all-day events keep their dates. Family-owned events stay wall-clock as before.

**Sync**: window 30 days back to 6 months ahead. Google every 30 minutes, links every 2 hours, plus on connect and
"refresh" (at most every 2 minutes per calendar); failures back off 15 min → 12 h. Each sync upserts by occurrence and
removes only that calendar's events in the window it fetched. **Safety**: a sync that would remove more than half of a
calendar with 10+ events is held once and marked; only a second sync in a row that agrees removes them. Rows claimed
with `skip locked` so overlapping runs never double up. Expired/revoked Google grant → connection `reauth`, events kept
and labeled possibly out of date, "Reconnect" shown; a gone feed → `error` after 3 tries.

**Duplicates**: one row per (calendar, occurrence) by a unique index; reconnecting the same Google account reuses its
connection; the same adult can't add the same link twice (fingerprint of host+path+query); the same event on two
calendars (both adults invited, a team calendar added by each) shows once on screen (same UID and start), naming the
other calendar ("also on …"). A family-made event and an imported event aren't merged (no reliable match).

## Tests

| Run | What |
| --- | --- |
| `npm test` | `tests/calendar-import.test.ts` (24: zones/DST, repeat rules, feeds, Google mapping, SSRF, sealing, PKCE), `tests/calendar-connected.test.ts` (6: local time, overnight, dedupe, Family Meeting week) plus the existing calendar suites |
| `npm run test:calendar` (local Postgres) | `tests/calendar-e2e.test.ts` (10): the real handler on a real database with fake Google, feed hosts and Auth: OAuth + PKCE, replayed/forged state, sealing, private-host and redirect refusals, sharing, 304s, cancellations, throttling, revoked grant and reconnect, disconnect + revoke, family events untouched |
| `bash scripts/test-household-sql.sh` | `supabase/tests/calendar-connections.sql` (49): grants, RLS, private/shared/Busy, unshare, leaving the household, idempotent sync, window-only removal, the mass-removal hold, backoff, reauth, one-time OAuth state, disconnect |

## Rollout (each step needs the owner)

1. **Google Cloud** (owner): create a project → OAuth consent screen (External; app name "Organized Family"; support
   email; privacy policy URL; authorized domain `organizedmomcollective.com`, `supabase.co`) → add scopes
   `calendar.calendarlist.readonly`, `calendar.events.readonly`, `openid`, `email` → OAuth client (Web application)
   with redirect URI `https://<project-ref>.supabase.co/functions/v1/calendar-connect` → enable the Google Calendar API.
   **These are sensitive scopes: Google verification (brand + scope justification, a demo video) is required before
   more than 100 users or the "unverified app" warning; in Testing mode refresh tokens expire after 7 days.**
2. **Secrets** (Supabase → Edge Functions): `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`,
   `CALENDAR_TOKEN_KEY` (`openssl rand -base64 32`; losing it means everyone reconnects), `CALENDAR_CRON_SECRET`.
3. **Migration**: `preflight.sql` → apply `20261205000000_calendar_connections.sql` (after the household and
   family-calendar migrations) → `verify.sql`.
4. **Deploy** `calendar-connect` (`verify_jwt = false` is in `supabase/config.toml`; it checks its own callers).
5. **Schedule**: `schedule.sql` (pg_cron + pg_net, secret in Vault).
6. **Privacy policy**: add what's read (calendar names and events, read-only), where it's kept, sharing defaults,
   removal; Google's Limited Use disclosure. Required by Google verification and the App Store.
7. Test on the website and a TestFlight build with a test Google account and a real school feed, then turn it on for
   families (the Calendars button shows to signed-in adults; Google's button only once step 2 is done).

**Rollback**: unschedule, undeploy, `rollback.sql` (family events untouched).

## Next (not in this phase)

Editing imported events or writing to Google; Outlook/Microsoft 365 OAuth (links work today); iCloud (no API: its
share link works today); push notifications for changes; incremental Google sync (sync tokens / push channels) when
volume needs it; matching a family-made event to an imported one.
