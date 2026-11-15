# One household, one family profile: architecture, migration and compatibility plan

**Status (2026-11-14): designed and built on `claude/focused-fermi-re9ddc`, tested on a throwaway local database.
Not applied to production. Applying it needs the owner's approval.** Owner requirement (2026-11-14): Calendar, the
cleaning companion and the Family Meeting Club use the same household and family information. One
household, stable member ids, one family profile, one color per person everywhere, one responsibility system, both
adults on their own accounts, children without accounts, existing Club data and colors preserved.

## 1. Audit: what exists (code and the live project, read-only, 2026-11-14)

| Table (all applied in production) | What it holds | Notes |
| --- | --- | --- |
| `club_households` | One per account: `owner_user_id` (unique), `display_name`, `preferences` (jsonb, closed key set incl. `colors`, `icon_style`, `week_starts`, `weekday_dinner`, `pets`, `school`…), `profile_version`, setup/focus fields | **Not membership-gated**: "anyone signed in may keep a profile; kits are what membership unlocks" (`club_household_save`). So a free household already works. |
| `club_family_members` | Stable `id` per person, `first_name`, `kind` adult/child, `role`, `birth_year/month` (children), `is_account_holder`, `sort`, `archived_at` (never deleted) | Assignments everywhere point at these ids. |
| `club_activities` | The typical week: category, name, `member_ids[]`, `days[]` (0–6), `starts_at` | Recurring family schedule already entered during Club setup → seeds the calendar. |
| `club_responsibilities` | Jobs with `owner_ids[]`, `helper_ids[]`, category, status (existing/desired/suggested/confirmed) | **This is the shared responsibility system.** Cleaning, Calendar and the Family Meeting read it; nothing new. |
| Colors | `preferences.colors`: member id → one of 8 marker colors (`src/data/club/family-colors.ts`, migration `20261120000000`) | Unsaved colors are **auto-assigned in family order, children first** (`memberColors`). |
| Billing, entitlements, fulfillment, welcome kit, resource versions, email log | Keyed to the household or `owner_user_id` | Stay with the paying owner. |

Live data (aggregate counts only): 10 households, 20 family members (0 archived), 16 activities, 27 responsibilities,
11 subscriptions, 12 entitlements, **0 households with saved colors** (every color today is auto-assigned).

Access: every function finds "her household" with `owner_user_id = auth.uid()` (13 migrations, ~100 places). RLS
select policies on households, members, activities and responsibilities use the same rule. A second adult has no way
in.

### Two problems found

1. **Colors can shift.** Because unsaved colors are computed from family order, adding a child (children come first)
   or archiving someone moves other people's colors. Harmless while colors only appear on one monthly printable; wrong
   once the same color must mean the same person in the calendar, the Family Meeting and on the wall calendar.
2. **Whole-family save is last-write-wins.** `club_household_save` replaces the member list and archives anyone not
   in it. With one adult that's fine; with two phones, a stale copy could archive someone the other adult just added.

## 2. Design

**Extend, don't duplicate.** No new family, member, color or responsibility tables. The household gains adults; the
same rows serve every feature.

```
auth.users ──< household_adults >── club_households ──< club_family_members (stable ids, colors via preferences)
   (mom, partner)  role owner|partner       │              ├──< club_activities      (typical week)
                   member_id → her/his      │              ├──< club_responsibilities (who owns what)
                   own family-member row    │              ├──< calendar_events      (M3, new)
                                            │              └──< sunday_setups        (M4, new)
                                            └── billing, entitlements, fulfillment: owner only (unchanged)
```

- **`household_adults`** (new): `household_id`, `user_id` (unique: one household per account), `role` `owner|partner`,
  `member_id` (the adult's own row in `club_family_members`, so "Luis" in the family *is* Luis's account; no second
  profile). Backfilled from every existing `club_households.owner_user_id`; a trigger adds the owner row for every new
  household, so `club_household_save`'s insert path is unchanged.
- **`public.household_id_for(uid)`** (new, internal): the one resolver. `club_my_household()`, `club_household()`,
  `club_household_save`, `club_family_profile()`, and the four read policies switch to it. Everything built on
  `club_my_household()` (activities, responsibilities, focus, setup steps) follows automatically.
- **Owner-only, unchanged:** billing, Stripe, entitlements, Club resource approval for printing, welcome kit, address,
  account deletion of the household. The partner sees the shared family and calendar. Whether the
  partner also opens the paid Club months is an owner decision (§6); nothing in this change grants it.
- **Colors pinned, never overwritten.** Every save stores a color for every active member: saved colors first, then
  the color the member is *already being shown* (computed from the family as it was before the change), and only then
  a new free color for someone new (`pinMemberColors`, `src/lib/household/colors.ts`). Server side,
  `club_household_save` merges colors: a client that omits `colors` (an old one) can't wipe them; a color is only
  changed when the client sends a different one for that id.
- **Concurrent edits are refused, not lost.** `household_save(p_expected_version, …)` checks `profile_version`; a
  stale copy gets `stale_profile` and the app reloads the family and re-applies the change. The old 3-argument
  `club_household_save` keeps working for existing pages (and gains the color merge).
- **Partner invitation.** The owner picks the adult in her family (or adds one), and the app makes a one-time invite
  with that adult's email. It's shared as a link (`/app/join?code=…`) through the phone's share sheet or copied; the
  partner signs in with the emailed 6-digit code **with that same email**, then accepts. Rules, all enforced in the
  database:
  - Code: 128 random bits, stored only as a SHA-256 hash; expires in 7 days; single use; revocable; at most 5 open
    invites per household.
  - The accepting account's **verified** email must equal the invite's email (a forwarded link is useless to anyone
    else).
  - An account already in a household can't join another (no silent merge, no data loss). Leaving first is explicit.
  - The invited adult row can't be the owner's, a child, archived, or already linked.
  - Owner can remove the partner; the partner can leave. Removing never deletes family data.
- **Security:** every new table has RLS; reads are scoped by `household_id_for(auth.uid())`; writes are only checked
  `security definer` functions; anon has nothing. Tests prove one household can never read or write another's rows.

## 3. Migration (one file, additive, transactional)

`supabase/migrations/20261124000000_household_shared.sql`:

1. Create `household_adults`, `household_invites`; backfill one `owner` row per existing household (`on conflict do
   nothing`), linking `member_id` to the household's `is_account_holder` adult when there is exactly one.
2. Trigger on `club_households` insert → owner row.
3. `household_id_for`, new `club_my_household`, `club_household` (adds `adults`, `my_role`, `my_member_id`),
   `club_household_save` (same signature; resolves via adults; merges colors), `household_save` (version-checked),
   `club_family_profile`, read policies.
4. Invite functions: `household_invite_create`, `household_invites`, `household_invite_revoke`,
   `household_invite_accept`, `household_partner_remove`, `household_leave`.

**Data changes: none to existing rows** except inserting the owner rows. No colors written by the migration (the app
pins them on the next save, from what each family already sees). No member, activity, responsibility, membership or
billing row is touched. Rollback: drop the two new tables and re-run the previous definitions (kept in
`20261120000000_club_household_colors.sql` and `20261109000000_club_family_profile.sql`).

**Order for production (owner approval):** apply after `20261121`–`20261123` (already in the repo, not applied) or on
its own; it doesn't depend on them. Run `scripts/test-household-sql.sh` against a Supabase branch first.

## 4. Compatibility

| Existing piece | After |
| --- | --- |
| Club member signs in, opens family, months, billing | Identical (owner row resolves the same household). |
| Existing pages calling `club_household_save` (3 args) | Work; now merge colors instead of replacing them. |
| Sample households (`?sample=`) | Untouched (browser-only). |
| Admin views, fulfillment, print views | Untouched (owner-keyed). |
| Account deletion | Owner: unchanged (household goes, partner row cascades). Partner: only their `household_adults` row goes; the family stays. |
| Cleaning companion progress (`omc:v1:*`) | Still device-local this milestone; household sync of progress is a later step. |

## 5. Tests

`supabase/tests/household-partners.sql`, run by `scripts/test-household-sql.sh` with the existing `club-access` and
`club-profile` tests (which must still pass unchanged): backfill, invite lifecycle (create, wrong email, expired,
revoked, reused, already-in-household, child/owner/linked targets), partner reads and edits the shared family and
responsibilities, colors survive a partner save and an old client's save, stale version refused, isolation between two
households for every table and function, anon locked out, partner can't reach billing.

## 6. Owner decisions still open

1. **Partner and the paid Club months.** Today membership is one paying account. Recommended: the partner can *read*
   the household's Club months (it's the family's plan) but approvals for printing stay with the owner. Not built until
   you say so.
2. **Invite delivery.** Built: share link + matching email. An emailed invite needs an Edge Function deploy (Resend),
   which is a production change.
