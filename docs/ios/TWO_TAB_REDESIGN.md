# Two-tab redesign: Today | Family Meeting

**Family Meeting: we decide together. Today: we follow through together.**

The weekly Family Meeting is the product. Everything else exists to help family members own their part and follow
through. This is a focused redesign of the existing app, not a rebuild: no new database tables, no migration, no change
to Supabase policies, billing, entitlements or the Club. The approved three-screen mockup was the reference for
hierarchy and layout. The visuals remain the Organized Family system (PUBLIC-VISUAL-DESIGN / APP_DESIGN_SYSTEM): the
same fonts, colors, member color avatars and `Icon` set. There are no photos, illustrations or emoji icons.

## Navigation

| Before | After |
| --- | --- |
| Today · Calendar · Cleaning · Family | **Today · Family Meeting** |

- `src/data/app/tabs.ts`: `PRIMARY_TABS` and `tabFor(path)`, shared by the phone tab bar (`AppTabBar.astro`) and the wide-screen header (`Nav.astro`).
  - The Family Meeting tab opens `/app/family/meeting` (same route, same data).
  - Every other app screen belongs to Today.
- The same on the website, the PWA and the iPhone app. The printed calendar's QR pages (`/app/calendar…`) keep their own tabs.
- Nothing was removed. From Today:

| Today shortcut | Opens | What's there (unchanged) |
| --- | --- | --- |
| This Week (header) and **Plans** | `/app/family-calendar` | The family calendar, connected Google and iCal calendars, event responsibilities |
| **Cleaning** | `/app/cleaning` | The cleaning companion, daily reset, week, progress |
| **Resources** | `/app/family` ("Family & resources") | Members and setup, who does what, partner sharing, getting started, the Family Meeting Club and its months |
| Profile icon (header) | `/app/account` | Account, sharing, billing, settings |

## Today (`src/components/app/TodayDashboard.tsx`, `src/pages/app/index.astro`)

1. **Header.**
   - Contents: "Today", "Living out what we agreed together.", and **This Week**. The account control is in the app header, as before.
2. **Our family focus.**
   - The family's own focus (`profile.priority`, chosen in a meeting) is called theirs.
   - Otherwise, a Club family sees this month's topic, labeled "This month · prepared for your family", never as something they agreed.
   - A brand-new family sees an invitation to its first meeting.
3. **Today's Responsibilities** (the main content).
   - **Trackable:** today's responsibilities on calendar events, from the event-responsibilities feature. Each shows the person's color initial, name, the task, its event, and a check circle that syncs with the event and the other phone.
   - Unfinished ones whose event left the calendar this week stay visible so they can be removed.
   - **Agreements:** each person's standing agreements, with no check circle, because agreements have no done state and none is invented.
   - Each responsibility appears once. "N more this week" links to the calendar.
4. **Plans · Cleaning · Resources.** Shortcuts, not tabs, each with a real count ("2 events today", "3 of 10 done").
5. **Next Family Meeting.**
   - Shows a date only when a "Family Meeting" event is really on the family's calendar.
   - Otherwise it says where the family is with the meeting: continue, met recently, or a short invitation. No date or time is ever made up.

The old sections are folded in: today's plans (now the Plans count); the week ahead (now in the meeting's Our Focus, as
before); everyone's part (now Today's Responsibilities); and the Club month tile (now under Resources). No development
stages or coaching appear on Today.

## Family Meeting (`src/components/ourweek/WeeklyMeeting.tsx`)

**Landing** (new). It shows:
- "Family Meeting", "About 10 min", and the approved subtitle.
- The focus, as on Today.
- The four approved parts, with their exact names, in order: **Our Focus · Let's Talk · Everyone's Part · Let's Practice**. Tapping a part opens the meeting there.
- **one** button: Start Our Family Meeting, or Continue.
- "Last time together": what the family agreed.
- The next meeting, only if it's on the calendar.

There is no Club promotion on the landing.

**Meeting states** (`src/lib/app/meeting-progress.ts`):

| State | When | What she sees |
| --- | --- | --- |
| first | Nothing agreed, never met on this phone | "Your first Family Meeting" |
| in-progress | A meeting started here in the last 3 days, not finished | **Continue: {part}**, and Start over |
| recent | **Finish meeting** tapped in the last 6 days | "You met on Sunday. Everyone's parts are on Today." |
| ready | Anything else, including after weeks away | "Ready when you are." No counts, no streaks, no backlog |

- **Where it's recorded:** when a part opens, and when Finish meeting is tapped. Finish now returns to Today.
- **Limitation (deliberate):** progress is kept on **this phone**, per household, so Continue doesn't carry over to the other adult's phone. A shared record would need a new table, which this redesign avoids. Agreements, development decisions and event responsibilities stay shared as before.

**The guided meeting:**
- The engine, the four parts and their content are unchanged: the week review, agreements, calendar, practice, sync, offline and conflict handling.
- The header is compact: "‹ Family Meeting" and "Step 3 of 4".

## Responsibility development: MAWL invisible

The engine (`src/lib/family-development/*`) is unchanged: its eligibility rules, readiness checks, valid decisions, records and the
database's Club check on every write. What parents see changed:

- **No stage names, stage pills or progressions anywhere.**
  - The stage pills ("Learning", "Together", "Practicing", "Their responsibility") are gone.
  - Confirmations say what to do now ("Saved. This week: Do it together…"), never which stage it is.
  - The "Back to '…'" line is gone.
  - Where a new responsibility starts is asked as "How much help will Mia need at first?" (Show Mia how first / We'll do it together / Mia can mostly do it; I'll coach / Mia already owns it).
  - Moves are actions: "Ready to do it together", "Ready to try it while you coach", "Hand over responsibility".
- **Everyone's Part leads with one conversation** (`DevelopmentConversation`). It shows:
  - the child's color initial, name, and what they're practicing;
  - **"What went well?"**, said out loud with the child first; nothing to type;
  - the **engine's own question with the engine's own answers** for that stage (for example, "Did Sofia do 'Unload safe dishwasher items' at the usual time (after dinner) without a reminder?" with Usually, Sometimes or Rarely);
  - **Our next step**: Keep practicing, or the valid changes.
- **Everyone else** is one tap away ("Next steps for Mateo, Elena"), each with their question too. The check-in moved from Let's Talk to Everyone's Part.
- **Nothing advances on its own.** Children's input is invited; parents decide readiness. Hand over responsibility is still a separate, explicit choice.

## Club

The Club is the same weekly meeting, enhanced:
- The month's focus, questions, age-fit suggestions, practice and printables appear inside the meeting parts, as before.
- Club resources are under Resources.
- Free families keep the full meeting.
- No new paywall, pricing or entitlement change. The iPhone app still sells nothing.

## Tests

- **Unit:** `tests/two-tab-redesign.test.ts` covers:
  - the tabs, and that secondary screens stay reachable;
  - every meeting state, including no guilt wording;
  - a real scheduled meeting only;
  - the landing, and Today's honesty rules;
  - MAWL invisibility.
- **Development tests** were updated from "the stage pill shows" to "no stage shows", and the valid moves are unchanged. They now also cover the one-conversation layout.
- **Browser** (CI: family-e2e, web-shell):
  - the app-shell smoke test (two tabs, shortcuts, Family & resources);
  - family, calendar, Google (app and web), Club access, Rivera demo, first sessions, and event responsibilities, all updated for the landing and the new Today.
  - `scripts/e2e/redesign-screens.mjs` takes the before and after screenshots (Rivera Club household, new free household).
- **iOS:** `ios/App/AppUITests/AppLaunchTests.swift` now uses the Family Meeting tab and Today's shortcuts. It runs in CI's simulator job, not in a Linux session.
