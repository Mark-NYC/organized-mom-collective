# Organized Mom Collective iPhone app: audit, architecture and roadmap

**Status (2026-11-14): plan approved for Milestone 1 only by the owner's brief; nothing deployed, no database
changes, no Stripe changes, not merged.** Branch: `claude/focused-fermi-re9ddc`. Milestone 1 code lives in
`capacitor.config.ts`, `ios/`, `src/lib/native/`, `src/data/app/`, `scripts/build-app-shell.mjs`,
`.github/workflows/ios-app.yml`. Everything here is internal planning: none of it is a customer promise
([PRODUCT_ROADMAP.md → Release gates](../brand/PRODUCT_ROADMAP.md#release-gates-and-customer-honesty)). In customer
copy the cleaning companion stays "the cleaning companion" / "website" until the iPhone app actually ships in the App
Store; then "app" is accurate for the App Store build only.

Read with: [VISION.md](../brand/VISION.md), [PRODUCT_ROADMAP.md](../brand/PRODUCT_ROADMAP.md),
[MEMBERSHIP.md](../club/MEMBERSHIP.md), [IMPLEMENTATION_PLAN.md](../club/IMPLEMENTATION_PLAN.md),
[YEAR_ONE_CALENDAR.md](../club/YEAR_ONE_CALENDAR.md), [supabase/ACCOUNTS.md](../../supabase/ACCOUNTS.md).

---

## 1. Audit: what actually exists (checked in code and in the live Supabase project, 2026-11-14)

### 1.1 Stack

| Layer | Reality | Evidence |
| --- | --- | --- |
| Site | Astro 7, **fully static** (`dist/`), React 19 islands (`client:only`), Tailwind v4, MDX. No SSR adapter. | `astro.config.mjs`, `package.json` |
| Hosting | Cloudflare Pages (www.organizedmomcollective.com); one Pages Function (`/pinterest-feed.csv`). | `README.md → Hosting`, `functions/` |
| Server | Supabase: Postgres + RLS + `security definer` RPCs, Auth (email OTP), 20 Edge Functions (Stripe, Resend, Gelato, Club billing/webhook/admin…). No SDKs, all `fetch`. | `supabase/functions/`, `supabase/migrations/` (69 files) |
| Payments | Stripe. Shop: one-time embedded Checkout (off). Club: subscriptions, Billing Portal, webhook re-reads Stripe, explicit `club_entitlements` rows. **Test mode only.** | `docs/club/MEMBERSHIP.md`, `_shared/club/` |
| Auth | Supabase Auth OTP over plain fetch, session `{access_token, refresh_token}` in `localStorage` (`omc:account:session`), auto-refresh. | `src/lib/account.ts` |
| CI | GitHub Actions: `npm ci && npm run build` on every PR (`club-build-check.yml`) plus photo/icon/Pinterest jobs. **Unit tests are not run in CI.** | `.github/workflows/` |
| PWA | Manifest + service worker scoped to `/app`, precache written at build (`offline-precache.mjs`); public pages have none. | `public/manifest.webmanifest`, `src/layouts/AppLayout.astro` |

### 1.2 The member experience today (the thing the app wraps)

- `/app` is now a **family home hub** (Home · Cleaning · Club · Account bottom tabs, `src/components/Nav.astro`), not the
  cleaning Today screen the README describes.
- `/app/cleaning` (+ `week`, `reorder`, `settings`) is the cleaning companion (`TodayApp.tsx`, data
  `src/data/cleaning.ts`, progress `src/lib/storage.ts` under `omc:v1:*`, **device-local only, not synced**).
- `/app/calendar/*` is the QR copy of the companion for calendar owners (`START_DESTINATION =
  /app/calendar?source=calendar`), its own four tabs, no Club. Visiting it sets `omc:calendar-companion:v1 = 1`, which
  unlocks cleaning on `/app` for that device. Otherwise cleaning is unlocked only by a signed-in account with a **direct
  website** calendar order (`calendarOrderAccess`). **Etsy buyers (the main channel) can't be verified**; the gate is
  device-local honor system by design.
- `/app/club`, `/app/club/<month>` (12 months + Welcome Family Rhythm), `/app/club/months`: Club Home and each month's
  personalized plan on the shared plan shell (`src/components/club/plan/`). `/club/*` (ClubLayout): login, welcome,
  welcome kit, family profile, family vision, resources, tools, dashboard (billing). All behind
  `PUBLIC_CLUB_ENABLED` (off in production; each page renders a "not available" notice).
- Household data: `club_households` (one **owner** per household, `owner_user_id unique`), `club_family_members`,
  `club_activities`, `club_responsibilities`, `club_resource_versions`, `club_welcome_plans`. RLS: a member reads only
  her own household; writes go through checked functions. **There is no second adult on a household yet.**

### 1.3 What's applied to the live Supabase project (`list_migrations`, read-only)

Applied: admin, support, starter kit, **accounts**, **club core + kit seeds**, **club membership**, cutoff rule, welcome
vision, first month free, household colors, welcome kit, family profile, welcome-kit approvals, household icon style,
the marketing/email migrations. **Not applied:** all `*_shop*.sql` (shop is off), tool email gate, `checkout_offers`,
`club_welcome_plans`, `club_welcome_rhythm_kit`, `club_welcome_overlap`, `20261102_pinterest_queue`.

### 1.4 Tests (baseline on this branch before any change)

`npx vitest run`: **56 failing tests in 16 files**, all pre-existing (kit tests describing earlier drafts, the QR route
test, shop, worksheet…). `docs/club/KNOWN_TEST_FAILURES.md` recorded 42 on 2026-10-30, so **14 more have drifted since**
(new: `club-september`, `club-print-deadline`, `email-checkout-attribution`, `tool-sharing`, extra January/October).
Milestone 1 records them in `tests/known-failures.txt` and CI fails only on a failure not in that list
(`scripts/compare-test-failures.mjs`); it adds none.

### 1.5 Outdated or contradictory documentation

| Doc | Says | Reality | Action |
| --- | --- | --- | --- |
| `README.md` intro, URL table, "Companion app" row | `/app` is Today; "No backend, no accounts" | `/app` is the family hub; Today is `/app/cleaning`; QR goes to `/app/calendar` | Fixed in this branch (M1) |
| `docs/club/IMPLEMENTATION_PLAN.md §1` | Accounts migration "not applied" | Applied to production 2026-10-26 | Noted; fix with the next Club doc pass |
| `docs/club/KNOWN_TEST_FAILURES.md` | 42 failures | 56 | Re-baseline (owner decides test vs. product per group) |
| `docs/club/YEAR_ONE_CALENDAR.md` | Status 2026-10-22, "$5/month working price", Nov kit as the private beta | Price $5.90 (MEMBERSHIP.md), monthly program now starts January 2027 (founding members) | Mark superseded where it conflicts |
| `docs/brand/PRODUCT_ROADMAP.md` | Club "Phase 1 (November kit)…", no mention of an app | 12 months of plans built; this roadmap | Linked from here; owner to approve wording |
| Club name | "Organized Family Club" (MEMBERSHIP, README, `Nav.astro` alt text) | `CLUB_NAME = 'Family Meeting Club'` (`src/data/club/config.ts`), logos say Family Meeting Club | **Owner decision:** one name |
| Vercel references | `supabase/{ACCOUNTS,SHOP,TOOL-EMAIL,SUPPORT,ADMIN}.md`, `page-inventory.yml`, `ADMIN_DASHBOARD_PLAN.md`, `PRIVACY_POLICY_DRAFT.md` | Cloudflare Pages | Already listed in IMPLEMENTATION_PLAN → Drift; still open. **Privacy draft must be fixed before `/privacy` publishes** |
| `/app` home copy | "including the October Sunday Reset preview" | The Sunday Reset moved to September | Fixed in M1's Today screen |

---

## 2. Recommended architecture

### 2.1 Decision: Capacitor, bundled static shell, one codebase

**Use Capacitor 8 (iOS) with the member pages bundled into the app**, built from the same Astro source as the
website. Not a remote URL wrapper (Apple guideline 4.2 rejects thin web wrappers, and it would break offline), not a
React Native rewrite (two UI codebases for one small team, and the Club's printable plans are Astro + DOM).

```
                 same repo, same src/
                ┌──────────────────────────────┐
   npm run build│  Astro static build           │npm run build:app (APP flags on, own outDir)
   (unchanged)  └──────────────┬───────────────┘
                               │
         dist/  ───────────────┘──────────────  dist-app/ → scripts/build-app-shell.mjs → app-www/
   Cloudflare Pages (website, public pages,                 allowlist: /app/**, member /club/** pages,
   shop, Club sales, billing)                               _astro, fonts, icons, Club images
                                                            ⟶ npx cap sync ios ⟶ ios/App (Xcode, SPM)
```

- **One product codebase.** Components, data (`src/data/cleaning.ts`, Club kits), engines and Supabase calls are
  shared. Native-only behavior is runtime-detected (`window.Capacitor.isNativePlatform()`) in `src/lib/native/`, and
  every Capacitor plugin is **dynamically imported only on native**, so the website's bundles don't grow.
- **Separate build output.** `build:app` writes to `dist-app/` with the app flags (`PUBLIC_APP_SHELL=ios`,
  `PUBLIC_CLUB_ENABLED=true`, `PUBLIC_ACCOUNTS_ENABLED=true`); the production `dist/` and its flags are untouched.
- **Allowlist packaging.** `scripts/build-app-shell.mjs` copies only member pages into `app-www/` and fails the build if
  a public sales page, admin page, checkout, a `sk_live`/`sk_test`/`service_role`/`whsec_` string, or a source map
  slips in. Public pages are never in the bundle.
- **Links out.** Inside the app, any link to a page that isn't in the bundle (homepage, `/calendar`, `/shop`, `/club`
  offer, `/club/dashboard` billing, `/support`, articles, free tools) opens in the system browser on the website. Shopping,
  checkout and subscription management stay on the web. The app never shows a price or a buy button.
- **Routing.** Capacitor's default iOS router sends every extension-less path to the root `index.html` (an SPA
  assumption). `OMCRouter` in `ios/App/App/OMCBridgeViewController.swift` resolves `/app/cleaning` to
  `app/cleaning/index.html`, so Astro's multi-page output works unchanged.

### 2.2 Data: local first, then sync

| Data | Today | M1 (app) | Later |
| --- | --- | --- | --- |
| Cleaning progress `omc:v1:*` | `localStorage` behind `storage.ts` Backend | **Durable mirror**: every write also goes to Capacitor Preferences (iOS `UserDefaults`, not purged under storage pressure); on launch, missing keys are restored. `localStorage` stays the synchronous read path, so no component changes. | Step 2 of accounts: route the Backend through a `household_progress` table, keyed by the same stable ids and dates (last-write-wins per key, like `account.ts reconcile`) |
| Saved tools `omc:<tool>` | `account_saves` sync when signed in | Same (mirrored locally too) | Same |
| Club household, plans | Supabase tables via RPC, RLS | Same calls from the app | Household members (2 adults) |
| Auth session | `localStorage` | **Not mirrored** to Preferences (UserDefaults isn't encrypted). If iOS purges web storage she signs in again with a code. | Keychain via a secure-storage plugin before the calendar integration ships |
| Calendar events, inbox | none | none (schema drafted, not applied) | Supabase tables, see 2.4 |

Offline: assets are inside the app binary, so the companion opens offline from first launch (no service worker; WKWebView
doesn't run one on `capacitor://`). Supabase calls fail soft as they already do on the web.

### 2.3 Security and household isolation

- Every family row carries `household_id`; RLS everywhere: `household_id in (select household_id from household_members
  where user_id = auth.uid())`. Today that's `club_households.owner_user_id`; Milestone 3 adds `household_members`
  (owner, partner) so a partner gets their own login without sharing mom's code. Children never get accounts.
- Writes stay `security definer` functions with explicit checks (the project's existing pattern, tested in
  `supabase/tests/*.sql`). Add cross-household tests for every new table (`npm run test:admin-sql`).
- No secret in the app: the bundle holds only the publishable Supabase key (already public). Google OAuth refresh
  tokens, the Claude API key and inbound-mail secrets live in Supabase Edge Function secrets / Vault, never in
  the client. The packaging script greps the bundle for secret patterns.
- Email content is private: store the parsed facts and a short excerpt, keep raw email 30 days max (configurable), never
  log bodies, never send them to analytics. GA4 is not loaded in the app (M1).
- App Store privacy label: email address, family names/ages (user content), no tracking. Before the first TestFlight
  upload (M2), confirm the app's privacy manifest covers UserDefaults (Preferences plugin) as a required-reason API.

### 2.4 Future features: how they fit (designed now, built later)

**Calendar (M4).** `calendar_events` (household_id, title, starts_at, ends_at, all_day, rrule, member_ids[], source
`manual|google|inbox`, external_id, etag). Family member colors already exist (`club_household_colors`). Google:
OAuth via `ASWebAuthenticationSession` (system browser), tokens exchanged and stored server-side by a new Edge Function.
**Minimum scopes:** `calendar.events.readonly` (or `calendar.calendarlist.readonly` + per-calendar read) to import the
calendars she picks, and `calendar.app.created` to write only into one "Family (Organized Mom)" calendar the app
creates. Never full `calendar` scope. Both are Google "sensitive" scopes → OAuth app verification (no paid security
assessment, unlike Gmail's restricted scopes).

**Smart Family Inbox (M5).** Each household gets a private forwarding address
(`<random-token>@inbox.organizedmomcollective.com`). Cloudflare Email Routing on a **subdomain** (so the main domain's
mail is untouched) → an Email Worker verifies the token, strips attachments over a size cap, stores the message, and
calls an Edge Function that asks Claude for structured output (`output_config.format` JSON schema: events, changes,
cancellations, confidence, the quoted sentence it came from). Results land in `inbox_suggestions` as `pending`. **Nothing
touches the calendar until a household adult taps Approve**; approve/edit/dismiss is logged. No Gmail inbox access.

**Sunday Setup (M6).** A guided weekly review that reads this week's events, pending inbox suggestions, cleaning rhythm
and the Club month's plan, then produces a printable week for the wall calendar (the physical calendar stays the family's
shared view; the app never claims to sync paper).

A draft of these tables with RLS is in [schema-draft.sql](schema-draft.sql): **documentation, not a migration**, kept out
of `supabase/migrations/` so nothing can apply it by accident.

---

## 3. Milestones

Each milestone ends on a TestFlight build and needs the owner's go before the next. Nothing goes to production, Stripe or
the live database without explicit approval.

| # | Milestone | Scope | Exit criteria |
| --- | --- | --- | --- |
| **1** | **App foundation + Cleaning + Club in one shell** (this branch) | Capacitor iOS project, custom router, app build + allowlisted bundle, native bridge (external links, durable storage, resume refresh, status bar), unified **Today** screen (today's cleaning + this month's Club plan + family), feature registry with Calendar/Inbox/Sunday Setup off, GA off in app, CI (unit tests + shell checks + macOS simulator build), docs | Bundle builds and passes checks; iPhone-size smoke test passes; simulator build green in CI; website build unchanged; no new failing tests |
| 2 | **TestFlight beta** | Apple Developer account, bundle id, signing in CI (App Store Connect API key), app icons/splash from `public/icons`, Universal Links (`/start` and `/app/*` open the app; needs `apple-app-site-association` on the site), `capacitor://localhost` in `CLUB_ALLOWED_ORIGINS`, Supabase Auth redirect URLs, sign-in tested on device, privacy policy published | 5–10 families (calendar owners + Club test members) on TestFlight for 2 weeks; crash-free; sign-in works |
| 3 | **Accounts step 2 + household members** | Sync cleaning progress to the account (`household_progress`), Keychain session, partner invite (`household_members`, invite by email code), cross-household RLS tests | Two adults on one household see the same progress; no cross-household reads in tests |
| 4 | **Calendar** | `calendar_events`, manual events with member colors and recurrence (RRULE), week view, Google import (read) + write to the app-created calendar, conflict handling, offline queue | Google verification passed; imports a test calendar; edits round-trip |
| 5 | **Smart Family Inbox** | Forwarding address, Email Worker, extraction with Claude, suggestions with approval, retention job, eval set of real (consented) forwarded emails | ≥ target precision on the eval; zero calendar writes without approval |
| 6 | **Sunday Setup** | Guided weekly review, printable week for the wall, push reminders (only if families want them) | Families complete it weekly in beta |
| 7 | **App Store launch** | Store listing, review notes (reader/multiplatform: no in-app purchase, sign in with existing account), support flow | Approved; customer copy updated honestly |

---

## 4. Accounts, keys, services and costs

| Need | When | Cost (check current pricing) | Who |
| --- | --- | --- | --- |
| **Apple Developer Program** (organization enrollment needs a D-U-N-S number) | M2 | $99/year | Owner enrolls |
| App Store Connect API key (`.p8`, Issuer ID, Key ID) as GitHub secrets | M2 (CI signing/TestFlight upload) | free | Owner creates |
| GitHub Actions macOS minutes | M1 onward | macOS minutes bill at a higher rate than Linux on private repos; the iOS job runs only when app files change. Fallback: Xcode Cloud (25 h/month included with the Developer Program) | Owner's GitHub plan |
| A Mac | never required | Claude Code Web + CI builds; TestFlight installs on her iPhone | — |
| Supabase | existing project | no change for M1; later tables fit the current plan | — |
| Google Cloud project + OAuth consent screen + verification | M4 | free; verification takes days–weeks | Owner |
| Cloudflare Email Routing on `inbox.` subdomain + Email Worker | M5 | free tier covers early volume | Owner adds DNS |
| **Anthropic API key** (Edge Function secret only) | M5 | per email ≈ 3k input + 0.5k output tokens. `claude-opus-5-5` ($4/$20 per M tokens) ≈ $0.02/email → ~$1/household/month at 50 emails, which is **17% of a $5.90 membership**. `claude-haiku-5-5` ($0.10/$0.50) ≈ $0.0006/email. Model choice is the owner's, decided on an eval of real emails | Owner |
| Push notifications (APNs key) | M6, only if wanted | free | Owner |

---

## 5. Risks to the website and the Club

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Apple in-app purchase rules** (3.1.1): digital subscriptions sold in-app must use IAP | Rejection, or 15–30% fee on the Club | App sells nothing and shows no prices; members sign in with an account bought on the web (3.1.3(b) multiplatform). Billing stays on the web. The Club's printed mailer helps the case but don't rely on it |
| Thin-wrapper rejection (4.2) | Rejection | Bundled, offline-capable, native link handling, native storage; M2+ adds Universal Links; later push/widgets |
| Build flags leak into production | Club or accounts switched on for the website | Separate `build:app` + `dist-app/`; production `build` untouched; packaging allowlist |
| Shared files changed for the app break the site | Regression on Cloudflare | Native code is runtime-gated and dynamically imported; CI runs the web build + unit tests on every PR; failures compared by name |
| QR / `/start` printed on calendars | Broken printed QR codes | `/start` and `/app/calendar` untouched; M2 Universal Links only add an "open in app" path |
| Etsy buyers can't be verified | Anyone can unlock cleaning in the app, as on the web today | Same honor system as the website ("I have the wall calendar" sets the same device flag). Owner decision if that should change |
| Two storages on iPhone (app vs Safari) | Progress made in Safari isn't in the app | Durable mirror now; account sync (M3) is the real fix; tell beta families |
| Edge Function CORS | Club functions reject `capacitor://localhost` | Add it to `CLUB_ALLOWED_ORIGINS` (M2, owner); RPCs via PostgREST already work |
| Session token in web storage | Token exposure on a jailbroken device | Short-lived access tokens; Keychain in M3 before any Google token exists |
| AI mistakes on the calendar | Wrong events on the family plan | Suggestions only, human approval, source sentence shown, eval gate |
| Email privacy | Sensitive school/medical mail | Subdomain, per-household random address, 30-day raw retention, no logging of bodies, privacy policy section before launch |
| Club not launched / test mode | App beta has nothing to unlock | TestFlight uses Stripe test-mode members and admin grants; no live payments |
| Pre-existing failing tests (56) | Real regressions hide | Compare by name; re-baseline `KNOWN_TEST_FAILURES.md` with owner decisions |

---

## 6. Milestone 1: what's in this branch

1. **Native project:** `capacitor.config.ts` (app id `com.organizedmomcollective.app`, webDir `app-www`), `ios/`
   (Swift Package Manager, no CocoaPods), `ios/App/App/OMCBridgeViewController.swift` (the bridge with `OMCRouter`,
   multi-page routing that can't leave the bundle), storyboard pointed at it. App icon and splash are still
   Capacitor's defaults (M2).
2. **App build:** `npm run build:app` = asset preparation + `astro build --config astro.app.config.mjs` (outDir
   `dist-app`, app flags) + `scripts/build-app-shell.mjs` (allowlist copy, root redirect to `/app`, secret and page
   checks, `app-www/shell-manifest.json`). `npm run ios:sync` copies it into the Xcode project.
3. **Native bridge** `src/lib/native/`: `platform.ts` (detection, never imports Capacitor on the web),
   `links.ts` (in-bundle vs. open-on-website classification, pure and tested), `durable-storage.ts` (Preferences
   mirror + restore, pure core tested), `init.ts` (wires it up from `AppLayout`/`ClubLayout`, resume → refresh event).
4. **Unified Today** (`/app`): today's cleaning reset (if unlocked), this month's Club plan, family, and in the app an
   "I have the wall calendar" unlock that sets the same device flag as the printed QR. Feature registry
   `src/data/app/features.ts`: Calendar, Inbox and Sunday Setup are `planned` and never rendered.
5. **GA4 off inside the app**; the website keeps it.
6. **CI** `.github/workflows/ios-app.yml`: Linux job (whole unit suite, failing only on failures not in
   `tests/known-failures.txt`; app build; shell checks; iPhone smoke test with screenshots as artifacts) and macOS job (`cap sync ios` + unsigned simulator `xcodebuild`).
7. **Docs:** this file, `schema-draft.sql`, README rows.

What M1 deliberately doesn't do: no Apple signing, no TestFlight upload, no database migrations, no Stripe or Edge
Function changes, no Calendar/Inbox UI, no account sync of cleaning progress.

Also changed for the website (small, deliberate): `/app` Today now renders its date, today's zone and the month's Club
card on the device (it showed the build day's date before), the first bottom tab reads "Today" instead of "Home", and
the `dev`/`build` scripts share one `prepare:assets` step (same commands, same order).

### How to run it (Claude Code Web or any Linux box)

```bash
npm run build:app        # dist-app/ → app-www/ (checks fail the build on a leak)
npm run test:app-shell   # serves app-www/ like the iOS router and drives it at iPhone size
```

The Xcode build runs in CI on macOS (`ios-app.yml`); download the simulator `.app` artifact or, from M2, install the
TestFlight build on an iPhone.

### Milestone 1 results (2026-11-14)

CI run [43648076479](https://github.com/Mark-NYC/organized-mom-collective/actions/runs/43648076479), commit `be73a33`:

- **Unit tests:** 55 failed + 1 file that fails to load, 1077 passed, 107 skipped. All 56 failures are the pre-existing
  ones in `tests/known-failures.txt`, matched by name; none new. (The first run, 43647192708, failed because
  vitest's output never reached the comparison script, which then misreported every known failure as passing. The
  list wasn't stale; the script now writes vitest's output to a file and fails loudly if it can't read a result.)
- **App bundle:** 71 member pages, 766 files, 39.9 MB; 178 website pages left out; no tracker, secret or sales page.
- **iPhone-size smoke test:** all pages load with no script errors, missing files or horizontal overflow; unlock →
  cleaning → checkmark survives reload; `/shop` opens on the website.
- **iOS Simulator build (macos-15, unsigned):** `BUILD SUCCEEDED`. The binary contains `OMCRouter` and
  `OMCBridgeViewController`, the compiled storyboard instantiates `App.OMCBridgeViewController`, and the app holds
  the member bundle and the App, Browser and Preferences plugins. **Not run yet:** launching it on a simulator or
  an iPhone. Routing, storage and safe areas are verified only in Chromium so far.

Screenshot review: Today, Cleaning and Account render cleanly at 393 px, and the tab bar is right (Cleaning shows only
after unlock). Problems found in screens Milestone 1 didn't change, to fix before TestFlight:

1. **`/club/login` has no app tab bar.** Its header links only to Club pages, and the app has no browser back button,
   so you can't get back to Today from it. Give ClubLayout pages a way back to Today in the app.
2. **Two logos on Club pages**: "Organized family Club" in the top bar and "The Family Meeting Club" under it. This is
   the open naming decision.
3. **Account shows the fictional Rivera family when signed out.** It's labeled as a sample, but in an app it reads as
   someone else's data. Show a sign-in prompt instead.
4. The iOS app icon and splash screen are still Capacitor's placeholders.

### What still blocks TestFlight (Milestone 2)

| Blocker | Who |
| --- | --- |
| Apple Developer Program membership ($99/yr; an organization needs a D-U-N-S number) | Owner |
| Bundle ID `com.organizedmomcollective.app` registered; App Store Connect app record | Owner |
| App Store Connect API key (Issuer ID, Key ID, `.p8`) as GitHub secrets, then a signed archive + upload job | Owner → then CI |
| Real app icon and splash from the brand files | Design |
| The three navigation and content problems above | Code |
| Sign-in inside the app: add `capacitor://localhost` to `CLUB_ALLOWED_ORIGINS` (Edge Function secret) and test the code email | Owner approves, then test |
| A test member: Stripe **test mode** checkout or an admin grant, so the Club has something to open | Owner |
| `/privacy` published (App Store requires a privacy policy URL; the Club already needs it before launch) | Owner |
| Privacy manifest check (UserDefaults via Preferences) and App Store privacy answers | Code + owner |
| First real-device pass: routing, storage that survives an app restart, safe areas, sticky headers on plan pages, swipe-back | Owner's iPhone via TestFlight |
