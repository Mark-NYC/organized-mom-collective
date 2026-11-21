# Pilot measurement

What we measure during the pilot, where each number comes from, and what we deliberately don't collect. Owner view:
**Admin → Club → Pilot**. Database: `supabase/migrations/20261210000000_app_events.sql` (not applied until the owner
approves).

## What existed before

- **Public website:** Google Analytics (GA4) for page views and CTA clicks (`src/lib/analytics.ts`, PublicLayout).
- **The app:** no tracking at all. That stays true for anyone not signed in.

## Principles

- **Use what the database already knows**, in aggregate: accounts, households, agreements, invitations, Club
  subscriptions. These need no new collection.
- **Add only what can't be derived:** one allowlisted event name, the platform and the day, for a signed-in grown-up, at
  most once a day per event. No counts, no properties, no free text.
- **Never collected:** children's names or ages, family or household names, agreement words, calendar contents, or
  anything a family typed. The events table doesn't even have a household column.
- **No outside service.** Everything stays in our own database. GA is not added to the app.
- **The owner sees numbers only.** Demo accounts (`@example.com`) are left out.

## The funnel

| Metric | Source |
| --- | --- |
| Accounts created | `auth.users` (created since the chosen date) |
| Onboarding started | event `onboarding_started` (family setup seen with no family yet) |
| Onboarding completed | the account has a household (`household_id_for`) |
| First meaningful action | events `cleaning_checked`, `plan_added`, `agreement_made` |
| First responsibility | the household has a confirmed agreement (`club_responsibilities`) |
| Family Meeting started / completed | events `meeting_started` (moved past part 1) / `meeting_completed` ("Finish meeting") |
| Second adult invited / joined | `household_invites` / `household_adults` (role partner) |
| Day 1 / 7 / 30 return | event `app_open` (once a day): the next day, days 7–13, days 30–36 after the first open |
| Club preview viewed | event `club_preview_viewed` (Club Home without the Club) |
| Club trial started | `club_subscriptions` status `trialing`, or a first free month (`club_entitlements` source `intro`) |
| Subscription conversion | `club_subscriptions` active, or a paid invoice |
| Feedback sent | event `feedback_sent` |

The funnel counts people, not events. Retention counts people whose first recorded open falls in the window.

## How the app sends events

`track(event)` in `src/lib/app/events.ts`:
- It sends only when signed in and never in the demo. It sends each event at most once per day per phone, retries next time if offline, and never throws or waits.
- Where each event is sent from:
  - `app_open`: AppLayout
  - `onboarding_*`: family setup
  - `cleaning_checked`: cleaning sync
  - `plan_added`: calendar
  - `agreement_made`: agreements
  - `meeting_*`: the Family Meeting
  - `club_preview_viewed`: Club Home

The database function `app_event` accepts only the allowlisted names, and writes nothing for a signed-out caller.

## Limits to keep in mind

- Anonymous use (before sign-in) isn't measured. A mom who uses the app only on her phone without signing in doesn't appear.
- Events are per person per day, so "how many times" isn't known, only "on which days".
- `plan_added` also counts edits to a plan (it's a save).
- Small numbers. With a pilot of 10–20 moms, read the feedback and talk to them. The funnel shows *where* to look, not *why*.
