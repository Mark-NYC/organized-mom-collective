# Deploying 20261121 → 20261201 to production

Status: **plan for the owner's approval, 2026-11-15. Nothing here has been applied.** What each migration is and why:
[MIGRATION_PLAN.md](MIGRATION_PLAN.md). This is how to apply them, how to check each step, and how to go back.

Production today (read-only, 2026-11-15): Postgres 17.11, 37 migrations applied, the last `club_household_icon_style`.
None of 20261121 onward is there. 10 households, 20 family members, no saved colors, 10 accounts with a
subscription Stripe could still charge (step 9 will refuse to delete those until cancelled), none without an owner.
`supabase/rollout/household/preflight.sql` run against production the same day: **all 10 checks ok.**

## Rules

1. One file at a time, with the SQL editor or `apply_migration`. **Never `supabase db push`**: production's history
   uses different names, and a push would try to re-run migrations it already has.
2. Each step needs the owner's go. Stop at the first check that isn't `ok`.
3. Database first, code second. The app and website code that calls these functions ships only after its step is
   applied and verified (table below). Until then the code falls back: sign-in, family and Club pages work as today.
4. On a Supabase branch first (a copy of production's schema), then production.

## Order and dependencies

| Step | File | Needs | Changes existing behavior? | Approval still open |
| --- | --- | --- | --- | --- |
| 1 | `20261121000000_club_welcome_plans` | production today | No (new table and functions). **Fixes a live gap:** the website's Family Rhythm page already calls these | — |
| 2 | `20261122000000_club_welcome_rhythm_kit` | 1 | Redefines `club_me`, the fulfillment queue, admin lists. Ships switched off (`welcome_item = 'vision'`) | — |
| 3 | `20261123000000_club_welcome_overlap` | 2 | Redefines `club_me`. Only matters with 2's switch on | — |
| 4 | `20261124000000_household_shared` | production today (independent of 1–3) | Redefines the family read/save functions and four read policies; same signatures. Backfills one owner row per household | — |
| 5 | `20261125000000_family_calendar` | 4 | No | — |
| 6 | `20261126000000_household_member_colors` | 4 | **Writes data:** saves each member's current color (20 colors in 5 households; nothing printed can differ) | — |
| 7 | `20261127000000_family_agreements` | 4 | Adds columns to `club_responsibilities`; redefines `club_family_profile` | — |
| 8 | `20261128000000_household_club_access` | **1–3 and 4** | Redefines `club_me` and six content functions; a partner gains Club content, never billing | — |
| 9 | `20261129000000_account_delete_billing_guard` | 4 | **Yes:** an account with a chargeable subscription can't be deleted by any path | Deletion policy (OWNERSHIP_AND_BILLING_POLICY.md) |
| 10 | `20261130000000_household_join_from_own` | 4, 5 | No (new functions, one new table) | Approved 2026-11-15 (replace-on-join with confirmation, plans carried over, 90-day copy). Open: the 90-day purge and a privacy-policy line |
| 11 | `20261201000000_household_cleaning_progress` | 4 | No (new table and two functions) | — |
| 12 | `20261202000000_club_kit_titles_january_september` | production today (independent) | **Changes two rows:** `club_kits.title` for January ("Our First Family Meeting") and September ("Our Family Habit Cards"). January is already **scheduled** in production under its old title | Owner go (decision made 2026-11-16; the write still needs it) |

Why 1–3 go before 4–8: step 8 rebuilds `club_me` from its live definition. Applied on production's older `club_me`
it would silently lose what 2–3 add. Steps 5, 6, 7, 9, 10 and 11 only need 4 and can go in any order after it.

Suggested sessions: **A** = 1, 2, 3. **B** = 4, 5, 6. **C** = 7, 8, 11. **D** = 10. **E** = 9 (after the policy decision). **F** = 12 (any time; before January's mailing is reviewed).

## Preflight (before session A, and again before B)

All read-only.

1. `supabase/rollout/snapshot.sql` and confirm the project's point-in-time recovery or a fresh backup exists
   (Dashboard → Database → Backups). Note the time: it is the fallback for everything below.
2. `supabase/rollout/household/preflight.sql`: every row `ok = true`.
3. `supabase/rollout/household/fingerprint.sql`: save the output as `before.txt`.
4. `supabase/rollout/household/capture.sql`: save the one value it returns as `restore-functions.sql`. It is the
   exact current text of the 15 functions steps 4–9 replace. **Take it again after session A** (steps 2–3 change
   `club_me`), so the copy used for a rollback of B–E is the state right before step 4.
5. In Stripe: no chargeable subscription whose customer has no account (preflight checks the database side).

## Applying and verifying

After every file: `supabase/rollout/household/verify.sql` (rows for unapplied steps say `applied = false`; every
applied row must be `ok`), then the step's own check:

| After | Check |
| --- | --- |
| 1–3 | `supabase/rollout/verify.sql`; the Family Rhythm page loads for a test member; `select welcome_item from club_settings` = `vision` |
| 4 | 10 owner rows, one per household; sign in as a test member on the website: family page loads and saves; `/admin/club` lists members as before |
| 5 | `select count(*) from calendar_events` = 0; nothing else to see until the app ships |
| 6 | Every current member has a color (verify.sql); 20 colors, equal to the dry run in MIGRATION_PLAN.md; a month's printable shows the same colors as before |
| 7 | The family page still lists responsibilities; `select count(*) from club_responsibilities where revision <> 0` = 0 |
| 8 | Signed in as a test member: Club Home, a month and the dashboard are unchanged; `club_me` returns the same fields as before the step |
| 9 | One trigger named `account_chargeable_guard`; a test account with a cancelled subscription can still delete itself |
| 10, 11 | verify.sql rows only (no existing behavior changes) |

Then, per session, the end-to-end pass on the Supabase branch with the app build pointed at it: the two-phone flow
in `scripts/e2e/family-e2e.mjs` covers sign-in, the invitation, joining from an account with its own family, the
calendar, agreements, shared cleaning and account deletion.

## Existing production functionality stays intact (checked after every session)

Run as a signed-in test member on the live website, and compare `supabase/rollout/household/fingerprint.sql` before
and after for everything the session did not mean to change:

| What must still work | How to check |
| --- | --- |
| Shop checkout and order confirmation | Open `/checkout?product=calendar-26-week`: the form loads. `select count(*) from shop_orders` unchanged by the session |
| Club sign-in, Club Home, a month, Account & Billing | Sign in at `/club/login`; open Club Home, this month's page and `/club/dashboard`; the billing portal link opens |
| `club_me` for a paying member | Same fields and values as before the session (save the JSON before; diff after) |
| Family page saves | Change a family member's name and change it back |
| Admin | `/admin/club`: members, fulfillment queue and kit list load with the same counts |
| Subscriptions and entitlements | `select status, count(*) from club_subscriptions group by 1` and `select count(*) from club_entitlements where revoked_at is null`: identical before and after |
| Email automation | `select count(*) from cron.job` identical, plus one (`omc-household-archives-purge`) after step 10 |
| Stripe webhook | Dashboard → Webhooks: no new failures in the hour after each session |

## Rollback

Every file runs in one transaction (or stops itself when the text it patches has changed): a failed apply leaves
nothing behind. To undo steps that did apply:

| Undo | How | Loses |
| --- | --- | --- |
| 1–3 | `supabase/rollout/rollback-welcome-overlap.sql`, then `rollback-welcome-rhythm-kit.sql` (rehearsed earlier); 1 is additive, leave it | Saved Family Rhythms only if 1's table is dropped |
| 10 or 11 alone | Their sections at the top of `supabase/rollout/household/rollback.sql` | Archive copies / shared cleaning marks. Device checkmarks stay on the phones |
| 9 alone | Its section of `rollback.sql`, then `account_delete` from `restore-functions.sql` | Nothing |
| 4–11, all | `rollback.sql`, then `restore-functions.sql`, then `finish.sql`, one session. `fingerprint.sql` must then equal `before.txt` | Partner access and invitations, the calendar, agreements, shared cleaning marks, archive copies. **Keeps** every household, family member, Club record, subscription and saved color |
| Anything unexpected | Point-in-time recovery to the time noted in preflight | Everything after that time, across the whole database |

Rehearsed on a throwaway database by `scripts/rehearse-household-rollback.sh` (in CI): it runs preflight, applies
4–11 with real rows (partners, events, cleaning marks, archives), runs verify, rolls back, and requires the schema
fingerprint (915 functions, columns, policies, triggers and grants) to be identical to before, no household or family
member lost, and the pre-household suites to pass on the result.

A rollback after families have used the features removes their data. Past the first days, prefer fixing forward.

## Code that waits for the database

| Ships after | Code |
| --- | --- |
| 4 | Partner invitations, the public invitation page (`/club/invite`), Our Week sign-in and family setup |
| 5, 6, 7 | Calendar, permanent colors, Family Meeting agreements |
| 8 | A partner opening the household's Club months |
| 9 | Our Week Account's delete flow and its refusal wording |
| 10 | Joining from an account that already has a family (the page falls back to the plain accept without it) |
| 11 | Shared cleaning progress (without it the companion stays on the device, as today) |

Also needed before the app can sign in at all: `capacitor://localhost` in `CLUB_ALLOWED_ORIGINS` and the Supabase
Auth redirect settings (owner; OMC_APP_ROADMAP.md → TestFlight blockers).

## What needs the owner's approval

1. Each session A–E, separately, after its preflight is shown.
2. Step 9's deletion policy (three open questions in OWNERSHIP_AND_BILLING_POLICY.md).
3. Step 10's archive is approved (2026-11-16): purged daily by a scheduled job, restorable by support only, removed with the account. Still yours: the wording of the privacy paragraph (`src/pages/privacy.astro`).
4. Session F (two kit titles).
