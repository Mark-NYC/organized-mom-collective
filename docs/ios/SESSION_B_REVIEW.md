# Session B for review: 20261124, 20261125, 20261126

Status: **APPLIED to production 2026-11-17 18:07–18:12 UTC with the owner's approval. Verified.** Next:
[Session C](SESSION_C_REVIEW.md).

## Result (2026-11-17)

Fresh verified backup first: `backups/20261117T180028Z` (run 44142983172), 100 tables and 920 rows restored exactly.
Before-record 18:05:31 UTC. Each file ran as one statement that refused to run unless its text hashed to the reviewed
file's.

| Check | After 24 | After 25 | After 26 |
| --- | --- | --- | --- |
| Schema change vs the same file on a test database (every function, column, view, constraint, index, policy, trigger, grant) | identical (+84, 10 replaced) | identical (+60) | identical (+3, 1 replaced) |
| Households (10), family members (20), activities (16), responsibilities (27): row checksums | unchanged | unchanged | unchanged (colors added, below) |
| Subscriptions (11), entitlements (12), orders (12), addresses, customers, resource versions, email log, kits, scheduled jobs | unchanged | unchanged | unchanged |
| Club access and paid access per sign-in (11) | unchanged | unchanged | unchanged |
| `club_me` and `club_family_profile` for all 10 members | unchanged | unchanged | unchanged |
| `club_household` for all 10 members | every earlier field unchanged; adds `my_role`, `my_member_id`, `adults` | unchanged | `preferences.colors` added |

- **Owners:** exactly 10 owner rows, one per household, each its `owner_user_id`; 0 partners, 0 invitations.
- **Calendar:** created, empty, row-level security on; `calendar_changes` returns no events for any member.
- **Colors:** 20 saved, every one equal to the dry run (5 families: blue, green, purple, pink). The 5 households
  with no family members got an empty `colors: {}` (the migration's normal result; no values). Everything else in
  `preferences` unchanged.
- `verify.sql`: all 7 checks for 24–26 ok; no later step present. 43 migrations recorded, latest
  `household_member_colors`.

## Preflight (production, read-only, 2026-11-17 17:56 UTC)

| Check | Result |
| --- | --- |
| Verified backup | `backups/20261117T174106Z` (run 44139509039): 100 tables, 920 rows, 11 sign-ins, 40 migrations restored exactly into an isolated database; stored encrypted in R2. A fresh one is taken right before applying |
| Everything the session replaces (6 functions, 4 policies) is byte-identical to the repo | **10 of 10** |
| None of Session B (or later) is already there; Session A is in (40 migrations, latest `20261117010634`) | ok |
| Every household has one owner, a real sign-in; nobody owns two; at most 20 members each | ok |
| The profile saves still carry the lock 24 rewrites; pgcrypto in `extensions` | ok |
| Rollback capture re-taken: production's 29 function definitions | identical to `captured/restore-functions-after-session-a.sql` |
| Database suites (17) and the full rollback rehearsal on today's `main` | pass |

**Dry run of the color backfill (26), read-only, same order and palette as the migration:** 10 households, 5 with
family members, 20 colors to save, 4 per family (`blue, green, purple, pink`), 0 saved colors today, 0 archived
members, largest family 4 (no repeats), 0 orders printed or mailed. What families see today is exactly what gets
saved; nothing printed can differ.

**Production before Session B:** 10 households, 20 family members, 16 activities, 27 responsibilities, 11 sign-ins,
subscriptions 10 trialing / 1 canceled, 12 live entitlements, 12 orders, 10 accounts with Club access.

**File hashes to apply (md5):** 24 `b2eeb7c00c41b9d9cb6681dab2d72e71`, 25 `7041580f74696b0c21061cbc4a5bf386`,
26 `d7f150dc156e40b6eac31816e05d70bd`.

## Exact changes

Compared on a test database, before and after each file:

| File | New | Changed | Removed | Existing rows written |
| --- | --- | --- | --- | --- |
| `20261124_household_shared` | Tables `household_adults` (who the grown-ups of a household are) and `household_invites` (hashed codes, bound to a verified email); 13 functions (invite, accept, revoke, remove, leave, handover); 5 read policies; 2 triggers (keep the owner row in step; pass the household on when an owner's sign-in is deleted) | `club_my_household`, `club_household`, `club_household_save`, `club_family_profile`, `club_activities_save`, `club_responsibilities_save`: same names and arguments, now answering for either adult | The four "Members read their ..." policies, replaced by "Adults read their ..." | **Backfill:** one owner row per household (10 rows into the new table). No existing row changes |
| `20261125_family_calendar` | Table `calendar_events`; 6 functions (save, delete, changes, import activities) | Nothing | Nothing | None |
| `20261126_household_member_colors` | `household_colors_complete` | `household_save_core` (made by 24) | Nothing | **Writes:** each current member's color saved into their household's `preferences.colors`: 20 members today. The colors are the ones each family already sees |

What members see after it: nothing different on the website. The family page reads and saves as before; printed
materials show the same colors. What becomes possible (once the app is on a phone): inviting the other grown-up,
the shared calendar.

## Dependencies

- Needs: production as it is now (Session A is in). Order: 24, 25, 26; 25 and 26 need 24.
- Needed by: Session C (agreements, Club access for the second adult, shared cleaning), D, E, G.
- Code: already on `main` and live; it falls back until these functions exist.
- Not included: agreements (27), Club access for a partner (28), the deletion guard (29), joining from an own
  family (30), shared cleaning (1201), billing for either adult (1203).

## Procedure (after your go)

1. **Fresh backup**, read-only on production: the backup workflow, then wait for `VERIFIED`. No backup, no session.
2. **Before-record:** data checksums (households, members, activities, responsibilities, subscriptions,
   entitlements, orders, addresses, customers, email log), Club access per sign-in, the full schema fingerprint,
   and for all 10 members `club_household`, `club_family_profile` and `club_me` (checksums only).
3. **Apply 24, 25, 26 one at a time**, each refusing to run unless its text hashes to the file above. After each:
   - the schema change equals the change the same file makes on a test database, object for object;
   - `supabase/rollout/household/verify.sql`: every applied row ok;
   - subscriptions, entitlements, orders, addresses, customers and Club access: **unchanged**.
4. **After 24:** exactly 10 owner rows, one per household, each its `owner_user_id`; `club_household`,
   `club_family_profile` and `club_me` return the same JSON as before for all 10 members; 20 family members intact.
5. **After 25:** `calendar_events` exists and is empty.
6. **After 26:** 20 saved colors, equal to the dry run above; families, members and everything else unchanged.
7. Stop at the first check that isn't clean; roll back that step (below). Then a post-session backup.

## Rollback

| Undo | How | Loses |
| --- | --- | --- |
| 26 alone | Its section of `supabase/rollout/household/rollback.sql` | Nothing (saved colors stay; they're valid for the old code) |
| 25 alone | Its section | Every calendar event made since |
| 24, 25, 26 | Sections 26, 25, 24 of `rollback.sql`, then the captured `restore-functions-after-session-a.sql`, then `finish.sql` | Partner access and invitations, calendar events. **Keeps** every household, family member, Club record, subscription and saved color |
| Anything unexpected | Point-in-time recovery to the time from step 1 | Everything after that time |

Rehearsed in CI on every push (`scripts/rehearse-household-rollback.sh`): apply with real rows, roll back, schema
fingerprint identical to before, no household or family member lost.
