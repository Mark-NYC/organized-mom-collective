# Calendar and Club lifecycle email sequences

Updated: November 10, 2026
Status: Four draft Resend templates created. **Not published, scheduled, or connected to automatic sending.** Production delivery must remain disabled until the trigger, opt-in and idempotency checks below are implemented and tested.

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

1. Publish the four approved templates; verify sender identity, actual mailing-address footer and unsubscribe handling appropriate to classification.
2. Add a private, RLS-protected lifecycle send queue with unique `(journey, source_id, step)`, due dates, provider message IDs, and retry/uncertain states. Backfill must be opt-in and bounded, never retroactive unreviewed sending.
3. Enqueue only from durable fulfillment and subscription state changes. Recheck source state at send time; cancellations, refunds, chargebacks and unsubscribes must block any promotional send. Verify marketing opt-in for promotional messages.
4. Reuse Resend idempotency keys and the existing per-recipient send-day reservation approach so welcome and newsletter sends do not unexpectedly overlap. Marketing one-message-per-day applies to every path.
5. Dry-run with controlled test records, then execute direct end-to-end acceptance of one delivered shop order and one activated Club subscription with no actual customer mail. Monitor response, provider events and retries.
6. Only after these pass, enable scoped production sending. No sender or recipient email address should be invented.

## Editorial rules

These emails give one practical action and a single destination or reply. No artificial urgency, discount promises, or pressure. Apply `EMAIL_EDITORIAL_DESIGN_GUIDELINES.md` to rendered output. Preserve privacy: avoid unnecessary family details, names, or payment information in logs. Review first-week customer feedback and eventual campaign attribution before changing cadence.

## Tracking

Record send eligibility, due date, delivered and failed events, suppression reason, unsubscribes, and responses when available. Use first-party UTM tags for actual relevant destination links, and do not claim open/click rates while Resend tracking is off. Attribution is not proof of incremental conversions.
