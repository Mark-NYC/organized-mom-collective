# Release readiness: Organized Family (iPhone) and the household release

Status 2026-11-16. Release candidate: branch `claude/stoic-albattani-esdhkp`, PR #480 (draft). Nothing is applied to
production, deployed or merged. Evidence is in CI on that branch and in the files named below.

## Verified

| Area | Evidence |
| --- | --- |
| Unit tests | `npm test`: every test passes, no accepted-failures list (CI `web-shell`, `build`) |
| Database | 16 suites, Postgres 16 locally and 17 in CI, also on production's migration state (`scripts/test-household-sql.sh`, CI `household-db`) |
| Rollback | Apply → verify → roll back → identical schema fingerprint, no family lost (`scripts/rehearse-household-rollback.sh`, in CI) |
| Two parents, end to end | 107 checks at iPhone size on an isolated backend: invite, join from an own family (confirm, plans carried, copy kept), shared cleaning, offline, same-box taps, sign-out and back, removal, re-invite, a stranger with the link, a third adult (`scripts/e2e/family-e2e.mjs`, CI `family-e2e`) |
| Real app on the iPhone Simulator | `ios-simulator`: tabs, safe areas, a checkmark surviving a relaunch and a cleared-storage launch, then the family flow against the isolated backend (one macOS job). See "Simulator" below for the run count |
| Website | Production-style build passes; site check: 3 remaining, all Pinterest plan docs with missing research fields |
| Monthly QR codes | November 2026 to October 2027: each is a built page that sends a member to that month's own page (`tests/club-kits.test.ts`) |
| January / September | January = the four-part, ten-minute Family Meeting; September = Habit Cards, in kit, banner, member pages and tests |
| Production preflight | `supabase/rollout/household/preflight.sql`, read-only, 2026-11-15: all checks ok |

## Blockers before TestFlight

| # | Blocker | Who |
| --- | --- | --- |
| 1 | Apply the migrations, in the sessions of MIGRATION_DEPLOYMENT_PLAN.md. Until then sign-in works but family sharing, calendar sync, agreements and shared cleaning have no backend | Owner approves each session |
| 2 | Apple Developer Program membership; bundle id `com.organizedmomcollective.app`; App Store Connect app record | Owner |
| 3 | App Store Connect API key in GitHub secrets, then a signed archive and upload job in CI | Owner, then code |
| 4 | `capacitor://localhost` in `CLUB_ALLOWED_ORIGINS` and Supabase Auth settings, then sign-in tested on a device | Owner approves (an Edge Function secret) |
| 5 | Real app icon and launch screen (still Capacitor's placeholders) | Design |
| 6 | `/privacy` published, including the new paragraph about the 90-day copy; App Store privacy answers; privacy manifest for UserDefaults | Owner approves the text |
| 7 | App display name and listing say "Organized Family" (in-app labels already do) | Owner, in App Store Connect and `ios/` |
| 8 | A real-device pass: keyboard, swipe-back, feel | Owner's iPhone, via TestFlight |

## Blockers before production (website and Club)

| # | Blocker | Who |
| --- | --- | --- |
| 1 | PR #480 reviewed and merged; then the website deploys from `main` | Owner |
| 2 | January is **scheduled** in production and its kit copy changed (four-part meeting; letter still marked draft). Review the January letter and printable before the December 13 print cutoff | Owner |
| 3 | Session F: the two kit titles in production (`20261202`) | Owner |
| 4 | The remaining billing choices (OWNERSHIP_AND_BILLING_POLICY.md → Decisions needed) | Owner |
| 5 | One gallery photo and one tool preview are missing from the repo (the pages now show a tile instead of a broken image); one product has no order-email picture | Owner supplies the files |
| 6 | Banner and resource names disagree for February, March, October and December (banner: Connection Cards, Chore Chart, Sunday Reset, Giving Cards; resources: Laundry Guides, Our Family Rhythm, 5-Minute Reset). Same kind of conflict as January/September; not changed without a decision | Owner |
| 7 | Stale docs say the shop and the Club are off in production; both are on (checked on the live site) | Docs pass |

## Known limits (not blockers)

- Shared cleaning catches up on open, resume, reconnect and every 15 seconds while open. It is not push.
- Simulator tests can't show keyboard behavior, swipe-back or real network conditions.
- The invitation link opens the website page; inside the app the invitation is pasted (no Universal Links yet).

## Simulator

The intermittent failures were one cause, in the test harness: the test-only storage wipe ran while the first page was
loading and then reloaded it. Fixed by finishing the wipe before the web view exists. Run count on the fixed harness
is recorded in PR #480.
