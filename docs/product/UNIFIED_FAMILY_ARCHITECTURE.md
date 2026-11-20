# Organized Family + Family Meeting Club: unified architecture (Stage 1)

Status 2026-11-18: **approved in principle by the owner, with the decisions in §0.** Stage 2 is built on branch
`claude/unified-family-meeting` (stacked on `claude/club-integration`, the Club-inside-the-app shell). Nothing is merged,
deployed or applied to production. Production was only read.

**Product principle (owner, 2026-11-18): the Club is not a second meeting system or a separate resource portal. It is
the personalized guidance layer of Organized Family.**

**The one-line model.** Organized Family organizes the week. The Club personalizes how the family grows. The weekly
Family Meeting is where they meet: free families run it from their own week; Club families run it with their
month's prepared plan inside it.

---

## 0. Owner decisions (2026-11-18)

| # | Decision | What it means here |
| --- | --- | --- |
| 1 | **October 2027 is Our Family Sunday Reset.** | Audit in §6a. Not a rename: the Daily Reset generates different content. Prepared, not switched (§9, step 1c). |
| 2 | **Keep the four parts:** Our Focus · Let's Talk · Everyone's Part · Let's Practice. | The weekly meeting uses them unchanged; printed guides and kits stay compatible. |
| 3 | **Free families get profile questions progressively.** | Never the five-step intake up front. One question at a time, only where it changes what they see right then (§8). Club rules and data untouched. |
| 4 | **Club discovery and conversion on the website, after real value.** | iPhone app: members keep full access; no purchase prompts, no Club selling, pending a separate App Store compliance review. |
| 5 | **Hide audio until recordings exist.** | The `audio` field and player slot stay; nothing says "audio coaching" while no month has a file. |
| 6 | **Migration 20261202: prepare and verify only.** | Diff, effects, rollback, rehearsal and a verified backup in §10. Production execution waits for final approval. |

**Critical priority:** one weekly Family Meeting for everyone. Free: the four parts with basic guidance. Club: the same
meeting, carrying the family's personalized month (children's ages, the month's theme, their challenges and priority),
and what they agree is followed through in weeks 2–4 with the existing framework (on my own · needs reminders ·
struggling).

**Update 2026-11-20:** child skill development (MAWL stage per child per skill, history, one next step per child) now has its own additive design inside this meeting: [FAMILY_DEVELOPMENT_ENGINE.md](FAMILY_DEVELOPMENT_ENGINE.md). Agreements stay in `club_responsibilities`.

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

## 6. Approved monthly content

**Superseded by §13 (owner, 2026-11-18): the twelve monthly pages are the source of truth.** §6a and §6b below are kept
for the record; where they compare the pages with planning documents or the kit registry, the pages win.

## 6a. October: Daily Reset vs the approved Sunday Reset (decision 1; superseded, see §13)

Three different Octobers exist in the repository today:

| Where | What it is |
| --- | --- |
| Member page `/app/club/october` and `/club/resources/2027-10-…` | **Daily Reset** ("Less asking. More doing."): `OctoberDailyReset.astro`, `OctoberPlanMobile.astro`, engine `engines/daily-reset.ts`. A child-facing daily cleanup sheet: one area (whole home, bedroom, playroom, living room), one trigger ("Before Dinner"…), two or three cleanup jobs from `JOB_OPTIONS` with icons, a finish line; a parent back page. Moved here from September in Oct 2026. |
| Kit registry `2027-10-home-works-together.ts` and its mailer draft | **"A Home That Works Together" / Our Fall Home Reset**: a five-item fall checklist and a chore-chart tool (`tool: 'chore-chart'`), mailer `docs/club/mailers/2027-10-home-works-together.md` (draft, not printed). |
| Monthly meeting content `src/data/club/family-meeting.ts` (month 10) | "Daily home reset and shared spaces", resource "Our 5-Minute Reset": written for the Daily Reset. |
| Orphaned | **Sunday Reset**: engine `engines/sunday-reset.ts`, printable `SeptemberSundayReset.astro`, phone screen `SeptemberPlanMobile.astro`, artwork in `public/images/club/october/` (it was designed for October). Three fixed Sunday steps (Look ahead · Prepare early · Share the work), a weekly role per person by age, three fall jobs, a chosen Sunday moment ("Sunday after lunch"). Only reachable today through the legacy `/club/resources/2027-09-…` route. |

**The approved theme already exists as finished work: the Sunday Reset.** Aligning October means switching which
existing printable October uses, not writing a new one. Exactly what changes:

1. `/app/club/october`: render the Sunday Reset (printable, phone screen, desktop rail) instead of the Daily Reset.
2. `/club/resources/[slug]`: October → Sunday Reset; September stops rendering the Sunday Reset (see §6b).
3. Registry `2027-10-home-works-together.ts`: theme "Our Family Sunday Reset", the subtitle, action and tool from the
   Sunday Reset's own text (`DEFAULT_TAGLINE` "Look ahead. Get ready. Share the work.", `SUNDAY_STEPS`). **Slug
   unchanged** (entitlements, saved work and QR codes are keyed by it).
4. Meeting content month 10: theme and questions for the Sunday Reset, written from its existing text.
5. Mailer draft: rewritten from the Sunday Reset printable. **Copy needs your review** before it's final.
6. Production title `club_kits` October: "Our Family Sunday Reset" (part of the title migration in §10b).
7. Bring the Sunday Reset up to the shared personalization foundation it predates: ages for the kit's month through
   `personalize/family.ts` (it hard-codes January 2027), roles that respect the account-holder rule the same way.
   The fixed steps, artwork and layout stay.
8. The Daily Reset is kept in the code, unassigned (a good candidate for a later month or a free tool). Nothing deleted.

Risk: none for members (October 2027 is a draft; 0 holders, 0 saved versions in production, read 2026-11-18).

## 6b. What members actually open, month by month (superseded by §13)

Production `club_kits` read-only on 2026-11-18. "Member page" is what `memberPlanHref` opens.

| Month | Your list | Member page today | Registry theme | Production title | Action |
| --- | --- | --- | --- | --- | --- |
| Nov 26 | Our Family, Our Team | Ownership plan | Our Family, Our Team | Our Family, Our Team | — |
| Dec 26 | Give to Others | Christmas Kindness Mission | Your Christmas Mission Has Arrived! | Your Christmas Mission | Wording only: **you choose the title** |
| Jan 27 | Family Meeting Introduction | Meeting guide (four parts) | Our First Family Meeting | **A Fresh Start, Together** (scheduled, 12 holders) | 20261202 |
| Feb 27 | Family Connection | **Laundry guides** | Better Together (Connection Challenge) | Better Together | **Substance mismatch: decide** (connection cards exist on the legacy route only) |
| Mar 27 | Spring Clean as a Team | **Our Family Rhythm first**, Spring Prep as second tab | Our Family Spring Prep | Spring Clean as a Team | **Decide** which leads |
| Apr 27 | Dinner Team | Dinner Team | Everybody Helps at Mealtime | Everybody Helps at Mealtime | Wording only |
| May 27 | Our Family Summer Rhythm | Summer Day | Our Family Summer Rhythm | **Finish the School Year Well** | Title fix |
| Jun 27 | I Can Make My Own Snack | Snack Station | My Family's Snack Station | **Summer With a Plan** | Title fix |
| Jul 27 | I'm Bored! What Can I Do? | Activity board | What Can I Do Right Now? | **Ready to Go** | Title fix |
| Aug 27 | Back to School | School routines | My School Day | Ready for the School Year | Wording only |
| Sep 27 | Habit Cards | Habit Cards | Our Family Habit Cards | **A Week Everyone Can See** | 20261202 |
| Oct 27 | Our Family Sunday Reset | **Daily Reset** | A Home That Works Together | A Home That Works Together | §6a |

Also wrong today, fixed in step 1 (no production change):
- Club Home's year strip (`AppKitLibrary.tsx`) is a hard-coded list of old titles. It will read the registry.
- The legacy route `/club/resources/<slug>` renders stale printables for January (Habit Cards) and September (Sunday
  Reset); members are no longer sent there, but old emails and bookmarks are. It will send every month except
  November to the member page, keeping the link working.
- `docs/editorial/SEASONAL_ACQUISITION_PLAN.md` still lists January 2027 as Habit Cards.

**Title rule I recommend:** production `club_kits.title` = the registry `theme` (what the kit itself says), set by
guarded migrations that touch a row only while it still carries the old seed title. You approve the exact title per
month in the table above before any second title migration is written.

## 7. Follow-through (decision: check-ins in weeks 2–4)

**What exists** (`src/lib/club/family-plan.ts`, never wired): `Commitment` (only from the family's own choice, with
`progress`), `CheckInAnswer` = `on-own` · `reminders` · `struggling` · `moved-on`, an optional barrier after
struggling (`forgets`, `too-hard`, `not-set-up`, `not-interested`, `schedule`, `other`) mapped to one habit principle
(`BARRIER_PRINCIPLE`), `nextStep()` (celebrate · continue · adjust · retire) and `checkInDue()` (every 6 weeks).

**What the family already makes:** agreements ("We agreed"), stored as `confirmed` rows in `club_responsibilities`,
shared by both adults, synced offline with revisions. These are the commitments. There is **no column for a check-in**.

**Design (reuses the rules, adds storage only):**
- Each agreement gets `progress` (`practicing` · `improving` · `independent` · `struggling`), `last_checked_on`, and
  `barrier`. One new migration (`20261204000000_agreement_follow_through.sql`) adds the three nullable columns and one
  function, `household_agreement_check_in(p_id, p_answer, p_barrier, p_base)`, with the same household, revision and
  two-adult rules as `household_agreement_save`. No existing row changes; old clients ignore the fields.
- **Cadence:** weekly instead of six-weekly, for agreements 7+ days old not yet checked this week, stopping once one
  is `independent` twice in a row or retired. `checkInDue` gains a `days` argument; the 42-day default stays for any
  other caller.
- **In the meeting:** Let's Talk opens with "How did it go?" for each due agreement: three answers on screen
  (On my own · Needs reminders · Struggling). Struggling asks the optional barrier and shows the one adjustment from
  `nextStep()`. "We're done with this" is the existing remove. On my own is celebrated as progress ("Mia did it on their own"); it is evidence, not a Launch decision (owner review of PR 515).
- **Through the week:** Today and Family show each agreement's progress dot, and Club Home's "what's next" uses it.
- **Needs your approval to apply.** Until applied, the meeting hides check-ins (the function is absent) and
  everything else works.

## 8. Progressive profiling for free families (decision 3)

Same tables and functions as the Club intake (`club_activities_save`, `club_responsibilities_save`,
`club_focus_save`; none requires a membership). One question, at the moment it pays off, never a wizard:

| Moment | Question (existing step) | Immediate value |
| --- | --- | --- |
| After the first meeting's Everyone's Part | "What's hardest to share at home?" (challenges) | Next week's Let's Talk asks about it |
| My Family, members added | "Who already does what?" (responsibilities, existing) | My Family shows it; the meeting stops suggesting what's already owned |
| Second meeting | "The one thing you'd love to stop managing alone?" (priority) | Our Focus names it |

Each answer marks its step in `setup_done`, so the Club intake later skips it (existing rule, `nextOpenStep`). Club
members' answers and rules are untouched.

## 9. Implementation sequence and acceptance criteria (Stage 2)

| Step | Work | Acceptance criteria |
| --- | --- | --- |
| **1a** Titles in the app | Club Home year strip reads the kit registry; legacy `/club/resources/<slug>` sends non-November months to the member page | Every month name on Club Home equals the registry theme (unit test over all 12); `/club/resources/2027-01-…` lands on `/app/club/january` signed in or out; November's route unchanged; QR and email links still open |
| **1b** Migration 20261202 | Prepared, rehearsed, backed up (§10) | Rehearsal on a production-shaped copy changes exactly 2 rows, is idempotent, leaves admin-edited titles, entitlements and saved versions unchanged; rollback rehearsed; verified backup ID recorded |
| **1c** October | Sunday Reset switch per §6a, steps 1–4, 7; mailer copy drafted for review | `/app/club/october` shows the Sunday Reset on phone and desktop; prints two sheets; personalization by kit-month ages; Daily Reset still builds; snapshot tests updated deliberately |
| **2** One weekly meeting | `/app/family/meeting` is the meeting for everyone; the monthly page's meeting view links to it for the week; four part names unchanged | Free: week ahead, agreements, four parts, "We agreed" works as before (family e2e passes). No second meeting component: both pages render from one module |
| **3** Club personalization in the meeting | For members, the weekly page shows `buildFamilyMeeting()` output for the current month (focus, prepared questions, age-fit suggestions, practice step, link to the month's resource) | Same family + month gives identical focus, questions and suggestions on the weekly and monthly pages (test from one fixture); a free household never receives month content (server: `club_resource_get` refused; UI shows none); partner sees the same as the owner |
| **4** Follow-through | Migration 20261204 written and tested locally; check-ins in Let's Talk; progress on Today/Family | Rolled-back SQL test: both adults can check in, outsiders refused, revisions enforced; UI: due rules (7 days, weekly), three answers, barrier → one adjustment; hidden cleanly when the function is absent |
| **5** Club dashboard and navigation | Club Home leads with "Prepared for your family" (ages, theme, priority it used: the engine's `used`), this week's meeting and follow-through; audio mentions hidden | Club Home shows what was prepared and why without the year strip first; no "audio" text anywhere while no month has a file; app and website identical |
| **6** Progressive profiling | The three moments in §8 for free families, website and app | One question per moment, skippable, saved to the existing functions, `setup_done` marked; a later Club intake skips answered steps (e2e) |
| **Throughout** | Tests and screenshots | Unit tests, family e2e (web + app), Club journey (free, trial + second adult, active, canceled, beta grant; 393 and 1280), axe, app-shell smoke, iOS simulator on CI; rendered screenshots of every changed screen |

Out of scope without separate approval: applying any migration, production title changes, February and March content,
the October mailer's final copy, any App Store-facing purchase change.

## 10. Migration 20261202: preparation package (decision 6: prepared, NOT executed)

**Exact change** (`supabase/migrations/20261202000000_club_kit_titles_january_september.sql`, unchanged since it was
written on 2026-11-16):

```sql
begin;
update public.club_kits set title = 'Our First Family Meeting'
 where slug = '2027-01-fresh-start-together' and title in ('A Fresh Start, Together', 'A Week Everyone Can See');
update public.club_kits set title = 'Our Family Habit Cards'
 where slug = '2027-09-a-week-everyone-can-see' and title = 'A Week Everyone Can See';
commit;
```

**Expected effect in production** (read-only, 2026-11-18): exactly two rows of `club_kits`.

| Slug | Before | After | Status | Holders / saved |
| --- | --- | --- | --- | --- |
| 2027-01-fresh-start-together | A Fresh Start, Together | Our First Family Meeting | scheduled (unchanged) | 12 / 2 (unchanged) |
| 2027-09-a-week-everyone-can-see | A Week Everyone Can See | Our Family Habit Cards | draft (unchanged) | 0 / 0 |

Where members see it: `club_me` month titles (Club Home, Monthly resources, membership tile), the admin kit list,
the fulfillment queue and Club emails. Slugs, release dates, cutoffs, entitlements, saved work, orders and QR codes
are untouched. A title an admin already changed by hand is never overwritten.

**Rollback:** `supabase/rollout/kit-titles/rollback-20261202.sql` puts back the two seed titles, only on a row still
carrying the new title. **Preflight / post-check:** `supabase/rollout/kit-titles/preflight.sql` (read-only; titles,
statuses, holders and saved versions per kit) run before and after; the only difference must be the two titles.

**Rehearsal** (`scripts/rehearse-kit-titles.sh`, throwaway database with production's exact migration set, production's
kit titles and statuses, 12 January holders with 2 saved versions), 2026-11-18:

```
ok - migration applies
ok - exactly 2 kit rows changed
ok - January stays scheduled (status, release and cutoff untouched)
ok - member data unchanged (households, members, orders, entitlements, versions, subscriptions, addresses, emails)
ok - applying again changes nothing
ok - an admin-edited title is left alone by the migration
ok - and by the rollback
ok - rollback restores every title exactly
ok - member data unchanged after rollback
ok - applies again after a rollback
rehearsal passed
```

**Verified backup:** `backups/20261118T062538Z` (Database backup run 20, 2026-11-18 06:25 UTC): encrypted, downloaded
back, restored into a throwaway Supabase, "104 tables and 989 rows restored exactly; structure identical to the
source". Take one more right before execution.

**To execute (needs your final go):** fresh backup → preflight → apply the migration → preflight again (diff = the two
titles) → record it in `docs/ios/MIGRATION_DEPLOYMENT_PLAN.md`.

## 12. Stage 2 status (2026-11-18, branch `claude/unified-family-meeting`)

| Step | Status |
| --- | --- |
| 1a Titles in the app | **Done.** Club Home's year strip and Monthly resources read the resource registry (`tests/club-month-names.test.ts`). Old `/club/resources/<slug>` links forward to the member page, keeping the query, **except January 2027**: both families who saved January work saved Habit Cards on that old copy (production, keys read only), so forwarding would hide it. **Decide:** carry that work over, or leave January's old page as is |
| 1b Migration 20261202 | **Prepared** (§10). Not executed |
| 1c October | **Audited, not switched.** The Sunday Reset printable has since been relabelled as a January "Our Family Weekly Meeting" sheet (`SeptemberSundayReset.astro`: "FAMILY MEETING CLUB · JANUARY 2027", "Our Family Weekly Meeting", 17 mentions; its phone screen likewise). Making it October's means rewriting printed copy (kicker, title, intro, editor labels, "why this matters"), the registry entry, month 10's meeting content and the mailer. That's a change to a printable's words, so it waits for your copy approval. Nothing for members changes before October 2027 |
| 2 One weekly meeting | **Done.** `/app/family/meeting` is the meeting for everyone; Family's Club tile and Club Home's button open it; the month's page keeps its printable meeting sheet |
| 3 Club personalization | **Done.** Members' weekly meeting shows the month's focus, its prepared questions, one age-fit suggestion per person ("We agreed" saves it with the month's source key) and the practice step with the month's resource. Same engine call as the month's page (test) |
| 4 Follow-through | **Done in the app; migration `20261204000000_agreement_follow_through.sql` prepared, not applied.** Leaves every existing function exactly as in production (a client echoing the old read shape keeps working); adds three nullable columns and two functions. 21 SQL checks, also on production's exact migration set. Until applied, the check-ins simply don't show |
| 5 Club Home | **Done.** "Prepared for your family from" (children with ages this month, the month's theme, her priority and challenges, from the engine); "Start this week's meeting"; `/app/coaching` no longer says "Audio coaching coming soon" (12 months, 0 recordings): it shows only months that have a file and otherwise goes to Club Home |
| 6 Progressive profiling | **Done for the meeting:** after a meeting with agreements, a free family gets one optional question (challenges, then priority), saved with the Club intake's own function, marking its step; next meeting uses it. **Not built:** the third moment ("who already does what" in My Family) |

**New words for your review** (short, in the app only, no printed copy): the free meeting's Our Focus and Let's Talk
guidance, the Club Let's Talk line ("Ask this month's questions below…"), the follow-through answers and the six
"Try this week" adjustments, the profile question's two prompts.

**Tests:** unit 1224 passed; Club journey 95 checks (website) and 91 (iPhone app bundle): free, trial with a second
adult, active returning, canceled with kept months, beta grant, phone and desktop, including the weekly meeting,
follow-through for both adults, suggestions becoming agreements and the free profile question, all checked in the
database; family e2e (website and app); household SQL suite (all, plus the new 21); app-shell smoke.

## 11. Preservation plan: must not change

Kit definitions and engines; `personalize/` rules and snapshots; month pages, printables, previews (`?thumb=1`),
fulfillment views (`?fulfillment=`, bare); approval and cutoff (`club_resource_versions`, mailings,
`deadline.ts`); entitlements, `club_me`, `club_has_access`; Stripe, checkout, prices; owner-only billing, address
and print approval (`owner_only` verified server side); two-adult access; permanent member colors; QR routes
`/app/calendar…`; `/club/*` URLs (now inside the app shell); cleaning icons; the four meeting part names; no
purchasing or Club selling in the iPhone app.

Verified on the test backend: free refused November; trial, active, partner, beta grant open it; canceled keeps
November read-only; partner refused the mailing address and shown no billing.

## 13. The monthly pages are the source of truth (owner, 2026-11-18)

"All 12 monthly Family Meeting Club pages are already correct": `/app/club/january` … `/app/club/december` are the
approved themes, resources and content. Everything around them follows them; nothing here rewrites or regenerates a
kit, a generator, a printable or saved work.

### 13a. Inventory of the twelve pages (read from the page files)

| Month | Page | Heading the page opens with | Resources the page offers (generator / printable) | Saves under |
| --- | --- | --- | --- | --- |
| Jan | `/app/club/january` | Our Family Focus | The family's one-page focus, habit ideas, four Words of the Week (`MeetingGuidePrintable`, `MeetingGuideMobile`; the page is also the month's meeting) | `omc:club:january-family-meeting:v1` |
| Feb | `/app/club/february` | My Laundry, My Job. | A picture laundry guide per child by age, laundry days, machine operator (`FebruaryLaundryGuides`, `FebruaryPlanMobile`) | `omc:club:february-laundry-app:v1` |
| Mar | `/app/club/march` + `/app/club/march/spring-prep` | Our Family Rhythm · Our Family Spring Prep | Whole-family rhythm chart: two daily moments, everyone's part (`MarchFamilyRhythm`); Spring Prep jobs with owners (`MarchSpringPrep`), as a second tab | `omc:club:march-chore-charts:v2`; Spring Prep `omc:club:march-mobile:v1` |
| Apr | `/app/club/april` | Tonight, we've got dinner. | One prepared dinner plus a reusable four-role Dinner Team (`AprilDinnerPlan`) | `omc:club:april-app:v1` |
| May | `/app/club/may` | Our Summer Day | Picture-led summer rhythm (`MaySummerRhythm`) | `omc:club:may-app:v1` |
| Jun | `/app/club/june` | The snacks are handled. By the kids. | Snack station (`JuneSnackStation`) | `omc:club:june-app:v1` |
| Jul | `/app/club/july` | I'm Bored! What Can I Do? | Activity board (`JulyActivityBoard`) | `omc:club:july-app:v1` |
| Aug | `/app/club/august` | Back to School Without the Scramble | Back-to-school plan, Morning and After-School routines (`AugustSchoolRoutines`) | `omc:club:august-app:v1` |
| Sep | `/app/club/september` | Our Family Habit Cards | Habit cards (`JanuaryHabitCards`, the component's legacy name) | `omc:preview:september-habit-cards:v3` |
| Oct | `/app/club/october` | Less asking. More doing. | Daily Reset: one cue, picture jobs, a finish line, parent back page (`OctoberDailyReset`) | `omc:club:october-daily-reset:v1` |
| Nov | `/app/club/november` | Our Family Meeting (the page is the meeting) | Our Family Ownership Plan at `/club/resources/2026-11-family-ownership` (`NovemberOwnershipPrintable`) | the resource route's member key |
| Dec | `/app/club/december` | Your Christmas Mission Has Arrived! | One kindness mission and two Christmas cards (`DecemberMissionPrototype`) | `omc:club:december-app:v1` |

Not a monthly page: `/app/club/march/spring-clean` ("Spring Clean as a Team", marked IN REVIEW, browser tab only,
unlinked). Left as is.

### 13b. What changed (infrastructure only)

- **`src/data/club/month-pages.ts`**: one record per page (route, the name it opens with, its resources, two plain
  lines). `tests/club-month-pages.test.ts` reads each page's own source and fails if a name drifts.
- **Named from the pages:** Club Home's month card and year strip, Monthly resources, the membership tile's "next
  month", the Welcome Kit item names, Today's and Family's Club tiles, the weekly meeting's resource buttons and
  "Prepared for your family", the admin and fulfillment screens (the resource registry's `title` now comes from the
  pages: `src/data/club/resources.ts`), and the hidden audio page's month list.
- **March:** Family's Club tile and the weekly meeting offer both resources (Family Rhythm, Spring Prep). Spring Prep
  now has the app's Club bar and March's accent, like the March page (chrome only).
- **Navigation verified:** all twelve pages and Spring Prep open inside the app with the header, the four tabs and
  the Club bar, on the website and in the iPhone app bundle (Club journey).
- **Reverted from my earlier plan:** the October Sunday Reset switch is dropped (the October page is the Daily Reset),
  and the year strip no longer uses the resource registry's older names.

**Unchanged:** every page, generator, printable, storage key and saved version; the kit registry
(`src/data/club/kits/*.ts`) and the monthly meeting content (`src/data/club/family-meeting.ts`), because both are
printed (below); production data.

### 13c. Saved member work (production, read-only, 2026-11-18)

| Month | Saved versions | Storage keys in them | Conflict |
| --- | --- | --- | --- |
| January 2027 | 2 households | Household A: the current January page's key + the old `/club/resources` copy's key. Household B: `omc:club:january-weekly-meeting:v1` (a retired January "Weekly Meeting" tool) + the old copy's key | **Household B has no work on the current January page.** Its saved work is on two retired January tools. Nothing in this change touches it; the old January resource link stays unforwarded so it remains reachable |
| Every other month | 0 | — | None |

Fulfillment: 5 pending and 1 skipped January monthly orders print `/app/club/january` (unchanged; admin already calls
it "Our Family Focus"); 6 Welcome prints. Entitlements: 12, all January. No change affects any of them.

### 13d. Conflicts that need your decision

1. **October:** your earlier decision named "Our Family Sunday Reset"; the October page is the Daily Reset ("Less
   asking. More doing."). Under today's rule the page wins, so everything now follows the Daily Reset and the Sunday
   Reset switch is dropped. Confirm.
2. **Printed text that names a month differently from its page** (not changed, because it's printed):
   - The monthly meeting sheet says "Introducing {resource}" from `family-meeting.ts`: July "What Can I Do Right Now?
     Activity Board" (page: I'm Bored! What Can I Do?), October "Our 5-Minute Reset" (page: Less asking. More doing.),
     August "My School Day Routines", January "Our Family Weekly Meeting" (January has no separate meeting sheet).
   - The kit registry's `theme` prints on the mailer letter printables (`LetterPrintables`, all mailers still drafts)
     and the older kit editor's chart footer: February "Better Together", March "Our Family Spring Prep", October "A
     Home That Works Together" (with a chore-chart tool and its draft mailer), July "What Can I Do Right Now?", April
     "Everybody Helps at Mealtime". Members don't see these today (below), but a mailer printed from them would.
   Choose: align those printed names (and the October and February mailer drafts) to the pages, or leave them.
3. **Migration 20261202** would set January's production title to "Our First Family Meeting", which the page doesn't
   use. Production titles no longer reach members on screen (the app names months from the pages; Club emails use
   only the month), so I recommend **holding it**, or replacing it with page names if the admin's raw kit list matters
   to you.
4. **January Household B** (13c): leave its work on the retired tools, or carry it into the current January page
   (that would change saved member data, so it needs your go).

Checked and fine: the mailed QR codes open `/club/kits/<slug>`, which already sends a member with access straight on
to the month's page (every month except November, whose tool that page is). Only its browser-tab title used the kit
theme; it now uses the page's name.

## 14. Owner decisions (2026-11-18, second round) and the member experience review

**Decisions:** (1) October stays the Daily Reset. (2) Printed titles and mailer wording are aligned only where it
helps, from exact before/after wording you approve first: `docs/product/PRINTED_WORDING_PROPOSAL.md` (nothing printed
has changed). (3) Migration 20261202 is held; apply only for a specific functional need. (4) Both January families'
saved work is preserved, including work on retired tools; legacy access keeps working; nothing is migrated or deleted.

**January legacy access (decision 4).** Production keys only, read 2026-11-18: one family has Habit Cards (old copy) and
the current January page; the other has Habit Cards and the retired January Weekly Meeting (`omc:club:january-weekly-meeting:v1`),
which no page read anymore. Now:
- `/club/resources/2027-01-fresh-start-together?earlier` shows "Saved earlier" with both tools, whichever the family
  saved (from the saved version's own keys), never bounces them to the Welcome Kit and never offers print approval.
  The retired Weekly Meeting opens read-only: it reads its key and nothing it does is written back.
- The January page links to it whenever earlier work exists ("Open the copy you saved earlier"), not only until the
  family saves on the current tool (`EARLIER_KEYS`, `src/lib/club/plan/account.ts`).
- The Club journey checks both, and that the saved value is byte-for-byte unchanged after viewing.

**Member journey, tested end to end** (Club journey, phone size): Today → Family → the weekly Family Meeting (this
month's plan inside it) → the month's personalized resource (inside the app, Club bar) → back in one step → "We
agreed" (saved for the household) → a week later, Let's Talk asks how it went → On my own (celebrated) → Family's
Who does what.

**Mobile review: what was wrong and what changed**

| Found | Change |
| --- | --- |
| Today's meeting link opened the month's printable meeting sheet; Family's opened the weekly meeting: two "meetings" | Both open the weekly meeting |
| Family had two buttons into the same meeting (the meeting tile and the Club tile) | The Club tile opens the month and its resources only |
| November's tool page, January's earlier plans and the Family Vision print used the public layout: no app header or tabs on the website | They use the Club layout like every other `/club` page: app header, four tabs, Club bar; bare for `?fulfillment`, chrome hidden in `?thumb` previews |
| "← Your months" on those pages went to the billing dashboard and repeated the Club bar | Removed; "See your months" goes to Monthly resources |
| Club Home asked to finish the family profile twice (month card and footer) and linked the Family Rhythm and Meeting Guide twice | Asked once (on the month card); footer keeps only what isn't above |
| "Prepared for your family" repeated the month's name right under it | Shows what the month builds instead |

**Left as is, on purpose:** Today's "Who's doing what" and Family's "Who does what" (a summary and the full list); the
four meeting parts shown on Today and Family (a preview of the meeting); the Getting started checklist (a done step
links to the meeting, as a checklist should).

## 15. November editions (2026 and 2027)

Owner, 2026-11-18: "The November resource must support the correct year … do not hard-code either year." Narrow fix:
`NovemberOwnershipPrintable` takes the kit period (`kitMonth`) from its page and prints "NOVEMBER {year}" on its three
headers and works out every child's age for that November (same age rule as before). `/club/resources/<slug>` passes
the resource's month; November 2027 is a second entry in `src/data/club/resources.ts`, so it has its own member route,
saved version (per kit) and orders. Nobody held November 2026 or had saved it in production (read-only, 2026-11-18),
so no saved work or order was affected. Details and test evidence: `PRINTED_WORDING_PROPOSAL.md` §C.

**Before November 2027 goes live (checklist; owner, 2026-11-18):**
1. Add the November 2027 kit to `src/data/club/kits/` (production already has the row, draft) with its mailer; this
   also builds its QR page `/club/kits/2027-11-family-ownership`.
2. `/app/club/november`: choose the edition from the member's held November kit (2026 or 2027) so its meeting works
   out ages for that November, like the printable. `tests/club-month-names.test.ts` fails as soon as step 1 is done
   until this is.
3. Repeat the November checks in the Club journey for the meeting page (ages, header year) and the print views.

**Still to decide or do (not in this fix):**
- `/app/club/november` (the November meeting page) is built for the November 2026 kit, so in November 2027 its
  meeting would use 2026 ages. Fix when November 2027 is scheduled: choose the edition from the member's held
  November kit (same idea as the printable). Not urgent before autumn 2027.
- The kit registry (`src/data/club/kits/`) has no November 2027 kit yet (production has the row, draft), so its mailer
  QR page `/club/kits/2027-11-family-ownership` isn't built. Add it with that mailer.

## 16. What viewing, saving, printing and downloading write (existing behavior, documented 2026-11-18, unchanged)

Read from the current definitions (`club_resource_save` in `20261108000000_club_welcome_kit.sql`, `club_resource_get`
and `club_admin_fulfillment_bundle` in `20261104000000_club_membership.sql`) and confirmed in the Club journey:

| Action | Writes |
| --- | --- |
| Opening a monthly resource for the first time | `club_resource_save` creates the household's saved version (revision 1) and, for that month's **pending or on-hold** monthly order only, sets `member_approved_at = null`, `pdf_status = 'not_ready'`, `updated_at = now()`. Status never changes. |
| Opening it again (nothing changed) | The page writes back what it loaded; the function returns early ("the same state changes nothing, and keeps her approval"). No version, order or `updated_at` change (verified: same hash and revision). |
| Editing | New revision; the version's `approved_at` and the pending/on-hold order's member approval are cleared, `updated_at` bumped (she approves again). |
| Any save once the month's order is printed or mailed (or approved inside a Welcome Kit) | Refused (`already_printed`): historical orders and what printed can't change. |
| Admin print view (`?fulfillment=`) | Nothing (`club_admin_fulfillment_bundle` only reads; verified: both November orders byte-identical before and after). |
| Print / Save PDF / Download PNG | Nothing on the server; done in the browser. |
| Viewing a retired tool's saved work (January `?earlier`) | Nothing for the retired key (it is never written back; verified byte-identical). |
| Billing, subscriptions, entitlements | Never written by any of the above. |

**Correction (2026-11-18):** an earlier version of this section said a second adult couldn't save monthly resources.
That was wrong: it read the older definition in `20261108`. Production's `club_resource_save`, `club_resource_get` and
`club_document_save` were patched by `20261128_household_club_access` (applied 2026-11-17) to act on the household's
membership (`household_billing_user`), so **both adults edit and save the household's one shared copy**; print approval
(`club_fulfillment_approve`) and the mailing address stay owner-only. Confirmed read-only in production (function
definitions), by `supabase/tests/household-club-access.sql` ("partner edits the household's copy", "partner can't
approve"), and in the browser by the Club journey (the second adult's edit saves, revision +1, the owner's saved work
kept). **No database change is needed.**
