# Pilot testing: real moms, first sessions

How we get Organized Family ready for a small group of real moms, what we changed before they see it, how they tell us
what's going wrong, and how we test on real phones. Measurement is in [ANALYTICS.md](ANALYTICS.md).

The synthetic research (simulated interviews and journeys) gave us **hypotheses**, not findings. Nothing here claims a
real mom has met these targets yet. The pilot is how we find out.

## 1. A successful first session (our usability targets)

| # | Target | How we check it in testing | How the pilot tells us |
| --- | --- | --- | --- |
| 1 | Understands what the app does within 30 seconds | Today, before any setup, says it in one line and offers one step | Question 1 below; time to `onboarding_started` |
| 2 | Creates her account without friction | Emailed code, no password; lands straight in family setup | `accounts_created` → `onboarding_started` |
| 3 | Sets up her family without feeling overwhelmed | One short form: names and ages. No Club wording. About a minute | `onboarding_started` → `onboarding_completed`; question 2 |
| 4 | Completes one meaningful action | Cleaning opens on today's checklist; a plan or an agreement | `first_meaningful_action` |
| 5 | Knows how to come back tomorrow | Today keeps "Getting started" with the next step until she's started | `returned_day_1`; question 4 |
| 6 | Finds the Family Meeting without instructions | On Today, on Family, and as the last getting-started step | `meeting_started`; question 5 |
| 7 | Understands what the Club adds, without pressure | App: by invitation, and what's free. Website: what's free and what the Club adds, no price on the page | `club_preview_viewed`; question 6 |

## 2. What we found and what we changed (2026-11-21)

We audited the real screens with a brand-new account at iPhone size (`scripts/e2e/first-session-audit.mjs`, before and
after screenshots in the PR).

**Fixed before the pilot (critical):**

- **Family setup**
  - *Before:* two titles ("Set up your family", then "Tell us about your family"), Club wording in the free app ("welcome gift", "monthly family resources", an illustration style "when that feature is introduced"), and after saving a 4,000px edit page with no next step.
  - *Now:* one title, a promise ("first names and ages, about a minute"), no Club wording. After saving, "You're set up, Jess." with one button (Go to Today), the invitation for the other grown-up only when there is one, and the form folded under "Edit your family".
- **Cleaning**
  - *Before:* a new user's first tap on Cleaning opened a four-step walkthrough for the *paper* wall calendar ("Put the calendar and a set of colored pens on the table"), with an older "Organized Mom" header.
  - *Now:* Cleaning opens on today's checklist. The walkthrough stays on the printed calendar's QR pages (`/app/calendar`), where it belongs, and `?setup=1` can still replay it.
- **Today**
  - *Before:* three equal buttons and no sense of where to start. The "Getting started" list was at the bottom of Family.
  - *Now:* a new family sees "Start here" at the top: what the app is for, and one next step. After setup, "Getting started · 1 of 4 done" with the next step until they've started, then it goes away.
  - The steps are one shared list (`src/lib/app/first-steps.ts`), so Today and Family always agree.
- **Single parents**
  - *Before:* "Invite the other grown-up" could never be done, so the getting-started list never finished.
  - *Now:* a household with one grown-up has nobody to invite, so that step counts as done.
- **Club on the website**
  - *Before:* the preview said "This is a preview library, not an active membership" and nothing about what stays free or what the Club adds.
  - *Now:* one plain line: the calendar, cleaning, weekly Family Meeting and shared responsibilities are free for everyone, and the Club adds one personalized resource each month, printed and mailed, with ideas for using it in the meeting. The app is unchanged (by invitation, nothing sold).
- **Pilot feedback and measurement:** sections 3 and [ANALYTICS.md](ANALYTICS.md).

**Already solved (kept as is):**
- **Missed days:** cleaning resets each day, with no backlog. Today counts "days you showed up" positively and has no streak to lose. The meeting looks at the next seven days, so a missed week is just a new week.
- **No sign-up wall:** the app works on the phone without an account. Signing in is for sharing with the other grown-up.
- **MAWL:** the Club meeting already speaks in plain words ("Do it together", "Hand over responsibility"). The stage names appear only as small labels.

**Waiting for real feedback (not changed, on purpose):**
- Teen-specific experiences.
- Shorter Club Home on phones (it's long: 12 months).
- One "Add a plan" instead of two on a new family's Today.
- Whether "Everyone's Part · this month" should show standing agreements after a new month begins.
- Reminders. We add nothing that nags until moms ask for it.

## 3. Feedback from inside the app

- **Where:** a quiet line at the bottom of Today ("Something confusing or not working? Tell us"), and **Send feedback** on Account.
- **What she does:** picks one of three kinds (*Something's confusing*, *Something isn't working*, *An idea or wish*) and writes a sentence.
- **What we get:** her message and email, and where she was. The screen she came from, iPhone app or website, and her screen width are added automatically. Nothing about her family.
- **Where it lands:** an ordinary support request (topic *companion*), visible in **Admin → Club → Pilot**, grouped by screen, with a reply link. No emails are sent, so it's unobtrusive.
- **Why not the support form:** feedback goes through the database (`app_feedback`), because the support Edge Function doesn't accept requests from the iPhone app's origin.

## 4. What to send pilot moms

### Invitation (copy and send)

> Thank you for trying Organized Family before anyone else! It's free. Please use it the way you normally would for about
> two weeks.
>
> - **iPhone:** [TestFlight link]. **Or** on any phone or computer: https://www.organizedmomcollective.com/app
> - Sign in with your email. You'll get a 6-digit code (no password).
> - Set up your family (first names and ages), then do one small thing: check off a cleaning task, add a plan, or hold
>   a ten-minute Family Meeting.
> - Whenever something is confusing or doesn't work, tap **"Tell us"** at the bottom of Today. You don't need to explain
>   anything technical; we can see which screen you were on.
> - We'll check in on day 3 and day 14 with a few short questions.

### Feedback questions (day 3 and day 14)

1. In your own words, what is Organized Family for? (Day 3 only.)
2. Was setting up your family quick, or did anything slow you down?
3. What's the one thing you've actually used? Was it worth opening the app for?
4. Did you come back on another day? What brought you back, or what kept you away?
5. Did you find the Family Meeting? Did you try it, and how did your family respond?
6. Did anyone else (your partner, your kids) use it or see it? What happened?
7. Did you look at Family Meeting Club? What do you think it adds? Did anything feel pushy?
8. Was there a moment you almost gave up? What was happening?
9. If you could change one thing, what would it be?

### Households to recruit (at least one each)

- Two parents with two school-aged kids.
- A single mom with three kids.
- A family with a teenager and a young child.
- A mom who already lives in Google Calendar (add her as a calendar tester first: section 5).
- A mom who only wants the free app.

## 5. Before inviting anyone (owner)

1. Merge and deploy, then apply `20261210000000_app_events.sql` (preflight, apply by itself, verify: `supabase/rollout/app-events/`). Without it, the app still works, and feedback and measurement simply don't save.
2. **Google Calendar moms:** on production, calendar subscriptions and Google are off for everyone (`calendar_feed_rollout`: `everyone = false`, `google_everyone = false`, 1 tester). Add each Google family as a tester (`insert into calendar_feed_testers (user_id, google) values (…, true)`), or turn the rollout on.
3. TestFlight build for iPhone testers ([../ios/TESTFLIGHT.md](../ios/TESTFLIGHT.md)).
4. Open Admin → Club → Pilot once to see that it loads.

## 6. Real-device testing checklist (not done in CI; do it on a real iPhone)

The automated checks run Chromium at iPhone sizes and the app in the iOS Simulator. None of that is a real phone, so
these are **unverified** until someone does them.

| # | Check | iPhone (TestFlight) | iPhone Safari (website) |
| --- | --- | --- | --- |
| 1 | Install, open: Today shows "Start here" and nothing is cut off at the top (notch, Dynamic Island) or bottom (home bar) | ☐ | ☐ |
| 2 | Sign in with an emailed code: the email arrives, and the code works while switching apps to read it | ☐ | ☐ |
| 3 | Set up a family with 3 kids: the keyboard doesn't hide the field you're typing in; the age picker is usable | ☐ | ☐ |
| 4 | "You're set up" → Go to Today → Getting started shows the next step | ☐ | ☐ |
| 5 | Cleaning: opens on the checklist; check a task; force-quit and reopen: still checked | ☐ | ☐ |
| 6 | Calendar: add a plan for a child; it shows on Today and the calendar | ☐ | ☐ |
| 7 | Invite the other grown-up: the share sheet or copy link works; they join on their phone and see the same family | ☐ | ☐ |
| 8 | Family Meeting: all four parts; "Finish meeting" | ☐ | ☐ |
| 9 | Club: the app says "by invitation" with no price; the website says what's free and what the Club adds | ☐ | ☐ |
| 10 | Tell us: send feedback; it appears in Admin → Club → Pilot with the right screen | ☐ | ☐ |
| 11 | Airplane mode: check a cleaning task, then reconnect: it syncs to the other grown-up | ☐ | ☐ |
| 12 | Come back the next day: Today still makes sense, nothing is lost, no guilt message | ☐ | ☐ |
| 13 | Large text (Settings → Accessibility → Larger Text): nothing overlaps; buttons are still tappable | ☐ | ☐ |
| 14 | Dark mode on the phone: still readable | ☐ | ☐ |
| 15 | Account → Delete my account (on a throwaway account): works and explains what happens to the family | ☐ | ☐ |

## 7. Automated tests behind this

| Test | What |
| --- | --- |
| `scripts/e2e/first-session-e2e.mjs` (CI: family-e2e) | Five brand-new families (two parents; single mom of 3; teen and little ones; a Google Calendar mom; free-only), app bundle and website at 393 and 430px. Covers first open → account → setup → first action → calendar → coming back → meeting → Club → feedback → measured. Every screen is checked for clipping and sideways scroll |
| `scripts/e2e/first-session-audit.mjs` | The walkthrough that produced the before and after screenshots (text of every screen too) |
| `supabase/tests/app-events.sql` | Events and feedback: allowlist, once a day, privacy, owner-only funnel and feedback, no family data |
| `tests/pilot-readiness.test.ts` | First steps (including single parents), the setup and Cleaning fixes, feedback path cleaning, event sending, and the allowlist matching the database |
