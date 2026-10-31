# Club post-checkout journey (P0, Oct 31 2026)

Checkout → Sign in → Family → Family profile (steps 2–6) → Mailing address → Family Vision print → First monthly
resource → Confirm → Club Home. One state machine (`src/lib/club/onboarding.ts`, from `club_me` plus her profile)
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

- **Fulfillment still prints the old member copy.** The admin print view renders `/club/resources/<slug>`; her edits on
  the app tool are saved to the same `club_resource_versions` row but under the tool's own key, so the printed January
  wouldn't show them (and is the Habit Cards copy). Decide in PR #268 before approving any Welcome Kit for print.
- Registry titles differ from some tools (January: "Our Family Habit Cards" vs the Weekly Meeting tool). Club Home uses
  the month card titles; the confirmation says "Your January plan". Also #268.
- The tool's own "Approve this plan" button stays (device-only check mark); the kit panel says so.
- "Finish later" is per device; on a new device she's offered the open questions again (one click to defer).

## Tests

`node scripts/club-onboarding-e2e.mjs` (all scenarios, desktop and mobile), `--only=p0desktop,p0mobile` for this
journey, `--only=months` for every tool. Unit: `tests/club-onboarding.test.ts`.
