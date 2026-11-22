# Responsibilities on imported calendar events

Google Calendar (or a school or team iCal feed) tells the family what's happening. Organized Family helps everyone do
their part. An adult opens an imported event and adds who does what. Anyone in the family can be assigned, and either
adult can check things off on their own phone.

> **Soccer practice** · Tue 5:30–7 PM · Riverside Park field 3 · from *Mateo soccer*
> ☐ Pack soccer bag · Mateo  ☐ Drive to practice · Luis  ☐ Prepare dinner · Ana

Status: built and tested. **Off for everyone** until the owner turns it on for the test household (§5). Migration
`20261211000000_calendar_event_tasks.sql` is **not applied**.

## 1. What a family sees

- **Calendar**
  - Tapping an imported event opens its sheet: title, day and time, place, and the calendar it came from (it stays recognizably that calendar's event).
  - Below that is **Who's doing what**: each responsibility with a large checkbox, its person in their family color, and **Add a responsibility**.
  - Tap a row to change the words, the person, or **Remove** it.
  - The calendar row itself only gets words ("1 of 3 done"), never controls.
- **Today**
  - A **Who's doing what** tile lists the next 7 days' responsibilities. Each row shows the person, the event and the day, with the same checkbox.
  - Checking something off here or in the event is the same thing, on every phone.
  - If an event leaves the calendar (cancelled, deleted), its unfinished responsibilities show "No longer on the calendar", with Remove.
- **Unchanged:** the Daily Reset, cleaning rotation, Family, the Family Meeting, the family's own calendar events, and the refresh schedule. No new tab.
- **Who can do what**
  - Adults (household members with an account) add, edit, assign, complete and remove.
  - Children have no accounts, so they are assignees only.
  - One person per responsibility. When several people help, add one each ("Decorate · Sofia", "Decorate · Mateo"). "Anyone" is allowed.

## 2. Source of truth

| Owned by the source calendar (never written back) | Owned by Organized Family |
| --- | --- |
| Title, date and time, place, repeats, cancellation, deletion | Responsibilities, who's assigned, done or not |

Responsibilities live in their own table (`calendar_event_tasks`), apart from the imported events (`calendar_feed_events`).
The refresher still replaces imported events wholesale, and never reads or changes this table.

**Which event a responsibility belongs to:** the household plus the event's **UID** plus its **occurrence key**. The
occurrence key is the original start, from `RECURRENCE-ID` or Google's `originalStartTime`. This is the same identity
the calendar already uses to show an occurrence once when both adults import the same calendar.

| Change in the source calendar | What happens |
| --- | --- |
| Refresh, unchanged | Nothing changes |
| Refresh fails, or comes back empty | Events and responsibilities kept (the refresher already keeps the last good copy) |
| One occurrence of a repeating event moved or renamed | Same key: responsibilities stay; the label follows |
| A one-off event rescheduled | New key. Followed **only** if: it was a one-off when the responsibility was added, the UID now has exactly one occurrence, and it moved no more than 45 days. Otherwise it stays on the old date. It is never attached to a guess |
| An occurrence cancelled, or the event deleted | Kept. Today shows unfinished ones as "No longer on the calendar" (with Remove) during that week; finished ones drop off |
| Repeating events | Each occurrence has its own; they never share |
| Calendar removed and added again | Matched again by UID + occurrence, with nothing duplicated (both tested) |
| The other adult imports the same calendar | Same UID + occurrence, so they see the same responsibilities |

**Known limits** (the ICS data can't tell us more):
- A one-off event moved more than 45 days, or one whose UID changes (some exports regenerate UIDs), isn't followed. Its responsibilities stay on the old date and show as no longer on the calendar.
- Responsibilities on events that have left the calendar aren't cleaned up automatically yet.

## 3. Privacy and security

- **Household isolation:** every function resolves the caller's household from `household_adults`. The table has RLS on and no grants to `anon` or `authenticated`; access is only through the security-definer functions.
- **Private calendars stay private:** a responsibility shows to an adult who can see its event (their own calendar, or one shared with the household), or who made it.
  - Ana's private work calendar: Luis sees neither the event nor its responsibilities, and can't change them.
- **Member removed:** they show as unassigned, can't be assigned anymore, and their responsibilities stay (FK `on delete set null`).
- **An adult who leaves the household:** no access.
- **Not touched:** billing, subscriptions, entitlements and Club access. Nothing is ever written to Google or any source calendar.

## 4. Code

| What | Where |
| --- | --- |
| Migration (table, rollout flag, functions) | `supabase/migrations/20261211000000_calendar_event_tasks.sql` |
| Functions | `calendar_event_tasks(from, to)` (list; brings labels up to date, follows safe reschedules), `calendar_event_task_save(p)`, `calendar_event_task_done(id, done)`, `calendar_event_task_delete(id)` |
| App data | `src/lib/calendar/event-tasks.ts` (`useEventTasks`, `tasksFor`, `upcomingTasks`). Imported events now carry `external.uid` / `instance_key` (`src/lib/calendar/feeds.ts`) |
| Event sheet | `ExternalEventSheet` / `EventResponsibilities` in `src/components/calendar/CalendarSources.tsx` |
| Calendar row label | `EventRow` in `src/components/calendar/FamilyCalendar.tsx` |
| Today tile | `WhoDoesWhat` in `src/components/app/TodayDashboard.tsx` |
| Tests | `supabase/tests/calendar-event-tasks.sql` (45 checks), `tests/event-tasks.test.ts`, `scripts/e2e/event-tasks-e2e.mjs` (Rivera household, CI: family-e2e) |
| Rollout | `supabase/rollout/event-tasks/{preflight,verify,rollback}.sql`; the 20261211 section in `supabase/rollout/household/rollback.sql` |

**Saving:**
- A save needs a connection, so two adults' edits never fork. The last copy stays on the phone for reading offline.
- Checking something off shows at once and is undone if the server refuses.
- Other phones pick up changes on focus, on resume, and every minute while the app is open.

## 5. Rollout (owner approval at each step)

1. Review and merge the PR. Deploy the site and app bundle. Without the migration, nothing shows: every call fails and the feature hides itself.
2. Apply the migration on production:
   1. Back up.
   2. Run `supabase/rollout/event-tasks/preflight.sql`; every row must be `t`.
   3. Apply `20261211000000_calendar_event_tasks.sql` **by itself**, not `db push`.
   4. Run `verify.sql`; every row must be `t`.
   - It needs 20261205 and 20261206, which are already on production. It doesn't need 20261210.
3. Turn it on for the test household only. Calendar subscriptions must also be on for that household (it's a `calendar_feed_testers` row either way):
   ```sql
   update public.calendar_feed_testers set event_tasks = true where user_id = '<test adult user id>';
   ```
4. Test on real phones (§6). Only after review:
   ```sql
   update public.calendar_feed_rollout set event_tasks_everyone = true where id;
   ```
   This also requires calendar subscriptions to be on for those households.
5. **Rollback** (removes responsibilities families added; imported events untouched): `supabase/rollout/event-tasks/rollback.sql`. Turning it off without losing data: set `event_tasks = false` / `event_tasks_everyone = false`.

## 6. Real-device checklist (not done in CI)

Unverified until done on a real iPhone (TestFlight) and iPhone Safari:

1. Open an imported Google event, then add, assign and save in a few taps with the keyboard up. Nothing is hidden behind the keyboard or tab bar.
2. Check off on one phone; the other phone shows it within a minute, or at once on reopening.
3. VoiceOver reads each checkbox as "Pack soccer bag, Mateo, checkbox, not checked".
4. Larger Text: rows wrap and nothing overlaps.
5. Offline: the list still shows; saving says you're offline.
6. Move the event in Google Calendar; after the next refresh, the responsibilities are still there.

## 7. Out of scope (not built)

- Google OAuth changes and two-way sync.
- AI-suggested responsibilities.
- Push notifications.
- Automatic cleaning rescheduling.
- New Club features.
- Responsibilities on the family's own events (those already have "who handles it").
