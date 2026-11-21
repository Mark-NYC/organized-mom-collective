# Organized Family: public App Store launch

The plan for launching **Organized Family** as a free iPhone app, with Family Meeting Club available by invitation
through complimentary access the owner grants. Status as of 2026-11-21. Nothing in this document has been applied to
production, uploaded to App Store Connect or submitted to Apple. Each of those steps needs the owner's approval.

Related: [TESTFLIGHT.md](TESTFLIGHT.md) (signing and upload), [RELEASE_READINESS.md](RELEASE_READINESS.md),
[MIGRATION_DEPLOYMENT_PLAN.md](MIGRATION_DEPLOYMENT_PLAN.md), [OWNERSHIP_AND_BILLING_POLICY.md](OWNERSHIP_AND_BILLING_POLICY.md),
[../brand/OUR_WEEK.md](../brand/OUR_WEEK.md) (no purchasing in the app).

## 1. What launches

| Free for everyone (download and account) | Family Meeting Club (by invitation in the app) |
| --- | --- |
| Family calendar, cleaning companion, weekly Family Meeting, shared responsibilities and agreements, household with a second adult, calendar subscriptions and Google Calendar | The Club meeting, monthly Club months and resources, Welcome Family Rhythm, personalization and the development (MAWL) layer |

- **The app sells nothing.** The app build sets `PUBLIC_CLUB_CHECKOUT_ENABLED=false` and `PUBLIC_SHOP_ENABLED=false`
  (`scripts/build-app.mjs`). `classifyLink` keeps `/club` inside the app (Club Home) and maps `/club/dashboard` to
  Account. The Club gates in the app point to Club Home, never to a sales page.
- **Non-members see one plain line:** "Family Meeting Club is currently available by invitation." plus what stays free
  (`src/data/club/invitation.ts`). There's no price, trial, "join" or upgrade wording (unit-tested).
- **iPhone Club is invitation-only.** The iOS app's Club views require both `club_me().access` and a live
  `club_me().grant`. A Stripe-only web membership does **not** unlock Club in the iOS UI. The website retains its
  existing paid and complimentary access rules. This is a platform-specific presentation rule, not a claim that
  Supabase can authenticate which physical platform calls a shared RPC.
- **Complimentary grants include the second adult.** `20261208` makes the partner's `club_me().grant` reflect
  the owner's live grant. Web subscribers can also be individually invited to iOS Club without changing their billing.
- **Where the iOS rule is applied** (app build only; `appShellBuild()`):

  | Club surface in the app | Reads | Without a live grant |
  | --- | --- | --- |
  | Club Home, months list, Club gates, `/app/club/<month>` | `loadMembership` → `membershipForAppStore` | preview + invitation line |
  | Weekly Family Meeting (Club kind) and the MAWL layer | `accountStore.me` (via `useMeetingAccess`) | free meeting, no development layer |
  | A month opened directly (`/club/resources/<slug>`; `/app/club/november` links to it) | `loadResource` / `saveResource` / `approveResource` | closed, invitation text |
  | Welcome Family Rhythm | `loadWelcomePlan` and its save/approve | closed |
  | Family Vision print (`/club/family-vision`) | `loadWelcome` (returns nothing) and its save/approve | nothing to show |
  | Kit documents (chart editor, kit pages) | `accountStore.documents` / `saveDocument` | closed |

  The last four were added on 2026-11-21 after the app-bundle e2e showed a paid-only member could open the November
  month from a link inside the app ("Saved to your account"). That's fixed and covered by tests now.
- **Server permissions are shared and platform-blind.** The same Supabase RPCs serve the website and the app, and the
  server can't tell which one is calling. A paid subscription still passes `club_has_access` / `club_can_open` on the
  server, so a paid member calling the RPCs directly (outside the app's screens) gets their paid content. That's the
  same content they can open on the website anyway. **Nothing unpaid becomes reachable this way.** Free accounts are
  refused by the server (`not_found` / `club_required`, tested), and only an owner admin can create a grant (server-side,
  tested). The iOS rule controls what the app shows; it is not a server-side platform check, and we don't describe it
  as one.
- **Website billing is unchanged.** Checkout, the Stripe webhooks, invoices, monthly kits, PDFs, fulfillment and the
  Responsibility Card artwork are untouched.

## 2. Complimentary Club access (20261208)

It reuses the Club's existing grant table, `club_access_grants`, from 20261020, which `club_has_access` and the 20261128
household logic already honor. No new entitlement system.

| Requirement | How |
| --- | --- |
| Admin finds a person by email | `club_admin_access_search(query)`: at least 3 characters, escaped `ilike`, 20 results |
| Grant to the household | `club_admin_access_grant(user, expires_at?, note?)`: one `complimentary` grant on the **household owner's** account (`club_access_grant_target`). Every adult gets it through `household_billing_user` (20261128) |
| Revoke | `club_admin_access_revoke(user, note?)`: ends the live grants on every adult in the household. Never touches `club_subscriptions` or `club_invoices` |
| Optional expiry | Set or clear with `club_admin_access_expiry`. Future dates only. The dashboard date means through the end of that day |
| Audit | Every grant, revoke and expiry change goes to the append-only `admin_audit_log` (`club.access.*`), and the grant row keeps `granted_by`, `revoked_by` and `updated_at` |
| Server-side only | All five functions are `security definer`. Each one checks `is_admin('owner')` first and raises `forbidden` otherwise. RLS on the grant table is unchanged (no client writes). A family calling `club_admin_access_grant` on itself gets an error (SQL and e2e tests) |
| Paid stays paid | Status reads Free, Complimentary Club, Paid Club, or Paid Club + Complimentary. Revoking the complimentary part of a paying household leaves Paid Club. If the subscription ends while complimentary is live, access continues |
| Partner sees it | `club_me` now returns the household's grant to the second adult. Before, it returned `null` |

**Admin UI:** `/admin/club` → **Club access** tab (`src/components/admin/ClubAccessAdmin.tsx`). Search by email, see the
household and its adults, see the status, grant with a note and optional expiry, change or clear the expiry, revoke, and
see who did what and when (the last 20 events). It uses the existing owner sign-in and `adminRpc` only.

## 3. App Review compliance audit

Apple's App Review Guidelines were read on 2026-11-20 (page dated October 16, 2026).

| Area | Status | Notes |
| --- | --- | --- |
| **3.1.1 / 3.1.3(b) digital unlocks** | Mitigated, owner decided; residual risk | See 3.1 below |
| 3.1.3(e) physical goods | OK | The wall calendar and Club mailings are sold on the website, never in the app |
| 4.8 Sign in with Apple | Not required | Sign-in uses the app's own email-code accounts. No third-party or social login (Google is only a calendar connection, not a sign-in) |
| 5.1.1(v) account deletion | OK | Account → "Delete my account", inside the app (`FamilySummary.tsx`) |
| 5.1.1(i) privacy policy in the app | OK | Account links to the Privacy Policy, Terms of Service and Help & support (opens the website). Also needs the Privacy Policy URL field in App Store Connect |
| 2.1 reviewer access | Ready in code | Password sign-in is a quiet secondary option on `/app/sign-in`, because reviewers can't receive email codes. Nobody can create a password in the app. Only the owner sets one in Supabase Auth |
| Privacy manifest | OK | `PrivacyInfo.xcprivacy`: no tracking; email, name and user content, linked, app functionality |
| Privacy nutrition label | Owner | Answer to match the manifest. Calendar events, Google Calendar data and child first names and birth months count as user content, linked, not used for tracking |
| Permissions | OK | No usage-description prompts (no camera, photos, location, contacts or notifications) |
| Encryption | OK | `ITSAppUsesNonExemptEncryption = false` (HTTPS only) |
| Minimum iOS | 15.0 | iPhone only (`TARGETED_DEVICE_FAMILY = 1`) |
| Version / build | 1.0 (1) | Bump `CURRENT_PROJECT_VERSION` for each upload |
| Icon | **Gap** | The 1024px icon is the 512px seal enlarged. Supply a true 1024px master before the listing |
| Launch screen | OK | Real seal, no invented art |
| Signed upload | **Not yet run** | Needs the `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8` secrets ([TESTFLIGHT.md](TESTFLIGHT.md)) |
| Name, subtitle, description, keywords, category, screenshots, age rating, support URL | Owner | App Store Connect. Suggested category: Lifestyle (secondary: Productivity) |

### 3.1 The real risk: unlocking the Club without In-App Purchase

Guideline 3.1.1 governs unlocking digital content and functionality, and 3.1.3(b) addresses multiplatform
services. **For the initial iOS launch, the app shows Club content only when the household has a live manual Club grant.**
A Stripe subscription alone works on the website but does not unlock the Club iOS interface. This reduces the
external-purchase risk but Apple may still evaluate the complimentary digital feature under its own rules.

What works in our favor:
- The app never mentions a price, never links out to buy, and says the Club is by invitation.
- Complimentary access is free. Nobody pays to unlock anything in the app.
- The Club's core is physical (monthly mailed kits, the calendar). That falls under 3.1.3(e), physical goods.

What could still draw a rejection: Apple may classify the Club as a digital premium tier even with free
invitation grants. The app does not direct users to web purchases. Review notes should describe this accurately.
If Apple objects, respond to the actual Guideline cited; do not imply that iOS unlocks paid web subscriptions.

**Technical limitation:** The iOS-only rule uses live grant data returned by Supabase and is enforced consistently
by the app's membership and Club store screens. The shared Supabase Club RPCs also serve the website, where
paid subscriptions remain valid. The mobile bundle is not a cryptographic authorization boundary. Do not
describe the iOS filter as server-side platform enforcement.

## 4. Reviewer accounts (owner only, never in Git)

Two demo accounts, set up by the owner after 20261208 is applied:

1. Supabase dashboard → Authentication → Add user → **Create new user**, with an email the owner controls (for example
   `appreview-free@…`), **Auto Confirm**, and a strong generated password from a password manager.
2. A second user for the Club (for example `appreview-club@…`) set up the same way.
3. In the app (or on the website), sign in once as each one and set up a small sample family: one adult and one child
   aged about 8–11, so the Club meeting has a next step.
4. Admin → Club → **Club access** → search the Club reviewer's email → Grant, note "App Review", no expiry.
5. Put both emails and passwords **only** in App Store Connect → App Review Information → Sign-in required. Never put
   them in Git, issues, PRs, chat or email.
6. After approval, revoke the Club grant or rotate the passwords if you prefer.

No passwords are generated or stored by code. The only password in the repository is the throwaway test backend's
`e2e-test-password`, which works only against `scripts/e2e/test-backend.mjs`.

### App Review notes (paste into App Store Connect)

> Organized Family is a free family planning app: a shared family calendar, a cleaning routine, a weekly Family Meeting
> and shared responsibilities for the whole household. All of these are free, with no purchases in the app.
>
> Sign in: on the first screen tap "Have a password? Sign in with it" and use the accounts below. (Families normally
> sign in with a code sent by email.)
>
> Account 1 (free): shows the free experience. Club areas say "Family Meeting Club is currently available by
> invitation."
> Account 2 (Club by invitation): has complimentary Family Meeting Club access, granted by us at no charge. It shows the
> Club version of the weekly Family Meeting and the monthly Club content.
>
> The app contains no purchases, prices or links to buy. Family Meeting Club access in the app is by invitation only
> and free: a payment made anywhere else does not unlock anything in the app.
> Separately, we sell a physical wall calendar and a mailed monthly family kit on our website. Those are physical goods
> delivered by mail and are not sold or promoted in the app.
>
> Account deletion: Account → Delete my account.

## 5. Migrations: order, dependencies, rollout

Production, re-checked read-only on **2026-11-21** (migration ledger plus the objects themselves): every migration through
**20261129**, plus 20261201, 20261205 and 20261206 (production records them under the timestamps it applied them, by
name). **Pending in the repo and not on production:** 20261130, 20261202, 20261203, 20261204, 20261207, 20261208. Object
check: no `household_development` table; no `club_admin_access_*` functions; the grant reason check is still
`('preview','beta')`; every dependency of 1207/1208 is present; `club_me` still has the exact `'grant', null,` text
20261208 patches. Rows at check time: 11 households, 11 subscriptions (10 active), **0 Club grants**, 27 agreements.

**The 10 active paying households will see the free app** until each one is granted complimentary access (Admin → Club
access). Their website membership is unaffected.

This launch needs **20261207** (the development records the Club meeting's MAWL layer writes) and **20261208**
(complimentary access). Both were verified on the production migration set **without** 20261130 or 20261202–04, by
`scripts/rehearse-launch-migrations.sh` (CI: household-db job). It builds production's set with realistic rows, then
applies 1207 and then 1208 each by itself (preflight, apply, verify), and checks that every existing household, adult,
person, agreement, subscription, paid month and grant is unchanged. It exercises both migrations (grant from the second
adult, revoke, re-grant, paid + complimentary, no self-grant, subscription row untouched), rolls back 1208 then 1207
(schema fingerprint identical; every earlier row intact; the one agreement made through a development step kept by
design), and re-applies both. The other pending migrations are not part of this release. Don't apply them
alongside it.

| Order | Migration | Depends on | Rollout files |
| --- | --- | --- | --- |
| 1 | 20261207 family_development_records | 20261124, 20261127, 20261128 (on production) | `supabase/rollout/family-development/{preflight,verify,rollback}.sql` |
| 2 | 20261208 club_complimentary_access | 20261020, 20261023, 20261104, 20261124, 20261128 (on production) | `supabase/rollout/club-complimentary/{preflight,verify,rollback}.sql` |

20261208 doesn't need 20261207. The order is only so that the Club meeting's MAWL layer works the moment the first grant
is made.

## 6. Production deployment checklist (for the owner's approval; nothing done yet)

1. Merge the PR after review, and wait for CI to pass on `main`.
2. **Fresh, verified backup:** run the `db-backup` workflow right before step 3, and confirm it finished and restored
   in its self-test. Note the backup id. Don't continue on an older backup.
3. **20261207:** run `supabase/rollout/family-development/preflight.sql` (all checks pass), then apply
   `20261207000000_family_development_records.sql` **by itself** (SQL editor, or `psql -f`). **Do not use
   `supabase db push`.** It would also apply 20261130 and 20261202–04, which aren't part of this release. Then run
   `verify.sql`.
4. **20261208:** run `supabase/rollout/club-complimentary/preflight.sql` (7/7, and save its snapshot output), apply
   `20261208000000_club_complimentary_access.sql`, then run `verify.sql` (5/5). Compare the snapshot: the existing grants,
   subscriptions and function fingerprints should be unchanged.
5. Record both versions in `supabase_migrations.schema_migrations` (version, name), so later pushes skip them.
6. Deploy the website: the `/admin/club` access tab, the invitation copy and password sign-in.
7. Smoke test: admin → Club access → search your own test email → status shown. Grant a test household, check the Club
   meeting on the website, then revoke.
8. Then build and upload the app (section 7).

**Rollback:** `supabase/rollout/club-complimentary/rollback.sql` reverts the `club_me` patch, drops the new functions and
columns, and turns `complimentary` grants into `beta` grants, so families keep access. Then use
`family-development/rollback.sql` if 20261207 must also go. Website rollback: redeploy the previous build.

## 7. App Store Connect submission checklist (for the owner's approval; nothing done yet)

1. Add the four Apple secrets ([TESTFLIGHT.md](TESTFLIGHT.md)) and run **iOS TestFlight** by hand. Fix whatever the
   first signed run reports.
2. Install from TestFlight on a real iPhone. Sign in with a code. Check the free features, the invitation line on Club
   Home and account deletion (on a throwaway account).
3. Replace the app icon with a true 1024px master, and bump the build number.
4. App Store Connect → the app: name **Organized Family**, subtitle, description, keywords, category, age rating, support
   URL, marketing URL, **Privacy Policy URL** (`https://www.organizedmomcollective.com/privacy`), and Price: Free.
5. App Privacy: answers that match the privacy manifest (section 3).
6. Screenshots: 6.9" and 6.5" iPhone, of real app screens only.
7. App Review Information: the two reviewer accounts (section 4), contact details, and the notes above.
8. Choose the build, then **Submit for Review**. That's your decision. Release manually after approval.

## 8. Tests

| Test | What |
| --- | --- |
| `supabase/tests/club-complimentary-access.sql` | 60 checks: owner only (families, anonymous callers and non-owner `helper` admins refused), grant goes to the household owner, both adults, expiry, revoke all, paid untouched, paid + complimentary, audit, no self-grant, MAWL with 20261207. Runs in `scripts/test-household-sql.sh` |
| `tests/app-store-launch.test.ts` | Invitation copy, no purchase wording, app build flags, policy links, deletion, password sign-in, admin labels, owner checks |
| `scripts/e2e/club-access-e2e.mjs` | The real admin dashboard and family pages in Chromium (iPhone size): 15 scenarios, plus the app bundle (`app-www`): a paid-only member sees the free app, and the Club opens after a grant. CI: `family-e2e` job |
| `scripts/rehearse-launch-migrations.sh` | Production's migration set → 1207 alone → 1208 alone → use → rollback → re-apply, with data checks (section 5). CI: `household-db` job |
| `tests/app-store-launch.test.ts` (loaders) | In the app build, months, welcome plan, Family Vision and kit documents never reach the server without a grant; with a grant they open; on the website nothing changes |

## 9. Release verification (2026-11-21, PR #516)

Results from CI runs and local runs. "Passed" means the job or script ran and passed. Anything that wasn't run says so.

### CI (GitHub Actions)

| Check | Commit | Result |
| --- | --- | --- |
| Verify Astro build (website build + checks) | 425f3a2, e6988b0 | passed |
| web-shell: unit tests, app bundle build, iPhone-size smoke test | 425f3a2, e6988b0 | passed |
| household-db: all household SQL suites, production-schema step, household / calendar / Google rollback rehearsals, **launch migrations rehearsal** | 425f3a2, e6988b0 | passed |
| family-e2e: family flow (two phones, offline, isolation), calendar subscriptions, Google Calendar, **free + complimentary Club e2e (website and app bundle)** | 425f3a2, e6988b0 | passed |
| ios-simulator: unsigned simulator build, launch and interaction test (XCUITest), family flow in the real app (XCUITest) | f94cc3e | passed |
| ios-simulator | 425f3a2 | failed: the launch test's tap on the Cleaning tab didn't register, so Today stayed on screen ("Not found: first Daily Reset task"). App code is the same as f94cc3e. Fixed in the test (e6988b0): it confirms the tab opened, and taps again if not |
| **ios-simulator: build, launch test, family flow** | **e6988b0** (current app code) | **passed** |
| ios-simulator | ae3e5bb | failed: test-timing artifact, not a regression. The test checked off a cleaning task at 23:58 UTC and relaunched after midnight, so the new day correctly showed 0 of 5. Passed again on f94cc3e |
| iPhone app: TestFlight, check only (unit tests, app bundle leak check, `cap sync`, **Release archive**, unsigned) | e6988b0 | **passed**. Key and upload steps skipped (no secrets) |
| Signed TestFlight upload | — | **never run.** Needs `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` |

PR builds skip the simulator job by design. It runs on push builds.

### What the simulator tests cover, and what they don't

- **Covered in the iOS Simulator:**
  - Launch, the four tabs, safe areas (status bar, home indicator) and the Account panel when signed out.
  - The sign-in screen, and progress surviving a relaunch and a wiped web view.
  - Signing in against the test backend, the shared calendar, the weekly Family Meeting with the Club layer and a MAWL next step added to the plan, cleaning, close and reopen.
- **Covered in Chromium against the real app bundle (`app-www`), not in the simulator:**
  - Account deletion (free and paid-account rules), sign-out and signing in as someone else.
  - A free household, and a paid-only household seeing the free app and the invitation.
  - The Club opening after a grant, and a Club month opened directly staying closed.
- **Unit tests only:** the Privacy Policy, Terms and Help links and where they open.
- **Not tested on a real iPhone.** That happens with TestFlight (section 7).

### Club access rules (the app's firm rule: only a live complimentary/beta grant opens the Club)

| Scenario | Result | Where |
| --- | --- | --- |
| Free household: no Club in the app, and the server refuses Club content | passed | e2e (website + app), SQL |
| Paid website member without a grant: free meeting, Club Home preview, invitation, month opened directly stays closed | passed | e2e on `app-www`; unit (loaders never reach the server) |
| Complimentary household: Club meeting, MAWL, months | passed | e2e, SQL |
| Both adults get it (grant found from either adult's email) | passed | e2e, SQL, rehearsal |
| Expired or revoked grant: Club closes for both adults; family data kept | passed | e2e, SQL |
| Paid + complimentary: Club in the app while the grant is live; subscription ending keeps access | passed | e2e, SQL |
| Revoking complimentary never touches Stripe (subscription row unchanged) | passed | e2e, SQL, rehearsal; the migration has no write to `club_subscriptions` / `club_invoices` (unit) |
| Paid website membership unchanged on the website | passed | e2e (paying member opens their month on the website), unit |
| Nobody grants themself; admins who aren't owners are refused; anonymous callers refused | passed | SQL, e2e, rehearsal |
| Admin: search, household, status, grant, expiry set/clear, revoke, re-grant, history | passed | e2e (real `/admin/club` page), SQL |

### Purchase audit of the app bundle (`app-www`, 2026-11-21)

- No `checkout.stripe.com`, `buy.stripe.com`, `js.stripe.com` or billing-portal URLs anywhere in the bundle.
- `/club/join`, `/club` and `/club/dashboard` are excluded from the build. Nothing in the app links to `/club/join`. In the app, `/club` maps to Club Home and `/club/dashboard` to Account.
- The `club-billing` client code is bundled with the shared membership module, but its only callers (the dashboard, the join page) aren't in the app.
- No visible price, "subscribe", "upgrade", "join the Club" or "free trial" wording. The only "$" text is the free tools' "Under $25" budget filter. "Subscribe" appears only in the calendar's iCal help text.
- Every Club gate in the app shows "Family Meeting Club is currently available by invitation." plus what stays free.
