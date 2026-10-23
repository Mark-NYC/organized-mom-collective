# Organized Family Club: architecture and implementation plan

**Status (2026-10-23): Phase 1 built behind a disabled flag; nothing deployed, applied or for sale.** Built: the kit configuration, the November kit, the responsibilities engine with edit merging and optional balance suggestions, the Club migration with access tests (local only), and the member pages (family form, dashboard, the November kit with editing and US Letter printing) behind `PUBLIC_CLUB_ENABLED` (off). See [§12](#12-phase-1-progress). No migration has been applied to the live project, no function deployed, no Stripe object created, no email sent, and nothing links to the Club.

Related: [YEAR_ONE_CALENDAR.md](YEAR_ONE_CALENDAR.md) (the 12 kits and the monthly production calendar) · [KIT_TEMPLATE.md](KIT_TEMPLATE.md) (the repeatable kit config) · the migration `supabase/migrations/20261023000000_club_core.sql` and its access tests `supabase/tests/club-access.sql` (not applied to the live project).

## The product in one paragraph

A $5/month membership (price pending the margin check in [Decisions](#decisions-owed-before-building)). She subscribes, signs in with the emailed code she already uses for `/account`, tells us her family once (first names, ages, roles), and every month a kit opens already filled in for her family: one flagship generator (November: the Family Ownership Builder), a few companion worksheets, and a premium printed mailer (Megan's letter, a field guide, a family activity, a QR code back to the personalized kit). The mailer is the same for every household; the personalization is digital. Everything prints to a clean PDF. The point, per [VISION.md](../brand/VISION.md): each kit moves one piece of family life off Mom's memory and onto someone else's row.

## 1. What the repository actually is (audit, 2026-10-22)

Checked in code, not only docs.

| Area | What exists | Where | Club reuse |
| --- | --- | --- | --- |
| Site | Astro 7, fully static (`dist/`), React 19 islands, Tailwind v4. No SSR adapter. | `astro.config.mjs` | Club pages are static shells with `client:only` React islands. |
| Hosting | **Cloudflare Pages is the production hosting target** (owner, 2026-10-22; README → Hosting). In the repo: `_redirects` written at build (`cloudflare-redirects.mjs`), `public/_headers` for admin security headers, one Pages Function (`functions/pinterest-feed.csv.ts`). `vercel.json` was removed (commit `e0c1e94`). | `cloudflare-redirects.mjs`, `public/_headers`, `functions/` | `_headers` rules for `/club/*`; no new Pages Functions. |
| Server logic | Supabase Edge Functions, one shared code base (`_shared/`), no SDKs: Stripe over `fetch`, PostgREST over `fetch` with the service role, Resend over `fetch`. Dashboard paste-ready builds via `npm run build:functions`. | `supabase/functions/`, `supabase/dashboard/` | Same pattern for three new functions. |
| Stripe | One-time **payment-mode** embedded Checkout only. Webhook: signature check (5 min), each event id once (`shop_stripe_events`), session re-read from the API, refunds from Stripe's own total, idempotency keys. Live gate: live key + `SHOP_LIVE_CHECKOUT=enabled` + admin setting. API version `2025-03-31.basil`. **No subscriptions, Customers, invoices or Billing Portal anywhere.** | `_shared/stripe.ts`, `handlers/webhook.ts`, `handlers/checkout.ts`, `deps.ts` | `StripeClient`, `verifyStripeSignature`, `formEncode`, the gate pattern, the event-dedupe pattern. Subscription handling is new code. |
| Auth / accounts | Supabase Auth email OTP over plain fetch, session in localStorage, token refresh; `account_saves` (localStorage keys synced, 64 KB/200 saves), purchases by verified email, `account_delete`. **Built and tested, switched off** (`PUBLIC_ACCOUNTS_ENABLED`), migration **not applied**; launch checklist open (privacy policy first). | `src/lib/account.ts`, `src/components/account/`, `supabase/migrations/20261022000000_accounts.sql`, `supabase/ACCOUNTS.md` | The Club's sign-in is this sign-in. **The Club can't launch before accounts do.** |
| Entitlements | `shop_entitlements` (kind `companion`/`download`, by email, `user_id` linked on sign-in). Nothing is gated on `companion`. | `20261010000000_shop.sql`, `20261012000000_shop_digital.sql` | Pattern only. Club access is computed from subscriptions and invoices instead (one-time orders and subscriptions have different lifecycles). |
| Admin | `/admin` (email + password), `admin_users` roles, `is_admin('owner')` used by every admin RLS policy, audit log, sections registry. | `src/data/admin.ts`, `src/components/admin/`, `20261020000000_admin_core.sql` | `/admin/club` as a new section; `is_admin('owner')` in the Club's admin policies. |
| Email | Resend transactional sends with a dedupe log and honest status (sent / skipped / failed). | `_shared/email.ts` | Welcome and kit-ready emails via the same mailer and a `club_email_log`. |
| Generators | ~25 printable tools: `[data-field]` autosave to localStorage, PNG export via `html-to-image` (`src/lib/printable.ts`), three shared palettes (`src/data/tool-palettes.ts`), print CSS in `global.css` (`@media print`, `@page`), `window.print()` in `Builder.astro`. Data libraries: 16 illustrated jobs with `minAge` (`src/data/responsibilities.ts`), chores by age (`src/data/chores-by-age.ts`, `src/data/chore-chart.ts`), starter routines (`src/data/routines.ts`). | `src/lib/printable.ts`, `src/data/*` | Task libraries, illustrations, category colors, palettes and print CSS feed the engines. The tools themselves are Astro + vanilla script per page; the Club needs reusable React engines, so it reuses data and styles, not tool markup. |
| Tests | Vitest unit tests (`tests/`), SQL access tests on a throwaway Postgres (`npm run test:admin-sql`), shop end-to-end on Postgres + PostgREST (`npm run test:shop`), fakes for Stripe/Resend (`tests/shop/fakes.ts`). | `tests/`, `supabase/tests/`, `scripts/test-*.sh` | Same harnesses; new `club-*` tests. |

### Drift found (fix or confirm before building)

1. **Legacy Vercel references (flagged for correction, 2026-10-22).** Production hosting is Cloudflare Pages ([README → Hosting](../../README.md#hosting)); build variables live in Cloudflare Pages → Settings → Variables and Secrets. These still describe Vercel and should be corrected in their own change (operational docs, so each fix should be checked against the live dashboards, not rewritten blind):

   | File | What it says | Correct to |
   | --- | --- | --- |
   | `docs/operations/PRIVACY_POLICY_DRAFT.md` (§ Who we share it with) | "Vercel (hosting)" | Cloudflare (hosting). **Fix before `/privacy` is published.** |
   | `supabase/ACCOUNTS.md` (launch step 10) | "Vercel → Environment Variables → `PUBLIC_ACCOUNTS_ENABLED`" | Cloudflare Pages → Variables, Production |
   | `supabase/SHOP.md` (launch gate note, test-mode keys, the "Vercel" checklist section, launch step 4, deployment and domain notes) | Vercel env vars, deployments, domains, `*.vercel.app` | Cloudflare Pages equivalents; recheck the apex → www redirect where it's configured now |
   | `supabase/TOOL-EMAIL.md` (steps 3 and 2) | "In Vercel … set `PUBLIC_TOOL_EMAIL_GATE_ENABLED`", "`PUBLIC_RESPONSIBILITY_CHART_GATE_ENABLED`" | Cloudflare Pages → Variables |
   | `supabase/SUPPORT.md` | "already set on Vercel" | set in Cloudflare Pages |
   | `supabase/ADMIN.md` | "same public values as Vercel … flags set on Vercel production" | Cloudflare Pages production |
   | `.github/workflows/page-inventory.yml` (header comment) | "same as Vercel … set on Vercel production" | Cloudflare Pages production |
   | `docs/operations/ADMIN_DASHBOARD_PLAN.md` | "fully static on Vercel", "One Vercel Function: `api/pinterest-feed.ts`", "after Vercel build", Vercel deployment link | Cloudflare Pages; the feed is the Pages Function `functions/pinterest-feed.csv.ts` |
   | `docs/operations/PINTEREST_MERCHANT_REVIEW.md` | DNS → Vercel IPs, Vercel domains, `*.vercel.app` login wall | Historical review (dated); add a note that hosting moved, recheck DNS |
   | `functions/pinterest-feed.csv.ts` (comment) | "when migrating off Vercel" | fine as history; reword to present tense when convenient |

   Not hosting claims, leave as they are: `tests/shop.test.ts` and `supabase/functions/_shared/env.ts` use a `*.vercel.app` URL as an example of an extra allowed origin.
2. **The existing webhook would see Club events.** One Stripe account, two products. If the shop endpoint stays subscribed to `checkout.session.completed` and `charge.refunded`, it will receive subscription checkouts and subscription refunds. Today it fails safe (no matching order → warning, `found: false`), but Phase 2 adds an explicit `session.mode === 'subscription'` skip with a test so it never depends on that accident.
3. **One event table can't serve two endpoints.** If both endpoints share `shop_stripe_events`, whichever processes an event first makes the other skip it. The Club gets `club_stripe_events`.
4. **`account_delete` deletes the sign-in outright.** With a paid subscription that would orphan a live Stripe charge. Phase 2 makes it refuse (`active_membership`) and routes Club members through `club-billing → delete`, which cancels in Stripe first.
5. **`account_saves` syncs every `omc:` localStorage key.** Club pages must not write family data to localStorage; add `club` to the excluded prefixes in both `syncableKey()` and the table check so nothing duplicates into `account_saves`.

## 2. Decisions owed before building

Each has a recommendation. **Bold** ones block Phase 1.

| # | Decision | Recommendation | Why |
| --- | --- | --- | --- |
| D1 | **Price and margin.** | **Working hypothesis: $5/month including the physical mailer** (owner, 2026-10-22), kept until fulfillment quotes are in. Get two quotes (print, envelope, postage, insertion) and record them here; Stripe's standard US card fee (2.9% + 30¢, verify on the account) comes out of each charge. Revisit only if the quotes don't fit. | The quote is the input the price depends on; nothing in the build is price-specific (one Stripe Price, a lookup key). |
| D2 | **Launch month.** | Private digital beta of the November kit (10–20 families, free or a 100%-off test coupon). Choose the first paid month and first mailer month once the mail house's turnaround is known: December if its proof-to-mail time fits before a Nov 15 cutoff, otherwise January. | Production lead times in [YEAR_ONE_CALENDAR.md](YEAR_ONE_CALENDAR.md) are planning placeholders, not print deadlines; the real ones come from the mail house. Accounts going live is the other gate. |
| D3 | **Sign in before or after paying?** | **Verify her email before payment; family onboarding after a successful checkout** (owner, 2026-10-22). `/club/start`: email → 6-digit code → embedded Checkout for that verified account → (paid) family profile. Also handle a paid-but-not-signed-in subscription by verified-email claim (same rule as `account_orders`). | One account per subscription, no orphaned payments, no "which email did I use?" tickets, and the shortest path to paying; nobody types in their children's details before they've decided to join. |
| D4 | **Back catalog for members.** | Active members open **every released kit**. After cancelling: kits she **earned** (paid for their release month, or the one she joined on) stay open read-only, with print; no new kits, no edits. | Growing library = rising value per month (a retention reason). "Kits you paid for stay yours" removes the cancellation fear and the refund-dispute argument. |
| D5 | **Payment failure grace.** | Digital access continues while Stripe is retrying (`past_due`), up to Stripe's retry schedule (set Smart Retries to end within ~2 weeks, then cancel). **No mailer unless the covering invoice is paid by the cutoff.** | Generous on what costs nothing (digital), strict on what costs money (print and postage). |
| D6 | Refunds. | Full refund of an invoice → that invoice no longer earns anything (derived automatically) and the subscription is canceled now. First-month refund = full revoke. Partial (goodwill) refund → no access change. Dispute → `access_revoked_at`. A shipped mailer is never "revoked". | Simple to explain, enforced by the database, not by memory. |
| D7 | Mailer cutoff and first-mailer rule. | Cutoff the 15th of the month before (`mailer_cutoff_at` per kit). Joined after the cutoff → digital kit now, first mailer the following month. No back-issue mailers. | One batch per month to the printer, no one-off shipments. |
| D8 | Shipping scope and tax. | US only (matches the shop). Ask the accountant whether a subscription with a printed component is taxable where you're registered; Stripe Tax on the subscription price if yes. | Same open tax decision as the shop (supabase/SHOP.md → Sales tax). |
| D9 | Who prints and mails. | A mail house that takes a CSV and a print-ready PDF per month. Pick before Phase 3; the CSV format follows theirs. | Hand-stuffing 100+ envelopes a month isn't a system. |
| D10 | Megan's letter. | Megan writes each letter herself, in her words. The repo holds the structure and a "not written yet" placeholder; nothing invents her experiences (CLAUDE.md non-negotiable). | Brand honesty. |
| D11 | Privacy / children's data. | Publish `/privacy` first (already accounts gate #1) with a Club section: what we store about children (first name or nickname, birth year/month, role), why, who sees it (not support staff), deletion. Have it reviewed; the Club collects children's information from the parent, never from the child. | Required before any family profile is stored. |

## 3. Architecture

```
Browser (static pages + React islands)        Supabase Edge Functions               Postgres (club_* tables, RLS)
/club/start  1. verify email (account.ts OTP) ────────────────────────────────────▶ auth.users
             2. pay ───────────────────────▶ club-billing {checkout}
                                               finds/creates Stripe Customer ───▶ club_customers
                                               refuses if a live sub exists
             Stripe embedded form ◀── client_secret (mode=subscription, US address)
                            Stripe ──────────▶ club-webhook (own endpoint + secret)
                                               signature, event once ───────────▶ club_stripe_events
                                               GET subscription / invoice ──────▶ club_subscriptions, club_invoices,
                                               (never trusts payload order)        club_mailing_addresses, join grant
             3. (after payment) family profile ── rpc club_household_save ─────────▶ club_households, club_family_members
/club/dashboard ── rpc club_me ─────────────────────────────────────────────────▶ access, status, kits she can open
/club/kits/[slug] ── rpc club_household + club_document_get ────────────────────▶ profile + saved edits
             engine(profile, kit config) + edits → the kit, rendered and printed in the browser
             save ── rpc club_document_save (revision check) ───────────────────▶ club_documents
/club/settings ──────────────────────────────▶ club-billing {portal | delete}  ─▶ Stripe Billing Portal / cancel + account_delete
/admin/club ── RLS reads (is_admin owner) ──────────────────────────────────────▶ subscriptions, invoices, mailings
             actions ───────────────────────▶ club-admin {resync, snapshot, export, mark mailed, grant}
```

- **Stripe is the billing authority.** `club_subscriptions` and `club_invoices` are a mirror rewritten from a fresh `GET` on every webhook. Payload order never matters.
- **Supabase decides access**, through `club_has_access`, `club_earned`, `club_can_open` (digital) and `club_mailing_eligible` (print). The browser never writes billing, entitlement or mailing state.
- **Kit content lives in the repo**, typed and reviewed in pull requests (`src/data/club/kits/<slug>.ts`). The database holds only a kit's slug, month, release time, mailer cutoff and status.
- **Personalization runs in the browser**, deterministic, from curated rules. No AI calls, no per-generation cost, and the same inputs always give the same chart.
- **No new npm dependencies.** PDF output is the browser's print-to-PDF from a dedicated print stylesheet (vector, exact fonts, same approach as `Builder.astro` and `global.css @media print`).
- **Separate from everything that exists.** Own tables, own functions, own webhook endpoint, own Stripe product. The calendar, shop, tools, Pinterest engine and the cleaning companion are untouched apart from the two safety fixes in Drift 2 and 4.

## 4. Data model and RLS

Migration: `supabase/migrations/20261023000000_club_core.sql` (in the repo, **not applied** to the live project). Access tests: `supabase/tests/club-access.sql`, run by `npm run test:admin-sql` (including another household trying to read, rename, delete, overwrite or pull in someone else's family and chart, 2026-10-23).

| Table | Holds | Customer access | Written by |
| --- | --- | --- | --- |
| `club_households` | One per account: optional display name ("Team Rivera"), a closed set of preferences (palette, week start, faith content on/off, pets, school type, dinner time), `profile_version`. | Read own (RLS) | `club_household_save` |
| `club_family_members` | Stable id, first name ≤ 30 chars, `kind` adult/child, `role`, children's birth **year and month** (no day), `is_account_holder`, `archived_at`. **No last names, photos, schools, gender or full birthdays.** | Read own (RLS). **Admins can't read it**: support never needs a child's name. | `club_household_save` (removing someone archives them) |
| `club_customers` | Stripe Customer per account (reused on resubscribe). | None | `club-billing` |
| `club_subscriptions` | Stripe mirror: status, period, cancel-at-period-end, `access_revoked_at`. Unique index: one live subscription per account. | Via `club_me()` only | `club-webhook` |
| `club_invoices` | Paid/failed/refunded invoices with periods: what earns kits and mailers. | None | `club-webhook` |
| `club_stripe_events` | Processed event ids for this endpoint. | None | `club-webhook` |
| `club_kits` | Slug, month, title, status (`draft`/`scheduled`/`retired`), `release_at`, `mailer_cutoff_at`. Opens by itself at `release_at`: no cron. | Via `club_me()` | `club-admin` |
| `club_kit_entitlements` | Only the exceptions: the kit current when she joined, and admin grants. Everything else is derived from invoices. | None | `club-webhook`, `club-admin` |
| `club_documents` | Per household × kit × printable: `edits` (overlay, ≤ 32 KB), palette, `engine_version`, `profile_version`, `revision`. | Via `club_document_get/save` | `club_document_save` (edit access only) |
| `club_mailing_addresses` | One US address, `paused` (skip print, keep digital). | Read own | `club-webhook` (from Checkout), `club-billing` (edit) |
| `club_mailings`, `club_mailing_recipients` | One batch per kit, frozen at the cutoff, with a frozen address and the invoice that qualified it. | None | `club-admin` |

Still to add in Phase 1/3 (not in the draft): `club_settings` (one row: `mode off|preview|live`, mirroring `shop_settings`), `club_email_log` (dedupe keys, same shape as `shop_email_log`), and the admin audit entries through `admin_audit_log`.

Rules the draft enforces (each one has a check in the smoke test): no direct writes to any table; another account sees nothing; anon can call nothing; a child needs a birth year; one account holder; unknown preference keys refused; one live subscription per account; no kit before its release time; non-members can't open or save; a stale save from a second tab or device is refused (`conflict`), never silently merged; a lapsed member keeps earned kits read-only; an unpaid or refunded invoice earns no kit and no mailer.

## 5. Subscription lifecycle

Stripe objects (test mode first, live only at Phase 4): Product "Organized Family Club", one recurring Price with `lookup_key = club_monthly_v1`, a Billing Portal configuration (update card, view invoices, cancel **at period end**; no plan switching, no pausing in v1), Smart Retries, Stripe's own receipt and failed-payment emails turned on, and a **second webhook endpoint** `…/functions/v1/club-webhook` with these events only: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`.

Every webhook does the same thing: verify signature → record the event id (`club_stripe_events`, `new|retry|done`) → `GET` the subscription (and invoice, if any) from Stripe → upsert the mirror. The handler never computes state from the event payload. Note for `2025-03-31.basil`: the period dates are on the subscription **item** (`items.data[0].current_period_*`), and an invoice's subscription is `invoice.parent.subscription_details.subscription`.

| Scenario | What happens | Access | Mailer |
| --- | --- | --- | --- |
| New signup | `/club/start`: email code → `club-billing {checkout}` creates a Customer with her verified email and `metadata.user_id`, opens embedded Checkout (`mode=subscription`, `shipping_address_collection: US`, `client_reference_id = user_id`). After payment the same page asks for her family. | From `invoice.paid` (`active`). The page polls `club_me()` until then, then shows the family form; the dashboard sends anyone without a household back to it. | If paid before the next cutoff. |
| Existing customer (has `/account`, bought downloads) | Same auth user; `club_customers` gets her first Stripe Customer. Shop guest orders stay separate. | Same | Same |
| Existing member tries again | `club-billing` refuses (`already_member`) and sends her to the dashboard; the unique index is the backstop. | Unchanged | Unchanged |
| Checkout abandoned | Nothing in our tables except an orphan Stripe Customer we reuse next time. | None | None |
| First payment succeeds | `checkout.session.completed` + `invoice.paid` → subscription `active`, invoice `paid`, address saved, **join grant** for the kit current at signup. Welcome email (Resend, deduped). | Yes, plus the current kit earned | Next cutoff |
| First payment needs 3-D Secure / fails | Subscription `incomplete`; Checkout shows the error; after 23 h Stripe expires it (`incomplete_expired`). | No | No |
| Renewal fails | `invoice.payment_failed` → `past_due`. Stripe retries and emails her (portal link). | Yes, while `past_due` (D5) | **No** unless paid by the cutoff |
| Recovery | `invoice.paid` → `active`. | Yes | Yes if paid before the cutoff |
| Retries exhausted | Stripe cancels → `customer.subscription.deleted` → `canceled`. | Earned kits read-only | No |
| Renewal | `invoice.paid` (new period) → new invoice row. Earns the kit released in that period. | Yes | Yes |
| Cancel (portal) | `cancel_at_period_end = true`. `/club/settings` shows "Your membership ends on …". | Until period end | If the paid period covers the cutoff |
| Period ends | `customer.subscription.deleted` → `canceled`, `ended_at`. | Earned kits read-only | No |
| Resubscribe | New subscription, same Customer, same household and documents (her edits come back). | Yes | Next cutoff |
| Full refund | `charge.refunded` → invoice `amount_refunded = amount_paid` → that period earns nothing; `club-admin` refund action also cancels now. | Ends if it was the only paid period | Removed if not yet exported |
| Partial refund | Recorded, no access change. | Unchanged | Unchanged |
| Dispute | `access_revoked_at = now`, `disputed` flag on the admin list. | None | Removed if not yet exported |
| Duplicate event | `club_stripe_events` says `done` → 200, nothing runs. | — | — |
| Out-of-order events (`updated` before `created`, `paid` before `completed`) | Each one re-reads the subscription from Stripe and upserts the whole row, so the last processed event always writes Stripe's current truth. | — | — |
| Account deletion | `/club/settings → Delete`: `club-billing {delete}` cancels the subscription **now** in Stripe, then `account_delete`. Household, family, documents and address go (cascade); subscription, invoice and Customer rows stay with `user_id = null` (billing records). `account_delete` alone refuses while a membership is live. | Ends | Removed if not yet exported |
| Second device | Sign in with the same email → everything is server-side (profile, edits, access). Nothing lives only in one browser. Two tabs editing the same chart: the second save gets `conflict` and reloads. | Same | — |

### Digital access vs mailing eligibility (independent on purpose)

- **Digital** (`club_has_access`): status `trialing`, `active` or `past_due`, not revoked. Opens every released, non-retired kit. Lapsed: `club_earned` kits, read-only.
- **Mailing** (`club_mailing_eligible`): a **paid**, not fully refunded invoice whose period covers that kit's `mailer_cutoff_at`, plus an address on file and not paused. `past_due` gets the digital kit and no mailer. Cancelled-at-period-end still gets the mailer if the paid period covers the cutoff.

## 6. Monthly fulfillment lifecycle

Per kit month M (dates per kit in [YEAR_ONE_CALENDAR.md](YEAR_ONE_CALENDAR.md)):

| When | Step | Owner |
| --- | --- | --- |
| M − 10 weeks | Kit brief: theme, flagship engine, rules, worksheets, mailer contents ([KIT_TEMPLATE.md](KIT_TEMPLATE.md)) | Product |
| M − 8 weeks | Kit config + rules in a PR; engine tests pass; Megan writes the letter | Product, Megan |
| M − 6 weeks | Mailer content locked; print-ready PDF to the mail house for proof | Product |
| M − 5 weeks | Proof approved; QR tested on a phone against the preview deployment | Owner |
| M − 1 month, 15th | **Cutoff**: `/admin/club → Snapshot` freezes recipients (eligible subscription + address + paid covering invoice) | Owner |
| M − 1 month, 16th | Export CSV → mail house | Owner |
| M − 1 month, ~20th | Mail drop; `Mark mailed` | Mail house, owner |
| M, 1st 00:00 local | Kit opens by itself (`release_at`); kit-ready email to members with access | Automatic |
| M + 1 week | Returned mail → mark `returned`, email her to fix the address | Owner |

The QR on every mailer is `https://www.organizedmomcollective.com/club/kits/<slug>?source=mailer`: a member lands in her filled-in kit; anyone else lands on sign-in, then the sales page. **Print URLs are permanent**: never rename a released kit's slug (same rule as `/start`).

## 7. Personalization engine

### Inputs, outputs, determinism

- **Profile**: members with **age computed for the kit's month** from birth year/month (so October's kit sees October's ages), `is_account_holder`, preferences.
- **Kit rules** (`KitItem` in `src/data/club/types.ts`): a curated library per kit, each item with a stable `id`, `for` (`adult`/`child`/`anyone`), `minAge`/`maxAge`, ownership `levels` by age, `frequency`, an `effort` weight, `section` (family / their space / themselves), `scope` (`household`: one owner for the family; `each`: everyone eligible gets their own), `core`, `excludes` (jobs that cover the same ground) and optional `requires` (`pets`, `faith_content`, `school`). Built from existing libraries: every card in `src/data/responsibilities.ts` becomes an item automatically (a card added later gets defaults from its category and starting age), plus family jobs worded from `src/data/chores-by-age.ts` and whole jobs for teens and adults (`src/data/club/libraries/ownership-jobs.ts`).
- **Output**: a document model (JSON) whose every row has a stable id. Same profile + same rules + same engine version → same document, byte for byte. Ties break on a stable hash of `household_id + item id`, never `Math.random`.

### The four engines (`src/lib/club/engines/`)

| Engine | Does | Kits |
| --- | --- | --- |
| `responsibilities` | Picks age-eligible jobs, assigns owners by balanced effort, sets frequency and ownership level (`learning`: their job, with someone beside them; `with-check`: theirs start to finish, a coach checks; `owns`: theirs completely). Adults get **whole jobs** (plan → do → finish), never "help Mom". Weekly capacity by age is **guidance**: jobs are spread within it first; a core job nobody has room for may stretch a teen or adult a little (25%), never a child and never the account holder, and whatever is still left says "Needs an owner" instead of falling to her. Adults aren't forced to equal counts: the account holder only leans last in ties, and real imbalance (adults 4+ effort points apart, or anyone past guidance) is offered as optional **workload balance suggestions** (move a job from one person to another), never applied for her and never moving work onto the account holder. Single-parent households: kids' ownership levels move up a year instead. | Nov, Mar, Apr, Oct |
| `routines` | Ordered, timed steps per child (or the family) from start/end times and ages; owner per step. | Jan, Jun, Aug |
| `planning` | A dated plan: dates from the kit month (holiday dates, school's last day, Sundays), prompts per family member, who leads each block. | Dec, Feb, May, Sep |
| `projects` | A bounded project: zones or packing lists split into owned tasks with a due day, sized by age. | Mar, Jul |

### Edits are never overwritten

The saved document is **not** re-generated output. It's `edits` (`src/lib/club/edits.ts`): `accepted` (the engine's rows as they were when she took them, kept whole), `added` (her own rows), and her changes on top (assign, coach, frequency, level, text, replace, hidden, order, dismissed), keyed by stable row ids. The engine runs again only to find *suggestions*, around everything already on her chart:

```
chart       = applyEdits(accepted + added, edits)
suggestions = generate(profile, kitRules, pinned = chart) − chart − dismissed − hidden
```

- **A manual change always wins.** Reassigning a job, rewording it, hiding it or reordering it pins that item.
- **A profile change never changes the chart by itself.** When `household.profile_version` is newer than the document's, the kit shows a short "Your family changed" panel: new suggestions for a new or older child, listed with *Add* and *Not now*. Accepted ones become edits; dismissed ones go in `dismissed` and never come back.
- **Someone removed** is archived, not deleted: their jobs stay on the chart marked "Needs a new owner" until she picks one.
- **Rules change** (`engineVersion` bump): items that disappear from the rules stay on her chart exactly as accepted; new rules items show as suggestions, same panel.
- **A job she deliberately left without an owner** gets no owner offers.
- **Levels are kept as accepted.** A partner joining (which ends the one-adult level boost) or a birthday never changes a level by itself; moving a job up is her call. A job reassigned to someone else gets the level for its new owner.
- Tested as properties: 200 seeded random runs of edits, new children, removals, birthdays, accepted and dismissed suggestions and database round trips; every edited field stays exactly as she left it (`tests/club-edits.test.ts`).

### PDF output

Each printable is a React component with a fixed US Letter page (portrait or landscape) and a print stylesheet (`@page { size: letter landscape; margin: … }`, `print-color-adjust: exact`). "Print or save as PDF" calls `window.print()`. Palettes from `src/data/tool-palettes.ts`, Kalam headings and the responsibility illustrations per [TOOL-OUTPUT-DESIGN.md](../brand/TOOL-OUTPUT-DESIGN.md). Test matrix in Phase 2: iPhone Safari (Share → Print → pinch to PDF), Android Chrome, desktop Chrome/Safari/Edge. If iOS output is not acceptable, the fallback is the existing PNG export (`html-to-image`) per page, not a server renderer.

## 8. Routes and UI

Static pages, `noindex` except `/club` once launched. Member pages use a new `ClubLayout` (BaseLayout + a quiet member header: Dashboard · Family · Settings; no site navigation, no sales elements, no manifest or service worker). `/club` uses `PublicLayout`. Georgia headlines, Montserrat UI, ivory / sage / blush / charcoal from the existing public tokens (`docs/brand/PUBLIC-VISUAL-DESIGN.md`).

| Route | Purpose | Notes |
| --- | --- | --- |
| `/club` | Sales page | Behind `PUBLIC_CLUB_ENABLED`; until then a noindex "not available" stub, out of the sitemap, linked from nowhere. Lists only what's live. |
| `/club/start` | Verify email (6-digit code) → pay → family (one screen: name, adult/child, birth month/year for kids; "Add someone") | Family comes only after a successful payment; nothing else asked. Preferences are optional and live in `/club/family`. |
| `/club/dashboard` | This month's kit first, then the library, then status line ("Renews Dec 1" / "Ends Dec 1") | |
| `/club/kits/[slug]` | The kit: flagship generator filled in, worksheets, print | `getStaticPaths` from the kit registry; the page shell is static, the data comes from the RPCs. |
| `/club/family` | Edit family and preferences | Shows "3 kits will offer new suggestions" after a change. |
| `/club/settings` | Status, address, pause mailer, Billing Portal, delete | |
| `/admin/club` | Members by status, MRR, failed payments, kit schedule, mailing snapshot/export/mark mailed, resync, grant | `AdminLayout`, `src/data/admin.ts` section. No children's names anywhere in admin. |

## 9. Files

### Database (Phase 1)
- `supabase/migrations/20261023000000_club_core.sql` (built 2026-10-23; `club_settings` and `club_email_log` still to add with Phase 2–3); `account_delete` refusal; `account_saves` key check excludes `omc:club`.
- `supabase/tests/club-access.sql` from the smoke test; add it to `scripts/test-admin-sql.sh`.

### Server (Phase 2–3)
- `supabase/functions/_shared/club/` — `subscription.ts` (Stripe → mirror rows, pure, tested), `access.ts` (gate: key mode, `CLUB_LIVE_CHECKOUT`, `club_settings.mode`).
- `supabase/functions/_shared/handlers/club-billing.ts` + `supabase/functions/club-billing/index.ts` — `checkout`, `portal`, `delete`, `address`.
- `supabase/functions/_shared/handlers/club-webhook.ts` + `supabase/functions/club-webhook/index.ts`.
- `supabase/functions/_shared/handlers/club-admin.ts` + `supabase/functions/club-admin/index.ts` — `resync`, `snapshot`, `export`, `mark_mailed`, `grant`, `refund_and_cancel`, `schedule_kit`.
- `supabase/functions/_shared/env.ts` — `STRIPE_CLUB_WEBHOOK_SECRET`, `STRIPE_CLUB_PRICE_ID`, `CLUB_LIVE_CHECKOUT`, `CLUB_EMAIL_FROM`.
- `supabase/functions/_shared/handlers/webhook.ts` — skip `mode === 'subscription'` sessions (Drift 2).
- `supabase/config.toml` — `verify_jwt = false` for the three (each checks its callers).
- `scripts/build-dashboard-functions.mjs` — emit the three paste-ready files.

### Frontend (Phase 1–3)
- `src/data/club/types.ts` (kit config types), `src/data/club/kits/index.ts` (registry), `src/data/club/kits/2026-11-family-ownership.ts`, `src/data/club/libraries/*.ts`.
- `src/lib/club/profile.ts` (ages for a month, validation), `src/lib/club/engines/{responsibilities,routines,planning,projects}.ts`, `src/lib/club/edits.ts`, `src/lib/club/api.ts` (RPCs with the account session), `src/lib/club/hash.ts`.
- `src/layouts/ClubLayout.astro`; `src/pages/club/{index,start,dashboard,family,settings}.astro`, `src/pages/club/kits/[slug].astro`, `src/pages/admin/club.astro`.
- `src/components/club/` — `ClubGate.tsx` (reuses `account.ts` sign-in), `FamilyForm.tsx`, `Dashboard.tsx`, `KitShell.tsx`, `SuggestionsPanel.tsx`, `PalettePicker.tsx`, `print/ResponsibilityChart.tsx`, `print/LetterPage.tsx`, `print/FieldGuide.tsx`, `print/ConversationCard.tsx`, `print/ResetChecklist.tsx`; `src/components/admin/ClubAdmin.tsx`.
- `src/routes.ts`, `src/data/admin.ts`, `src/lib/account.ts` (`omc:club` excluded), `src/pages/sitemap.xml.ts` (member pages out), `scripts/check-site.mjs` (Club pages are noindex), `README.md` (routes, flags).

### Tests
- `tests/club-profile.test.ts` — ages per month, validation.
- `tests/club-engine.test.ts` — determinism (same input → same output), age eligibility, balanced effort, adults get whole jobs, account holder ≤ even share, single-parent and 1–6 child households, `requires` honored.
- `tests/club-edits.test.ts` — edits survive every profile change; archived member → "needs an owner"; suggestions never auto-apply; dismissed stay dismissed.
- `tests/club-kits.test.ts` — every kit config validates, months unique, item ids unique and stable (snapshot), slugs match the database seed.
- `tests/club-webhook.test.ts` — with the existing fakes: duplicate events, out-of-order events, every lifecycle row in §5, live/test mismatch, signature failures; the shop webhook ignores subscription sessions.
- `tests/club-billing.test.ts` — refuses a second live subscription, reuses the Customer, the gate (test/live, flag, setting).
- `supabase/tests/club-access.sql` — the 27 smoke checks plus admin reads and "admins can't read family members".

### Cloudflare Pages
- `public/_headers`: `/club/*` (except `/club`) → `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, a CSP allowing `connect-src` Supabase and Stripe, `frame-src`/`script-src` `https://js.stripe.com` on `/club/start` and `/club/settings`. `/admin/club` is already covered by `/admin/*`.
- Build variables, in Cloudflare Pages → Settings → Variables and Secrets (Production and Preview separately): `PUBLIC_CLUB_ENABLED` (false in production until Phase 4), `PUBLIC_ACCOUNTS_ENABLED`, existing `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_STRIPE_PUBLISHABLE_KEY`. Public flags only show or hide pages; the server gate decides.
- No Pages Functions, no redirects, no hosting change.

## 10. Smallest viable launch

**In:** sign-in (accounts step 1), a family form, one subscription price, embedded Checkout, the webhook, `club_me`, a dashboard, **one kit** (November, Family Ownership Builder + its printables), print-to-PDF, Stripe's Billing Portal for every billing change, `/admin/club` with a member list and the mailing snapshot + CSV export, a welcome email.

**Out of v1 (and out of the sales copy):** annual plan, gifting, pausing a subscription, coupons beyond Stripe promotion codes, kit-ready emails (dashboard shows the new kit; email in Phase 3), multiple households per account, a partner's own login (share the printed chart instead), syncing the cleaning companion, any AI.

## 11. Phases and acceptance criteria

### Phase 0: prerequisites (no Club code)
- Hosting confirmed (Drift 1); docs updated to the real host and env-var location.
- Accounts step 1 launched per `supabase/ACCOUNTS.md`, including `/privacy` with the Club's children's-data section reviewed (D11).
- D2, D7, D9 decided and written into this file; D1's fulfillment quotes recorded (the $5 working hypothesis confirmed or revised).
- Legacy Vercel references corrected (Drift 1).

**Accepted when:** a real customer can sign in on two devices and see the same saves; `/privacy` is live and names the right host; the mail-house quotes are recorded here.

### Phase 1: data and engine (no payments)
- Migration + `club-access.sql` in the repo; applied to a **Supabase branch or local stack only**.
- Kit config types, the November config, the `responsibilities` engine, `edits.ts`, the family form, the kit page reading a household and rendering the Family Ownership Builder and its printables; print-to-PDF.
- Access for testing via an admin `grant` row only (no Stripe).

**Accepted when:** `npm run verify` and `npm run test:admin-sql` pass with the new tests; a test household of 2 adults + kids aged 4, 7 and 10 opens a filled chart where every job is age-eligible, adults have whole jobs and the account holder's effort ≤ the other adult's; editing three items, then adding a child and changing an age, leaves those three items exactly as edited and shows the new child's suggestions in the panel; the PDF prints on one Letter page on iPhone Safari and desktop Chrome.

### Phase 2: billing in test mode
- Stripe test Product, Price, Portal configuration, second webhook endpoint; `club-billing`, `club-webhook`; the shop webhook's subscription skip; `account_delete` refusal; `/club/start` and `/club/settings` on a Preview deployment.

**Accepted when:** every row in §5 is reproduced in Stripe test mode (test clocks for renewal, failure, retry exhaustion and period end) and the mirror matches Stripe after each; replaying any event twice or out of order changes nothing; an existing shop test purchase, download and refund still work end to end (`npm run test:shop`); a second subscription attempt is refused.

### Phase 3: operations
- `/admin/club`; mailing snapshot, CSV export in the mail house's format, mark mailed / returned; kit scheduling; welcome and kit-ready emails with dedupe.

**Accepted when:** a test batch reproduces the eligibility rules (past_due, cancelled-at-period-end, refunded, joined after cutoff, paused) exactly; the CSV opens cleanly in the mail house's template; no admin screen shows a child's name.

### Phase 4: beta, then launch
- Private beta with 10–20 families on the November kit (D2). Fix what they hit. Then `/club` sales page copy (BRAND_VOICE, nothing unbuilt), live Stripe objects, `CLUB_LIVE_CHECKOUT=enabled`, `club_settings.mode = live`, `PUBLIC_CLUB_ENABLED=true` in production.

**Accepted when:** one real purchase, renewal and refund on the owner's card behave as in §5; the first mailer batch is exported and mailed; the roadmap moves the Club to Live.

## 12. Phase 1 progress

### Done (2026-10-22): kit configuration, November kit, responsibilities engine, edit merging

Pure TypeScript, no database, UI, Stripe or new dependencies; nothing ships to visitors.

| File | What it is |
| --- | --- |
| `src/data/club/types.ts` | `KitConfig`, `KitItem`, `KitPrintable`, frequencies, ownership levels, chart sections |
| `src/data/club/libraries/ownership-jobs.ts` | The job library: every card in `src/data/responsibilities.ts` (refined rules for the 16 we have, defaults for any added later), family jobs from `chores-by-age.ts`, teen and adult whole jobs |
| `src/data/club/kits/2026-11-family-ownership.ts` | November: theme, rules, the Kitchen & Pantry Reset read from `src/data/cleaning.ts` (November project), printables, field guide, team-meeting activity; Megan's letter `null` until she writes it |
| `src/data/club/kits/index.ts` | Kit registry, `kitProblems()` validation, `schedulable()` (refuses a kit without Megan's letter) |
| `src/lib/club/profile.ts` | Family profile types, ages for a kit month, stages (child / teen / adult), validation matching `club_household_save` |
| `src/lib/club/hash.ts` | Stable FNV-1a hash for tie-breaks |
| `src/lib/club/engines/responsibilities.ts` | The engine (rules above) |
| `src/lib/club/edits.ts` | Edit operations (assign, coach, frequency, level, rename, replace, remove/restore, add, move, accept/dismiss suggestions), `resolveDocument()`, `readEdits()` for saved JSON |
| `tests/club-profile.test.ts`, `tests/club-engine.test.ts`, `tests/club-edits.test.ts`, `tests/club-kits.test.ts`, `tests/club/fixtures.ts` | 12 test families from one adult with no kids to a single parent of six, teens, a grandparent at home, an 18-year-old still at home |

### Done (2026-10-23): the November member experience, behind the flag

| Piece | Where |
| --- | --- |
| Engine adjustments: capacity as guidance (STRETCH), the account-holder lean (HOLDER_LEAN), `balanceSuggestions()`, levels kept as accepted, "done means" edits | `src/lib/club/engines/responsibilities.ts`, `src/lib/club/edits.ts` |
| Migration: households, family members, kits (November seeded as a **draft**), documents, preview/beta access grants (`club_access_grants`, the only way in until billing), the billing and mailing tables Phase 2 writes; `account_delete` refuses with a live paid membership; `account_saves` refuses `omc:club…` keys; anon loses execute on the `account_*` functions (it had it since the accounts migration) | `supabase/migrations/20261023000000_club_core.sql` |
| Access tests | `supabase/tests/club-access.sql` (in `npm run test:admin-sql`) |
| Feature flag `PUBLIC_CLUB_ENABLED` (off): off, every /club page is a one-line "not available" notice with no app code | `src/data/club/config.ts`, `src/layouts/ClubLayout.astro`, `.env.example` |
| Sample households (made-up, labeled "Sample", saved in the browser tab only): Rivera (2 parents, kids 4/7/10, a dog), Brooks (one parent, 6 and 9), Chen (2 parents, a grandparent, 5 kids and teens), Okafor (toddler), and an empty one for the welcome form | `src/data/club/samples.ts`, `?sample=<id>` on any /club page |
| One store interface: the signed-in account (Club database functions with the account session) or a sample | `src/lib/club/store.ts` |
| `/club/start` (welcome + family form), `/club/family` (edit), `/club/dashboard` (kits from the registry), `/club/kits/<slug>` (one page per kit config) | `src/pages/club/`, `src/components/club/` |
| The kit: chart opens filled in; per person: reassign, reword, "done means", frequency, level, coach, swap, remove/put back, add (typed or from the library); suggestions (new person's jobs, owners for open jobs, workload moves) with Add / Not now; explicit save with conflict handling; the team reset, team meeting card, handing-over checklist and field guide | `ChartEditor.tsx`, `KitPage.tsx` |
| Printing: US Letter (chart landscape, worksheets portrait), the three tool palettes, Kalam names, illustrations on category colors; `fitChart()` measures and picks columns and density so a family fits one page, flowing to two only for very long charts | `src/components/club/print/`, `src/lib/club/print.ts`, `src/styles/club.css` |
| Launch protection: `/club/*` security headers (noindex, no-store, CSP, no framing); `npm run check:site` fails if a Club page loads GA4 or the Pinterest tag, is indexable, is in the sitemap, or is linked from any page outside /club; the page inventory skips /club | `public/_headers`, `scripts/check-site.mjs`, `scripts/lib/page-inventory.mjs` |
| QA by hand: every sample at phone and desktop width, edits survive a reload, a family change shows suggestions without changing the chart, every printable prints to one Letter page with no clipped text, a 7-person chart plus 24 extra jobs prints readably on two | `scripts/club-qa.mjs` |

### Done (2026-10-23): the August 2027 kit, simplified to letter, action, tool

Owner direction: the first August draft (a 20-plus-task launch plan, an overview, a school setup, a command center, three extra mail pieces) asked too much of her and competed with the wall calendar. August is now the three-part shape every kit follows: **one letter, one action, one optional tool**. Curriculum: [YEAR_ONE_CALENDAR.md → August](YEAR_ONE_CALENDAR.md); mailer: [mailers/2027-08-school-year.md](mailers/2027-08-school-year.md).

| Piece | Where |
| --- | --- |
| Kit config: draft letter, six-line countdown (`action`), routine tool (`tool`, `items`), the letter's back page (`fieldGuide`, `example`, `invite`, `calendarNote`) | `src/data/club/kits/2027-08-school-year.ts`, types in `src/data/club/types.ts`, checks in `kitProblems()` |
| Kit page: one screen (title, countdown that checks off, notes who's helping, saves and prints; one button to the tool; the letter on screen and front and back in print); November keeps its tabs | `src/components/club/KitPage.tsx`, saved state `src/lib/club/action.ts` |
| Routine tool: pick a child and morning or after school; 4–6 steps by age (`perSection`, `routineSteps()`, `ROUTINE_MAX_STEPS`); reorder, reword, remove, add, suggested extras; one chart per page | `ChartEditor.tsx` (routine variant), `src/lib/club/engines/responsibilities.ts` |
| Printables: the letter (two pages, ivory stationery, Georgia, Montserrat labels, a Kalam signature), the countdown, the routine chart | `src/components/club/print/LetterPrintables.tsx`, `src/styles/club.css` |
| QR code, no dependency (byte mode, level M, versions 1–6; decoded with OpenCV during development) | `src/lib/club/qr.ts` |
| Kept from the first draft, out of the kit: launch plan and command center item sets, school setup, overview, command center print | `src/data/club/libraries/school-year.ts`, `src/lib/club/school.ts`, `src/lib/club/overview.ts`, `SchoolPrintables.tsx`, `tests/club-school-year.test.ts` |
| Print fix (from the first draft): the print-only rule targets `.is-printing`; QA refuses a blank page or a letter page with content cut off | `src/lib/club/print.ts`, `src/styles/club.css`, `scripts/club-qa.mjs` |
| Migration: August seeded as a **draft** (not applied) | `supabase/migrations/20261024000000_club_august_kit.sql` |
| Refinements (2026-10-23): the countdown dates itself from "When does school start?" (family date, optional per-child dates, her edits kept, "go back to suggestions" lists what changes, short-notice and past-date handling); print, copy as text, `.ics` export, no sync or reminders; the letter greets her by first name when known, prints blank "By" lines, and asks one family question on the back; routine steps always in the order a day goes; a dry-erase tip by the print button; a sample family with no children yet (Hughes) | `src/lib/club/countdown.ts`, `KitPage.tsx`, `LetterPrintables.tsx`, `src/data/club/samples.ts` |
| One routine chart (2026-10-23): August's own routine editor and chart print are gone; "Make a routine chart" opens the site's routine chart inside the Club for a chosen child (name, age, morning or after school handed over). The public chart's script moved into one shared module; its pages, markup, behavior and analytics are unchanged (checked before and after). The reusable pattern for future kit tools is in [KIT_TEMPLATE.md → Tools](KIT_TEMPLATE.md) | `src/components/site/RoutineChart.astro`, `routine-chart.ts`, `src/lib/tool-handoff.ts`, `src/data/club/tools.ts`, `src/pages/club/tools/routine-chart.astro`, `src/components/club/ClubToolBar.tsx` |
| The October 2027 kit, A Home That Works Together (2026-10-23): a second configuration on the same page and print components: `action.kind: 'checklist'` (five lines, no dates, editable wording), the chore chart as its tool. The public chore chart moved into `ChoreChart.astro` + `chore-chart.ts` (public markup and behavior checked identical before and after), hosted at `/club/tools/chore-chart`. Handoffs now clear on other Club pages and saved charts are keyed per household. Migration seeds October as a **draft** (not applied) | `src/data/club/kits/2027-10-home-works-together.ts`, `src/components/site/ChoreChart.astro`, `chore-chart.ts`, `tool-handoff-ui.ts`, `src/pages/club/tools/chore-chart.astro`, `supabase/migrations/20261025000000_club_october_kit.sql` |
| October's tool, aligned (2026-10-23): the shared chore chart gains **Start with one job** (`oneJobs` in `src/data/chore-chart.ts`: one age-fit job, the rest blank to write in, no rewards), public and Club alike; its printed line changes from "Little jobs. A big helping hand." to "My jobs, start to finish." (every public printout). The Club opens it in one-job mode (`tool.start`) and offers grown-ups too (`people: 'everyone'`, a whole job: `adultOneJob`). The public chart's existing behavior is otherwise unchanged (checked before and after) | `src/components/site/ChoreChart.astro`, `chore-chart.ts`, `src/data/club/tools.ts` |
| Tests | `tests/club-august.test.ts`, `tests/club-countdown.test.ts`, `tests/club-october.test.ts`, `tests/tool-sharing.test.ts` |

### Previewing

- **Samples, no backend:** build with `PUBLIC_CLUB_ENABLED=true` (a Cloudflare Pages **Preview** environment variable, never Production) and open `/club/dashboard`. With accounts off it lists the samples; or add `?sample=rivera` to any /club page. `npm run dev` shows the pages too.
- **A real account (a Supabase branch or local stack only):** apply the migration there, set `PUBLIC_ACCOUNTS_ENABLED=true` and `PUBLIC_CLUB_ENABLED=true` on the preview, schedule the kit and grant access in that project's SQL Editor:
  `update club_kits set status = 'scheduled', release_at = now() where slug = '2026-11-family-ownership';`
  `insert into club_access_grants (user_id, reason, note) select id, 'preview', 'owner preview' from auth.users where email = 'you@example.com';`

- **A hosted preview, no build host needed:** `node scripts/build-club-preview.mjs <Club-enabled dist> <out.html>` turns the member pages into one self-contained page (`src/preview/club-preview.tsx`): sample households only, navigation inside the page, printing replaced by "Preview the printout" (the host's frame can't open a print dialog). Owner preview published privately 2026-10-23.

### Still open before Phase 2
1. Accounts step 1 launch (its checklist in `supabase/ACCOUNTS.md`, `/privacy` first, with the Club's children's-data section).
2. The private beta (D2) uses `club_access_grants` with `reason = 'beta'`; no billing needed.
3. Megan's letters: November's (`letter: null`), and her approval or rewrite of August's and October's drafts (`draft: true`). No kit can be scheduled for members until then.

Phase 2 (billing) doesn't start until the owner says so.
