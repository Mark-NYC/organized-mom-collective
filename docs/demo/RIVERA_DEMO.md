# The Rivera demo family

A private, fully used Organized Family household you can sign in to and explore like a real family would use it, with
complimentary Family Meeting Club. It's built entirely with the app's own database functions, so everything you change
is a real change. **Reset Rivera Demo** puts it back.

- Migration: `supabase/migrations/20261209000000_demo_rivera.sql` (**not applied to production**).
- Admin control: `/admin/club` → **Club access** → **Rivera demo family** (owner admins only).
- Tests: `supabase/tests/demo-rivera.sql`, `scripts/e2e/rivera-demo-e2e.mjs`, `tests/rivera-demo.test.ts`.
- Rollout files: `supabase/rollout/demo-rivera/{preflight,verify,rollback}.sql`.

The public marketing previews (`?sample=rivera` on Club pages) are unchanged. They run in the browser only and never
touch an account. The private demo is a separate, signed-in household.

## 1. The family

This is the Rivera family that already exists in `src/data/club/samples.ts`. I didn't create a second version of it.

| Person | Age | Color | Role |
| --- | --- | --- | --- |
| Ana | adult | pink | Account holder (the household owner) |
| Luis | adult | orange | Second adult (joined through the real invitation) |
| Sofia | 10 (March 2016) | blue | School, soccer |
| Mateo | 7 (June 2019) | green | School, swim lessons |
| Elena | 4 (February 2022) | purple | Preschool |

The family has a dog, Coco. Colors are the household's permanent colors, assigned by the database on the first save.

**Their story, from the family profile (every setup step completed):**
- **Challenges:** morning and evening routines, remembering who does what, and sharing the housework fairly. In their own words: "Mornings are rushed, the house gets cluttered, and the kids need reminding for everything."
- **Priority:** the morning rush. Their note: "Calmer mornings, and more time together on weekends."
- **Household priorities:** smoother mornings, kids doing more on their own, and more time together.
- **Typical week:** school Monday to Friday (Sofia, Mateo), preschool Monday, Wednesday and Friday (Elena), soccer Tuesday, Thursday and Saturday (Sofia), swim lessons Wednesday (Mateo), and work for both parents.
- **Who does what today:** meals (Ana and Luis, Sofia helps), driving (Luis), laundry (Ana, Sofia helps), cleaning (Ana and Luis, kids help) and Coco (Sofia, Mateo helps).
- **Hopes:** Sofia putting her laundry away, Mateo packing his school bag, and Elena owning part of her morning routine.

## 2. What's in it, and where to see it

| Capability | Where | What you'll see | Populated | Verified |
| --- | --- | --- | --- | --- |
| Today | `/app` | Today's plans, the week's Family Meeting preview, Club card, Everyone's Part with each person's agreements | ✅ | ✅ 393 / 430 / desktop / app bundle |
| Calendar | `/app/family-calendar` (Week, Month, Agenda) | 9 weekly plans (school, preschool, soccer practice and games, swim, library day, trash night, Family Meeting, Saturday pancakes). 9 one-offs around today (permission slip, dentist, birthday party, picture day, dinner at Abuela's, science project, conference, well visit, and a past pumpkin patch) | ✅ | ✅ |
| Cleaning | `/app/cleaning` | Today's Daily Reset 2 of 5 done; two weeks of history, including each day's zone; this month's home project started; the family's cleaning agreements; shared between both adults | ✅ | ✅ change on Ana's phone shows on Luis's |
| Family and responsibilities | `/app/family` | All five people with colors, plus 13 agreements, each with a cue and a finish line | ✅ | ✅ |
| Weekly Family Meeting (Club) | `/app/family/meeting` | All four parts. Everyone's Part opens with "One next step each": a Watch check-in for Sofia, an Assist check-in for Mateo, and a new suggestion for Elena | ✅ | ✅ |
| MAWL | Meeting → Everyone's Part | **Model:** Mateo, Clear my dishes. **Assist:** Mateo, Unpack my backpack. **Watch:** Sofia, Unload the dishwasher. **Launch:** Sofia, Pack my backpack, and Elena, Put toys away. Also a step back, a new cue, an edited finish line, and a paused skill (Elena's hamper) | ✅ | ✅ moved one stage, explicitly, from the page |
| Habits and cues | Agreements and skills | After breakfast; Before leaving for school; When we get home; After dinner; Before bedtime. Each with a finish line | ✅ | ✅ |
| Club access | Club Home `/app/club` | Complimentary Club through the 20261208 grant, for both adults | ✅ | ✅ website and app bundle |
| Monthly Club resources | `/app/club/<month>` | Open only for **released** kits. Production has none released today (see section 6) | n/a in production | ✅ on the test database with November released |
| Welcome Family Rhythm | Club Home | Opens for Ana (owner with a grant). It's built from the family profile, and no saved edits are seeded | ✅ (profile-driven) | partly: access checked, not every page |
| Family Vision print | – | Not available. It exists only as a paid welcome order (fulfillment) | ❌ by design | – |
| Second adult | Sign in as Luis | Same family, calendar, cleaning, meeting and Club. No owner-only actions (address, billing) | ✅ | ✅ SQL and browser |
| Admin | `/admin/club` → Club access | Status, install, **Reset Rivera Demo**, and the grant in the access search | ✅ | ✅ |

### A walkthrough (about 15 minutes)

1. Sign in as Ana on your phone. **Today** shows today's plans and who's doing what this week.
2. **Calendar** → Agenda: next week's dentist, birthday party and picture day. Add a plan, then see it on Luis's phone.
3. **Cleaning:** two Daily Reset tasks are done. Check another, then open Cleaning as Luis: it's there.
4. **Family** → each person's agreements, with when it happens and what "finished" looks like. Edit one.
5. **Family** → **Our Family Meeting**:
   - **Our Focus**, then **Let's Talk**.
   - **Everyone's Part:** Sofia's Watch check-in ("Change how we're practicing" → "Hand over responsibility"), Mateo's Assist check-in, and Elena's suggested next skill ("Add to our plan" or "Customize" the cue).
   - **Let's Practice.**
6. **Edit routine** or **Pause this responsibility** on any card, then watch the agreement follow.
7. **Club Home** and the current month (when a kit is released).
8. Sign in as Luis on a second device: the same family, and every change you made.
9. When you're done: Admin → Club access → **Reset Rivera Demo**.

## 3. Access (owner setup, once per environment)

Sign-in is the app's normal password sign-in, the same option App Review uses. It isn't a backdoor. No password is in
the repository.

1. Supabase dashboard → **Authentication** → **Add user** → **Create new user**. Create two users, each with a strong
   generated password from your password manager, with **Auto Confirm User** on:
   - `rivera-ana@example.com` (Ana)
   - `rivera-luis@example.com` (Luis)

   `example.com` is a reserved domain that never receives mail, so nothing can be sent to these accounts. The demo
   refuses any other domain. You can choose other `@example.com` addresses.
2. Owner admin: `/admin/club` → **Club access** → **Rivera demo family**. Enter both emails → **Install the Rivera demo** → confirm.
3. Open the demo:
   - **Desktop or iPhone web:** `https://www.organizedmomcollective.com/app/sign-in` → "Have a password? Sign in with it".
   - **iPhone app** (TestFlight or App Store): first screen → "Have a password? Sign in with it".
   - Keep the passwords in your password manager. Anyone with them can see the demo. Nobody else can: it's an ordinary private household, protected by the same row-level security as every family.

## 4. Reset

**Where:** `/admin/club` → **Club access** → **Rivera demo family** → **Reset Rivera Demo** (with a confirmation).

**What it restores:** the whole Rivera household. That covers the people, colors, profile, invitation, calendar,
agreements, cleaning marks and development records with their history, dated around the day you reset (weekly plans
keep repeating either way).

**What it keeps:** the two sign-ins (accounts and passwords), the complimentary grant, and the audit log. Every reset
is recorded as `demo.rivera.reset` with who and when.

**Afterwards:** sign out and back in on any device that had Rivera open. Phones keep cleaning checkmarks and a few
caches locally, as they do for every family.

**Guarantees (tested):**
- **Owner admins only.** Families, helper admins and anonymous callers are refused.
- **Clean demo accounts only.** It refuses an account that isn't `@example.com`, or that has a subscription, invoice, Club month, mailing or another family.
- **Only the registered demo household is deleted.** Other households are byte-for-byte unchanged.
- **Idempotent.** Resetting twice gives the identical family, with no duplicates.
- **No side effects.** No subscription, invoice, entitlement, fulfillment, email, marketing, calendar-feed, Google or shop row is ever written, and production's email and marketing triggers sit on tables the seed never touches.

## 5. How it's built

`demo_rivera_reset` (owner only) calls `demo_rivera_seed`. The seed runs **as Ana or Luis** (their user id as
`auth.uid()`), using the same database functions their phones call:

| Step | Function |
| --- | --- |
| Family | `household_save` |
| Profile (all 5 steps) | `club_activities_save`, `club_responsibilities_save` (existing, desired), `club_focus_save`, `club_meeting_guide_mark` |
| Luis joins | `household_invite_create` (Ana), `household_invite_accept` (Luis) |
| Club | `club_admin_access_grant`, as the owner admin running the reset (20261208, audited) |
| Calendar | `calendar_event_save` (weekly recurrence for regular plans) |
| Agreements | `household_agreement_save` |
| Development | `household_development_decide`. Every start, advance, step back, modify and pause is a real decision, so stages, agreements and history agree exactly as in the app |
| Cleaning | `cleaning_marks_push` |

The one thing a phone can't do is make history weeks old. After each real decision, the seed moves that Rivera row's
**display dates** back: development event times, the record's start and last check-in date, agreement dates and
cleaning mark dates. Sync cursors (`updated_at`, revisions) are never changed, so phones pick up a reset normally.
Seeded rows use fixed ids, so a reset recreates the same rows.

Not seeded:
- Club month edits and saved printables (those are per-tool saves a family makes).
- The Welcome Family Rhythm's saved edits.
- Agreement check-ins (production doesn't have 20261204).

## 6. Limitations (honest)

- **Monthly kits in production:** no kit is released today. November 2026 is `draft`, and January 2027 is scheduled but not yet released. A complimentary grant opens only released months, so Rivera opens none until you publish one. The demo doesn't change kit status or release dates; that's your publishing decision. On the test database, with November released, the month opens personalized for the Riveras.
- **Family Vision:** it's a paid welcome print (a fulfillment order), so the demo doesn't create one.
- **Past meetings:** there's no meeting history table. The weeks of use show through dated agreements and the development history.
- **No screen lists a child's skills and decision history** outside the meeting (where a skill appears when its check-in is due). The history is stored and returned by `household_development()`, but no page shows it yet. That's a product gap, not something the demo can fill.
- **"New" badges** on plans in the week preview: the app marks plans created since the last meeting, and a fresh install or reset creates them all at once.
- **Cleaning** on a new device starts with the companion's first-run screen, which is device-only, like a real phone.
- **Dates:** one-off plans and cleaning history sit around the day of the last reset. Weekly plans never go stale. Reset any time to refresh.

## 7. Production (each step needs the owner's approval)

1. Fresh, verified backup (`db-backup` workflow).
2. `supabase/rollout/demo-rivera/preflight.sql`: all checks pass. It passed on 2026-11-21, read-only.
3. Apply `20261209000000_demo_rivera.sql` **by itself** (SQL editor or `psql -f`; not `supabase db push`, which would also apply 20261130 and 20261202–04). Then run `verify.sql` and record the version in `supabase_migrations.schema_migrations`.
4. Deploy the website (adds the Rivera panel to Admin → Club access).
5. Create the two `@example.com` users (section 3), then **Install the Rivera demo** in the dashboard.

**Rollback:** `supabase/rollout/demo-rivera/rollback.sql`. It removes the functions and registry, and optionally the
demo family and its grant. Verified to leave the schema identical to production's.
