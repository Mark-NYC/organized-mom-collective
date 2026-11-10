# Email-to-checkout attribution

Status: Implemented in GitHub and deployed Supabase RPC and both checkout Edge Functions on November 10, 2026. Admin `/admin/email` code updated. The public Astro build and end-to-end Stripe paid checkout have **not** been independently confirmed.

## What counts

- **Email-associated shop order**: a Stripe Checkout Session that was attached to a real `shop_orders` row and has a verified payment state `paid`, `partially_refunded` or `refunded` with `livemode=true`. Shop net revenue is paid order amount minus refunds, floored at zero.
- **Email-associated calendar order**: the same paid shop rule, plus a matching order item with calendar slug `family-schedule-calendar-2027`, `calendar-52-week`, or `calendar-26-week`. Count one order, not line item quantity.
- **Email-associated Club enrollment**: a completed live `club_checkout_sessions` row linked to a real live Club subscription for that Stripe customer. Trialing and free-first-month enrollments **are not** paid revenue. No Club revenue is claimed.
- **Email campaign association**: same-browser first-party seven-day **last email campaign** UTM snapshot. This does not prove an email was read, clicked or caused the sale. It does not track another device/browser, and it is not full lifecycle attribution. No raw URLs, subscriber passes, emails, customer names or IP addresses are stored in the analytics attribution row.
- **No pre-existing history is backfilled**. Only future visits with valid `utm_source=omc_email&utm_medium=email&utm_campaign=...` can be associated.

## Implemented paths

- `src/lib/email-checkout-attribution.ts`: strict campaign allowlist, 7-day expiry, session-storage-only browser snapshot. A fresh email campaign visit replaces an earlier email campaign snapshot. Unrecognized or expired data is ignored.
- `src/layouts/BaseLayout.astro`: captures tagged URLs only on public tracked pages; the public page can keep functioning if storage is blocked. Admin/app tracking remains disabled where specified.
- `src/lib/shop.ts`: includes optional attribution object in shop checkout creation request.
- `src/lib/club/membership.ts`: includes optional attribution in Club checkout creation request.
- `supabase/functions/_shared/handlers/checkout.ts`: records attribution **after** Stripe Checkout Session is created and `shop_attach_session` succeeds.
- `supabase/functions/_shared/handlers/club-billing.ts`: records attribution **after** the Club Checkout Session is created and `club_checkout_record` succeeds.
- `supabase/migrations/20261110023000_email_checkout_attribution.sql`: RLS-protected, service-role-only `marketing_checkout_attribution` keyed by Stripe session ID. The RPC checks a matching real checkout session exists before writing. Idempotent first-touch per individual checkout session. No money or access decision uses campaign data.
- `supabase/migrations/20261110024000_email_checkout_conversion_reporting.sql`: owner-only aggregate reporting derives results by joining attribution with already-verified financial and Club rows, for the past 30 days. Does not treat an abandoned or test checkout as a sale. Per-campaign totals included.
- `src/components/admin/EmailAdmin.tsx`: shows associated Club enrollments, calendar orders, paid site orders, net paid shop revenue, and per-campaign totals beside unattributed business totals. Explains the seven-day UTM model.

## Deployment and QA

- Supabase migration applied successfully; RLS enabled and public/anonymous function rights revoked. Service role may record checkout attribution.
- `shop-checkout` Supabase Edge Function deployed ACTIVE version 35. Safe request smoke test returned the expected 400 `invalid_request` without creating an order.
- `club-billing` deployed ACTIVE version 19. Safe `offer` request returned HTTP 200 with the current test-mode offer state. No checkout was created.
- Rolled-back SQL test successfully attached a recognized campaign to an existing **test** Club Checkout Session, and the reporting RPC returned campaign totals without counting this test session as a live Club enrollment. No fixture persisted.
- Unknown session ID, invalid campaign and duplicate-session RPC paths were exercised in the same rolled-back transaction. The attribution ledger remains empty until an actual tagged checkout is opened.
- The owner-only reporting RPC returned valid JSON; anonymous callers cannot execute either write RPC or admin report. Seven previously scheduled newsletter broadcasts unchanged.

## Where to see it

[Email admin dashboard](https://www.organizedmomcollective.com/admin/email). Future `one_small_win_04`, `one_small_win_05` and `one_small_win_07` have correct UTM-tagged links; earlier scheduled newsletters were intentionally not edited. Other future Club/calendar offers should follow the same campaign convention and keep `#omc_pass` fragments after URL queries.

## Remaining live acceptance checks

1. Confirm deployed `/admin/email` is accessible when signed in and correctly renders the new conversion fields.
2. Open a UTM-tagged Club or calendar landing page in a private browser, navigate to checkout and inspect the completed Stripe session association in Supabase. Test-mode checkouts must **not** increment live conversion totals.
3. Complete a controlled paid *live* checkout only when appropriate, then confirm one and only one attributed conversion after the webhook confirms payment. Do not invent real-money purchases merely for QA.
4. If the Club signup button reuses an already-open Checkout Session created before the email visit, the last-minute email source may not be attached; first captured attribution wins for a specific session. This is a documented limitation.
5. Resend click-tracking remains off, deliberately avoiding redirect interference with subscriber access passes. GA4 page visits already support the UTM query but are not imported into this report.

## Metrics interpretation

These figures mean *a buyer was in a browser session previously reached by an email-tagged link within seven days*. They do **not** establish causation. A free Club enrollment is not counted as paid revenue; revenue from Club invoices requires a separate verified paid invoice join and should not be inferred from enrollment counts.
