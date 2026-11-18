# Calendar integration

Status (2026-11-18): **iCal subscriptions and the unified calendar are built and tested on branch
`claude/calendar-integration`. Nothing is deployed, and migration 20261205 has not been applied.** Google Calendar
OAuth is not built yet; it needs the owner's Google Cloud credentials first (see "Google Calendar" below).

Until the migration and function are live, the app checks for the feed functions, doesn't find them, and hides the
whole feature. The production calendar behaves exactly as before.

## 1. Audit: the calendar as it was (main @ 609d582)

| Area | What exists |
| --- | --- |
| Model | Wall-clock events: `starts_on`, optional `ends_on`, `start_time`/`end_time`, an IANA `timezone`, `recurrence` (daily/weekly/monthly/yearly with interval, weekdays, until/count), `skip_dates`, `member_ids` (who it's for), `owner_member_id` (who handles it), `revision`, `deleted_at`. `src/lib/calendar/recurrence.ts` expands occurrences. |
| Storage and sync | `calendar_events` is scoped to the household with RLS (migration 20261125, live). RPCs: `calendar_event_save` (optimistic revision check), `calendar_event_delete`, `calendar_changes(since)`, `calendar_import_activities`. The client (`src/lib/calendar/client.ts` + `store.ts`) works offline first, with a local copy, an outbox, and conflicts shown when the other adult changed an event first. |
| Editing | `EventSheet` in `FamilyCalendar.tsx`: add, edit, "this one / all" deletes (a skip date or a delete), repeats, people, who handles it. |
| Sharing | One household, two adults (`household_adults`). Both see and edit every family event, and invites go through `household_invite_*`. Other households are isolated (SQL tests and the family e2e cover this). |
| Colors | Each person has a permanent marker color (`memberColors`, saved in `club_households.preferences.colors`). Each event's bar takes the color of its first person. |
| Views | Week (the wall calendar's shape), Month, Agenda; Today's plans; "This week on our calendar" in the weekly Family Meeting (free `/app/family/meeting` and the Club month meeting). |
| Web vs iPhone | Same code. The iPhone app is the Capacitor shell around `app-www` (the `/app` pages), so calendar behavior is identical. The intended differences are wording ("this phone" / "this device") and the website-only billing link. |
| External calendars | None. There was no import, subscription or sync of outside calendars. |

## 2. What was built

### Architecture

```
School/team/work iCal URL ──► calendar-feeds Edge Function ──► calendar_feed_events (expanded instances, UTC / dates)
   (webcal:// or https://)      fetch · parse · expand · store        │
                                 every 30 min (pg_cron) or "Refresh"  ▼
                                                     calendar_feed_events(from, to, 'mine' | 'household') RPC
                                                                      │
FamilyCalendar · Today · Weekly Family Meeting ◄── useExternalCalendars / loadExternalEvents
   (read-only CalendarEvents with an `external` field, in the device's time zone, in the chosen person's color)
```

- **The family's own events are untouched.** Imported events live in their own tables, never enter `calendar_events`, its sync, outbox or local store, and can't be edited in the app. Opening one shows a read-only sheet saying where it came from and to change it in the original calendar.
- **Parsing** (`supabase/functions/_shared/calendar/ics.ts`): RFC 5545 with line folding and escaping.
  - Time zones: TZID (IANA and common Windows names), UTC, floating times (read in the household's zone), and X-WR-TIMEZONE.
  - Event shapes: all-day and multi-day events, DURATION.
  - Recurrence: RRULE (FREQ, INTERVAL, COUNT, UNTIL, BYDAY with ordinals, BYMONTHDAY, BYMONTH, WKST), expanded in wall time so a 4 PM practice stays 4 PM across a daylight-saving change.
  - Exceptions: EXDATE, RDATE, RECURRENCE-ID overrides (moved or retitled) and STATUS:CANCELLED, both for a whole event and for one occurrence.
  - Window: one month back to one year ahead, capped at 5,000 instances. Rules it can't expand safely (BYSETPOS, BYWEEKNO…) are skipped, not guessed.
- **Duplicates.**
  - Within one calendar, instances are unique by UID + instance.
  - Across the household, the same event subscribed twice (by both adults, say) is shown once.
  - Adding the same link twice returns the existing subscription.
- **Fetching** (`supabase/functions/_shared/handlers/calendar-feeds.ts`):
  - Only `https`/`http` links; `webcal://` is accepted and stored as `https://`.
  - Never reads private, loopback, link-local or metadata addresses. This is checked when a calendar is added and again on every redirect, with at most 3 redirects.
  - Limits: a 15-second timeout and a 5 MB cap.
  - Conditional GET (ETag / Last-Modified), so an unchanged calendar isn't re-downloaded.
  - The link is never logged or returned to anyone but its owner.
- **Failures and disconnection.**
  - A temporary error (5xx, timeout, not a calendar) keeps the last good events, shows a plain reason, and backs off.
  - A link that stopped working (401/403/404/410) marks the calendar *disconnected* and clears its events, so stale plans don't linger.
  - "Refresh" reconnects it once the link works again. Removing a calendar deletes it and its events; the original calendar is never touched.

### Privacy (each adult controls their own)

- Every calendar belongs to the adult who added it. It is **private by default** ("Only me"), and they can switch it to "Our household" at any time.
- The other adult sees a household calendar's events and name, but **never its link**, and can't change, refresh or remove it.
- **The weekly Family Meeting shows shared calendars only.** Private ones stay out of every meeting view, including the Club month meeting.
- If an adult leaves the household, their calendars stop showing to it.
- Other households see nothing. All of this is enforced in SQL (security-definer RPCs; no direct table access) and covered by `supabase/tests/calendar-feeds.sql` and the e2e.

### "Whose calendar" and colors

Each calendar can be assigned to a person (Maya's school calendar) or the whole family, and its events take that person's permanent color, as on the wall calendar. Imported rows also show the calendar's name ("· Lincoln Elementary").

### Where it shows

| Surface | Which calendars |
| --- | --- |
| Family calendar (Week, Month, Agenda) | Mine (my private + all household-shared) |
| Today | Mine |
| Weekly Family Meeting (`/app/family/meeting`, Club month meeting) | Household-shared only |

Imported events are never flagged as "new/changed" or "nobody handling it" (nobody can be assigned to a read-only event).

### Files

| File | What |
| --- | --- |
| `supabase/migrations/20261205000000_calendar_feeds.sql` | Tables `calendar_feeds`, `calendar_feed_events`; RPCs `calendar_feed_add/update/remove/retry`, `calendar_feeds`, `calendar_feed_events`; service-role `calendar_feed_claim`, `calendar_feed_store`. **Not applied.** |
| `supabase/functions/calendar-feeds/` + `_shared/handlers/calendar-feeds.ts` + `_shared/calendar/ics.ts` | The Edge Function, the fetch/sync logic and the parser. **Not deployed.** |
| `src/lib/calendar/feeds.ts` | Client API, cache, conversion to read-only events, `useExternalCalendars`, `loadExternalEvents` |
| `src/components/calendar/CalendarSources.tsx` | The Calendars panel and the read-only event sheet |
| `FamilyCalendar.tsx`, `TodayDashboard.tsx`, `ourweek/WeeklyMeeting.tsx`, `lib/club/plan/meeting.ts`, `lib/family-meeting-support.ts` | Unified display |

### Tests

| Test | Covers |
| --- | --- |
| `tests/calendar-ics.test.ts` (8) | DST, EXDATE, moved and cancelled overrides, multi-day all-day events, UTC, floating and Outlook zones, monthly/yearly rules, refusals, windowing |
| `tests/calendar-feeds-handler.test.ts` (5) | Auth, owner-only refresh, the cron secret, status mapping, SSRF incl. redirects |
| `supabase/tests/calendar-feeds.sql` (29) | Privacy, ownership, link secrecy, duplicates, limits, store/error/gone/retry, removal, leaving the household |
| `scripts/e2e/calendar-e2e.mjs` (42) | Two adults on phones against the isolated backend with local iCal fixtures: add via the panel, unified Agenda, recurrence/EXDATE/cancel/move, LA→NY time zone, multi-day, read-only sheet, private vs household, duplicate shown once, link never shared, other household isolated, meeting shows shared only, Today, privacy switch, error / not-a-calendar / disconnected / reconnect, remove, scheduled refresh, family create/edit still works |

Run the e2e:

```bash
bash scripts/e2e/family-db.sh && psql -X -q -d omc_family_e2e -f scripts/e2e/seed.sql
```

```bash
node scripts/e2e/test-backend.mjs &
```

```bash
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 PUBLIC_SUPABASE_ANON_KEY=e2e-anon npm run build:app
```

```bash
node scripts/e2e/calendar-e2e.mjs app-www e2e-calendar
```

## 3. Turning it on (owner steps, in order, each with approval)

Nothing below has been done. Steps 1–4 need no outside accounts.

1. **Apply migration `20261205000000_calendar_feeds.sql`** to production.
   - It only adds new tables and functions; it alters no existing table, row or function, and doesn't touch billing or the Club.
   - Rollback: `drop table public.calendar_feed_events, public.calendar_feeds cascade;` and drop the `calendar_feed_*` functions.
2. **Set the function secret** `CALENDAR_CRON_SECRET` to a long random value (Dashboard → Edge Functions → Secrets, or `supabase secrets set CALENDAR_CRON_SECRET=…`). `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` are provided automatically.
3. **Deploy the function** `calendar-feeds`. It does its own auth, so deploy it with JWT verification off, the same as the scheduled refresh call:

   ```bash
   supabase functions deploy calendar-feeds --no-verify-jwt
   ```

4. **Schedule the refresh** every 30 minutes. Store the same secret in Vault, then in the SQL editor:

   ```sql
   select vault.create_secret('<the CALENDAR_CRON_SECRET value>', 'calendar_cron_secret');
   select cron.schedule('omc-calendar-feeds-refresh', '*/30 * * * *', $$
     select net.http_post(
       url := 'https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/calendar-feeds',
       body := '{"mode":"due"}'::jsonb,
       headers := jsonb_build_object('Content-Type', 'application/json',
         'x-calendar-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cron_secret')),
       timeout_milliseconds := 60000);
   $$);
   ```

   Each run claims at most 20 due calendars (each refreshed at most every 3 hours when healthy, backing off when failing).
5. **Release the website/app.**
   - The UI code ships with the branch, but it's hidden until steps 1–3 are live, so merging before them is harmless. The order matters only to make the feature appear.
   - The iPhone app picks it up in the next TestFlight build (not started; needs approval).

Smoke test after turning it on: add a public school or holiday calendar from one test account, check it on both adults' phones, switch it to private, and remove it.

## 4. Google Calendar (next; needs owner credentials)

Families can already add Google calendars today, read-only, through iCal: Google Calendar → Settings → the calendar → **"Secret address in iCal format"**. The panel explains this.

For one-tap "Connect Google Calendar" (OAuth, read-only), the owner needs to set up a Google Cloud project:

1. Google Cloud Console → create the project "Organized Family", then enable the **Google Calendar API**.
2. OAuth consent screen:
   - User type External; app name "Organized Family".
   - Support email; homepage https://organizedmomcollective.com; links to the privacy policy and terms.
   - Scope **`https://www.googleapis.com/auth/calendar.readonly`** only.
   - This scope is *sensitive*. Google requires app verification before more than 100 users can connect; plan 2–6 weeks. Add test users meanwhile.
3. Credentials → OAuth client ID → **Web application**.
   - Authorized redirect URI: `https://uvqhmlqwmgnohhduttip.supabase.co/functions/v1/calendar-google/callback`.
4. Share the **client ID** and set the **client secret** as the function secrets `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Never send the secret in chat or commit it.
5. Update the privacy policy: read-only calendar access, what is stored (event title, time, location for the next year), deletion on disconnect, and Google API Services User Data Policy (Limited Use) compliance.

Once these exist, the plan is:

- a `calendar-google` function (connect → consent → callback), with encrypted refresh tokens in a service-only table and incremental sync tokens;
- reuse of `calendar_feeds` (`kind = 'google'`) and the same store, privacy, display and "disconnected" handling;
- revoking the token on removal.

No other part of the app changes.

## 5. Known limits

- **Read-only by design.** There is no write-back to outside calendars, and family events are not published as a feed yet (a possible next step: a private iCal link of the family calendar for phones' native calendars).
- **Window.** Instances cover one month back to one year ahead; the app loads about one month back and four months ahead.
- **Refresh interval.** Changes in the source calendar appear within about 3 hours, or immediately with Refresh.
- **Unsupported rules.** Rare RRULE parts (BYSETPOS, BYWEEKNO, BYYEARDAY, hourly) are skipped rather than guessed.
- **Wording.** Customer copy on the public website should keep calling the companion a website. This feature is inside `/app` only, and no public page mentions it yet.
