# Customer accounts (step 1)

Mom signs in with a 6-digit emailed code (no password). Her account keeps what she makes on the site (builder lists, chore charts, planners, pickers, checklists) in sync across devices, and lists everything she bought from the website shop, with permanent downloads.

**Status (2026-10-26): migration applied to production (with the Club's), still switched off.** Earlier: built and tested 2026-10-21. Nothing changes for visitors until `PUBLIC_ACCOUNTS_ENABLED=true`.

## What's in it

| Piece | Where |
| --- | --- |
| Tables, rules and functions | `supabase/migrations/20261022000000_accounts.sql` |
| Access tests (43 checks) | `supabase/tests/accounts-access.sql`, run by `npm run test:admin-sql` |
| Downloads from the account | `supabase/functions/_shared/handlers/download.ts` (`{ order }` + her access token) |
| Browser side: sign-in, sync | `src/lib/account.ts` (tests: `tests/account.test.ts`) |
| `/account` page | `src/pages/account.astro`, `src/components/account/AccountApp.tsx` |
| "Keep this on every device" prompt | `src/components/account/SaveNudge.astro` (in `PublicLayout`) |

**How saving works.** Every tool already saves in the browser under an `omc:` key. With accounts on, public pages watch those writes (`installStorageHook`) and, when she's signed in, upload them about a second later. Signing in uploads everything already in that browser; a second device takes the account's copy. No clocks are compared: each key remembers the server time of the copy it last matched.

**What isn't synced (step 2).** The cleaning companion's daily progress (`omc:v1:*`). The database refuses those keys.

**Purchases.** Matched to her **verified** email (Supabase confirms it when she types the code). Website orders only; Etsy orders aren't here. Digital orders get a "Get your files" button that works for as long as the order isn't refunded (the emailed link still expires after 7 days). Signing in also fills in `shop_entitlements.user_id`.

**Consent.** Signing in is not marketing consent. The optional box (unchecked) writes to `tool_email_contacts` with `consent_version = 'account-v1'`, the same list as the chore-chart signup. She can change it on `/account`.

**Deleting.** `/account` → Delete my account removes her saves and sign-in, unlinks her entitlements and turns off marketing email. Orders stay (business and tax records). Admin accounts can't delete themselves there.

**Club changes (`20261023000000_club_core.sql`, applied 2026-10-26).** That migration also revokes anon's execute on the `account_*` functions (this migration revoked them from PUBLIC only, and Supabase grants new functions to anon directly), makes `account_delete` refuse while a paid Club membership is live, and refuses `omc:club…` keys in `account_saves`.

**Security.** Customers are ordinary Supabase Auth users. Admin rights come only from `admin_users` / `shop_admins` / `survey_admins`; every admin function and policy checks those (verified 2026-10-21, and the admin access tests still pass with this migration). She can read and delete only her own saves; writes go through `account_put` (64 KB per save, 200 saves, key shape checked, server time stamped).

## Launch checklist

Work top to bottom. Leave the switch off until every box is done.

1. [ ] **Privacy policy live at `/privacy`.** Draft for your review: `docs/operations/PRIVACY_POLICY_DRAFT.md`. Accounts store children's names and chores she types into the tools, so this goes first. Add the page to the footer and link it under the sign-in button.
2. [ ] **Run the migration.** Supabase → SQL Editor → paste `supabase/migrations/20261022000000_accounts.sql` → Run, once.
3. [ ] **Turn on email codes.** Authentication → Providers → Email: enabled; "Confirm email" on; Email OTP length 6; OTP expiry 600 seconds (10 minutes).
4. [ ] **Make the email show the code, not a link.** Authentication → Email Templates → **Magic Link** (and **Confirm signup**): subject `Your Organized Mom Collective code`, body containing `{{ .Token }}`, for example:
   > Your sign-in code is **{{ .Token }}**. It works for 10 minutes. If you didn't ask for it, ignore this email.
   Without `{{ .Token }}` Supabase sends a link and she can't sign in on the page.
5. [ ] **Send through your own email provider.** Authentication → SMTP Settings: use Resend's SMTP (host `smtp.resend.com`, port 465, user `resend`, password a Resend API key, sender on your verified domain). Supabase's built-in sender only allows a handful of emails an hour and isn't for real customers.
6. [ ] **Rate limits.** Authentication → Rate Limits: emails sent per hour to match your SMTP plan (start at 30); token verifications at the default.
7. [ ] **URL configuration.** Authentication → URL Configuration: Site URL `https://www.organizedmomcollective.com`.
8. [ ] **Deploy the download function.** Redeploy `shop-download` (the change is in `_shared/handlers/download.ts`). Its gateway setting stays `verify_jwt = false`; the function checks her token itself.
9. [ ] **Test with your own email** on a preview deployment with `PUBLIC_ACCOUNTS_ENABLED=true`: get a code, sign in, make a chore chart, open `/account` on your phone, see it there; buy a test download and get its files from `/account`.
10. [ ] **Switch on.** Vercel → Environment Variables → `PUBLIC_ACCOUNTS_ENABLED=true` → redeploy.

## Measuring it

The prompt and sign-in use the existing events: element saves (`element_use`), tool spotlight clicks. Add GTM/GA4 triggers for page views of `/account` and for `account_put` is not needed; the questions to answer in two weeks are: what share of builder and tool users see the prompt (`/account?next=` page views), and what share of those finish signing in (saves in `account_saves`, Supabase → Table editor).

## Step 2 (not built)

Companion sync: route `src/lib/storage.ts`'s backend through the account when she's signed in, allow `omc:v1:` keys for her own user only, and add a "Sign in to keep your progress" line to the companion's Settings (no sales elements there).
