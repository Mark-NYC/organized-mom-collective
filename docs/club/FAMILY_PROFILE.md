# Family profile (onboarding steps 1–6)

What the Club knows about a family so monthly printed resources, and later the Monthly Family Meeting, can fit how the family actually runs. Promise: Mom doesn't have to manage everything alone. Every question has to improve a resource or help family members share responsibility.

## The six steps

| # | Step | Where it's stored | Required? |
| --- | --- | --- | --- |
| 1 | Who's in your family (first names, kids' ages, adult roles) | `club_households`, `club_family_members` (unchanged, `club_household_save`) | Yes: gates the Welcome Kit (`onboarded_at`) |
| 2 | Typical week (category tiles; optional name, who, days, time) | `club_activities` | No |
| 3 | Who already takes care of what (owns vs helps when asked) | `club_responsibilities`, `status = 'existing'` | No |
| 4 | What the kids could take on (choices + custom, optional per kid) | `club_responsibilities`, `status = 'desired'` | No |
| 5 | Where it's hard to stay on the same page | `club_households.challenges`, `challenge_note` | No |
| 6 | One thing to stop managing alone: the family's first priority | `club_households.priority`, `priority_note` | No |

Migration: `supabase/migrations/20261109000000_club_family_profile.sql` (additive; **not applied** to the live project). Choices and ids: `src/data/club/family-profile.ts`. Types, steps, validation: `src/lib/club/family-profile.ts`. UI: `src/components/club/FamilySetup.tsx` (wizard and single-step edit), `FamilyProfileSummary.tsx` (on `/club/family`).

## Concepts kept apart

- **Activities**: what happens and when. Only the category is required.
- **Existing responsibilities**: `owner_ids` take care of it without being asked, `helper_ids` help when asked (never both). `scope` comes from the owners: one is `individual`, two or more `shared`, none unassigned.
- **Desired responsibilities**: what the family wants to develop. `owner_ids` here means "for this child", optional.
- **Suggested** (`status = 'suggested'`): recommendations the system may make later. Not confirmed, never written by the browser.
- **Confirmed** (`status = 'confirmed'`, `confirmed_at` set): accepted by the family. Not written by onboarding yet.
- **Challenges** and **priority**: household-level.

## Flow and resume

- `/club/welcome`: after the family form ("Step 1 of 6"), steps 2–6 follow, then address/print as before. Each step saves when she leaves it (Next or Skip for now), and `setup_done` records it, so an interrupted setup resumes at the first open step on her next visit. "Finish later" goes on to her Welcome Kit.
- Existing households (onboarded before this) are never forced through it: the dashboard shows "Finish your family profile (about 2 minutes)", linking to `/club/family?setup=1`. Nothing they already entered is asked again.
- `/club/family`: the family form plus "How your family runs", each section with Edit (one step, Save/Cancel).

## Rules

- These answers don't bump `profile_version`, so saved kit documents never show "New suggestions" because of them. No existing kit reads them yet.
- Same access model as `club_core`: RLS on, grants revoked, customers read only their own rows and write only through `club_activities_save`, `club_responsibilities_save`, `club_focus_save`; `club_family_profile` reads. Member ids are checked against the household. Admins have no read policy (like children's names).
- Kids never get accounts. No daily tracking, scores or badges.

Tests: `supabase/tests/club-profile.sql` (via `npm run test:admin-sql`), `tests/club-family-profile.test.ts`, browser flow in `scripts/club-onboarding-e2e.mjs`.

## Icons

Source JPEGs `assets/icons/ofc/onboarding/*.jpg` → transparent WebP `public/images/club/onboarding/*.webp` with `python3 scripts/prepare-onboarding-icons.py` (exterior-only background removal, gap-tolerant flood fill, edge band converted to alpha, consistent padding). Per-icon results and reviewer notes: `assets/icons/ofc/onboarding/REPORT.md`. Categories without a matching illustration (clubs, other, most responsibilities) show a plain mark until art exists.
