# Calendar integration

Status (2026-11-19): **iCal subscriptions and the unified calendar are built, security-reviewed and tested on branch
`claude/calendar-integration` (PR open, not merged). Nothing is deployed, and migration 20261205 has not been applied.**
Links are encrypted in Vault, fetches are pinned to the checked address (no DNS rebinding), and a server-side flag limits
the feature to test households first ([ROLLOUT.md](ROLLOUT.md), [SECURITY_REVIEW.md](SECURITY_REVIEW.md)). Google Calendar
OAuth is not built yet; it needs the owner's Google Cloud credentials first (see "Google Calendar" below).

Until the migration and function are live, the app checks for the feed functions, doesn't find them, and hides the
whole feature. The production calendar behaves exactly as before.

**Next layer:** who does what for an imported event (pack the bag, drive, sign the slip), kept apart from the imported
events and never written back: [EVENT_RESPONSIBILITIES.md](EVENT_RESPONSIBILITIES.md) (migration 20261211, own rollout flag).

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
| `tests/calendar-ics.test.ts` (8) | DST, EXDATE, moved and cancelled overrides, multi-day all-day events, UTC, floating and Outlook zones, monthly/yearly rules, refusals, truncated downloads, windowing |
| `tests/calendar-feeds-handler.test.ts` (11) | Auth, owner-only refresh, double tap, constant-time cron secret, status mapping, content hash (incl. Google's DTSTAMP), scheduled-run budget, SSRF incl. DNS answers and redirects |
| `tests/calendar-feeds-client.test.ts` (4) | Conversion to read-only events in the device zone, colors, week-ahead labels |
| `supabase/tests/calendar-feeds.sql` (37) | Privacy, ownership, link secrecy, duplicates, limits, store/error/empty/gone thresholds, throttle, retry, removal, leaving and moving households, family events untouched |
| `scripts/rehearse-calendar-rollout.sh` | Preflight, apply, verify, use, rollback (schema identical), re-apply |
| `AppLaunchTests.testFamilyFlowWithTestBackend` (iPhone simulator, CI) | Imported shared and private events on the real app's calendar, read-only sheet, Calendars panel, still there after relaunch |
| `scripts/e2e/calendar-e2e.mjs` (52, app bundle and website build) | Offline (device copy), no events re-download when nothing changed, rollback hides everything and keeps family events, plus: | Two adults on phones against the isolated backend with local iCal fixtures: add via the panel, unified Agenda, recurrence/EXDATE/cancel/move, LA→NY time zone, multi-day, read-only sheet, private vs household, duplicate shown once, link never shared, other household isolated, meeting shows shared only, Today, privacy switch, error / not-a-calendar / disconnected / reconnect, remove, scheduled refresh, family create/edit still works |

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

## 3. Turning it on

See [ROLLOUT.md](ROLLOUT.md): preflight (already passed read-only on production), a verified backup, the migration, the function, the secret (created by the owner, never in chat), the 30-minute schedule, post-deployment checks and rollback. Security: [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

### Usage on the Supabase Free plan

Free-plan limits that matter: 500,000 Edge Function invocations/month; **2 s CPU** and 150 s wall clock per request; 500 MB database; 5 GB egress.

| Item | Amount | Share of the Free plan |
| --- | --- | --- |
| Scheduled runs (every 30 min) | 1,440 invocations/month, plus one per Refresh tap | ≈0.3% of invocations. Production already runs 4 jobs every 5–10 min, so this adds ~3% to existing cron traffic. |
| An idle run (nothing due) | One small SQL claim, then return | Negligible |
| CPU per run | Calendars are claimed **one at a time** until 0.9 s of parsing, 25 calendars or 90 s, whichever comes first; the rest wait for the next run | Under the 2 s CPU limit. After the parser fix in this PR: Google's US-holidays feed 32 ms, a 300-event school calendar ≈90 ms, a 5 MB worst case ≈380 ms. |
| Capacity | Each calendar refreshes every 3 h (6 h → 24 h when failing); 6 runs × 25 = **~150 calendars per 3 hours** | If that's ever exceeded, refreshes simply stretch. Then go every 15 minutes (still <0.6% of invocations). |
| Unchanged calendars | ETag/Last-Modified (HTTP 304), otherwise a content hash that ignores Google's per-download `DTSTAMP` | Unchanged calendars: no parse, no database write |
| Database | ~0.1 MB per typical school calendar (100–400 occurrences), 1.5 MB worst case (the 5,000 cap) | 100 calendars ≈ 10–15 MB of 500 MB (today 20 MB used) |
| App traffic | The list (≈1 KB per calendar) on open/focus and every 15 min while visible. Events are re-downloaded only when a calendar actually changed (`events_at`). | A few KB per visit typically |

**Verdict:** the 30-minute schedule fits comfortably. Hourly would also work; 30 minutes gives fresher school changes at negligible cost.

## 4. Google Calendar (next; needs owner credentials)

### Google's secret iCal address: the interim path (no OAuth)

Families can add Google calendars today, read-only, through iCal: Google Calendar on a computer → Settings → the calendar → **"Secret address in iCal format"** → copy, then paste it into Calendars. The panel says this. It was verified against Google on 2026-11-18:
- the feed parses correctly (33 US holidays in 32 ms in Deno);
- Google sends no ETag, and a new `DTSTAMP` on every download, so the content hash ignores DTSTAMP; unchanged Google calendars are neither re-parsed nor rewritten;
- a revoked or wrong secret link returns 404, which the app handles as "stopped working" (events kept through two failures, then disconnected).

**It works. Tradeoffs to communicate:**

| | Secret iCal link (now) | Google OAuth (next phase) |
| --- | --- | --- |
| Setup for mom | Desktop or browser only (not the Google Calendar phone app); find Settings → the calendar → copy a long link; once per calendar | One "Connect Google" tap; pick calendars |
| What the link grants | **Anyone who has the link can read that whole calendar, with details**, until it's reset. Google itself warns not to share it. | A read-only token scoped to our app, revocable from her Google account |
| Where it's kept | Encrypted in Supabase Vault. No app response returns it, not even to its owner (they see the host name only); never on the device, never logged | Encrypted refresh token |
| Revoking | She resets the secret address in Google; our copy stops working and is disconnected | Remove in the app or in her Google account |
| Freshness | Our schedule: within ~3 h, or right away with Refresh | Same schedule, or push notifications later |
| Work/school accounts | Google Workspace admins can disable secret addresses | Admin approval may be needed |
| Private event details | Full details (titles, locations) of every event, even ones marked private in some setups | The same read-only data; scopes can't narrow it further |
| Approval needed from Google | None | App verification for the sensitive scope (2–6 weeks) |

**Recommendation:** ship the secret-link path now with clear in-app wording ("Treat this link like a password; only you see it here; reset it in Google any time"). Use it for family, school and sport calendars, and suggest "Only me" for work calendars. Don't advertise "Connect Google Calendar" until OAuth ships.

### Google OAuth setup (next phase)

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
