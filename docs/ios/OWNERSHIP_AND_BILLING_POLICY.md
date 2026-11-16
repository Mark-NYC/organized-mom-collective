# Household ownership, account deletion and Club billing: proposed policy

Status: **proposal for owner approval, 2026-11-15. The guard is written and tested on the branch (20261129, not applied); live deletion and billing are unchanged.** Today's behavior is
recorded in `supabase/tests/household-ownership-billing.sql` (15 checks; "gap:" checks describe what this policy would
change).

## Today (tested on an isolated database)

| Situation | What happens now | Safe? |
| --- | --- | --- |
| Owner deletes her account in the app/website while the Club is trialing, active or past due | Refused (`active_membership`); nothing changes | ✅ |
| Owner deletes her account while the subscription is **unpaid**, **incomplete** (first payment pending) or **paused** | Allowed. Her account goes; the subscription row is kept as a billing record with **no owner**; Stripe may still try to charge (incomplete, unpaid retries, a paused one can resume) and nobody can manage it from the app | ❌ gap |
| Her sign-in is deleted **outside** `account_delete` (Supabase dashboard, a script) while **active** | Nothing stops it. The household passes to the partner (20261124), but the **active subscription is left with no owner**: Stripe keeps charging her card and nobody can cancel from the app | ❌ gap |
| Subscription already canceled | Her account goes; the partner keeps the family on the free plan; the old subscription stays as a billing record | ✅ |
| The partner | Can't read or change any subscription (RLS, no function), can't take ownership (handover isn't exposed), gets Club access only through the owner's live membership (20261128) | ✅ |

Billing credentials never move today: the Stripe customer stays tied to whoever paid.

## Proposed policy

1. **No account that can still be charged can be deleted, by any path.** A membership counts as chargeable in Stripe
   statuses `trialing`, `active`, `past_due`, `unpaid`, `incomplete` and `paused`. Deleting the sign-in is refused in
   the database itself (a check on deleting the account, not only in `account_delete`), with a clear message: "Cancel
   your Family Meeting Club membership first." Canceling happens in the billing portal on the website (never in the
   app), or by support.
2. **Cancel, then delete.** A canceled-at-period-end membership keeps its paid months until the period ends. Deletion
   is allowed once Stripe reports `canceled` (or `incomplete_expired`). For someone who wants to leave at once,
   support cancels immediately under the existing refund rules (docs/operations/CUSTOMER_SUPPORT.md); no new refund
   terms.
3. **The family stays with the other adult, on the free plan.** When the owner's account goes (after cancellation),
   the partner becomes the owner of the household: family, colors, calendar, agreements, saved Club work stay. The
   household's Club access ends with the membership; the partner can start their own membership with their own
   payment method. **No billing credentials, Stripe customer or subscription are ever transferred.**
4. **Paid months already received.** Proposed: the household keeps **read and print** access to the months it already
   received (they're the family's), by re-granting them to the new owner as admin entitlements with an audit note.
   Needs your decision; until then they become unreadable when the payer leaves.
5. **Voluntary ownership transfer (later, not release 1).** Allowed only with no chargeable membership, or as: owner
   cancels → the other adult subscribes with their own card → ownership moves (`household_owner_handover`, already
   built, not exposed) with both adults confirming in the app. Never a silent move of billing.
6. **Safety net for anything that slips through.** If a Stripe event arrives for a subscription whose payer no longer
   exists, `club-webhook` cancels it immediately, flags it, and emails the owner (you) for follow-up and any refund.
   Admin deletion in the dashboard is documented as "cancel in Stripe first".

## Built on the branch (2026-11-15, not applied)

- **20261129_account_delete_billing_guard** (points 1–2): `account_chargeable(uid)` and a BEFORE DELETE trigger on
  sign-ins that refuses (`active_membership`) while a subscription is trialing, active, past due, unpaid, incomplete or
  paused, from any path; `account_delete` refuses up front. A refusal rolls back everything, so the household handover
  never half-happens. Tests (`household-ownership-billing.sql`, 21 checks): every chargeable status refused, the direct
  delete refused, the partner can always delete their own account (the owner's membership and family stay), cancel then
  delete works and the partner owns the family with no Club access and no billing, `incomplete_expired` doesn't block.
- **Our Week Account** (point 3, in the app): sign out and "Delete my account" with what happens to the family spelled
  out for her role (alone: deleted; with a partner: stays with them; partner: only their sign-in). A refusal says "Contact
  us and we'll help you cancel it first", never a billing link (no purchasing in the app). Checked end to end in
  `scripts/e2e/family-e2e.mjs`.
- Production today (read-only, 2026-11-15): no chargeable subscription without an owner.
- **Not built:** point 6 (webhook cancels a live subscription whose payer is gone): it changes live billing behavior, so
  it waits for your approval. With 29 applied it's a second line of defense only.

## What would change (after approval)

- A guard on deleting a sign-in: refuse while a chargeable subscription exists (covers every path), plus the same
  check in `account_delete` with the full status list. Tests flip the three "gap:" checks.
- `club-webhook` (Edge Function): cancel and flag a live subscription whose user is gone.
- App/website copy for the deletion refusal (owner-approved wording).
- Optional (decision 4): re-grant received months to the new owner on handover.

## Decisions needed (updated 2026-11-16)

Decided by the owner on 2026-11-16: an account deletion must never leave a paid subscription charging without a
clear way to cancel, and must never cost the other adult their household access or data. Built and tested:

- The database refuses to delete any sign-in with a chargeable subscription, by any path (20261129, not applied).
- The refusal now says why and how to fix it. In the app: "Contact us and we'll help you cancel it first" (no
  billing link inside the app). On the website: a link to Account & Billing to cancel, and to support.
- When an owner's account is deleted, the household passes to the other adult first; a partner deleting their
  account removes only their own sign-in.

Still yours to decide:

1. **Months already received.** After the payer cancels and leaves, should the household keep read and print access
   to the months it already received? Today they become unreadable. Recommended: keep them (re-grant to the new
   owner with an audit note). Not built.
2. **Leaving right now.** Cancellation is at period end. May support cancel immediately on request, and with what
   refund? Recommended: yes, under the existing refund terms in CUSTOMER_SUPPORT.md; no new terms.
3. **Webhook safety net.** If Stripe ever reports a live subscription whose payer no longer exists, cancel it
   automatically, flag it and email you? Recommended: yes. It changes live billing behavior, so it isn't built.
4. **A partner who pays.** If the second adult holds their own membership and the owner doesn't, the household
   shows no Club access today (access follows the owner). Recommended: honor either adult's membership. Not built.
5. **Voluntary ownership transfer** while subscribed. Not in release 1; needs both adults to confirm and the new
   owner to subscribe with their own card.
