# Session A for review: 20261121, 20261122, 20261123

Status: **APPLIED to production 2026-11-17 01:06 UTC, with the owner's approval. Verified.** This was the first of the
sessions in [MIGRATION_DEPLOYMENT_PLAN.md](MIGRATION_DEPLOYMENT_PLAN.md): the Welcome Kit's Family Rhythm backend. It
turned on no household or app feature. Next: [SESSION_B_REVIEW.md](SESSION_B_REVIEW.md).

## Result (2026-11-17)

Before-record taken 2026-11-16 23:48:53 UTC (data checksums, full schema fingerprint, every member's `club_me`).
Each file ran in one transaction; 22 and 23 ran only because their text hashed to the reviewed file's.

| Check | After 21 | After 22 | After 23 |
| --- | --- | --- | --- |
| Schema change vs the change the repo's files make on a test database (every function, column, view, constraint, index, policy, trigger, grant) | identical (+29) | identical (+29, 14 replaced) | identical (+15, 10 replaced) |
| Subscriptions (11), entitlements (12), orders (12), customers, addresses, households, family members, resource versions, email log, scheduled jobs: row checksums | unchanged | unchanged | unchanged |
| Who has Club access and paid access (11 sign-ins) | unchanged | unchanged | unchanged |
| The fulfillment queue's 12 rows (type, status, readiness, kit) | unchanged | unchanged | unchanged |
| `club_me` for all 10 members, every field that existed before | unchanged | unchanged | unchanged |

After the session: `welcome_item` = `vision`; every welcome order is still a Vision order; May and August carry the
daily-rhythm flag; no household is marked first-month-only; no Family Rhythm saved yet; all 10 members can open the
Family Rhythm (`can: edit`). Three migrations recorded in production's history (40 total). Not checked from here: the
pages in a browser as a signed-in member, and `/admin/club`.

Backup: I recorded the time above as the point-in-time reference; I could not see the Backups page from here, so
whether point-in-time recovery is switched on for the project is unconfirmed.

## Production preflight (read-only, 2026-11-16, `supabase/rollout/session-a/preflight.sql`)

| Check | Result |
| --- | --- |
| The 8 functions, 1 view and 2 constraints the session replaces are byte-identical to the repo's definitions | **11 of 11 identical.** No drift to overwrite |
| None of the 12 new functions, the new table or the 3 new columns exists yet | **16 of 16 absent.** No partial earlier attempt |
| Postgres / migrations | 17.11 / 37 applied, last `20261113000000` |
| Households / family members | 10 / 20 |
| Fulfillment orders | monthly_resource: 5 pending, 1 skipped · welcome_vision: 5 pending, 1 skipped |
| Subscriptions | 10 trialing, 1 canceled |
| Live entitlements | 12 |
| May and August kits present (they get the daily-rhythm flag) | 2 of 2 |
| Scheduled jobs | 5 (the session adds none) |

Run it again right before applying; every row in sections 1 and 2 must say `true`.

## Exact changes

Compared on a throwaway database, before and after the three files (every function, column, view, constraint, index,
policy, trigger and grant): **38 new objects, 11 changed, 0 removed.**

| File | New | Changed | Existing rows written |
| --- | --- | --- | --- |
| `20261121_club_welcome_plans` | Table `club_welcome_plans` (one row per household, RLS, nobody writes directly); functions `club_welcome_plan_get / _save / _approve / _unapprove` (members), `club_welcome_plan_access` (internal) | Nothing | None |
| `20261122_club_welcome_rhythm_kit` | Column `club_settings.welcome_item` (**ships `'vision'` = today's behavior**); functions `club_rhythm_valid`, `club_welcome_item_of`, `club_welcome_item_choose` + its trigger on new orders, `club_welcome_rhythm_order_set / _clear`; index `club_fulfillment_one_welcome_rhythm`; view column `kit_welcome_type` | `club_me`, view `club_fulfillment_queue`, `club_admin_welcome_queue`, `club_admin_set_welcome_kit`, `club_admin_fulfillment_bundle`, `club_admin_member_months`, `club_admin_members`, `club_email_audience`, `club_kit_submitted`; two check constraints on `club_fulfillment_orders` widened (new type `welcome_rhythm`, its personalization shape) | `club_settings`: the new column's default on its 1 row |
| `20261123_club_welcome_overlap` | Columns `club_kits.establishes_daily_rhythm`, `club_households.welcome_kit_monthly_only`; function + trigger `club_welcome_overlap_check` | `club_me`, the queue view and the admin functions again | `club_kits`: the flag set on May and August (2 rows) |

What a member or the owner sees after it: **nothing different.** Every existing order stays a Vision order. The
Family Rhythm page on the website, which already calls these functions, starts saving to the account. The behavior
change (a Family Rhythm in new Welcome Kits) happens only if you later set `club_settings.welcome_item = 'rhythm'`,
which is a separate decision and not part of this session.

## Dependencies

- Needs: production as it is today. Nothing else first.
- Order inside the session: 21, then 22, then 23. Each is one transaction: a failure leaves nothing behind.
- Needed by: step 8 (`20261128`) and the billing step (`20261203`). Sessions B (household, calendar, colors) do not
  need it, but B's function capture must be taken **after** A (A changes `club_me`).
- Code: none waits on a deploy; the website's Family Rhythm page already calls these functions.
- Not included: the `welcome_item` switch, any Edge Function, any Stripe change.

## Procedure (after your go)

1. Dashboard → Database → Backups: confirm point-in-time recovery or take a backup. Note the time.
2. `supabase/rollout/snapshot.sql` → save the output (row counts and checksums of member and fulfillment data).
3. `supabase/rollout/session-a/preflight.sql` → all `true`.
4. Save `club_me` for one test member (the JSON), for the before/after comparison.
5. Apply 21, 22, 23, one at a time (SQL editor or `apply_migration`; never `supabase db push`).
6. Verify: `supabase/rollout/household/verify.sql` (rows for unapplied steps say `applied = false`);
   `select welcome_item from club_settings` = `vision`; `snapshot.sql` again: identical; the Family Rhythm page loads and saves for the test member; `/admin/club` members,
   queue and Welcome Kits show the same counts; `club_me` has the same values plus the new welcome fields.

## Rollback

| Undo | How | Loses |
| --- | --- | --- |
| 23 | `supabase/rollout/rollback-welcome-overlap.sql` (refuses if any household's Welcome Kit is its first month alone) | Nothing |
| 22 | then `supabase/rollout/rollback-welcome-rhythm-kit.sql` (refuses if any Family Rhythm order exists) | Nothing |
| 21 | Leave it: additive. Dropping `club_welcome_plans` would delete saved Family Rhythms | Saved Family Rhythms, if dropped |
| Anything unexpected | Point-in-time recovery to the time from step 1 | Everything after that time |

Rehearsed 2026-11-16 on a throwaway database: after both rollback files the schema is **identical** to the state
after 21 alone, and every object the session changed is back to its pre-session definition. While
`welcome_item = 'vision'` neither refusal condition can occur.
