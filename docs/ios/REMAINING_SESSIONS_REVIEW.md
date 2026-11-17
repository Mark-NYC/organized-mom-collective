# Sessions D, E, F, G: 20261129, 20261130, 20261202, 20261203

Status 2026-11-17: **E applied and verified (results at the end). D, F and G prepared, not applied; each needs the
owner's separate approval.** Sessions A, B and C are applied and verified. **None of these four is needed for TestFlight**: the app falls back without each one (below).

## Preflight (production, read-only, 2026-11-17 after Session C)

| Check | Result |
| --- | --- |
| None of D, E, F, G is there (`household_archives`, `account_chargeable`, `club_household_of`; kit titles unchanged) | ok |
| Applied in order on a copy of production right after Session C (same schema fingerprint): 29, 30, 1202, 1203 | All four apply; `verify.sql` all ok |
| The 28 existing functions these four rewrite are identical in production and on that copy | 27 of 28. `club_member_link` differs by **one comment line** (production's copy was applied without it). 1203 patches its household insert, which is present, so it applies; the fingerprint after 1203 will differ from the rehearsal by that comment only |
| `pg_cron` installed (30 and 1203 each schedule one daily job) | yes; neither job exists yet |
| Chargeable subscriptions / without an account | 10 / 0 |

**Files (md5):** 29 `798be76f731f45235ab685dc65312ec5`, 30 `63a2264988493219c3c8784d5588b20f`, 1202
`bb8464373cfbe299e1ee66e458cc8a25`, 1203 `08ef5289343a85aa10b319dd84b52e19`.

## What each changes

| Session | File | New / changed (on the copy) | Existing rows written | Without it |
| --- | --- | --- | --- | --- |
| **E** | `20261129_account_delete_billing_guard` | 5 new (guard function, trigger on sign-ins); `account_delete` changed | None | **Live risk today:** any of the 10 members with a chargeable subscription can delete their account (website or app) and Stripe keeps charging. E refuses that by any path, with the approved "contact us / cancel first" wording |
| **D** | `20261130_household_join_from_own` | 30 new (archive table, preview/accept-leaving/snapshot functions, daily purge job `omc-household-archives-purge`) | None | Someone who already has a family can't join another adult's; the invitation page falls back to the plain accept |
| **F** | `20261202_club_kit_titles_january_september` | No schema | **2 rows:** `club_kits.title` January → "Our First Family Meeting", September → "Our Family Habit Cards". January is **scheduled**; its title shows in admin, the fulfillment queue and Club emails | Admin and emails keep the old working titles |
| **G** | `20261203_household_billing_either_adult` | 17 new (`club_household_of`, orphan list/flag/verify, daily job `omc-club-orphans-flag`); **26 changed**, including `club_invoice_apply` (the Stripe webhook path), `club_me`, `club_member_link`, fulfillment approval and admin lists | None directly; from then on, delivered months are re-granted to the other adult when the holder leaves | A partner who pays gets a second household; delivered months leave with the adult who held them |

Order: **E before G** (G needs it). D and F are independent. Suggested: E next (closes the live billing risk), then
F before January's mailing review, then D, then G last.

## Approvals still open

- **E:** policy decided 2026-11-16 (never delete a sign-in that can still be charged). The two "still yours" items in
  OWNERSHIP_AND_BILLING_POLICY.md (immediate cancellation on request; admin cancel button) don't block it.
- **D:** archive decided 2026-11-16. The privacy paragraph is written in `src/pages/privacy.astro`; it must be live on
  the website before D is applied, because D starts keeping the 90-day copy.
- **F, G:** decisions made 2026-11-16; each needs your go.

## Procedure (same as A–C, per session)

1. Fresh verified backup (push `.github/db-backup-request` with `[db-backup]`), or no session. For G, also run
   `supabase/rollout/household/capture-billing.sql` right before and keep its output (its rollback needs it).
2. Before-record: schema fingerprint and the data snapshot used in Session C (every table's checksum, Club access per
   sign-in, `club_me` / `club_resource_get` / welcome plan for every member).
3. Apply each file as text that must hash to the md5 above. After each: the schema change equals the rehearsal (G:
   plus the one comment), `verify.sql`, and the data snapshot unchanged except what the file means to write.
4. Session-specific checks:
   - E: exactly one `account_chargeable_guard` trigger; rolled-back test: deleting a sign-in with an active
     subscription is refused, with a cancelled one is allowed.
   - D: 6 cron jobs; rolled-back test of joining from an own family (archive made, plans carried over).
   - F: exactly two titles change; nothing else in `club_kits`.
   - G: `club_me` byte-identical for every paying member; `club_orphans()` empty; 7 cron jobs; rolled-back test: a
     partner who pays opens the household's Club, no second household.
5. Stop at the first check that isn't clean. Post-session backup.

## Rollback

| Undo | How | Loses |
| --- | --- | --- |
| E | Its section of `rollback.sql`, then `account_delete` from `captured/restore-functions-after-session-a.sql` (unchanged in production since; recheck its hash right before E) | Nothing |
| D | Its section of `rollback.sql` (also unschedules the purge) | The 90-day archive copies |
| F | Set the two titles back (old values in the file's header) | Nothing |
| G | `rollback-billing.sql`, then the `capture-billing.sql` output, then drop `club_household_of` | Nothing is deleted; a partner who pays stops opening the Club for the household |
| Anything unexpected | Restore the session's verified backup | Everything after that time |

## What I need from you

A separate "apply Session E" (and D, F, G when you want them). Recommended next: **E**, because it closes a live risk.

## Session E result (applied 2026-11-17 18:48 UTC)

| Step | Result |
| --- | --- |
| Backup right before: `20261117T184244Z` (run 44150617098) | VERIFIED: 104 tables, 936 rows restored exactly |
| Preflight | `account_delete` identical to the repo (`94dd0c44…`) and still has the line E patches; E absent; only `household_owner_leaving` on sign-ins; no cron job or other function deletes sign-ins; subscriptions: 10 trialing, 1 canceled; schema identical to post-Session C |
| Apply (text hashing to `764cbd64…`) | Schema change identical to the rehearsal: +6 (`account_chargeable`, `account_chargeable_guard`, the trigger, grants), `account_delete` changed. One guard trigger; members can't call the check |
| Unchanged (checksums) | 11 subscriptions, 12 entitlements, 12 Club orders, 34 shop orders, 4 shop entitlements, households, 20 family members, responsibilities, adults, customers, addresses, kits, email log, lifecycle queue, cron jobs, 11 sign-ins, Club access per sign-in (10 with access), every owner's `club_me`, family, profile, welcome plan and 140 month pages. 47 migrations |
| Now blocked from deletion | The 10 sign-ins with a trialing subscription, until it is canceled |

**Feature test on production, rolled back (10 of 10;** `supabase/rollout/household/session-e-feature-test.sql`; test-mode
subscriptions so nothing is queued): an owner with a trialing subscription can't delete in the app or by deleting the
sign-in directly, and the refused delete leaves the family whole; an `unpaid` subscription (no Club access, the old
gap) blocks both ways too; a canceled subscription allows deletion; a second adult deleting their account removes only
their sign-in; an owner who canceled deletes and the other adult becomes owner with every member kept and still opens
the family; canceled subscription records stay for billing history. Afterwards no test rows remain. The same test on a
pre-E copy fails the direct-delete and `unpaid` checks, so it does test the change.

The app already shows the approved refusal ("Contact us and we'll help you cancel it first", with a support link).
