# Organized Family Club: paid membership (operations and setup)

**Status (2026-10-26):** built, tested, database applied to production, Edge Functions deployed. **Nothing can be bought yet**: the Club has no Stripe key, checkout is `off`, and the site flags are off. Live payments need the owner's explicit approval.

Guiding principle: **One family. One monthly problem. One tailored plan. Delivered ready to use.**

## The two plans

| | Monthly · $5/month | Annual · $60/year |
| --- | --- | --- |
| Digital | The month each paid invoice covers (a November 2 joiner gets November; December's payment unlocks December) | The twelve consecutive months starting with the month paid, unlocked at once |
| Printed mailing | One per paid month (from `first_mailing_month`), for the earliest month whose list is still open when she pays: join Nov 2 → December's; join Nov 20 → January's | Twelve consecutive, from the first open list |
| Renewal | Each paid month adds that month | The renewal adds the next twelve as **membership year 2** |
| Failed payment | Nothing new until it's paid; months already received stay | Same |
| Cancel | At period end (Billing Portal); everything received stays, read and print only | Same |
| Refund (full) / chargeback | Revokes exactly the months that invoice granted, cancels their unmailed mailings | Same |
| Plan change | Monthly → annual: charged now, twelve months from now (the current month isn't granted twice). Annual → monthly: takes effect at the end of the paid year | |

No automatic discount. Pausing isn't offered (a paused or unpaid subscription pays no invoice, so it grants nothing).

## How access works (why it's safe)

- **Stripe is the billing authority.** `club-webhook` re-reads every subscription, invoice, charge and dispute from Stripe's API; event order and duplicates don't matter (`club_stripe_events`).
- **Access is explicit rows, not payment counts.** `club_entitlements`: one live row per member × calendar month × `digital|physical`, recording the resource edition (`kit_id`), membership year, plan, and the invoice and paid period that granted it. Unique indexes make a replayed webhook a no-op.
- **Only a paid invoice's own line periods grant** (`club_invoice_apply`). Open, failed, voided, disputed, refunded or duplicate-subscription invoices grant nothing.
- **Digital:** a member opens a *published* month she holds an active digital entitlement for (`club_can_open`). Live membership → edit; ended → read and print. Drafts open for nobody.
- **Physical:** each physical entitlement has exactly one `club_fulfillment_orders` row, and a household can never have two non-canceled mailings for one month. Physical eligibility is separate from digital access: a missed cutoff moves her mailing to the next open month and never closes a month she paid for online.
- **Mailing cutoff (a rule, not a date):** a month's list closes at **11:59 pm New York time on the second Sunday of the month before** (`club_settings.cutoff_ordinal` / `cutoff_weekday`; any first–fourth or last weekday). Second Sunday of November → December's list, of December → January's. `club_cutoff_at(month)` calculates it for any month and year; the admin shows the dates. Each payment earns the earliest month whose list is still open and that she doesn't hold yet (`club_next_mailing_month`), so a month's list is complete once it closes.
- **Launch exception (one time):** `launch_exception_month` + `launch_exception_cutoff_at`. Families whose paid invoice covers that month and is paid by the deadline also get that month's mailing, on top of their regular one; no other month changes, and it lapses after the deadline. Set to **November 2026, through Sunday November 8, 2026, 11:59 pm ET** (founding families, week of November 2). Turn off in Setup.
- **Sign-in:** passwordless 6-digit code (Supabase Auth OTP). A guest who pays gets an *unconfirmed* account for that email; nothing opens until she proves the inbox. Stable ids: `club_households.id` ↔ owner `auth.users.id` ↔ `club_customers.stripe_customer_id`.
- **Duplicate checkouts:** reused open Checkout for repeat clicks; refused when a live membership exists (database and Stripe both checked); if two checkouts still both finish, the second subscription is canceled, refunded and flagged `duplicate`, and never grants.
- **RLS:** members read only their own household, family, address, entitlements and mailings; every write is a checked function. Admin functions require `is_admin('owner')` and write `admin_audit_log`. Children's names reach an admin only through one mailing's print view (`club_admin_fulfillment_bundle`, audited). No Stripe or service keys in the browser.

## The member's path

1. `/club/join` → plan + email → Stripe Checkout (address collected there).
2. `/club/welcome?session_id=…` → "Payment received" → sign in with the code sent to that email → family (names, kids' ages) → address if missing → dashboard. The welcome email (Resend) links to `/club/login?email=…` for the same steps later.
3. `/club/dashboard` → plan and billing status, this month, every owned month, locked months ahead, months before she joined, mailing status per month, edit family, mailing address, Manage billing (Stripe Billing Portal), change email.
4. `/club/resources/<slug>` → the month's printable (the same component as its sample preview) filled with her family; edits save to her account (`club_resource_versions`); "Looks good, print it" approves the mailing.

## Monthly fulfillment (manual, PostGrid/LetterStream-ready)

Paid month → eligible mailing → family profile → personalized PDF → queue → review → mailed. In `/admin/club → Fulfillment`, pick the delivery month:

1. **Readiness** per household: `needs_profile`, `needs_address`, `mail_paused`, `needs_resource` (month still draft), `needs_pdf`, `ready`. Send profile reminders and "review before printing" emails from **Setup & emails**.
2. **Print view** → browser Print → Save as PDF → **Mark PDF ready** (audited: it shows that family's names).
3. **approved** (freezes the address) → download the CSV of approved addresses for the mail house → **printed** → **mailed**. Returned mail → **returned** → re-approve with the corrected address. **skipped / on_hold** need a note.
4. **Late** = added by hand (an admin grant) after that month's list closed: send in a catch-up batch. Payments are never late; they earn the next open month.

Settings (`/admin/club → Setup`): checkout `off|test|live`, first printed mailing month (default **November 2026**), mailing cutoff rule (default second Sunday, with the next months' calculated deadlines in New York time), the launch exception, member review on/off. Kits' `mailer_cutoff_at` follows the rule (synced on every settings save).

Supabase API connections load pg-safeupdate: every UPDATE/DELETE in a database function needs a WHERE (one-row tables: `where id`), or it fails with "UPDATE requires a WHERE clause". `supabase/tests/club-membership.sql` checks every public function. Months publish in **Monthly resources** (draft → published).

## What you must do (in order)

### Supabase
1. **Auth → Providers → Email:** enabled, "Confirm email" on, OTP length 6, OTP expiry 3600 s (an hour is kinder than 10 minutes for a busy mom; the code is single-use).
2. **Auth → Email Templates → Magic Link and Confirm signup:** subject "Your Organized Family Club code", body with `{{ .Token }}` (otherwise Supabase sends a link and the code screen can't work). Also **Change Email Address**: keep the confirmation link (email change uses it).
3. **Auth → SMTP:** Resend SMTP (`smtp.resend.com`, 465, user `resend`, password a Resend API key, sender on your verified domain). The built-in sender is rate-limited to a few emails an hour.
4. **Auth → URL Configuration:** Site URL `https://www.organizedmomcollective.com`; add `https://www.organizedmomcollective.com/club/dashboard` to redirect URLs.
5. **Edge Functions → Secrets:** `CLUB_STRIPE_SECRET_KEY` = a **test** secret key (`sk_test_…`, or a restricted `rk_test_…` with write access to Customers, Checkout Sessions, Subscriptions, Invoices (read), Prices, Products, Billing Portal, Refunds, Webhook Endpoints, Disputes (read), Charges/PaymentIntents (read)). Optional: `CLUB_EMAIL_FROM`. `RESEND_API_KEY` already exists (shared with the shop). Do **not** set `CLUB_LIVE_CHECKOUT` yet.
6. Recommended: redeploy the three functions from the repo once (`supabase functions deploy club-billing club-webhook club-admin --no-verify-jwt`) so the deployed code is byte-for-byte the reviewed source. Today's deploy was made from the same build through the Supabase connector.

### Stripe (test mode first)
7. In `/admin/club → Setup`, press **Set up Stripe (test mode)**. It creates, once: the product, `club_monthly_v1` ($5/month) and `club_annual_v1` ($60/year), the Billing Portal configuration, and the webhook endpoint `…/functions/v1/club-webhook` (its signing secret is stored server-side).
8. Stripe Dashboard → Billing → **Revenue recovery:** Smart Retries on, end within ~2 weeks, then **cancel** the subscription. Turn on Stripe's customer emails for receipts and failed payments.
9. Decide sales tax for a subscription with a printed component (accountant), as for the shop.

### Cloudflare Pages (Preview first)
10. Pages project `organized-mom-collective` → Settings → Variables and Secrets → **Preview** (not Production): `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` (same values as Production; Preview has none today), `PUBLIC_CLUB_ENABLED=true`, `PUBLIC_ACCOUNTS_ENABLED=true`, `PUBLIC_CLUB_CHECKOUT_ENABLED=true`. Then retry the latest preview deployment so the build picks them up.
11. Supabase function secret `CLUB_ALLOWED_ORIGINS` = the preview's stable branch URL (e.g. `https://claude-vibrant-wozniak-kjitd.organized-mom-collective.pages.dev`). It lets the Club functions answer that page (CORS) and sends Stripe Checkout and the Billing Portal back to it; it doesn't touch the shop's `SHOP_ALLOWED_ORIGINS`.

### Test on the preview (30 minutes)
11. Setup → checkout **test**. Buy monthly with card `4242 4242 4242 4242` → welcome page → code → family → address → dashboard shows November. Admin → Members shows her. Buy again with the same email → "already a member". Billing Portal → switch to annual → twelve months. Cancel → "set to end" email. Use a Stripe **test clock** for renewal and a declined renewal (`4000 0000 0000 0341`). Refund an invoice from Stripe → its months disappear.
12. Publish November (and December) in **Monthly resources** once their content is final.

### Going live (needs your explicit approval)
13. Live key in `CLUB_STRIPE_SECRET_KEY` (`sk_live_…`), `CLUB_LIVE_CHECKOUT=enabled`, press **Set up Stripe (live mode)**, Setup → checkout **live**, production `PUBLIC_CLUB_ENABLED`, `PUBLIC_ACCOUNTS_ENABLED`, `PUBLIC_CLUB_CHECKOUT_ENABLED` = true, rebuild. Publish `/privacy` with the Club's children's-data section first (ACCOUNTS.md launch checklist).

## Tests

- `npm run test:admin-sql`: database access and lifecycle (311 checks), including monthly/annual/renewal/failure/cancel/refund/chargeback, duplicates, RLS between households, admin audit.
- `npm run test:club`: the real Edge Function handlers on a real database with a stateful fake Stripe (test mode), fake Auth and Resend: 19 end-to-end scenarios (`tests/club-billing-e2e.test.ts`).
- Not yet run: a real Stripe test-mode purchase (needs the key in step 5).

## Known limits

- Printing is browser print-to-PDF per household from the print view; no batch PDF renderer or print-and-mail API yet (orders carry `provider`/`provider_ref` for PostGrid or LetterStream later).
- Profile-reminder, resource-ready and review emails are sent from `/admin/club` (no scheduler in the project; `pg_cron` isn't enabled).
- Edits are saved per month for the newer printables through their own browser state; December's mission has no editable state.
- A full refund revokes; a partial refund changes nothing automatically (use an entitlement override, e.g. when refunding the rest of a year).
