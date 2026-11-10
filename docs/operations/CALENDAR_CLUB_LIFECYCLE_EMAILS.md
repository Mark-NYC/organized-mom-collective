# Calendar and Club lifecycle email sequences

Updated: November 10, 2026
Status: Four Resend drafts updated with the Mark & Meg signature. **Production Supabase staging queue, guarded claim/finish RPCs, and the delivery Edge Function deployed on November 10, 2026.** Jobs stay held and the delivery launch gate is disabled; no cron dispatcher or live send is activated. Existing customers are not backfilled. Production delivery must remain disabled until the remaining checks below are implemented and tested.

## Calendar buyer onboarding (site shop orders)

- **First Week:** send after confirmed physical delivery `shop_orders.delivered_at`, never after merely paid/shipped. Template `426ab487-b9b3-4470-8ab0-cb70932a02ae`, subject "Your calendar is here. Start with this."
- **Week Two:** send 7 days after first follow-up, and only for fulfilled, noncancelled, nonrefunded eligible orders. Template `47781939-1678-432a-9fe2-48c72e6c0793`, subject "One question to ask around your calendar".
- Site orders only; Etsy fulfillment/delivery must not be inferred from a site order.
- Do not use `shipped_at` as a delivery substitute. If `delivered_at` remains unset, do not send.
- Distinguish operational product-use guidance from a promotional message. Only send promotional content or review requests under applicable marketing consent and platform policy. Week Two currently asks for a direct reply, not an incentive or review.

## Organized Family Club activation coaching

- **Day 3:** 3 days after confirmed live Club activation `club_subscriptions.started_at`. Template `db9e6ea7-b8ac-4763-9d15-963193d81130`, subject "Try this first with your family".
- **Day 10:** 10 days after confirmed live activation. Template `e4c1661b-040a-45b9-b75c-e8de724c76c2`, subject "Keep your family meeting short".
- Only for active/trialing entitled live subscriptions, never test sessions, failed checkouts, canceled/revoked access or non-activated signups. Avoid duplicate coaching on subscription renewals.
- Existing welcome, profile reminder, resource ready, review, kit reminder and billing notices stay in place. On day 3, if onboarding is incomplete, prefer existing profile reminder over this coaching. Suppress or defer the email when a high-priority billing or activation notification is due.

## Before production automation

1. **Outstanding:** Verify sender identity, actual mailing-address footer and unsubscribe handling for marketing mail, preview/test the four drafts, then publish the approved templates. All four drafts now close with **Mark & Meg / Creators of the Organized Mom Collective** in HTML and plain text; verified by Resend read-back.
2. **Done for staging:** A private, RLS-protected lifecycle queue with unique `(journey, source_id, step)`, due dates, provider message IDs, and retry/uncertain fields. New live, consented site-calendar delivered orders and Club activation events can stage held jobs. No historical backfill. Migration: `supabase/migrations/20261110030000_marketing_lifecycle_staging.sql`.
3. **Implemented in guarded SQL, pending end-to-end acceptance:** Source-state recheck, consent and suppression verification, paid/delivered calendar checks, live active/trialing Club checks with an entitlement. The worker also rechecks Resend unsubscribe state and template publication before sending. Verify source-state transitions under representative real checkout/activation events before enabling.
4. **Implemented in guarded SQL/worker:** Resend idempotency keys, shared unique marketing send-day ledger (step 0 for lifecycle), Wednesday and explicit newsletter-date blocking. Existing welcome emails keep their own reservations. Pending acceptance test for simultaneous claims.
5. Dry-run with controlled test records, then execute direct end-to-end acceptance of one delivered shop order and one activated Club subscription with no actual customer mail. Monitor response, provider events and retries.
6. Only after these pass, enable scoped production sending. No sender or recipient email address should be invented.

## Editorial rules

These emails give one practical action and a single destination or reply. No artificial urgency, discount promises, or pressure. Apply `EMAIL_EDITORIAL_DESIGN_GUIDELINES.md` to rendered output. Preserve privacy: avoid unnecessary family details, names, or payment information in logs. Review first-week customer feedback and eventual campaign attribution before changing cadence.

## Tracking

Record send eligibility, due date, delivered and failed events, suppression reason, unsubscribes, and responses when available. Use first-party UTM tags for actual relevant destination links, and do not claim open/click rates while Resend tracking is off. Attribution is not proof of incremental conversions.

## November 10 staging verification

The production migration applied successfully. Read-back confirmed exactly two enabled trigger definitions, RLS on, no SELECT rights for anon or authenticated roles, and zero queued jobs at deployment. The four Resend templates remain drafts. **No mail was sent.** This verifies schema installation only, not actual event-trigger behavior or end-to-end delivery. Before launch, investigate cases where customer/line-item metadata arrives after the triggering subscription/delivery update, and make qualification idempotent for eventual consistency. Implement actual send-time rechecks and send-day coordination separately.

## November 10 delivery-worker implementation

- Migration: `supabase/migrations/20261110031000_marketing_lifecycle_worker_guardrails.sql` applied in production. Adds private `marketing_lifecycle_settings` (all three launch conditions false), dispatch tokens/counters, service-role-only `marketing_claim_lifecycle` and `marketing_finish_lifecycle` functions, and `marketing_private.prepare_lifecycle_dispatch` (not scheduled).
- Edge Function: `supabase/functions/resend-lifecycle-delivery/index.ts`, deployed as `resend-lifecycle-delivery` version 1. The endpoint takes only an opaque 64-character dispatch token, rechecks the marketing contact, Resend unsubscribe, suppression and published template state, and sends through Resend with an idempotency key only after a successful SQL claim. Failed or uncertain send results require investigation; they are not blindly retried.
- Launch remains **OFF**: `enabled=false`, `approved_templates=false`, `deliverability_verified=false`. The four templates remain **draft**; no lifecycle cron exists. SQL read-back showed `queued_jobs=0`, `pending_sends=0`, and the guarded dispatcher returned `0` while disabled.
- Security advisor surfaced RLS-without-policy info for the new two tables, as intended for service-only tables with revoked anon/authenticated access. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .
- **Outstanding:** Verify postal address/unsubscribe compliance, test with synthetic customer records and test provider delivery, check that Club customer/entitlement rows arrive before activation trigger, confirm calendar order item availability at delivery transition, and handle race cases where these records become eligible after the original trigger. Explicitly approve and schedule only after acceptance. Current content is short lifecycle coaching; do not misclassify it as operational receipts to bypass opt-in.
