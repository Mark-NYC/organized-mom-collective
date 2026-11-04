# Club launch P0 rollout (prepared Nov 4 2026)

Goal: a mother can sign up, onboard, personalize her family, approve her January (Our Family Weekly Meeting) and her
Family Vision print, and her Welcome Kit enters print-and-mail fulfillment. **Each production step needs the owner's
go-ahead.** Stripe stays in test mode until step 7.

| # | Step | Who | Status |
| --- | --- | --- | --- |
| 0 | Merge the P0 PR (family form fix, January personalization fixes, tests) | owner | waiting |
| 1 | Pre-flight, read-only: `supabase/rollout/launch-p0/01-preflight.sql` | Claude | **done Nov 4: all ok** (5 test claims, 8 test orders) |
| 2 | Apply `20261110000000_club_welcome_kit_approvals.sql`, then `20261113000000_club_household_icon_style.sql` | owner or Claude | waiting |
| 3 | Verify, read-only: `03-verify.sql` (every row ok) | Claude | after 2 |
| 4 | Deploy `club-billing`, `club-admin`, `club-webhook` from `supabase/dashboard/` (Verify JWT **off**) | owner or Claude | after 2 |
| 5 | Cancel the test subscriptions in the Stripe **test** dashboard, then run `04-cleanup-test-data.sql` | owner, then Claude | waiting |
| 6 | Production test in Stripe test mode, with a fresh email and an address never used before (checklist below) | together | after 4–5 |
| 7 | Go live: live key, `CLUB_LIVE_CHECKOUT=enabled`, Set up Stripe (live), Setup → checkout live (docs/club/MEMBERSHIP.md → Going live) | owner | last |

Until step 7, consider hiding the public "Get My First Month Free" button (`PUBLIC_CLUB_CHECKOUT_ENABLED=false` in
Cloudflare Pages, rebuild): a real visitor's card fails in Stripe test mode.

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
