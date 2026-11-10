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
- Resend existing webhook `169cfda6-fc7f-497f-86aa-a8595d3805f7`: expanded subscriptions to `contact.updated`, `email.bounced`, `email.complained`, `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.failed`, and `email.clicked`. No second secret or endpoint was created.
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
