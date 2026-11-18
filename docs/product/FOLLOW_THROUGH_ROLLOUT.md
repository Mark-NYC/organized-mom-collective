# Migration 20261204 (weekly follow-through): production execution plan

Status 2026-11-18: **approved by the owner in principle; NOT applied.** Applying needs the owner's final go after
reading this plan. Migration: `supabase/migrations/20261204000000_agreement_follow_through.sql`. What it powers:
"How did it go?" in the weekly Family Meeting (docs/product/UNIFIED_FAMILY_ARCHITECTURE.md §7).

## What it changes

- `club_responsibilities` gains three **nullable** columns: `progress`, `checked_on`, `barrier`, and two check
  constraints (only agreements carry them; a barrier only with "struggling").
- Two functions for signed-in household adults: `household_agreement_check_in(...)` and `household_follow_through()`,
  plus an internal `household_follow_through_json` (not callable by any user).
- **Unchanged:** every existing row (no UPDATE), every existing function (`household_agreement_save/remove/json`,
  `household_agreements`, `club_family_profile`), billing, entitlements, orders, saved resources.
- The app already ships the UI and hides it while the functions are missing; applying turns check-ins on for both
  website and iPhone app with no deploy.

## Safeguards already completed (2026-11-18)

| Safeguard | Result |
| --- | --- |
| Production preflight (read-only, `supabase/rollout/follow-through/preflight.sql`) | 6/6 ok: 20261127 and 20261124 in place; the new columns, functions and constraints absent; not recorded as applied |
| Production snapshot (same file) | `existing` 15 rows, `desired` 12, agreements 0, deleted 0; the five agreement/profile functions' md5s recorded below |
| Local replay matches production | The five functions' md5s are identical on the replay of production's exact migration set |
| Standalone rehearsal (`scripts/rehearse-follow-through.sh`) | preflight → apply → verify (5/5) → counts and functions byte-identical → every agreement row unchanged → follow-through suite (21 checks) → rollback → schema identical (every column, function, constraint) → re-apply → verify |
| Household rollback rehearsal (CI, `household-db`) | Passes with 20261204 included (run 120) |
| SQL tests on production's set + 20261204 | 16/16 applicable files, 944 checks |
| Verified backup | `backups/20261118T162254Z` (Database backup run 21): restored into a throwaway Supabase, "104 tables and 1001 rows restored exactly; structure identical to the source" (and the second set, 38 tables and 258 rows, likewise). Take another right before executing |

Production function fingerprints (must be identical after applying):

```
club_family_profile()                              f89494ee29e2b68c5e5d25cc2256fe0b
household_agreement_json(club_responsibilities)    4498b5c6d8cf557780bf8a8c55cadec2
household_agreement_remove(uuid,integer)           bae966be29ef2f89dd7b4f4c3b29c930
household_agreement_save(jsonb,integer)            759c8c29e8a565613934732c23c22aa0
household_agreements(timestamp with time zone)     cfb3f513025e713c26b257dd94c94de4
```

## Execution (after the owner's go), one sitting, about 10 minutes

1. **Fresh verified backup:** push `.github/db-backup-request` with `[db-backup]`; wait for the green run and its
   "restore verified" line. Record the backup ID.
2. **Preflight** on production: `supabase/rollout/follow-through/preflight.sql`. Every check `ok = t`; save the snapshot
   rows. If anything differs from the table above, stop.
3. **Apply** `20261204000000_agreement_follow_through.sql` (Supabase `apply_migration`, name
   `agreement_follow_through`). It is one transaction: it fully applies or changes nothing.
4. **Verify:** `supabase/rollout/follow-through/verify.sql` (5/5 `ok = t`), then the snapshot half of `preflight.sql`
   again: identical to step 2.
5. **Smoke test** with the owner's own account: the weekly Family Meeting opens; with an agreement 7+ days old,
   "How did it go?" appears and an answer saves. Nothing else changes for anyone.
6. Record it in `docs/ios/MIGRATION_DEPLOYMENT_PLAN.md` (time, backup ID, results).

**Stop rules:** any preflight check false, any verify check false, or the snapshot differs → do not continue; if the
migration already applied, roll back (below) and report.

## Rollback

`supabase/rollout/follow-through/rollback.sql` (one transaction). Drops the two functions, the constraints and the three
columns. Removes only check-in answers families gave since applying; every agreement stays. Rehearsed: the schema
returns to exactly its state before applying. If families have started checking in, prefer fixing forward.

## Not part of this

Migration 20261202 (kit titles) stays on hold. No billing, subscription, mailer or fulfillment change.
