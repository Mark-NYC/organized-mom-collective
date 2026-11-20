# Organized Family: public App Store launch

The plan for launching **Organized Family** as a free iPhone app, with Family Meeting Club available by invitation
through complimentary access the owner grants. Status as of 2026-11-20. Nothing in this document has been applied to
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
- **In the app, the Club opens only for an explicit live grant** (owner decision, 2026-11-20). A paid website
  subscription alone shows the free app. A household with both a subscription and a grant gets the Club.
  `membershipForAppStore` (`src/lib/club/membership.ts`) and `accountStore.me` (`src/lib/club/store.ts`) apply this
  in the app build only, reading the live grant that `club_me` returns to both adults (20261208). This decides what the
  app shows, not what the server allows. The server entitlement is still `club_has_access()`: a paid subscription OR a
  live grant. On the website, paid members keep the Club exactly as before.
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

Guideline 3.1.1 says apps "may not use their own mechanisms to unlock content or functionality". 3.1.3(b), multiplatform
services, allows content bought elsewhere to be accessed in the app only if it is also offered through IAP. **Decided
(2026-11-20): in the app, Club features open only for complimentary (or beta) grants, never because of a website
payment.** Nothing bought anywhere unlocks anything in the app.

What works in our favor:
- The app never mentions a price, never links out to buy, and says the Club is by invitation.
- Complimentary access is free. Nobody pays to unlock anything in the app.
- The Club's core is physical (monthly mailed kits, the calendar). That falls under 3.1.3(e), physical goods.

Residual risk, **uncertain, and I can't verify how Apple will rule**: a reviewer could still question invitation-only
content for which no in-app purchase is offered. The review notes answer that directly: access is free and granted
by us, and there's nothing to buy. The trade-off: paying website members see the free app until they're also granted
access. Grant them from Admin → Club access if you want them to have the Club in the app. If Apple still objects, the
remaining option is IAP for the Club's digital layer. That's a pricing, tax and fulfillment decision, out of scope here.

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

Production (read-only check, 2026-11-20) has every migration through **20261129**, plus 20261201, 20261205 and
20261206. **Pending in the repo and not on production:** 20261130, 20261202, 20261203, 20261204, 20261207, 20261208.

This launch needs **20261207** (the development records the Club meeting's MAWL layer writes) and **20261208**
(complimentary access). Both were verified on the production migration set **without** 20261130 or 20261202–04: CI step
"production schema" and the local rehearsals. The other pending migrations are not part of this release. Don't apply them
alongside it.

| Order | Migration | Depends on | Rollout files |
| --- | --- | --- | --- |
| 1 | 20261207 family_development_records | 20261124, 20261127, 20261128 (on production) | `supabase/rollout/family-development/{preflight,verify,rollback}.sql` |
| 2 | 20261208 club_complimentary_access | 20261020, 20261023, 20261104, 20261124, 20261128 (on production) | `supabase/rollout/club-complimentary/{preflight,verify,rollback}.sql` |

20261208 doesn't need 20261207. The order is only so that the Club meeting's MAWL layer works the moment the first grant
is made.

## 6. Production deployment checklist (for the owner's approval; nothing done yet)

1. Merge the PR after review, and wait for CI to pass on `main`.
2. **Backup:** run the `db-backup` workflow (or Supabase → Database → Backups → confirm today's backup), and note the backup id.
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
| `supabase/tests/club-complimentary-access.sql` | 56 checks: owner only, grant goes to the household owner, both adults, expiry, revoke all, paid untouched, paid + complimentary, audit, no self-grant, MAWL with 20261207. Runs in `scripts/test-household-sql.sh` |
| `tests/app-store-launch.test.ts` | Invitation copy, no purchase wording, app build flags, policy links, deletion, password sign-in, admin labels, owner checks |
| `scripts/e2e/club-access-e2e.mjs` | The real admin dashboard and family pages in Chromium (iPhone size): 15 scenarios, plus the app bundle (`app-www`): a paid-only member sees the free app, and the Club opens after a grant. CI: `family-e2e` job |
| `supabase/rollout/club-complimentary/*` | Preflight, verify and rollback, rehearsed locally: apply → verify → rollback → re-apply |
