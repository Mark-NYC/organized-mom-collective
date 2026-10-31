# The Welcome Kit (approved 2026-10-30, revised with the owner 2026-10-31)

A new member's first mailing is **one package with three things**, mailed as soon as she has approved her
personalized items (target: **within two business days**):

1. her personalized **Family Vision** watercolor print (our gift),
2. the standard, reusable one-page **Family Meeting guide** (the same sheet for every family; a packing-list insert,
   not an order; `src/data/club/meeting-guide.ts`, printable at `/club/family-meeting-guide`; **draft copy for the
   owner's approval** before the first kit prints; not January's Weekly Family Meeting resource),
3. her **first month's resource**, personalized and approved by her on its real tool (`/app/club/<month>`): the
   current program month, or **January 2027** for founding members.

It never waits for a billing date or the second-Sunday cutoff. From the following month she gets the regular monthly
resource on the regular schedule ([MEMBERSHIP.md](MEMBERSHIP.md); billing-date alignment is a separate proposal:
[BILLING_SCHEDULE_PROPOSAL.md](BILLING_SCHEDULE_PROPOSAL.md)).

Code: `supabase/migrations/20261108000000_club_welcome_kit.sql` (pairing, readiness, admin actions, December, the
reminder email), `20261110000000_club_welcome_kit_approvals.sql` (explicit approval only, two reminders, submitted
and ship-by, the guide review, packing list, the owner's notification), `src/lib/club/onboarding.ts` (her next step), `/club/welcome`, `/club/family-vision`,
`/app/club/<first month>?welcome=1` (the month's real tool; `/club/resources/<slug>` sends her there while her kit waits on it), `/admin/club → Fulfillment → Welcome Kits`. Tests:
`supabase/tests/club-membership.sql` (Welcome Kit section), `tests/club-billing-e2e.test.ts`,
`tests/club-onboarding.test.ts`, `scripts/club-onboarding-e2e.mjs` (pages against a local copy of the database).

## How it's built: two orders, one package

No new tables or columns. A new household already gets two fulfillment orders: the `welcome_vision` order and the
`monthly_resource` order for its first paid month (`club_households.first_paid_month`: the free month, or the first
paid month without one). They stay two rows, so each keeps its own entitlement, refund and cancellation rules; the
queue pairs them:

- `club_fulfillment_queue`: `batch = 'welcome_kit'` on both, `in_welcome_kit`, `kit_partner_id`, **one readiness for
  the package**, `kit_submitted_at` (both of her approvals in) and `kit_ship_by` (two business days later, New York
  dates, weekends skipped; holidays aren't known). `kit_auto_approve_at` is retired (always null).
- `club_admin_set_welcome_kit`: approve, print, mail, return, hold or skip **both together**. Moving one half alone is
  refused (`use_welcome_kit`), so a package can't be split or sent twice.
- Kit orders are left out of the monthly lists, the monthly mail-house CSV and the monthly "review before printing"
  email.

## What she does

Checkout → family questionnaire → mailing address (only if Checkout didn't collect one) → personalize and approve her
print → review the Family Meeting guide → personalize and confirm her first month → **Welcome Kit submitted** → Club Home.


1. **You're in** (`/club/welcome`): sign-in code, then her family: what she calls her family (prefilled
   "The Rivera Family" from the name she gave Stripe, editable, never over a name she already saved), her first name,
   the kids' names and ages. Her address only if Checkout didn't collect one.
2. **Her print** (`/club/family-vision`): "A little gift, just for your family." Artwork first; **"Yes! Send me my
   print"** (explicit approval, always); "Customize artwork"; "Mailing to Austin, TX · Change". Then "It's yours!" with
   **"Next: your Family Meeting guide"**.
2b. **The Family Meeting guide** (`/club/family-meeting-guide`): the sheet she'll receive, "Nothing to change here",
   **"Next: your <month> resource"**. Her review is recorded (`club_households.meeting_guide_seen_at`) and never holds
   the kit.
3. **Her first resource** (`/app/club/<month>?welcome=1`, the month's real tool, `WelcomeKitConfirm`): above the tool,
   prepared for her family, what comes in the kit and what to do, then one final **"Looks good. Prepare my Welcome
   Kit"** (`club_fulfillment_approve`, her click only) → **"Your Welcome Kit is submitted"** (the three items, "we aim to
   print and mail it within two business days") → **"Go to Club Home"** (`/app/club`). The owner is emailed once
   (club-billing `kit_submitted` → `SUPPORT_INBOX`: packing list and mail-by date). An
   edit after confirming asks her to confirm again. The old `/club/resources/<slug>` copy redirects there while her kit
   waits on it (so the `kit_reminder` email's link lands on the tool). Club Home shows her family, her next step, her
   Welcome Kit's progress, her current month, what's coming and every month; Account & Billing (`/club/dashboard`) is
   her plan, address and email. Signed out, `/app/club` is still the preview. Full journey:
   [POST_CHECKOUT_JOURNEY.md](POST_CHECKOUT_JOURNEY.md).

Leaving at any point and coming back (refresh, the welcome email's sign-in, `/club/login`) lands on the same step: it's
derived from the database every time, never stored in the browser.

## The package's readiness, in order

`needs_profile` → `needs_address` → `mail_paused` → `needs_vision` (her print isn't approved) → `needs_resource` (the
month isn't published) → `needs_confirmation` → `needs_pdf` (either item) → `ready`.

**Explicit approval only (20261110).** Nothing is ever confirmed for her: the kit stays `needs_confirmation` until she
confirms her first month. Reminders instead: `/admin/club → Setup & emails → Welcome Kit reminders` sends the first
two days after her print approval and the second after seven (each once; run it daily). Her **print is never
auto-approved** either.

Opening her resource doesn't undo a confirmation (saving unchanged state is a no-op); changing it does, and she confirms
again. Once the kit is approved for print, both her print and her first resource lock.

**What prints is what she approved.** The owner's print view of her first month is the month's real tool,
`/app/club/<month>?fulfillment=<order>` (admin session; `startFulfillment` in `src/lib/club/plan/family.ts`), with her
saved version restored before the tool reads it: her family, her edits, nothing from the owner's own browser. Print →
Save as PDF → Mark PDF ready. November keeps its `/club/resources` page (its tool lives there).

## Eligibility

| Situation | The kit |
| --- | --- |
| Normal new member | Ships when ready: one package |
| Cancels future renewal (cancel at period end) | **Ships**: she earned it |
| First payment refunded or disputed (paid joiners) | **Nothing ships**: both orders are canceled with that invoice |
| Unpaid / voided first invoice | Nothing exists to ship (no orders are created) |
| Membership ended before its free month (founding trial canceled outright) | **Held**: the free month is withdrawn, the kit shows "Held: her first month was withdrawn". The owner decides: skip it, or **send print alone…** with a note (required) |
| Address missing or mailings paused | Held until fixed |
| No free month (same household again), 2027 onward | Charged $5.90 at once (disclosed on the join page and in Checkout); that payment buys the current month: **the normal kit, now** |
| No free month, founding window (before 2027) | Today: billing starts January 1, 2027 and the kit opens then. "Charged now, kit now" needs a billing change: [BILLING_SCHEDULE_PROPOSAL.md](BILLING_SCHEDULE_PROPOSAL.md) → B |
| Her first month not published yet | Held (`needs_resource`); she sees "yours, we're finishing it", never "not part of your membership" |
| A welcome print that already stood in for a December (before this change) | Ships alone, as it was promised |

## Joining before or after the cutoff

The second-Sunday cutoff **doesn't apply** to a Welcome Kit; it ships on its own track as soon as both items are ready.

| She joins | Her first month | The kit | Next month |
| --- | --- | --- | --- |
| **Founding**, any day before January 2027 | January 2027 (free; the founding month, decision 2026-10-31) | Within two business days of her approvals (January's kit is published) | February, paid Feb 1, normal schedule (catch-up batch) |
| From January 2027, any day of the month | The month she joins (free) | Ships as soon as she's done | Paid a month later, normal schedule |
| Late in the month (e.g. the 30th) | That month (no cutoff) | Within two business days of her approvals | Paid a month later; can arrive a few weeks after the kit. Never a duplicate: one order per household and month (unique index), the kit's month is never mailed in a monthly batch |
| A December (from December 2027) | December | **The print + December's own resource** (the December substitution is retired for new members) | January, normal schedule |
| No free month (returning household) | Its first paid month | Same rules | Normal schedule |

## Admin: `/admin/club → Fulfillment → Welcome Kits`

One row per package, submitted kits first by mail-by date: household, the three items (print: name, value, approved,
PDF / Print view; first month: title, confirmed or "not confirmed yet", PDF / Print view on its real tool; the Family
Meeting guide, standard insert, printable from the page's link), one readiness in plain words, "Submitted <date> · mail
by <date>" (red when overdue), address, and one set of buttons: **approve kit → printed → mailed** (or on hold /
skipped / returned). Nothing is marked automatically. **Download approved kits** is one CSV row per package, naming all
three items. Each monthly list says how many of its month's resources ship in Welcome Kits instead.

## Release order (20261108 is live since Oct 31 2026; the rest isn't)

1. Apply `20261110000000_club_welcome_kit_approvals.sql` (owner's go-ahead). It changes no existing order, entitlement,
   claim or subscription; the four founding test kits keep their orders and simply wait for her confirmation (the
   three-day rule no longer applies to them).
2. Deploy the regenerated Edge Functions `club-billing` (kit_submitted, checkout disclosure), `club-admin` (second
   reminder) and `club-webhook` (welcome email copy), from `supabase/dashboard/`.
3. Set `SUPPORT_INBOX` if the owner's notification should go somewhere other than contact@organizedmomcollective.com.
4. Deploy the site. Before 1, the guide step falls back to this device and the queue lacks ship-by dates, so keep the order.
