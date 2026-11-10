# OMC Email Reporting

Updated November 10, 2026. This is the minimum email reporting build, not a marketing attribution suite.

## Admin page

**Route:** `/admin/email`. Uses the existing `AdminLayout` and `AdminGate`; visible in the Growth navigation and linked from the admin Overview. Reporting SQL is only executable for users with `public.is_admin('owner')` and discloses **aggregates only**. Neither public readers nor helper/admin roles can access its data.

The scorecard refresh button calls `public.admin_email_reporting()` via the existing authenticated admin session.

### Available today

- Free resource signups (last 7/30 days), total marketing opt-ins and opt-ins in the last 30 days.
- Newsletter Ready membership and sync errors.
- Day 2/Day 6 welcome jobs: sent last 30 days, pending/held, failed and due.
- Suppressions and actual **unsubscribes** (separately).
- Upcoming newsletter date, title and Resend scheduling state, directly from Supabase's calendar.
- Provider-confirmed delivered and failed message counts, populated as **signed Resend email events arrive**. No scheduled or merely attempted email is counted as delivered. Events are limited to broadcast IDs in the OMC newsletter calendar or welcome provider message IDs.
- Aggregate live Club active subscriptions and paid site orders last 30 days. **Not attributed to email**. No inferred ROAS or conversion claims.
- Signup trends using stored signup timestamps, not estimates.

### Tracking that is intentionally not claimed

- **Clicks:** Resend domain currently has click tracking **OFF**. The webhooks and private event table can accept future `email.clicked` events, but the UI reports *Not tracked*, not 0. Do not enable redirect-based click tracking until the email-link `#omc_pass` fragment is explicitly re-tested through the redirect on a new browser. An earlier QA established the custom pass merge works with click tracking off.
- **Opens:** Resend open tracking OFF, and open pixels are not necessary to ship this MVP.
- **Email-sourced Club visits:** Existing site GA4 tag `G-VGJK1B4TJ6` tracks site visits and campaign UTM tags; no GA4 API import into admin was built. Add consistent `utm_source=email&utm_medium=newsletter&utm_campaign=...` to future editorial/Club links where appropriate, then review GA4. Do not present a number as email-sourced without a verified UTM source.
- **Purchases from email:** The database records site orders and Club subscriptions but currently lacks reliable per-order email campaign attribution. Revenue is shown as an unattributed business context total. No extra personal tracking was introduced.
- **Existing Resend history:** Provider event tracking is prospective, not retroactive. Earlier broadcasts before the webhook expansion cannot be reconstructed from this event table.
- **Etsy purchases:** Not imported into this admin scorecard.

## Implementation

- `supabase/migrations/20261110020000_marketing_email_reporting.sql`: private `marketing_email_events` table, idempotent service-role-only `marketing_record_email_event` RPC, owner-only `admin_email_reporting` aggregate RPC.
- `supabase/migrations/20261110021000_email_reporting_unsubscribed_metric.sql`: distinguishes unsubscribe suppression from complaints and bounces.
- `supabase/functions/resend-marketing-webhook/index.ts`: validates signed Svix payload (existing implementation), writes only event ID, type, provider message ID, broadcast ID, event time, and sanitized link category. **Never stores recipient email, click IP, full click URL, session token, query string, hash fragment or user agent**. Retains the existing `contact.updated` / `email.bounced` / `email.complained` suppression handling. Analytics write failure does not prevent suppression.
- Resend existing webhook `169cfda6-fc7f-497f-86aa-a8595d3805f7`: expanded subscriptions to `contact.updated`, `email.bounced`, `email.complained`, `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.failed`, and `email.clicked` was requested, but a read-back of the provider webhook **does not list email.clicked** while click tracking is disabled. Delivery/failure subscriptions are active. No second secret or endpoint was created.
- `src/components/admin/EmailAdmin.tsx`, `src/pages/admin/email.astro`, `src/data/admin.ts` and `src/components/admin/OverviewAdmin.tsx`: owner-gated scorecard, mobile-friendly table/cards and navigation.
- No scheduled broadcast, welcome email, recipient segment or consent state was changed by reporting.

## QA

- Database migrations applied in production.
- With the owner context, the live `admin_email_reporting()` returned valid JSON, 3 newsletter-ready contacts, 0 audience-sync errors and all 7 pre-scheduled broadcasts.
- The event recording function was tested within a rolled-back transaction; no synthetic event remains.
- `anon` lacks EXECUTE on reporting RPC. `authenticated` has EXECUTE but the function raises `forbidden` unless the caller is an owner.
- Existing Resend webhook was updated in-place after the Edge Function redeploy; no webhook secret was rotated.
- Existing signed `contact.updated` webhook delivery history previously reported successful. **New email.delivered/failed ingestion should be verified after the next real event occurs**.
- GitHub push is complete; site build and the logged-in `/admin/email` browser render have not been independently confirmed by this server-side QA.

## Review after first newsletter

Check scheduled-to-sent reconciliation in `marketing_broadcast_calendar`, and whether `marketing_email_events` receives `email.delivered` or `email.failed` events for known broadcast IDs. The existing scheduling system records `scheduled` status before sending; this report does not pretend that future scheduled sends have been delivered. Add a reconciliation check for Resend status after sends if future reports reveal stale `scheduled` rows.

For upgrades: first add safe UTM campaign tracking into GA4, then test Resend click tracking with the private guide link, and only then add per-campaign clicks, site visits and attributed orders.

**Verified active webhook subscription read-back (2026-11-10):** `contact.updated`, `email.bounced`, `email.complained`, `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.failed`. `email.clicked` was requested but is not currently in Resend's returned subscription list. It is deliberately treated as unavailable, not zero. Domain click tracking remains off.


## Campaign attribution phase 1 (November 10, 2026)

Implemented **first-touch email UTM reporting** and the first tagged editorial links:

- `utm_source=omc_email`, `utm_medium=email`, `utm_campaign=one_small_win_04` on the **Club** link in One Small Win 04.
- `utm_source=omc_email`, `utm_medium=email`, `utm_campaign=one_small_win_05` on the **routine chart** link in One Small Win 05. **Important URL order:** the UTM query appears *before* `#omc_pass={{{contact.RESOURCE_PASS}}}`. That preserves both site campaign attribution and subscriber resource access.
- `utm_source=omc_email`, `utm_medium=email`, `utm_campaign=one_small_win_07` on the **calendar** link in One Small Win 07.
- One Small Win 07 also links to a public static PDF. No GA4 campaign data should be expected for a PDF fetched directly since no tracked webpage executes.
- One Small Win 06 and 08 have no website link, so no extra UTM was invented.
- Three updated Resend broadcasts were verified as **draft**, correctly in Newsletter Ready, with the email resource token syntax preserved. No previously scheduled Sunday or Wednesday emails were edited.
- Added `email_sourced_30d` to the owner-only reporting SQL, counting new free-tool contacts whose *first recorded* source is `omc_email` and medium is `email`. This is **not** overall newsletter click-through, nor direct Club conversion attribution.
- Migrations: `supabase/migrations/20261110022000_email_campaign_source_metric.sql`. Admin UI: `src/components/admin/EmailAdmin.tsx`.

**Limitation:** The seven already scheduled Nov 15–Dec 6 broadcasts were not changed and may not include campaign UTMs. The next opportunity for measurable GA4-tagged editorial visits is the later unscheduled draft campaigns. All new future editorial messages should add `utm_source=omc_email&utm_medium=email&utm_campaign=<stable-series-and-issue>` to normal website links, retaining any security token in the fragment. Link parameters must be HTML-escaped only inside attributes, not double-escaped.

**GA4 verification:** In the existing Google Analytics property `G-VGJK1B4TJ6`, look at Acquisition > Traffic acquisition using session source/medium `omc_email / email` and inspect session campaign per issue. This reports *visits*, not clicks from the inbox, and is not yet imported into the admin. Test tagged URLs with a new private browser; do not assume page reporting or purchase attribution works until observed.

**Live site caveat:** The protected admin report RPC was queried successfully as owner after the migration: three newsletter-ready, seven scheduled, zero first-touch email-source new contacts so far. A live website-browser render of `/admin/email` could not be independently established by available tools.


## Verified checkout-based attribution added, November 10, 2026

The owner-only report now includes 7-day last-email-UTM-associated **live paid shop orders**, **calendar paid orders**, **net shop revenue after refunds** and **completed live Club enrollments**, broken down by campaign. Club free trials are enrollments, not paid revenue. All totals join Stripe sessions to webhook-verified Supabase orders/subscriptions; simply opening checkout is not counted. This is association, not causation, and starts with new email-tagged sessions only. See [EMAIL_CHECKOUT_ATTRIBUTION.md](./EMAIL_CHECKOUT_ATTRIBUTION.md) for deployed code, RPCs, limitations and acceptance tests. No production newsletter schedules were changed.
