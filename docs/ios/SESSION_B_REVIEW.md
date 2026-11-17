# Session B for review: 20261124, 20261125, 20261126

Status 2026-11-17: **approved by the owner on condition of a usable backup. Blocked: there is none yet** (see Backup
below). Not applied. This is the session that makes the app's family
features possible: two adults in one household, the family calendar, and permanent member colors. It follows
[Session A](SESSION_A_REVIEW.md) (applied 2026-11-17).

## Production preflight (read-only, 2026-11-17, `supabase/rollout/household/preflight.sql`)

| Check | Result |
| --- | --- |
| None of the household migrations is already there | ok |
| Every household has exactly one owner account; no account owns two | ok |
| The two profile saves still carry the lock 24 rewrites; the four read policies 24 replaces exist by name | ok |
| pgcrypto is in the `extensions` schema (invitation codes) | ok |
| No household has more than 20 family members | ok |
| Later steps (27, 28, 29): their starting points are intact | ok |
| Everything the session replaces or removes (6 functions, 4 policies) is byte-identical to the repo | **10 of 10** |
| Production data | 10 households, 20 current family members, 16 activities, 27 responsibilities, 11 sign-ins; no saved colors yet |

One difference found outside this session: production's `club_member_link` lacks one comment line the repo has (same
logic). Session B doesn't touch it; the billing step (`20261203`) patches a different line of it and still applies.

## Backup (the owner's condition, not yet met)

The project is on Supabase's **Free** plan (checked 2026-11-17). Free projects get no daily backups and can't enable
point-in-time recovery; the WAL archiving visible on the server is not restorable by us. Either of these meets the
condition:

1. **A logical dump, today, free.** On the owner's computer with the Supabase CLI, the database connection string
   (Dashboard → Connect) in `$DB_URL`: `supabase db dump --db-url "$DB_URL" -f roles.sql --role-only`, then
   `-f schema.sql`, then `--data-only --use-copy -f data.sql`. Keep the three files off-site and out of this
   repository: `data.sql` contains every member's data.
2. **Pro plan** ($25/month): daily backups kept 7 days. Wait until Dashboard → Database → Backups → Scheduled lists
   one dated after the upgrade.

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

1. Note the time as the point-in-time reference; take the data checksums, the schema fingerprint and each member's
   `club_household`, `club_family_profile` and `club_me`.
2. `supabase/rollout/household/preflight.sql`: all ok. Re-capture `capture.sql` and compare with
   `supabase/rollout/household/captured/restore-functions-after-session-a.sql` (taken 2026-11-17): must be identical.
3. Apply 24, 25, 26 one at a time, each hash-guarded as in Session A. After each: the schema change must equal the
   expected change exactly; `supabase/rollout/household/verify.sql`; data checksums.
4. After 24: 10 owner rows, one per household; `club_household` and `club_family_profile` return the same JSON as
   before for all 10 members. After 25: no events. After 26: 20 saved colors, each equal to the color shown today.
5. Stop at the first check that isn't clean.

## Rollback

| Undo | How | Loses |
| --- | --- | --- |
| 26 alone | Its section of `supabase/rollout/household/rollback.sql` | Nothing (saved colors stay; they're valid for the old code) |
| 25 alone | Its section | Every calendar event made since |
| 24, 25, 26 | Sections 26, 25, 24 of `rollback.sql`, then the captured `restore-functions-after-session-a.sql`, then `finish.sql` | Partner access and invitations, calendar events. **Keeps** every household, family member, Club record, subscription and saved color |
| Anything unexpected | Point-in-time recovery to the time from step 1 | Everything after that time |

Rehearsed in CI on every push (`scripts/rehearse-household-rollback.sh`): apply with real rows, roll back, schema
fingerprint identical to before, no household or family member lost.

## What I need from you

Approved 2026-11-17, conditional on a usable backup. Waiting on: the dump's time (option 1) or the first scheduled
backup on Pro (option 2).
