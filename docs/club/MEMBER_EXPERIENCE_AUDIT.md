# Organized Family Club: member experience audit (Oct 30 2026)

Scope: the paying member's path from `/club` to her monthly tools and Family Meetings, on `main` at `6406774` (PRs
#264, #266, #267 merged; #268 open), the production Supabase project (read-only checks) and the live site. Fulfillment
(print counts, postage, the January/September swap) is out of scope except where it could mail the wrong thing.

## Launch blockers (owner action, nothing here was changed)

### 1. Production is missing two migrations

Production's migration history ends at `club_first_month_free` (20261107). Not applied:

| Order | File | What it does | Depends on |
| --- | --- | --- | --- |
| 1 | `supabase/migrations/20261108000000_club_welcome_kit.sql` | Welcome Kit: pairs her welcome print with her first month's order in the fulfillment queue (derived, no new columns), `club_admin_set_welcome_kit`, `club_admin_welcome_queue`, `kit_reminder` email kind; redefines `club_resource_save`, `club_intro_grant`, `club_invoice_apply`, `club_email_audience` | 20261104–20261107 (all on production) |
| 2 | `supabase/migrations/20261109000000_club_family_profile.sql` | Expanded family profile: columns on `club_households`, tables `club_activities`, `club_responsibilities`, functions `club_family_profile`, `club_activities_save`, `club_responsibilities_save`, `club_focus_save` | 20261023, 20261104 (on production). Applies on its own too; keep the order anyway |

**What members hit today without them** (reproduced on a database with production's exact migrations):
- The live site calls `club_family_profile`, `club_activities_save`, `club_responsibilities_save`, `club_focus_save`; none exist on production.
- New member, `/club/welcome`: onboarding steps 2–6 (week, who does what, growth, challenges, priority) are silently skipped.
- Returning member, `/club/family`: the whole page said "We couldn't load your family". **Fixed in this PR** (the page now opens without the profile), but the profile steps stay unavailable until 20261109 is applied.
- Family Meetings fall back to the generic, incomplete-profile version for every family.
- Admin: the Welcome Kit queue and actions (`/admin/club`) fail; `club_admin_set_welcome_kit` doesn't exist.

**Safety checks already run locally** (no Supabase branch: branching needs the Pro plan):
- `bash scripts/verify-family-profile-upgrade.sh`: production-shaped replay, 20261109 applied: households' original columns and every family member row unchanged, legacy answers kept, isolation between households, RLS and grants, 45 `club-profile.sql` checks. All pass.
- Production replay with the dev seed (a founding member with a welcome print and a January order), 20261108 then 20261109: both apply; households' original columns and **every fulfillment order row unchanged**. The queue view then groups her two orders as one `welcome_kit` package with one readiness, which is that migration's intent (docs/club/WELCOME_KIT.md).
- `npm run test:admin-sql` (every migration; admin, accounts, Club access, membership, profile tests): pass.
- `npm run test:club` (billing end to end, every migration): 34/34.

**Deployment steps** (in this order; owner's go-ahead required):
1. Re-check production's list: Supabase → Database → Migrations (or `list_migrations`) still ends at `club_first_month_free`.
2. Read-only snapshot for comparison: counts of `club_households`, `club_family_members`, `club_fulfillment_orders` by `fulfillment_type, status`, and `club_resource_versions`.
3. Apply `20261108000000_club_welcome_kit.sql` (SQL editor or `apply_migration`, name `club_welcome_kit`). It runs in one transaction.
4. Apply `20261109000000_club_family_profile.sql` (name `club_family_profile`).
5. Re-run the snapshot: same counts; `club_admin_welcome_queue()` lists the founding members' kits.
6. Deploy the regenerated Edge Functions `supabase/dashboard/club-admin.ts` and `club-webhook.ts` (`npm run build:functions` first). Deployed `club-admin` (v9) has no `kit_reminder`, so they predate the Welcome Kit.
7. Smoke test as a test-mode member: `/club/family` shows the profile summary; a profile step saves; `/admin/club` Welcome Kits tab loads.

Rollback: no existing row is changed by either. 20261108 replaces a view and functions: to undo, re-run the latest earlier definition of each (`club_fulfillment_queue`, `club_resource_save`, `club_intro_grant`, `club_invoice_apply`, `club_email_audience`, `club_admin_*`; 20261104–20261107) and drop the new ones. 20261109 adds objects only: drop them only if no member has saved profile answers yet. Take a database backup before step 3 either way.

### 2. Live checkout is in Stripe test mode

Production `club_settings.checkout_mode = 'test'`; only `webhook_secret_test` is stored; the 6 trialing and 1 canceled
subscriptions are test mode. The live site shows the Club and **Get My First Month Free**, so anyone can start a
test-mode checkout today: no real money moves and no real member is created. Going live is
[MEMBERSHIP.md → Going live](MEMBERSHIP.md) step 13 (live key in `CLUB_STRIPE_SECRET_KEY`, `CLUB_LIVE_CHECKOUT=enabled`,
**Set up Stripe (live mode)**, Setup → checkout **live**). Do it after the migrations above and the Welcome Kit
functions are deployed. Drift: MEMBERSHIP.md's status line says the site flags are off; on the live site the Club
pages and checkout button are on.

## What changed in this PR

**The monthly tools at `/app/club/<month>` are her plan, saved to her account** (`src/lib/club/plan/account.ts`;
docs/club/PLAN_ARCHITECTURE.md → Storage). Before, every app tool kept her edits only in the browser tab.

- One source of truth: her saved version of the month (`club_resource_versions`), the same row her copy at
  `/club/resources/<slug>` and the mailing read. No new table, function or migration; it works on production's
  current schema (tested).
- The tool's own entry sits beside the entry her copy saved; saving never overwrites another entry.
- Opening a tool never saves. Only her own changes (after a click or keystroke) save, debounced and revision-checked.
  Another device saved first: saving stops and the page says to reload.
- Her copy of the same tool (April–August, October, December; February and March once #268 lands) opens in the app
  tool until she saves there. January and September's copies are a different tool: kept, and linked from the tool
  ("Open the copy you saved earlier").
- Club home (`/app/club`) and the dashboard open `/app/club/<month>` for months she holds. November stays on
  `/club/resources/2026-11-family-ownership`: its tool has no app page.
- The rail and phone screen say "Changes save to your account" for members; samples keep "this browser tab".
- `/club/family` opens even when the profile can't load (production today).

**Not changed:** the tools' designs, wording (except two "stays in this browser tab" lines, now "✓ Changes show on the
sheet right away."), printing, the Family Meeting, `/club/resources/*`, the admin's fulfillment print, emails, Stripe,
prices, entitlements.

**Kept out of this PR:** the December member-copy print fix, as `docs/club/patches/december-member-copy-print.patch`
(see Fulfillment, below).

## Fulfillment: report only, nothing changed

1. **What prints isn't yet what she edits.** The mailing prints `/club/resources/<slug>?fulfillment=…`, which renders her
   copy's entry, not the app tool's. For months where they're the same tool, the two entries can now differ (she edits
   in the app). Before any mailing: make the fulfillment view render the app tool's entry (it's in the same row), as
   part of #268's work. Editing in the app tool does clear that month's approval for printing (`club_resource_save`), so
   an approved mailing never silently goes out after she changed her plan.
2. **January and September are swapped between the app and the mailing** (#268, decision 1). Four founding members'
   January orders are pending on production (none approved): as configured, their Welcome Kits would mail **Habit
   Cards headed "September 2027"** while their app January is the Weekly Meeting.
3. **December's copy prints blank** in the browser (on `main` and on #268): the page carries every month's printable
   CSS, and several hide everything but their own sheets in print. December 2026 is a draft on production, so nothing
   is affected today. The fix is in `docs/club/patches/december-member-copy-print.patch` (print only its two sheets,
   one Letter page each, scoped to the member copy); apply with #268 or the fulfillment work.
4. **February and March copies print a blank second page on `main`**: fixed by #268 (checked: Rivera prints 2 and 3
   pages, none blank).
5. The deployed "resource ready" and "review" emails link to `/club/resources/<slug>`. That page still works and saves
   to the same row; point them at `/app/club/<month>` when the Edge Functions are next deployed.

## Test results (all local, nothing against production)

| Suite | What | Result |
| --- | --- | --- |
| `node scripts/club-onboarding-e2e.mjs --only=months` (new) | Signed-in member, all 11 app tools: opens with her family, opening saves nothing, a real edit saves to her account, same plan in a new browser (closed browser / another device), reopening doesn't save again, Family Meeting shows her family and changes nothing, switch back keeps her change, Letter print with no blank page, every image loads, desktop and 390 px phone without sideways scrolling; January's earlier copy untouched and linked; sign out → signed-out gate → sign back in with her emailed code → June is her saved plan; `/club/family` opens; Club home links | 193/193 with every migration; 193/193 with **production's** migrations |
| `node scripts/club-onboarding-e2e.mjs` | Checkout → sign in → family → profile steps → print → first resource, desktop and mobile; resume midway; admin Welcome Kit | 156/156 |
| `node scripts/club-meeting-qa.mjs` | Family Meeting, 12 months, 5 samples plus single-parent, no-profile, large and grown-ups-only families, desktop and mobile, one-page print, tool untouched | 203/203 |
| `npm run test:club` | Billing end to end: fake Stripe (test mode), real handlers and database: new and returning subscriber, duplicates, failed payments, cancel, refunds, disputes, first month free | 34/34 |
| `npm run test:admin-sql` | Access tests: one household can't see another's data | pass |
| `bash scripts/verify-family-profile-upgrade.sh` | 20261109 on a production replay | pass |
| `tests/club-plan-account.test.ts` (new) | Save rules: no save on open, conflicts, read-only, printed, unreachable account, never overwriting her copy | 10/10 |
| `npx vitest run` | Whole unit suite | Same failures as `main`, by name (docs/club/KNOWN_TEST_FAILURES.md: kit tests describing earlier drafts); none new |

Not verified against the live environment: a real Stripe Checkout (test or live), the Stripe webhook against
production, the real emailed sign-in code, and anything that depends on the two missing migrations.

## Remaining issues

**P0** (before paying members)
- The two migrations and the Welcome Kit Edge Functions (above).
- Stripe live mode (owner's decision, after the above).
- Fulfillment must print the plan she edits (Fulfillment 1) and the January/September decision (Fulfillment 2), before the first mailing.

**P1**
- December's member copy prints blank (patch ready, not applied).
- Year-2 months (November and December 2027) have no app tool; they open her copy.

**P2**
- Approval on the app tools is still a check mark on this device (labeled as such); mailing approval lives on her copy.
- Emails link to the copy, not the app tool (Fulfillment 5).
- May–August copies at `/club/resources/*` are 10 px wider than a 390 px phone (the app tools aren't).
