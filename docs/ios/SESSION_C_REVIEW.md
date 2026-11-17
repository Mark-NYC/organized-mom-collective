# Session C: 20261127, 20261128, 20261201

Status 2026-11-17: **applied and verified** (approved by the owner the same day; results below). Follows
[Session B](SESSION_B_REVIEW.md) (applied and verified 2026-11-17). This session completes the app's family features:
"We agreed" family agreements, Club content for the second grown-up, and shared cleaning progress.

## Production preflight (read-only, 2026-11-17 18:15 UTC)

| Check | Result |
| --- | --- |
| The 9 existing functions Session C replaces are byte-identical to the repo | **9 of 9** |
| `club_responsibilities` has none of the agreement columns yet (27) | ok |
| The 5 functions 28 patches still declare `uid uuid := auth.uid();` (28 stops itself otherwise) | ok |
| 28's dependencies are in: Sessions A (`club_welcome_plans`) and B (`household_adults`) | ok |
| None of Session C is already there | ok |
| Session B is in: 43 migrations, latest `household_member_colors` | ok |
| Rollback copy for C alone: production's 9 function definitions captured (`captured/restore-functions-after-session-b.sql`) | hash-identical to production (`83c182cd…`) |
| Database suites and full rollback rehearsal on `main` | pass |

**Production data it touches:** 27 responsibilities gain 8 empty columns (every existing row keeps `revision 0`, no
words, not deleted). No household has a partner yet (0), so 28 changes nothing anyone sees today: the 10 owners' Club
data must come back identical. 1201 adds an empty table.

**Files (md5):** 27 `17693530a34e3eacaba0a43427f448d2`, 28 `ae1981aabf6dfdb218392c306e6617d6`, 1201
`21ec43b0846e4d13cec39f836164bebd`.

## Exact changes

Compared on a test database before and after each file:

| File | New | Changed | Existing rows written |
| --- | --- | --- | --- |
| `20261127_family_agreements` | 8 columns and 7 constraints on `club_responsibilities`; 4 functions (save, remove, list, JSON) for either grown-up | `club_family_profile` (lists agreements apart from the profile's rows) | None (columns are added empty; `revision` defaults to 0) |
| `20261128_household_club_access` | `household_billing_user`, `club_me_for` (internal) | `club_me`, `club_resource_get/save`, `club_document_get/save`, `club_welcome_plan_get/save`: either grown-up opens the household's months; `club_address_save` stays owner-only. Patched from the live definitions, so Session A's changes are kept | None |
| `20261201_household_cleaning_progress` | Table `household_cleaning_marks` (RLS, members read only), `cleaning_marks_push`, `cleaning_marks_changes` | Nothing | None |

Billing does not move in this session: the subscription, mailing address and print approvals stay with the owner.
(The billing changes for a partner who pays, kept months and the orphan safety net are `20261203`, a later session.)

## Dependencies

- Needs Sessions A and B (both applied). Order: 27, 28, 1201; each is independent of the other two except that 28
  needs A and B.
- Code: already live; the app and website fall back until these functions exist (agreements stay hidden, cleaning
  stays on the device, a partner sees no Club months).
- Needed by: Session D (joining from an own family, `20261130`), E (deletion guard, `20261129`), G (`20261203`).

## Procedure (after your go)

1. Fresh verified backup (the backup workflow), or no session.
2. Before-record: data checksums, Club access per sign-in, schema fingerprint, and for all 10 members `club_me`,
   `club_family_profile`, `club_household`, `club_resource_get` for each month they hold (checksums only).
3. Apply 27, 28, 1201 one at a time, each refusing to run unless its text hashes to the file above. After each:
   the schema change equals the same file's change on a test database; `verify.sql`; subscriptions, entitlements,
   orders, addresses, customers and Club access unchanged.
4. After 27: 27 responsibilities, all `revision 0`, no agreement text, none deleted; `club_family_profile` for every
   member shows the same activities and responsibilities as before.
5. After 28: `club_me` and every month's `club_resource_get` identical for all 10 owners.
6. After 1201: `household_cleaning_marks` exists and is empty.
7. Stop at the first check that isn't clean. Then a post-session backup.

## Rollback

| Undo | How | Loses |
| --- | --- | --- |
| 1201 | Its section of `supabase/rollout/household/rollback.sql` | Shared cleaning checkmarks (each phone keeps its own) |
| 28 | Its section, then `club_me`, `club_address_save` and the six content functions from `captured/restore-functions-after-session-b.sql` | Nothing stored; partners stop seeing Club months |
| 27 | Its section, then `club_family_profile` from the same capture | Every "We agreed" agreement |
| Anything unexpected | Restore the verified backup from step 1 | Everything after that time |

**Rehearsed 2026-11-17** on a test copy of the post-Session-B state with real agreements and cleaning marks:
sections 1201, 28, 27 plus the capture bring the schema back **identical to production after Session B**. (Use the
new capture for C alone; the earlier `restore-functions-after-session-a.sql` predates Session B.)

## Result (applied 2026-11-17, 18:30–18:33 UTC)

| Step | Result |
| --- | --- |
| Post-Session-B backup `20261117T181823Z` | VERIFIED (103 tables, 933 rows restored exactly) |
| Fresh backup right before C: `20261117T182351Z`, run 44147177662 | VERIFIED: 103 tables, 933 rows restored exactly; structure identical; 43 migrations |
| Before-record | Schema fingerprint identical to production right after Session B (no drift) |
| 27 `family_agreements` (applied as text hashing to `9bad4ec6…`) | Schema change identical to the test database (+27 −1). 27 responsibilities, all `revision 0`, every new field empty |
| 28 `household_club_access` (`5cf619c6…`) | Identical (+12 −8). For all 10 owners: `club_me`, `club_welcome_plan_get` and `club_resource_get` for all 14 kits (140 calls) byte-identical to before. All 11 sign-ins bill as themselves (no partners yet) |
| 1201 `household_cleaning_progress` (`528718ee…`) | Identical (+23). `household_cleaning_marks` exists, empty |
| Whole session | +62 −9 objects, identical to the rehearsal. 46 migrations, latest `household_cleaning_progress` |
| Unchanged throughout (checksums) | Households (all columns), 20 family members, 16 activities, 27 responsibilities, 11 subscriptions, 12 entitlements, 12 orders, 10 addresses, 11 customers, grants, 2 resource versions, 10 email log rows, 14 kits, 10 household adults, the fulfillment queue, 5 cron jobs, 11 sign-ins, Club access for every sign-in (10 with access), every owner's `club_household` |
| `club_family_profile` | Differs only by the five new, empty `agreed_*` keys on each responsibility; with those removed, byte-identical to before for all 10 owners |
| `verify.sql` | Every applied row ok (steps 24–28, 1201) |

**Feature test on production, rolled back (15 of 15).** One statement with throwaway `@example.invalid` sign-ins that
ends by raising an error, so nothing it wrote remains: the second adult joins by invitation; each adult sees the
agreements the other made, and the family profile lists them; one adult checks a cleaning task and the other sees it,
then unchecks and the first hears it; with January held by the owner, the second adult has Club access, is told they
are the partner, sees no plan or address, opens January to edit and saves the household copy; the second adult
can't set the mailing address (`owner_only`) or approve printing; a stranger gets no Club access, no cleaning marks and
no agreements. Afterwards: 0 test sign-ins, households, marks, grants or invites; entitlements 12, responsibilities
27, household adults 10, sign-ins 11; kits checksum equal to before (January's status unchanged).

**Fixed on the way:** `supabase/rollout/household/verify.sql` cast tables that a later step creates with `::regclass`,
which errors before that step is applied; it now uses `to_regclass`.

Post-session backup `20261117T183605Z` (run 44149506440): VERIFIED, 104 tables and 936 rows restored exactly, 46 migrations.
