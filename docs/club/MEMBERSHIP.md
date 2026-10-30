# Organized Family Club: paid membership (operations and setup)

**Status (2026-10-29):** built, tested, database applied to production; `club-billing`, `club-webhook` and `club-admin` redeployed from `main` (PR #254). **Nothing can be bought yet**: Stripe is in test mode only (`club_settings.checkout_mode = test`) and the site flags are off. **Launch price: $5.90/month, monthly only**; annual is built but not offered. **Your First Month FREE** (below) is in `supabase/migrations/20261107000000_club_first_month_free.sql`. Live payments need the owner's explicit approval.

Guiding principle: **One family. One monthly problem. One tailored plan. Delivered ready to use.**

## The plans

**Only monthly is sold** ($5.90/month, `club_monthly_v2`). Annual stays in the code and the database so an annual subscription would still be handled correctly, but `club-billing` refuses it, `stripe_setup` creates no annual price, and the Billing Portal allows no plan switching. Offering it later: add it to `OFFERED_PLANS` (`supabase/functions/_shared/club/deps.ts`) and `PLANS` (`src/lib/club/membership.ts`), and re-enable plan switching in the portal.

| | Monthly · $5.90/month (offered) | Annual (not offered) |
| --- | --- | --- |
| Digital | The month each paid invoice covers (a November 2 joiner gets November; December's payment unlocks December) | The twelve consecutive months starting with the month paid, unlocked at once |
| Printed mailing | That same month's resource, one per paid month (from `first_mailing_month`). Paid by the month's cutoff → regular batch; paid after (every monthly renewal, late joiners) → that month's catch-up batch | Twelve, one per month, same months |
| Renewal | Each paid month adds that month | The renewal adds the next twelve as **membership year 2** |
| Failed payment | Nothing new until it's paid; months already received stay | Same |
| Cancel | At period end (Billing Portal); everything received stays, read and print only | Same |
| Refund (full) / chargeback | Revokes exactly the months that invoice granted, cancels their unmailed mailings | Same |
| Plan change (not offered: the portal allows no switching) | Monthly → annual: charged now; the twelve paid months start with the first month she doesn't already have (a month is never sold twice). Annual → monthly: takes effect at the end of the paid year | |

No automatic discount. Pausing isn't offered (a paused or unpaid subscription pays no invoice, so it grants nothing).

## Your First Month FREE (the launch offer)

**Your First Month FREE. Then $5.90/month.** A new household's first monthly resource is free, printed and mailed. The Family Vision welcome print is free too. Checkout saves a card and charges nothing; the subscription is a Stripe trial until the first charge. No signup fee, no annual plan.

| | Founding member (joins before January 1, 2027) | Joins once the program runs (2027 onward) |
| --- | --- | --- |
| At checkout | $0. Card saved. | $0. Card saved. |
| Right away | Family Vision welcome print, free; dashboard access | Family Vision welcome print, free; dashboard access |
| Free month | **January 2027**: personalized, printed and mailed | **The month she joins** (e.g. joins March 14 → March) |
| Its mailing | January's regular batch if she joined by Sunday December 13, 11:59 pm ET; else January's catch-up batch | That month's catch-up batch (its second-Sunday cutoff was the month before) |
| First $5.90 charge | **February 1, 2027** (midnight New York) | **One month after she joins** (March 14 → April 14) |
| That payment buys | February, mailed on the usual schedule (February's list closes Sunday January 10, so a February 1 payment is in February's catch-up batch) | The next month (April), in its batch by the same rule |
| Then | $5.90 on the 1st of each month | $5.90 on her monthly date |
| Cancels before the first charge | Pays nothing. A cancellation takes effect at the end of the free period, so the free January she was promised still goes out. | Same |
| Membership ends early (admin, Stripe) | Future free months not yet mailed are withdrawn (`club_intro_end`); the welcome print stays | Same |
| First charge fails | No February access or mailing until it's paid (Stripe retries; "payment didn't go through" email) | Same |

**One free first month per household.** The checkout offers it only to an email that never had a membership or a free month. When the subscription starts, `club_intro_grant` refuses it if the account, its email, its mailing address (normalized) or its card (Stripe fingerprint) already had one. Then billing starts on the program's first day (before the program) or at once, and the welcome email says when she's charged. Claims are kept as hashes after an account is deleted (`club_intro_claims`; disclosed in the privacy policy).

The rules live in `supabase/migrations/20261107000000_club_first_month_free.sql` (`club_settings.program_start_month`, `intro_offer` to switch the offer off) and `club-billing` / `club-webhook`. The pages say the same through `CLUB_OFFER` and `CLUB_PROGRAM_START` in `src/data/club/config.ts`; rebuild the site after January 1, 2027 to drop the founding wording. The announcement bar counts down to the next deadline that prints a monthly plan: before the program, January's (Sunday December 13).

## How access works (why it's safe)

- **Stripe is the billing authority.** `club-webhook` re-reads every subscription, invoice, charge and dispute from Stripe's API; event order and duplicates don't matter (`club_stripe_events`).
- **Access is explicit rows, not payment counts.** `club_entitlements`: one live row per member × calendar month × `digital|physical`, recording the resource edition (`kit_id`), membership year, plan, and the invoice and paid period that granted it. Unique indexes make a replayed webhook a no-op.
- **Only a paid invoice's own line periods grant** (`club_invoice_apply`). Open, failed, voided, disputed, refunded or duplicate-subscription invoices grant nothing.
- **Digital:** a member opens a *published* month she holds an active digital entitlement for (`club_can_open`). Live membership → edit; ended → read and print. Drafts open for nobody.
- **Physical:** each paid month's printed copy is *that month's* resource: one `physical` entitlement and one `club_fulfillment_orders` row (`fulfillment_type = 'monthly_resource'`). A household can never have two non-canceled monthly mailings for one month. The cutoff only decides the batch (`late = false` regular, `true` catch-up); a payment after a cutoff is never dropped, moved to another month's content or turned into an extra mailing. Digital access never depends on it.
- **Mailing cutoff (a rule, not a date):** a month's regular batch closes at **11:59 pm New York time on the second Sunday of the month before** (`club_settings.cutoff_ordinal` / `cutoff_weekday`; any first–fourth or last weekday). `club_cutoff_at(month)` calculates it for any month and year; Setup shows the next deadlines. Monthly renewals are paid during their month, after its cutoff, so monthly members' copies are prepared in that month's catch-up batch once the payment lands.
- **Launch exception (one time):** `launch_exception_month` + `launch_exception_cutoff_at`, set to **November 2026 through Sunday November 8, 2026, 11:59 pm ET**. November payments by then go in November's regular (founding) batch instead of its catch-up batch. It never adds a month or a mailing; turn it off in Setup.
- **Welcome print (Family Vision):** every new paying household gets one personalized print (`fulfillment_type = 'welcome_vision'`, one live per household), created pending with the first paid invoice, outside any cutoff. She personalizes and approves it on `/club/family-vision` (`club_welcome_save` / `club_welcome_approve`, a second click changes nothing); Not again on renewal, plan change or retries; a refund or dispute of that first invoice cancels it if unprinted. **It ships in the Welcome Kit** with her first month's printed resource, one package outside the cutoff: [WELCOME_KIT.md](WELCOME_KIT.md).
- **December substitution (retired 2026-10-30 for new members):** a household whose first month is a December now gets December's own resource, with the welcome print beside it in the Welcome Kit. Rows made under the old rule (`fulfilled_by = 'welcome_vision'`, `satisfies_month`) keep working: that print ships alone, as promised.
- **Sign-in:** passwordless 6-digit code (Supabase Auth OTP). A guest who pays gets an *unconfirmed* account for that email; nothing opens until she proves the inbox. Stable ids: `club_households.id` ↔ owner `auth.users.id` ↔ `club_customers.stripe_customer_id`.
- **Duplicate checkouts:** reused open Checkout for repeat clicks; refused when a live membership exists (database and Stripe both checked); if two checkouts still both finish, the second subscription is canceled, refunded and flagged `duplicate`, and never grants.
- **RLS:** members read only their own household, family, address, entitlements and mailings; every write is a checked function. Admin functions require `is_admin('owner')` and write `admin_audit_log`. Children's names reach an admin only through one mailing's print view (`club_admin_fulfillment_bundle`, audited). No Stripe or service keys in the browser.

## The member's path

1. `/club/join` → plan + email → Stripe Checkout (address collected there).
2. `/club/welcome?session_id=…` → "You're in." → sign in with the code sent to that email → family (what she calls her family, names, kids' ages) → address if missing → **her print** (`/club/family-vision`: see it framed, customize, approve) → **her first resource** (`/club/resources/<first month>?welcome=1`) → "Looks good. Prepare my Welcome Kit" → dashboard. The welcome email (Resend) links to `/club/login?email=…`, which resumes at her next step (`src/lib/club/onboarding.ts`). Details: [WELCOME_KIT.md](WELCOME_KIT.md).
3. `/club/dashboard` → plan and billing status, the welcome print (personalize / status; for a December joiner, that it's her December resource), this month, only the months she bought (with each printed copy's status), the next month and the payment that brings it, edit family, mailing address, Manage billing (Stripe Billing Portal), change email.
4. `/club/resources/<slug>` → the month's printable (the same component as its sample preview) filled with her family; edits save to her account (`club_resource_versions`); "Looks good, print it" approves the mailing.

## Monthly fulfillment (manual, PostGrid/LetterStream-ready)

Paid month → eligible mailing → family profile → personalized PDF → queue → review → mailed. In `/admin/club → Fulfillment`, pick the delivery month:

1. **Readiness** per household: `needs_profile`, `needs_address`, `mail_paused`, `needs_resource` (month still draft), `needs_pdf`, `ready`. Send profile reminders and "review before printing" emails from **Setup & emails**.
2. **Print view** → browser Print → Save as PDF → **Mark PDF ready** (audited: it shows that family's names).
3. **approved** (freezes the address) → download the CSV of approved addresses for the mail house → **printed** → **mailed**. Returned mail → **returned** → re-approve with the corrected address. **skipped / on_hold** need a note.
4. **Catch-up** (`late`) = paid after that month's regular batch closed (monthly renewals, late joiners, admin grants): still that month's resource, prepared once paid. **Welcome Kits** (her welcome print + her first month, one package) have their own list at the top of Fulfillment, outside the monthly lists and CSV: both print views → Mark PDF ready → Approve kit → Printed → Mailed, moved together, no cutoff ([WELCOME_KIT.md](WELCOME_KIT.md)).

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
7. In `/admin/club → Setup`, press **Set up Stripe (test mode)**. It creates, once: the product, `club_monthly_v2` ($5.90/month), the Billing Portal configuration (no plan switching), and the webhook endpoint `…/functions/v1/club-webhook` (its signing secret is stored server-side). On the test account the first setup already made (product, `club_monthly_v1` $5, `club_annual_v1` $60, a portal that allowed switching, the webhook), pressing it again keeps the product and webhook, adds the $5.90 price and turns plan switching off. The old $5 and $60 prices are never used; archive them in the Stripe Dashboard if you like.
8. Stripe Dashboard → Billing → **Revenue recovery:** Smart Retries on, end within ~2 weeks, then **cancel** the subscription. Turn on Stripe's customer emails for receipts and failed payments, and the **trial ending reminder** (Billing → Subscriptions and emails): every new member's subscription is a free-month trial, and Stripe's reminder tells her before the first $5.90 charge.
9. Decide sales tax for a subscription with a printed component (accountant), as for the shop.

### Cloudflare Pages (Preview first)
10. Pages project `organized-mom-collective` → Settings → Variables and Secrets → **Preview** (not Production): `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` (same values as Production; Preview has none today), `PUBLIC_CLUB_ENABLED=true`, `PUBLIC_ACCOUNTS_ENABLED=true`, `PUBLIC_CLUB_CHECKOUT_ENABLED=true`. Then retry the latest preview deployment so the build picks them up.
11. Supabase function secret `CLUB_ALLOWED_ORIGINS` = the preview's stable branch URL (e.g. `https://claude-vibrant-wozniak-kjitd.organized-mom-collective.pages.dev`). It lets the Club functions answer that page (CORS) and sends Stripe Checkout and the Billing Portal back to it; it doesn't touch the shop's `SHOP_ALLOWED_ORIGINS`.

### Test on the preview (30 minutes)
11. Setup → checkout **test**. Buy monthly with card `4242 4242 4242 4242` → welcome page → code → family → address → dashboard shows November. Admin → Members shows her. Buy again with the same email → "already a member". Billing Portal → card, invoices and cancel only (no plan switch). Cancel → "set to end" email. Use a Stripe **test clock** for renewal and a declined renewal (`4000 0000 0000 0341`). Refund an invoice from Stripe → its months disappear.
12. Publish November (and December) in **Monthly resources** once their content is final.

### Going live (needs your explicit approval)
13. Live key in `CLUB_STRIPE_SECRET_KEY` (`sk_live_…`), `CLUB_LIVE_CHECKOUT=enabled`, press **Set up Stripe (live mode)**, Setup → checkout **live**, production `PUBLIC_CLUB_ENABLED`, `PUBLIC_ACCOUNTS_ENABLED`, `PUBLIC_CLUB_CHECKOUT_ENABLED` = true, rebuild. Publish `/privacy` with the Club's children's-data section first (ACCOUNTS.md launch checklist).

## Tests

- `npm run test:admin-sql`: database access and lifecycle (411 checks), including monthly/annual/renewal/failure/cancel/refund/chargeback, duplicates, RLS between households, admin audit.
- `npm run test:club`: the real Edge Function handlers on a real database with a stateful fake Stripe (test mode), fake Auth and Resend: 22 end-to-end scenarios (`tests/club-billing-e2e.test.ts`).
- Not yet run: a real Stripe test-mode purchase (needs the key in step 5).

## Known limits

- Printing is browser print-to-PDF per household from the print view; no batch PDF renderer or print-and-mail API yet (orders carry `provider`/`provider_ref` for PostGrid or LetterStream later).
- Profile-reminder, resource-ready and review emails are sent from `/admin/club` (no scheduler in the project; `pg_cron` isn't enabled).
- Edits are saved per month for the newer printables through their own browser state; December's mission has no editable state.
- A full refund revokes; a partial refund changes nothing automatically (use an entitlement override, e.g. when refunding the rest of a year).
