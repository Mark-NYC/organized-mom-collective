# Release readiness: Organized Family (iPhone) and the household release

Status 2026-11-16. Release candidate: branch `claude/stoic-albattani-esdhkp`, PR #480 (into `main`). Nothing is applied to
production or deployed. Evidence is in CI on that branch and in the files named below.

## Verified

| Area | Evidence |
| --- | --- |
| Unit tests | `npm test`: every test passes, no accepted-failures list (CI `web-shell`, `build`) |
| Database | 17 suites (billing for either adult: 49 checks), Postgres 16 locally and 17 in CI, also on production's migration state (`scripts/test-household-sql.sh`, CI `household-db`) |
| Rollback | Apply → verify → roll back → identical schema fingerprint, no family lost (`scripts/rehearse-household-rollback.sh`, in CI) |
| Two parents, end to end | 107 checks at iPhone size on an isolated backend: invite, join from an own family (confirm, plans carried, copy kept), shared cleaning, offline, same-box taps, sign-out and back, removal, re-invite, a stranger with the link, a third adult (`scripts/e2e/family-e2e.mjs`, CI `family-e2e`) |
| Real app on the iPhone Simulator | `ios-simulator`: tabs, safe areas, a checkmark surviving a relaunch and a cleared-storage launch, then the family flow against the isolated backend (one macOS job). See "Simulator" below for the run count |
| Website | Production-style build passes; site check: 3 remaining, all Pinterest plan docs with missing research fields |
| Monthly QR codes | November 2026 to October 2027: each is a built page that sends a member to that month's own page (`tests/club-kits.test.ts`) |
| January / September | January = the four-part, ten-minute Family Meeting; September = Habit Cards, in kit, banner, member pages and tests |
| Production preflight | `supabase/rollout/household/preflight.sql`, read-only, 2026-11-15: all checks ok. Session A's own preflight, 2026-11-16: 11 of 11 replaced objects identical to the repo, nothing half-applied ([SESSION_A_REVIEW.md](SESSION_A_REVIEW.md)) |
| Banner and kit names | The public banner names each month's real resource; a test holds it to the Family Meeting table (`tests/club-kits.test.ts`) |

## Blockers before TestFlight

| # | Blocker | Who |
| --- | --- | --- |
| 1 | Apply the migrations, in the sessions of MIGRATION_DEPLOYMENT_PLAN.md. **Sessions A, B and C applied 2026-11-17 (households for two adults, the calendar, permanent colors, agreements, Club for the second adult, shared cleaning): every family feature the app uses now has its backend. D–G are prepared (REMAINING_SESSIONS_REVIEW.md); none blocks TestFlight. Daily encrypted backups run since 2026-11-17 (docs/operations/DATABASE_BACKUPS.md).** Until then sign-in works but family sharing, calendar sync, agreements and shared cleaning have no backend | Owner approves each session |
| 2 | Apple Developer Program membership; bundle id `com.organizedmomcollective.app`; App Store Connect app record | Owner |
| 3 | App Store Connect API key and team id in GitHub secrets ([TESTFLIGHT.md](TESTFLIGHT.md)). The signed archive and upload job is written (`ios-testflight.yml`) and has never run | Owner, then a first run |
| 4 | ~~App origin settings~~ None needed: Auth and the database API already answer `capacitor://localhost` (checked 2026-11-17). Sign-in on a real device is still untested | Owner's iPhone, via TestFlight |
| 5 | ~~App icon and launch screen~~ Done with the existing seal (512px enlarged). A 1024px master before the App Store listing | Design, later |
| 6 | `/privacy` published, including the new paragraph about the 90-day copy; App Store privacy answers. The privacy manifest is in (`PrivacyInfo.xcprivacy`) | Owner approves the text |
| 7 | ~~Display name~~ Done in `ios/`. The App Store Connect record's name is the owner's | Owner |
| 8 | A real-device pass: keyboard, swipe-back, feel | Owner's iPhone, via TestFlight |

## Blockers before production (website and Club)

| # | Blocker | Who |
| --- | --- | --- |
| 1 | PR #480 reviewed and merged; then the website deploys from `main` | Owner |
| 2 | January is **scheduled** in production and its kit copy changed (four-part meeting; letter still marked draft). Review the January letter and printable before the December 13 print cutoff | Owner |
| 3 | Session F: the two kit titles in production (`20261202`) | Owner |
| 4 | Session G: billing for either adult (`20261203`), after sessions A, B, C and E | Owner |
| 5 | One gallery photo and one tool preview are missing from the repo (the pages now show a tile instead of a broken image); one product has no order-email picture | Owner supplies the files |
| 6 | ~~Banner and resource names~~ Fixed. Left alone on purpose: `club_kits.title` in the database (internal theme names, shown in admin) and the unlisted `/club/february-preview` prototype still titled "Connection Cards" | — |
| 7 | Stale docs say the shop and the Club are off in production; both are on (checked on the live site) | Docs pass |

## Known limits (not blockers)

- Shared cleaning catches up on open, resume, reconnect and every 15 seconds while open. It is not push.
- Simulator tests can't show keyboard behavior, swipe-back or real network conditions.
- The invitation link opens the website page; inside the app the invitation is pasted (no Universal Links yet).

## Simulator

The intermittent failures were one cause, in the test harness: the test-only storage wipe ran while the first page was
loading and then reloaded it. Fixed by finishing the wipe before the web view exists. Run count on the fixed harness
is recorded in PR #480.
