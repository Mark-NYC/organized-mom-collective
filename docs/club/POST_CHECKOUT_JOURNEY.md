# Club post-checkout journey (P0, Oct 31 2026; Welcome Kit revised the same day)

Checkout → Sign in → Family questionnaire (family, then profile steps 2–6) → Mailing address → Personalize and approve
the Family Vision print → Review the Family Meeting guide → Personalize and confirm the current month's resource →
**Welcome Kit submitted** → Club Home. The kit (print + guide + first month) is mailed within two business days of her
approvals ([WELCOME_KIT.md](WELCOME_KIT.md)).

## Owner decisions (Oct 31 2026) and where they live

| # | Decision | Implemented |
| --- | --- | --- |
| 1 | Before January 2027, January is the founding month; no November/December 2026 resources | Already the rule (`club_checkout_state`, `club_intro_grant`); unchanged |
| 2 | A standard one-page Family Meeting guide in every kit, a packing-list insert | `src/data/club/meeting-guide.ts` (draft copy), `/club/family-meeting-guide`, admin packing list and CSV |
| 3 | Explicit approval of both personalized items; no three-day rule; reminders | `20261110000000_club_welcome_kit_approvals.sql`, reminders at 2 and 7 days |
| 4 | No free month → charged $5.90 at once with disclosure, normal kit | 2027 onward: already the behavior, now tested and disclosed (join page, Stripe Checkout). Founding window: proposal B |
| 5 | Current program month, late-month joiners included | Already the rule: the month she joins, no cutoff for the kit |
| 6 | One regular schedule after the kit, billing dates unchanged for now | [BILLING_SCHEDULE_PROPOSAL.md](BILLING_SCHEDULE_PROPOSAL.md) (1st/15th/30th, recommendation A) |
| – | Two-business-day target and owner notification, nothing marked automatically | `kit_submitted_at`, `kit_ship_by`, club-billing `kit_submitted` email |
| – | What prints is the saved tool | `/app/club/<month>?fulfillment=<order>` (`startFulfillment`) | One state machine (`src/lib/club/onboarding.ts`, from `club_me` plus her profile)
decides every step; refreshing, signing out or switching devices lands on the same step.

## What the owner's production test showed (read-only, Oct 31 2026)

Test account created 11:24 (Stripe test mode). `club_intro_grant` refused the free month as `already_claimed`: the
mailing address matched an earlier test account's claim (one free month per household; correct). The webhook moved the
trial end to January 1, 2027. So: member, access, onboarded, address on file, **no months, no Welcome Kit orders**,
`next` = January (paid January 1). Nothing to fix in the data; the site didn't handle this state.

## Root causes

1. **Profile steps skipped.** `ClubWelcome` offered steps 2–6 only when the next step was the address or the print. A
   member with no Welcome Kit yet (`nextStep` = home) went from the family form straight to `/app/club`. A refresh
   after the family form also lost them (they depended on an in-memory "just saved" flag). `nextStep` ignored the
   profile, so `/club/login` couldn't resume it either.
2. **No explanation without a Welcome Kit.** Nothing said the free month wasn't available or when the membership starts;
   she landed in a library with nothing marked hers.
3. **Two homes, three navs.** `/app/club` used the companion nav, whose Account tab (`/app/account`) showed a made-up
   **sample family**; `/club/dashboard` was a second home with its own month list; the Club header said "Your Club /
   Account / Family".
4. **First resource confirmed on the wrong page.** The Welcome Kit confirmation lived on `/club/resources/<slug>`, the
   old member copy (January shows Habit Cards), not the real tool at `/app/club/<month>`.
5. **Generic closed-month message.** January said "isn't open for your account" instead of when it opens.

## What changed

| Area | Change |
| --- | --- |
| Setup order | `nextStep(me, { profile, profileDeferred })` adds `profile` right after `family`, for every member, with or without a kit. Resumes at the first open step. "Skip for now" skips one question. "Finish later" shows what's left and where (My Family), is remembered per account on this device, and continues to the address and kit. |
| No kit yet | `startsWithFirstPayment(me)`: after setup, "Your Club starts with January" (one free month per household, first payment date, what comes then), then Club Home, which keeps the same card. Nothing is granted. |
| First resource | Confirmed on `/app/club/<month>?welcome=1` (`WelcomeKitConfirm`, same `club_fulfillment_approve`, her click only). A later edit asks again. The old copy redirects there while the kit waits. |
| Navigation | `ClubNav`: Club Home, My Family, Monthly Resources (`/app/club#months`), Account & Billing, Sign out, on Club Home, every month tool, `/club/family`, `/club/dashboard`, the print and welcome pages. Short labels on phones. |
| Club Home | Family name, members with ages, Edit my family; one next step; Welcome Kit progress (4 steps); current month; coming up; every month. |
| Account & Billing | `/club/dashboard`: plan and billing, family summary, address, email, a link to Club Home; no second month list (samples keep theirs). |
| `/app/account` | A member sees her own family and Club links; the sample is shown only to others, labeled. |
| Closed month | "January opens January 1, 2027 … comes with your January 1, 2027 payment." |

Kit progress is now four steps (family, address, print, first resource). Tools, artwork, month cards, pricing, billing,
fulfillment rules and database functions are unchanged.

## Not fixed here (owner decisions)

- ~~Fulfillment prints the old member copy~~: fixed. The owner's print view is the real tool with her saved version
  (checked: her edit appears in the print view; January prints its two Weekly Meeting sheets). PR #268's member-copy
  print fixes still matter for November (its tool is that page) and for anyone opening an old copy.
- Registry titles differ from some tools (January: "Our Family Habit Cards" vs the Weekly Meeting tool). Club Home uses
  the month card titles; the confirmation says "Your January plan". Also #268.
- The tool's own "Approve this plan" button stays (device-only check mark); the kit panel says so.
- "Finish later" is per device; on a new device she's offered the open questions again (one click to defer).

## Tests

`node scripts/club-onboarding-e2e.mjs` (all scenarios, desktop and mobile), `--only=p0desktop,p0mobile` for this
journey, `--only=months` for every tool. Unit: `tests/club-onboarding.test.ts`.
