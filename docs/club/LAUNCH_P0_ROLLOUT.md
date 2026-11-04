# Club launch P0 rollout (prepared Nov 4 2026)

Goal: a mother can sign up, onboard, personalize her family, approve her January (Our Family Weekly Meeting) and her
Family Vision print, and her Welcome Kit enters print-and-mail fulfillment. **Each production step needs the owner's
go-ahead.** Stripe stays in test mode until step 7.

| # | Step | Who | Status |
| --- | --- | --- | --- |
| 0 | Merge the P0 PR (family form fix, January personalization fixes, tests) | owner | **done** (#342, #343) |
| 1 | Pre-flight, read-only: `supabase/rollout/launch-p0/01-preflight.sql` | Claude | **done Nov 4: all ok** (5 test claims, 8 test orders) |
| 2 | Apply `20261110000000_club_welcome_kit_approvals.sql`, then `20261113000000_club_household_icon_style.sql` | owner or Claude | **done Nov 4** |
| 3 | Verify, read-only: `03-verify.sql` (every row ok) | Claude | **done Nov 4** |
| 4 | Deploy `club-billing`, `club-admin`, `club-webhook` from `supabase/dashboard/` (Verify JWT **off**) | owner or Claude | #342 versions done; #343: `club-billing` done, `club-admin` + `club-webhook` **waiting** |
| 5 | Cancel the test subscriptions in the Stripe **test** dashboard (keep `sub_1UYBU5…` until your test is done), run `05-cleanup-keep-current-test.sql`; after your test, cancel that one too and run `04-cleanup-test-data.sql` | owner | waiting |
| 6 | Production test in Stripe test mode, with a fresh email and an address never used before (checklist below) | together | after 4–5 |
| 7 | Go live: live key, `CLUB_LIVE_CHECKOUT=enabled`, Set up Stripe (live), Setup → checkout live (docs/club/MEMBERSHIP.md → Going live) | owner | last |

Test-mode checkout is private since #343: `/club` shows "Enrollment opens soon" to visitors, and `club-billing` refuses
a test-mode checkout unless it comes from `/club?test-checkout=1`. Checkout is card only (Apple Pay / Google Pay
included; no Link, Klarna, Cash App, etc.).

## Step 7 runbook: prepare live Stripe without taking payments

1. Deploy `club-admin` and `club-webhook` from #343 (live setup needs them).
2. Supabase → Edge Functions → Secrets: set `CLUB_STRIPE_SECRET_KEY` to the **live** secret key. Leave
   `CLUB_LIVE_CHECKOUT` unset. Checkout now refuses everyone (`live_checkout_disabled`) and `/club` shows
   "Enrollment opens soon". Test checkout and test webhooks stop too, so do this only after your test.
3. `/admin/club` → Setup → **Set up Stripe**. Creates in live: product, $5.90 monthly price (`club_monthly_v2`),
   customer portal (replaces the test portal id) and the webhook endpoint (secret stored as `webhook_secret_live`).
4. Check in the Stripe **live** dashboard: product + price, portal (cancel at period end, no plan switching),
   webhook endpoint pointing at `/functions/v1/club-webhook`. Card payments enabled in Settings → Payment methods.
5. **Activation, only with the owner's explicit approval:** set `CLUB_LIVE_CHECKOUT=enabled`, then Setup → checkout
   mode **live**. Run one real $0 founding checkout with your own card and cancel it.

To back out at any step: put the test key back (and remove `CLUB_LIVE_CHECKOUT`).

## What each step fixes

- **The site fix (step 0)** restores onboarding on its own: the family form retries without the illustration style if
  the database refuses it, so families can get past step 1 even before step 2.
- **20261110** retires the three-day automatic confirmation (still live on production), adds the two-business-day
  mail-by date, the owner's notification lookup and the Family Meeting guide review. No existing row changes.
- **20261113** lets the family form save the illustration style (`hand-drawn` / `soft-color` only). No data changes.
- **Functions:** `club-billing` adds the owner's "Welcome Kit ready to prepare" email and the one-free-month-per-household
  notice in Stripe Checkout; `club-admin` the second reminder; `club-webhook` the three-item Welcome Kit welcome email.
- **Cleanup:** test-mode free-month claims hash the emails, addresses and cards used in testing, so a real family at
  one of those addresses (yours included) would be refused its free month. Their 8 unprinted orders are canceled so
  none can reach the print queue. Accounts, families, addresses, saved plans and entitlements stay. Test accounts that
  already subscribed still can't get a free month again on the same account: use a fresh email for step 6.

## Step 6 checklist (the first-month experience)

1. `/club` → Get My First Month Free → Stripe Checkout (test card 4242…) shows $0 today, $5.90 on February 1, 2027, and
   the one-free-month notice.
2. Back on `/club/welcome`, sign in with the emailed code.
3. Family: you, a partner or grandparent, two or three children with ages → **Next saves** (this was broken).
4. Profile questions: answer one, skip one; Finish later once, then continue.
5. Welcome Kit page: approve the Family Vision print (family name, word); look at the Family Meeting guide; open
   January, check every name and each child's part, change one line, approve it.
6. "Your Welcome Kit is submitted"; the owner's inbox gets "Welcome Kit ready to prepare" with a mail-by date.
7. `/admin/club` → Welcome Kits: one row, print + guide + January, mail-by date. Print views: January shows your
   change and your family's names; the print shows your family name. Make both PDFs; don't mark anything mailed.
8. Sign out, sign in on your phone: Club Home shows the kit as getting ready; January keeps your change.

## Checked locally (Nov 4 2026, `main` + this PR)

Fresh database with every migration: onboarding e2e (all scenarios, desktop and mobile, including the family form on
a database without 20261113 and the Okafor-family first-month personalization: six names on screen and in the January
PDF, no sample names, no assumed Mom/Dad, no fall wording, parts by age, Family Vision PDF with her family name),
every monthly tool, Family Meeting QA, `npm run test:club`, `npm run test:admin-sql`, the cleanup script on a copy.

Known, not part of this rollout: `20261102000000_shop_gelato_private_storage.sql` doesn't apply on an empty database
(its check is fixed by the next migration), which stops the local Club database tests; CI runs none of them. April's
and December's tools still default adults to "Mom"/"Dad" (later months, reviewed month by month).
