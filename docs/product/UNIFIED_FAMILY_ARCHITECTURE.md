# Organized Family + Family Meeting Club: unified architecture (Stage 1)

Status 2026-11-18: **proposal for owner approval. Nothing here is built yet** beyond the Club-inside-the-app shell on
branch `claude/club-integration` (app header and tabs on every Club page, Club bar, Family Club tile, kept-months
tile, Club journey test). No migrations, billing, entitlement or production data changes are proposed.

**The one-line model.** Organized Family organizes the week. The Club personalizes how the family grows. The weekly
Family Meeting is where they meet: free families run it from their own week; Club families run it with their
month's prepared plan inside it.

---

## 1. Audit: how the app and the Club relate today (from the code)

**The headline: the data is already one system. The experience isn't.**

| Layer | What exists | Shared or split |
| --- | --- | --- |
| Household and people | `club_households` + `club_family_members` (`src/lib/club/profile.ts`): first names, adult/child, role, child birth year and month, permanent color | **Shared.** The free setup (`/app/family/setup`, `OurWeekFamilySetup.tsx`) uses the Club's own `FamilyForm` and `club_household_save`, which sets `onboarded_at`. A free family that joins the Club skips the family step. |
| Calendar | `family_calendar` events belong to `club_households` and name people by member id | Shared |
| Cleaning progress | household cleaning marks (20261201) | Shared |
| Two adults | `household_adults`, invites, partner reads household access via `club_me` (`household_role: 'partner'`, billing fields null) | Shared; verified on the test backend |
| Family profile, steps 2–6 | `club_activities`, `club_responsibilities` (`existing`, `desired`), household `challenges`, `challenge_note`, `priority`, `priority_note`, `setup_done` (`src/lib/club/family-profile.ts`, migration 20261109) | Stored per household, **not gated by membership** server side (`club_activities_save`, `club_responsibilities_save`, `club_focus_save` check the household only). Only the Club's `/club/welcome` and `/club/family` ask for them. |
| Agreements | `club_responsibilities` rows with status `confirmed` (20261127): "We agreed" from either meeting | **Shared.** One table for free weekly agreements and Club monthly agreements. |
| Free weekly meeting | `/app/family/meeting` → `WeeklyMeeting.tsx`: the four standard parts (`src/data/club/meeting-guide.ts`), the family's week ahead and agreements. Deliberately generic. | App only |
| Club monthly meeting | `src/lib/club/family-meeting.ts` engine (profile + month content → prepared 10-minute meeting, age-fit suggestions, no invented details) rendered by `ClubFamilyMeeting.astro` at `/app/club/<month>?view=meeting` | Club only, **monthly**, a separate page from the weekly one |
| Monthly resources | 12 kit definitions (`src/data/club/kits/`), engines (`src/lib/club/engines/`), shared personalization (`src/lib/club/personalize/`: `familyContext`, `assignTasks`, snapshot "saved means settled", edits), plan shell, approval, print, fulfillment (`club_resource_versions`, mailings, cutoff) | Club only; untouched by this proposal |
| Commitments and check-ins | `src/lib/club/family-plan.ts`: `SuggestedIdea` vs `Commitment`, check-in answers (`on-own`, `reminders`, `struggling`, `moved-on`) → next step | **Modeled, never shown.** The retention loop exists as pure rules with nothing calling it. |
| Audio coaching | `audio?: { src, minutes }` on a month's meeting content; player slot in `ClubFamilyMeeting.astro` | **No recordings exist.** Must not be advertised. |

**Where it breaks for a family:**

1. **Two meetings.** The free weekly meeting and the Club's monthly meeting are different pages with different
   content. A member has no reason to open the weekly one and no weekly reason to open the monthly one.
2. **The profile that drives personalization (week, who does what, growth, challenges, priority) is invisible
   outside the Club.** A free family never tells us its challenges, so the Club pitch can't speak to them, and the
   Club intake asks all five steps at once after payment.
3. **The retention loop isn't wired.** Commitments and check-ins are designed; nothing asks "How did Mia's job go?"
4. **The Club Home year strip disagrees with the approved months** (§6).

## 2. Proposed unified architecture

**No new tables, no new profile, no new meeting engine.** Three surfaces inside Family, each reading what already
exists.

```
Family (tab)
├── My Family            /app/family            people, colors, ages · who does what · agreements · priorities
│                                                (club_households, members, club_responsibilities, focus columns)
├── Our Family Meeting   /app/family/meeting    THE weekly meeting, free and Club
│                                                free: WeeklyMeeting (week ahead, agreements, the four parts)
│                                                Club: same page, month's prepared parts from family-meeting.ts
└── Our Monthly Plan     /app/club …            Club Home, this month's resource, approval, print, past months
                                                 (unchanged pages, already inside the app shell)
```

**The weekly meeting becomes the single meeting surface.** For a Club family, `/app/family/meeting` calls the
existing `family-meeting.ts` engine for the current month and shows its output inside the same four parts:

| Part (minutes) | Free family | Club family (adds, from existing engines) |
| --- | --- | --- |
| Our Focus (2) | "What's our week?": the calendar's next 7 days, new/changed, nobody handling (`weekAhead`) | The month's Family Focus, already written for her family's ages and priority |
| Let's Talk (3) | Celebrate: last week's agreements, each person's (`agreementsByPerson`). Challenges: one open question | The month's prepared questions; the check-in question (`family-plan.ts`) on each commitment |
| Everyone's Part (3) | Agree one or two small parts ("We agreed", existing) | The engine's age-fit suggestion per child (max one each), tapped into an agreement with `source: 'month:…'` |
| Let's Practice (2) | Try one now | The month's practice step, linking to the month's resource |

Your five steps map onto the four parts without renaming them (look ahead = Focus; review responsibilities and
celebrate = Talk; challenges = Talk; agree actions = Everyone's Part). **Recommendation: keep the four approved part
names** (they're on printed guides, January's kit and the Meeting Guide).

The monthly meeting page (`?view=meeting`) stays as is for print and for the first meeting of the month; the weekly
page simply reuses its engine, so there is one meeting system with two entry points, not two systems.

## 3. Free vs Club

| | Free (website and iPhone) | Club ($5.90/month, unchanged) |
| --- | --- | --- |
| Calendar, sharing, two adults | Full | Full |
| Cleaning companion | Full | Full |
| Family members, colors, ages | Full | Full |
| Who does what, agreements | Full | Full |
| Weekly Family Meeting | Full: week ahead, agreements, the four standard parts | Same page, plus the month's prepared focus, questions and age-fit suggestions |
| Family profile (week, growth, challenges, priority) | **Optional**, in My Family ("Help us understand your family") | Required inputs for personalization; prefilled from anything she already answered |
| Personalized monthly resource, editor, approval, print, mailing, past months | — | Full |

Nothing free gets restricted. The difference is personalization and the printed, mailed plan.

## 4. Journey, first visit to month six

1. **Discovery** (Pinterest, article, calendar QR, App Store): lands on Today or a QR page. Unchanged.
2. **First win, under a minute:** add an event, or tick today's reset. No setup wall (current behavior).
3. **Getting started tile** on Family (built on the branch): household → week → other adult → first meeting.
4. **First weekly meeting:** the free page. "We agreed" creates the first agreements; Today shows them.
5. **Optional profile in My Family**, offered after the first meeting ("What's hardest to share at home?"): saves
   to the existing focus/responsibility functions. Free families get a better meeting (their own challenge as the
   Talk question); we learn what matters to her.
6. **Club discovery, website only** (owner decision 2026-11-17 and App Store rules): after she has held a meeting,
   one quiet line in the weekly meeting and in Getting started: "Want a plan made for {Mia (6) and Noah (9)} around
   {mornings}? Family Meeting Club." Uses her own children's ages and her stated challenge. Never in the iPhone app.
7. **Club onboarding** (`/club/welcome`, unchanged flow): family step already done (`onboarded_at`), steps 2–6
   prefilled from step 5, so she only confirms. Address, Welcome Kit.
8. **Month 1:** the weekly meeting now carries her prepared plan; the month's resource is one tap away.
9. **Weeks 2–4:** each meeting opens with the check-in on that month's commitments (`family-plan.ts`).
10. **Next month:** Club Home shows "Last month: Mia owns breakfast dishes, on her own now. This month builds on it."
    Requires reading commitments into the next month's engine input (rules exist; wiring is new).

## 5. Information architecture

| Tab | Club role |
| --- | --- |
| Today | This week's agreements; this month's plan card (members). Unchanged rule. |
| Calendar | Feeds the meeting's look-ahead. No Club UI. |
| Cleaning | None. Cleaning icons and companion untouched. |
| Family | Home of all three surfaces above. The Club is a section of Family, reached by tiles and the Club bar; never a fifth tab. |
| Account (profile) | Membership status; billing link on the website only, payer only. |

## 6. Approved monthly content: repository vs your list (flag for review)

Source of truth used: `src/data/club/kits/*.ts` and the month pages.

| Month | Your list | Repository | Status |
| --- | --- | --- | --- |
| Nov 2026 | Our Family, Our Team | Our Family, Our Team (responsibility chart) | Match |
| Dec 2026 | Give to Others | Our Christmas Kindness Mission | Match in substance; title differs |
| Jan 2027 | Family Meeting Introduction | Our First Family Meeting (four parts) | Match. Prod title fix is migration 20261202, **not applied** |
| Feb 2027 | Family Connection | Better Together / Connection Challenge | Match |
| Mar 2027 | Spring Clean as a Team | Our Family Spring Prep | Match |
| Apr 2027 | Dinner Team | Our Family Dinner Team | Match |
| May 2027 | Our Family Summer Rhythm | Our Family Summer Rhythm | Match (slug `finish-the-school-year`, legacy) |
| Jun 2027 | I Can Make My Own Snack | Snack station | Match |
| Jul 2027 | I'm Bored! What Can I Do? | What Can I Do Right Now? | Match |
| Aug 2027 | Back to School | My School Day | Match |
| Sep 2027 | Habit Cards | Our Family Habit Cards | Match. Prod title fix in 20261202, **not applied** |
| Oct 2027 | Our Family Sunday Reset | **A Home That Works Together: the Daily Reset** (Sunday Reset moved off October in Oct 2026; `SeptemberSundayReset.astro` is unused) | **Mismatch: decide** |

**Also wrong:** Club Home's "Your year" strip (`src/components/AppKitLibrary.tsx`, a hard-coded list) shows older
outcome titles that contradict the registry: January "Stop Being the Family's Calendar", February "Laundry That
Isn't All on You", September "School Routines Without the Nagging", October "Less Asking. More Doing.". Members see
this today. Fix: read titles from the kit registry.

## 7. Preservation plan: must not change

Kit definitions and engines; `personalize/` rules and snapshots; month pages, printables, previews (`?thumb=1`),
fulfillment views (`?fulfillment=`, bare); approval and cutoff (`club_resource_versions`, mailings,
`deadline.ts`); entitlements, `club_me`, `club_has_access`; Stripe, checkout, prices; owner-only billing, address
and print approval (`owner_only` verified server side); two-adult access; permanent member colors; QR routes
`/app/calendar…`; `/club/*` URLs (now inside the app shell); cleaning icons; the four meeting part names; no
purchasing or Club selling in the iPhone app.

Verified on the test backend: free refused November; trial, active, partner, beta grant open it; canceled keeps
November read-only; partner refused the mailing address and shown no billing.

## 8. Prioritized implementation plan (after approval)

| # | Work | Size | Risk |
| --- | --- | --- | --- |
| 0 | Ship the shell already built (Club inside the app; journey test 62 web / 58 app checks) | done, PR pending | Low |
| 1 | Club Home year strip reads the kit registry | S | Low |
| 2 | My Family: show the profile (who does what, priorities) with edit links to the existing FamilySetup steps; free families may answer optionally | M | Low: existing functions, no migration |
| 3 | Weekly meeting for members reuses `family-meeting.ts` output inside the four parts; suggestions become agreements with `source` | M | Medium: must match the monthly page's output exactly (test both from one fixture) |
| 4 | Weekly check-in on commitments (`family-plan.ts` rules), stored as an agreement update, no new table | M | Medium: confirm storage fits `club_responsibilities` without a migration; if not, stop and ask |
| 5 | Website-only Club discovery line, personalized with her children's ages and stated challenge | S | Low |
| 6 | Club Home "what was prepared for your family and why" header from the month's snapshot (ages, priority) | S | Low |
| 7 | Month-to-month continuity on Club Home (last month's commitments) | M | Medium |

Tests for each: family e2e, Club journey (all six households, web + app, 393 / 1280), unit tests on the engine
fixture, axe, iOS simulator, screenshots.

## Decisions I need from you

1. **October 2027:** Sunday Reset (your list) or the Daily Reset now in the repository?
2. **Meeting part names:** keep Our Focus · Let's Talk · Everyone's Part · Let's Practice and map your five steps
   into them (recommended), or rename (changes printed guides and January's kit)?
3. **Free families answering the profile** (challenges, priority, who does what) in My Family: yes (recommended:
   better free meeting, shorter Club intake, personalized Club discovery) or Club-only as today?
4. **Club discovery stays website-only** and appears only after a first meeting (recommended; the iPhone app keeps
   never mentioning the Club to free families)?
5. **Audio coaching:** hide every mention until recordings exist (recommended)?
6. **Migration 20261202** (January and September titles in production): still awaiting your separate approval.
