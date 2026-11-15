# Reconciled database migration plan (owner review)

Status: **plan for approval, 2026-11-15. Nothing applied to production.** Production applied through
`club_household_icon_style` (2026-11-13), under its own timestamps, so apply the files below **one at a time, in this
order** (Supabase SQL or `apply_migration`), never a blanket `db push`: production's migration history uses different
names and a push would try to re-run the shop, kit and email migrations it already has under other names.

Model these migrations serve (owner decisions 2026-11-15, [ACCESS_MODEL_ASSESSMENT.md](ACCESS_MODEL_ASSESSMENT.md)):
**Our Week** is the free family planning app (calendar, complete cleaning companion, weekly Family Meeting, family
responsibilities, two adult accounts per household). Paid: the physical wall calendar and Family Meeting Club (monthly
Family Focus resources, Welcome Kit, printed mailings). Both adults use the household's entitled Club resources; only
the paying owner manages billing, mailing address, subscription and ownership.

## 1. Audit of 20261121–23 (not applied, merged to main)

| Migration | What it is | Still needed? | Household reconciliation |
| --- | --- | --- | --- |
| `20261121_club_welcome_plans` | Storage for the **Family Rhythm**, the permanent welcome resource (owner decision D1): one row per household, revision-checked save, approval recorded against what prints | **Yes, urgently.** The live website code (main) already calls `club_welcome_plan_get` / `_save` for `/app/club/family-rhythm`; production doesn't have them, so that page fails for any signed-in member today (hidden only because the Club isn't launched) | Access resolves "the household I own" (`owner_user_id = me`): a partner gets `not_found`. Change in 28: read/edit for both adults on the household's entitlement; **approve/unapprove for print stays owner-only** (fulfillment control) |
| `20261122_club_welcome_rhythm_kit` | A second Welcome Kit item, `welcome_rhythm`, replacing the Family Vision print for **new** enrollments only when `club_settings.welcome_item = 'rhythm'`. Ships switched **off** (today's behavior: Vision). Redefines `club_me`, the fulfillment queue, admin lists and emails | **Yes, if the Family Rhythm still replaces the Vision print** (approved plan, WELCOME_KIT.md). Harmless while the switch is off | Welcome items, queue, admin and emails are owner/fulfillment matters: stay owner-only. `club_me` is redefined again in 28 for partners |
| `20261123_club_welcome_overlap` | When her first month is a kit flagged `establishes_daily_rhythm` (May, August), no separate welcome print; her first month is the Welcome win. Only matters with 22's switch on | **Yes, with 22** (decision D11). Does not affect January founders (January isn't flagged) | Owner/fulfillment only. Redefines `club_me` (latest version) |

**None is obsolete.** They don't touch the Family Meeting guide: the standard four-part, ten-minute guide is still the
Welcome Kit's packing-list insert (`src/data/club/meeting-guide.ts`), unchanged. Rollback scripts exist and were
rehearsed (`supabase/rollout/rollback-welcome-rhythm-kit.sql`, `rollback-welcome-overlap.sql`).

**Content conflicts found (not migrations; owner decisions):**
- **January 2027's kit teaches a different meeting.** Its action is "Our First 15-Minute Family Meeting" (five steps)
  and its tool builds "a personalized 15-minute meeting guide" (`src/data/club/kits/2027-01-fresh-start-together.ts`).
  The established meeting is four parts, ten minutes, and its January meeting page (`family-meeting.ts`, "Our Family
  Weekly Meeting") already uses that format. Founding members get January in their Welcome Kit beside the standard
  guide, so they'd receive two different meeting formats in one package.
- With the weekly meeting now free in Our Week, January's paid value should be the personalized Family Focus and the
  print, not the meeting itself.
- January's names differ across files: "A Week Everyone Can See" (kit header; also September's slug), "Fresh Start
  Together" (slug), "Our Family Weekly Meeting" (meeting page), "Our Family Focus" (2027-01 meeting guide).

## 2. The order

| # | File | Status | What it does | Depends on |
| --- | --- | --- | --- | --- |
| 1 | `20261121000000_club_welcome_plans.sql` | Ready (merged, tested, rollback rehearsed) | Family Rhythm storage | production today |
| 2 | `20261122000000_club_welcome_rhythm_kit.sql` | Ready, switch off | Rhythm as a Welcome Kit item | 1 |
| 3 | `20261123000000_club_welcome_overlap.sql` | Ready | Overlap rule | 2 |
| 4 | `20261124000000_household_shared.sql` | Ready (revised 2026-11-15) | `household_adults`, partners by invitation, **two adults max**, shared family profile, revision-checked family saves, owner linked to her family row, **owner deleting her account hands the household to the partner** | production today (independent of 1–3) |
| 5 | `20261125000000_family_calendar.sql` | Ready | Shared calendar, free | 4 |
| 6 | `20261126000000_household_member_colors.sql` | **New**, ready | Every member's color saved permanently by member id; backfill = today's colors | 4 |
| 7 | `20261127000000_family_agreements.sql` | Ready (revised 2026-11-15 for offline) | "We agreed" agreements: ids made on the phone, a revision per agreement, tombstone removes, a changes feed; conflicts refused, never overwritten | 4 |
| 8 | `20261128000000_household_club_access.sql` | Ready (written 2026-11-15) | Both adults use the household's Club entitlement; billing, address, approvals and fulfillment stay the owner's | 1–4 |
| 9 | `20261129000000_account_delete_billing_guard.sql` | Ready; **needs the deletion policy approved** | No sign-in that can still be charged (trialing, active, past due, unpaid, incomplete, paused) can be deleted by any path; account_delete refuses up front. Billing never transfers | 4 |

Applying 1–3 before 4 matters for 8 only: 8 redefines `club_me`, whose current definition is 23's. Writing 8 against
production's older `club_me` instead would silently drop 22–23's welcome fields. So: 1 → 2 → 3, then 4 onward.

Between steps, the live website keeps working: every change is additive or keeps the old function signatures
(`club_household_save` 3-argument, `club_family_profile`, `club_household` with extra fields only).

## 3. What changed on the branch today (tested, not applied)

**4: household_shared**
- Two grown-ups per household: invitations and acceptance refuse a third (`household_full`), with a per-household lock
  against two acceptances racing.
- **Account deletion can't take the family from the other adult.** A trigger on deleting a sign-in (any path:
  `account_delete`, the dashboard, a script) hands the household to the partner first: the partner becomes owner and
  account holder; family members, calendar, agreements, colors and Club content stay. What was only the leaving
  owner's goes with her account as before: billing, entitlements, mailing address, orders. `account_delete` already
  refuses while she has a paid membership. A partner deleting their account removes only their access; their family
  row stays. An owner without a partner: unchanged (her household goes with her account).
- Future voluntary transfer: `household_owner_handover(owner, partner)` is the same operation; not exposed. A
  voluntary transfer while subscribed also needs the Stripe customer and entitlements moved; out of scope for release 1.
- (Earlier today) owner linked to her family row on every save; the "linked member" guard applies to partners only.

**6: member colors (new)**
- `household_colors_complete(household)` saves, for each current member without a valid saved color, exactly the color
  the app shows today (`memberColors`: saved choices first, duplicates to the first person, then the next free marker
  color, children first, family order). Never changes a saved color; keeps archived members' colors on record.
- Runs once for every existing household, and at the end of every family save (the existing website form and the
  app): adding, removing or reordering never changes anyone else's color.
- Production dry run (read-only, counts only): 10 households, 5 with family members, 20 colors to save, largest family 4
  (no repeats), 0 saved colors today, 0 archived members, 0 printed orders, so no printed material can differ.

**Tests (throwaway Postgres; CI also on Postgres 17 and on production's migration state):**
- `household-colors.sql` (14 checks): the shared fixtures (`supabase/tests/fixtures/member-colors.json`) give the same
  colors in the database as in the app (`tests/member-colors-parity.test.ts`). Covered: no saved colors, a chosen
  color, duplicates, invalid values, archived people, nine children, the backfill being idempotent, and adding a baby
  first in the order, removing, reordering, picking a color, or a save that sends no colors.
- `household-ownership.sql` (14 checks): a third adult is refused. When the owner deletes her account, the household,
  members, calendar, agreements and colors stay, and the partner becomes owner and can invite again. A partner
  deleting their account loses only their own access. An owner with no partner: unchanged.
- Every existing suite still passes: accounts, Club access, membership (257), profile, welcome (21–23), partners,
  calendar, agreements.

## 4. 7 and 8, as built (2026-11-15)

**7 (revised):** `household_agreement_save(p, p_base)` creates with the phone's id or updates only from the revision it
started from (`conflict` otherwise; `removed` if the other adult removed it); the same suggestion agreed on two phones
returns the existing agreement; `household_agreement_remove(id, base)` keeps a tombstone; `household_agreements(since)`
is the changes feed (removals included). The profile read leaves removed ones out. The app keeps an outbox on the
phone (`src/lib/agreements/`), like the calendar's. Tests: 52 SQL checks, 10 unit tests (fake server, every conflict
rule), and the two-phone end-to-end flow (offline edit saved and shown at once; the other adult's earlier edit kept and
named; a non-conflicting offline edit syncs on reconnect).

**8:** one resolver, `household_billing_user(uid)`: the household owner for either adult. Patched from the live
definitions (exact text match or the migration stops): `club_resource_get` / `_save`, `club_document_get` / `_save`,
`club_welcome_plan_get` / `_save` use it. `club_me` becomes a thin wrapper: the owner's view is byte-for-byte as
before (`club_me_for`, generated from 23's definition); a partner gets access, kits and months, without plan, status,
renewal, grant, intro, address, welcome items, mailings or the next charge. Owner-only, untouched: approvals of the
monthly print and the Family Rhythm, the Welcome Kit guide review, the Vision print, fulfillment; `club_address_save`
now refuses partners (`owner_only`). Tests: 30 SQL checks (partner opens and edits the household's month and Family
Rhythm; can't approve printing, set an address or personalize the Vision print; sees no billing fields; after the
owner's membership ends both can only read; a removed partner loses access at once; strangers and anon get nothing).

**Production compatibility (read-only check of live definitions, 2026-11-15):** every text 8 patches exists in
production: `uid uuid := auth.uid();` in `club_resource_get`, `club_resource_save`, `club_document_get`,
`club_document_save`, `club_me`; the address marker in `club_address_save`; the `club_me()` header.

**Database test runs (throwaway Postgres 16 locally; CI on Postgres 17):** all 14 suites pass with every migration;
and 20261124–27 pass on production's current schema without 21–23 and 28 (CI's second pass).

## (Superseded) what was still to build

**7: offline agreements (revise 20261127):** a client-made id on create (a retry never duplicates), a `revision` per
agreement (edits and removes carry it; `conflict` instead of overwriting), tombstone removes (an offline edit to a
removed agreement is surfaced, not lost), and the conflict rules in ACCESS_MODEL_ASSESSMENT.md → 3. The app gets an
outbox like the calendar's.

**8: household Club access (write after this plan is approved):**
- One resolver: the household's paying account (the owner row of `household_id_for(uid)`).
- Both adults:
  - `club_resource_get` / `_save`, `club_document_get` / `_save`, the meeting guide functions, and
    `club_welcome_plan_get` / `_save` check the household's entitlement, not the caller's;
  - edits are revision-checked per household (already).
- Owner only:
  - `club_fulfillment_approve`, `club_welcome_plan_approve` / `_unapprove`, `club_welcome_save` / `_approve`
    (Vision print), `club_address_save`;
  - checkout, the billing portal and `account_delete`'s membership guard.
- `club_me` for a partner:
  - `access`, `kits` and `months` for the household;
  - no plan, status, renewal, intro or Stripe fields, no welcome or fulfillment actions;
  - starts from 23's definition.
- Tests:
  - a partner opens entitled months and can't see billing, approve printing or change the address;
  - a removed partner loses access at once;
  - after the owner cancels, both adults can only read;
  - after an owner handover, the new owner has no paid access until they subscribe.

## 5. How to apply (each step needs your go)

1. Snapshot production (`supabase/rollout/snapshot.sql`) and run `verify.sql` before and after each file.
2. Apply 1, 2, 3 (switch stays off). Check: Family Rhythm page loads for a test member; `club_settings.welcome_item = 'vision'`.
3. Apply 4, 5, 6 together in one session. Check: 10 households each have one owner row; 20 colors saved and equal to the
   dry run; the live family form still saves.
4. Apply 7 and 8 (built; need your approval).
4b. Apply 9 once the deletion policy is approved. Check: `select count(*) from pg_trigger where tgname = 'account_chargeable_guard'` = 1; a test account with a canceled subscription can still delete itself.
5. Only then ship the app and website code that uses them.
