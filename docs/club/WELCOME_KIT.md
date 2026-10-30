# The Welcome Kit (approved 2026-10-30)

A new member's first mailing is **one package**: her personalized Family Vision watercolor print (our gift, the
bonus) and her first month's printed resource. The print adds materials cost, not a second shipment. Every later
month follows the normal monthly schedule ([MEMBERSHIP.md](MEMBERSHIP.md)).

Code: `supabase/migrations/20261108000000_club_welcome_kit.sql` (pairing, readiness, admin actions, December, the
reminder email), `src/lib/club/onboarding.ts` (her next step), `/club/welcome`, `/club/family-vision`,
`/club/resources/<first month>?welcome=1`, `/admin/club → Fulfillment → Welcome Kits`. Tests:
`supabase/tests/club-membership.sql` (Welcome Kit section), `tests/club-billing-e2e.test.ts`,
`tests/club-onboarding.test.ts`, `scripts/club-onboarding-e2e.mjs` (pages against a local copy of the database).

## How it's built: two orders, one package

No new tables or columns. A new household already gets two fulfillment orders: the `welcome_vision` order and the
`monthly_resource` order for its first paid month (`club_households.first_paid_month`: the free month, or the first
paid month without one). They stay two rows, so each keeps its own entitlement, refund and cancellation rules; the
queue pairs them:

- `club_fulfillment_queue`: `batch = 'welcome_kit'` on both, `in_welcome_kit`, `kit_partner_id`, `kit_auto_approve_at`,
  and **one readiness for the package**.
- `club_admin_set_welcome_kit`: approve, print, mail, return, hold or skip **both together**. Moving one half alone is
  refused (`use_welcome_kit`), so a package can't be split or sent twice.
- Kit orders are left out of the monthly lists, the monthly mail-house CSV and the monthly "review before printing"
  email.

## What she does (about three minutes)

1. **You're in** (`/club/welcome`): sign-in code, then her family: what she calls her family (prefilled
   "The Rivera Family" from the name she gave Stripe, editable, never over a name she already saved), her first name,
   the kids' names and ages. Her address only if Checkout didn't collect one.
2. **Her print** (`/club/family-vision`): "A little gift, just for your family." Artwork first; **"Yes! Send me my
   print"** (explicit approval, always); "Customize artwork"; "Mailing to Austin, TX · Change". Then "It's yours!" with
   **"See your first family resource"**.
3. **Her first resource** (`/club/resources/<slug>?welcome=1`): the month's title and problem, prepared for her kids by
   name, what comes in the kit, how it helps, her first step, the printable itself to correct, then one final
   **"Looks good. Prepare my Welcome Kit"** → "It's all set!" → **"See your Club"**: `/app/club`, the month library,
   now showing her months as hers (her Welcome Kit while it's on its way, each month she holds opening her family's
   version, the month her next payment brings). Signed out, `/app/club` is still the preview. Her account (billing,
   family, address) is `/club/dashboard`, linked from there; log-ins and Club emails land on her next step or `/app/club`.

Leaving at any point and coming back (refresh, the welcome email's sign-in, `/club/login`) lands on the same step: it's
derived from the database every time, never stored in the browser.

## The package's readiness, in order

`needs_profile` → `needs_address` → `mail_paused` → `needs_vision` (her print isn't approved) → `needs_resource` (the
month isn't published) → `needs_confirmation` → `needs_pdf` (either item) → `ready`.

**Her first resource:** if she doesn't confirm it, the database sends one reminder batch two days after she approved
her print (`/admin/club → Setup & emails → Welcome Kit reminders`; run it daily), and **three days after her print
approval** the prepared resource counts as confirmed, **only when everything before it is valid** (family profile,
address, not paused, the month published). Approving the kit records it ("confirmed automatically 3 days after the
welcome print"). Her **print is never auto-approved**.

Opening her resource doesn't undo a confirmation (saving unchanged state is a no-op); changing it does, and she confirms
again (or the three-day rule applies). Once the kit is approved for print, both her print and her first resource lock.

## Eligibility

| Situation | The kit |
| --- | --- |
| Normal new member | Ships when ready: one package |
| Cancels future renewal (cancel at period end) | **Ships**: she earned it |
| First payment refunded or disputed (paid joiners) | **Nothing ships**: both orders are canceled with that invoice |
| Unpaid / voided first invoice | Nothing exists to ship (no orders are created) |
| Membership ended before its free month (founding trial canceled outright) | **Held**: the free month is withdrawn, the kit shows "Held: her first month was withdrawn". The owner decides: skip it, or **send print alone…** with a note (required) |
| Address missing or mailings paused | Held until fixed; nothing is auto-confirmed |
| Her first month not published yet | Held (`needs_resource`); she sees "yours, we're finishing it", never "not part of your membership" |
| A welcome print that already stood in for a December (before this change) | Ships alone, as it was promised |

## Joining before or after the cutoff

The second-Sunday cutoff **doesn't apply** to a Welcome Kit; it ships on its own track as soon as both items are ready.

| She joins | Her first month | The kit | Next month |
| --- | --- | --- | --- |
| **Founding**, any day before January 2027 (before or after Dec 13) | January 2027 (free) | Ships once January is production-ready: **target early December** (owner decision 2026-10-30). No date is promised to members until production is ready. | February, paid Feb 1, normal schedule (catch-up batch) |
| From January 2027, any day of the month | The month she joins (free) | Ships as soon as she's done | Paid a month later, normal schedule |
| Late in the month (e.g. the 28th) | That month | Ships early the next month | Can arrive a few weeks after the kit. Never a duplicate: one order per household and month (unique index), the kit's month is never mailed in a monthly batch |
| A December (from December 2027) | December | **The print + December's own resource** (the December substitution is retired for new members) | January, normal schedule |
| No free month (returning household) | Its first paid month | Same rules | Normal schedule |

## Admin: `/admin/club → Fulfillment → Welcome Kits`

One row per package: household, both items (print: name, value, approved, PDF / Print view; first month: title,
confirmed or "counts as confirmed <date>", PDF / Print view), one readiness in plain words, address, and one set of
buttons: **approve kit → printed → mailed** (or on hold / skipped / returned). **Download approved kits** is one CSV row
per package, naming both items. Each monthly list says how many of its month's resources ship in Welcome Kits instead.

## Release order (nothing here is live yet)

1. Apply `20261108000000_club_welcome_kit.sql` to the live project (owner's go-ahead; production has only test data).
2. Deploy the regenerated Edge Functions (`supabase/dashboard/club-admin.ts`, `club-webhook.ts`): the welcome email's
   Welcome Kit copy and the `kit_reminder` batch.
3. Deploy the site.

Before 1, the site's new pages would ask the database for columns it doesn't have yet, so keep this order.
