# Three-month Club integration (October 24, 2026)

## Intent

The three *physical product prototypes* for November 2026, December 2026, and January 2027 must belong to the same Club family experience. They reuse a single `/club/family` form/profile rather than independent questionnaires. The public Club marketing/home page is a separate follow-up and has **not** been redesigned in this step.

## The three canonical monthly routes

| Month | Canonical member route | Reusable printable | Unlisted review route |
| --- | --- | --- | --- |
| November 2026 | `/club/kits/2026-11-family-ownership` | `src/components/club/NovemberOwnershipPrototype.astro` | `/club/worksheet-generator/` |
| December 2026 | `/club/kits/2026-12-christmas-mission` | `src/components/club/DecemberMissionPrototype.astro` | `/club/december-preview/` |
| January 2027 | `/club/kits/2027-01-fresh-start-together` | `src/components/club/JanuaryHabitCards.astro` | `/preview/january-habit-cards` |

The `2026-12-christmas-mission` config was added to the registry so the sample dashboard can show this actual month between November and January. `2027-12-christmas-family-affair` remains a separate older planned kit; do not silently merge or reschedule it.

## Shared Family tab

- **Member routes:** `ClubLayout` and `ClubMonthAccess` reuse `ClubGate`. `ClubGate` is the existing Kits / Family / Sign out header and account/sample authorization system; Family routes to `/club/family`, which uses `FamilyPage`, `FamilyForm` and `accountStore` (database) or `sampleStore` (tab-local).
- **Unlisted review pages while `PUBLIC_CLUB_ENABLED` is off:** `ClubPrototypeNav` provides the same Kits / Family affordance and reuses the **same** `FamilyForm` and `sampleStore`. These previews use *sample* households only, saved in this browser tab. No real family data is entered into a public demo.
- Family updates are broadcast through `omc:club-preview-household` and consumed by November and December renderers and January's prepared card names. This is a bridge for the prototype views, not an independent family-data database.
- `ClubMonthAccess` checks the month is in `store.me().kits` before revealing a member's printable; `ClubLayout` still obeys `PUBLIC_CLUB_ENABLED`.

## Known limits and next steps

1. **No member launch yet:** Club pages remain gated when the feature flag is off, and real-user entitlements for the new December 2026 kit require a database release/grant. A registry entry does not grant membership.
2. **Edited documents:** The November/December prototypes have working PDF output but are not yet hooked to `ClubStore.saveDocument` for persistent per-account edits. January uses a browser-print preview and member draft data stays in this tab's sessionStorage. Do not claim cross-device persistence, mail fulfillment, or production-ready PDF output.
3. **Family depth:** November's prototype displays only two child-specific jobs, even if the profile has more or fewer children; it needs a scalable family-plan generator before launch. December's children are populated from the saved family profile; the actual action is child-led.
4. **January print production:** convert the four-up US Letter browser print preview to the shared SVG/PDF engine with embedded fonts before connecting it to a mail house.
5. **Build and visual QA:** run `npm run verify` and inspect all three previews in desktop/mobile, test each `Family` save and return flow, downloaded PDFs, Club feature flag, account access, and sample storage. These checks have **not** been run during the GitHub connector edits.
6. **Next planned task:** update the public `/club` home/landing page to show the current physical monthly offer and the three months coherently. Don't describe December 2027 as the December 2026 mailer.
