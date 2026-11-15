# Access model assessment: household Family Meeting, free basics, premium Club

Status: assessment for the owner, 2026-11-15. **Nothing here is implemented, applied or deployed.** Production access
and billing are unchanged.

Owner decisions being assessed:
1. Family Meeting access belongs to the household. Both adults take part in the weekly meeting; with an active Club
   membership both open its entitled monthly resources. Billing, account ownership and fulfillment stay with the
   paying owner.
2. App model: free Calendar, Cleaning, Family Meeting and shared responsibilities; Family Meeting Club is the premium
   membership.
3. Offline Family Meeting agreements with safe sync (roadmap).

## Fit with the brand vision, roadmap and Club offer

| | Fit | Note |
| --- | --- | --- |
| Household-level meeting (1) | Strong | VISION: "A family calendar belongs to the family, not just to the person who fills it out"; partners "own meaningful responsibilities from start to finish". Today a partner can't open the Club's meeting, which makes mom the only gateway: the opposite of the promise. |
| Free calendar, meeting, responsibilities (2) | Good, with a positioning decision | Matches "Two places. One family system" and "screen-light family system that begins on the wall". The Club must then sell what the free meeting doesn't have (below). |
| Free Cleaning (2) | **Conflicts with an approved decision** | PRODUCT_ROADMAP → Shelved: "Freemium cleaning companion … retired. The companion stays a full bonus for calendar owners." The companion is part of the calendar's offer. Needs an explicit owner decision and a roadmap update before building. |
| Offline agreements (3) | Strong | VISION conviction 4: "Simple systems that survive sick days and late practices beat perfect ones." |
| Stale docs | Fix in the same change | PRODUCT_ROADMAP still names "Organized Family Club" and a Phase 3 "Sunday Setup" workflow (both superseded). Brand docs are owner-approved, so not edited here. |

## 1. Household Family Meeting access

### Today (audit)

- Every Club entitlement is a row **per paying user** (`club_entitlements.user_id`), checked by
  `club_can_open(p_user, kit)` → `club_earned` / `club_has_access` / `club_access_grants`, all keyed on the user.
- Member content is already stored **per household**: `club_documents`, `club_resource_versions`,
  `club_welcome_plans`. Good: no data moves.
- Functions that decide Club access, all on `auth.uid()`: `club_me`, `club_resource_get`, `club_resource_save`,
  `club_document_get`, `club_document_save`, `club_fulfillment_approve`, `club_welcome_plan_access` (and the meeting
  guide's seen/mark). With the pending household migration (20261124) a partner shares the family profile, calendar
  and agreements, but **gets no Club month**: the e2e test confirmed Sam can't open the monthly meeting.

### Required changes

| Change | Where |
| --- | --- |
| One resolver: the household's paying account (`household_billing_user(uid)` = the owner row of `household_id_for(uid)`) | new migration |
| Content access checks use the household's entitlement: `club_can_open(household_billing_user(uid), kit)` in `club_resource_get/save`, `club_document_get/save`, meeting guide functions, `club_welcome_plan_access` | same migration |
| `club_me` for a partner: `access`, `kits` and `months` (what's open), **no** billing fields (plan, status, renews, ends, intro/claim, Stripe ids) and no welcome/fulfillment controls | same migration |
| Owner-only, unchanged: Stripe checkout/portal, `club_address_save`, `club_fulfillment_approve` (approving what gets printed is a fulfillment control), welcome print approval, entitlement overrides, account deletion | verify with tests |
| Partner who leaves or is removed loses Club access at once (it follows `household_adults`) | tests |
| App/website: Family tab and Club pages read access from `club_me`, not "am I the account holder" | client |
| Copy: membership is "for your household"; terms/FAQ say both grown-ups can use it | owner-approved copy |

### Risks

- **`club_me` has been redefined in six migrations; the newest is in 20261123, which production doesn't have.**
  Production's `club_me` is an older version. A new migration must start from production's actual definition, or
  20261121–23 must be applied (or retired) first. Otherwise it silently ships unapplied welcome-plan behavior.
- Account sharing: one membership now serves two logins. That's intended (one household), but the household must
  stay one family: keep invites to a linked, existing adult in the family (already enforced), max two adults (current
  design: one owner + partners; decide whether more than one partner is allowed).
- A partner could edit the month's personalized resource while the owner approves printing. Saves are already
  revision-checked per household (`conflict`), so nothing is overwritten, but the owner may print the partner's edit.
  Acceptable if the owner approves after both are done; say so in the approval step.
- Ending: when the owner cancels, both lose edit access together (entitlements are the owner's). When the owner
  deletes her account, the household and its content go with it (cascade): the partner loses everything. Decide
  whether to offer "transfer ownership" before that (not built).

## 2. Free basics, premium Club

### Today (audit)

| Area | Gate today | Model wants |
| --- | --- | --- |
| Calendar (app) | Free: any signed-in household; works signed out on the phone | Free. No change |
| Shared responsibilities, agreements (20261127) | Free: any household | Free. No change |
| Family Responsibilities page | Free | Free |
| Cleaning companion | Honor-system device unlock ("I have the wall calendar", same rule as the printed QR) or a website calendar order | Free basic: **conflicts with the approved roadmap** (above) |
| Weekly Family Meeting | **Only inside a Club month** (`/app/club/<month>?view=meeting` needs `club_can_open`). The standard guide (`/club/family-meeting-guide`) is a Welcome Kit insert | Free weekly meeting |
| Monthly Family Focus, personalized monthly meeting, printed mailer, Welcome Kit | Club entitlement | Premium. No change |

### Required changes

1. **A free weekly meeting screen** in the Family tab: the standard four parts and timing from
   `MEETING_GUIDE` (unchanged wording), this week's calendar, and Everyone's Part with the family's own agreements
   (add/edit/remove). No monthly focus, no personalized questions or suggestions: those stay the Club's.
2. **Premium boundary, stated in one place** (`src/data/app/features.ts` + the Club offer copy): Club adds the monthly
   Family Focus resource, the personalized monthly meeting (focus, questions, age-fit suggestions), the printed
   monthly mailer and Welcome Kit.
3. **Cleaning:** owner decision first. Options: (a) keep it the calendar's bonus (no change; the app's unlock stays
   honor-system), (b) free daily reset in the app, full companion for calendar owners, (c) all free. (b) or (c) needs
   the roadmap's "Shelved" line rewritten and the calendar's sales copy checked, since the companion is part of what
   the calendar sells.
4. **Household setup without a Club membership:** the database already allows it (`club_household_save` has no
   entitlement check; the calendar tests use a free household). The app's family setup still runs through the Club
   pages. Give free households a plain "set up our family" path that never shows Club sales.

### Risks

- **App Store purchase rules.** A premium membership opened inside an iOS app is in Apple's review scope (guidelines
  3.1.1 / 3.1.3). The current plan (roadmap → Milestone 7) is a sign-in-only app with purchase on the website. Check
  the rules for the US storefront and the physical-mailer part of the membership before TestFlight. Don't ship a
  "join the Club" button in the app until that's decided.
- **Club value:** if the weekly meeting is free, the Club's pitch must be clearly the monthly resource, the
  personalization and the mail. Current sales copy should be read with that in mind (no change made).
- **Cleaning:** changing it affects the calendar's value proposition and Etsy listing language.

## 3. Offline agreements (roadmap)

Added to [OMC_APP_ROADMAP.md](OMC_APP_ROADMAP.md) → Next. What it needs, so confirmed agreements survive dropped
connections and two adults changing the same one:

- **Client-made ids** for new agreements (like calendar events), so a retry never duplicates.
- **A revision per agreement**; edits and removes carry the revision they started from; the server answers
  `conflict` instead of overwriting the other adult.
- **Removes are tombstones** (kept, marked removed), so an offline edit to a removed agreement is surfaced, not lost.
- **An outbox on the phone** (mirrored to native storage like the calendar), pushed in order on reconnect; the screen
  says "saved on this phone, will sync" and names any conflict.
- **Conflict rules:** edit vs edit → server copy kept, the other phone told; edit vs remove → kept removed, told;
  reassign to someone archived meanwhile → refused, told; the same suggestion agreed on two phones → one agreement.

**Because 20261127 isn't applied yet, the cheapest path is to add the id, revision and tombstone columns to it now**
instead of a follow-up migration that changes the same functions' API.

## 4. Family member colors: stability audit

**Every surface uses one function**, `memberColors()` (`src/data/club/family-colors.ts`): the family form, monthly
resources and printables (`personalize/colors.ts`, the August/March/Family Rhythm engines), the meeting guide
generator, the calendar, the cleaning companion's agreements and Family Responsibilities. The only other palette is
`/club-2`, a sales page with made-up families. So on any given day, a person has the same color everywhere.

**But colors aren't stable over time in production.**

- `memberColors` uses saved colors (`preferences.colors`) first, then assigns the rest **by position** (children
  first, family order).
- **Production: 0 of 10 households have saved colors**, so every color is positional.
- So adding a baby, archiving someone, or changing the order **shifts other people's colors**: on screen, in the
  calendar, and between a printed mailer and the next one.
- The fix on this branch is in two places, but neither covers production yet:
  - `pinMemberColors` in the app saves today's colors whenever the family is saved through the new code.
  - 20261124 merges colors instead of replacing them.
  - The website live now doesn't pin. Households that never save again stay positional.

**Required:**
- A one-time pin at deploy. Write each existing household's current colors into `preferences.colors`, by member id,
  computed by the same function, so nothing anyone has printed changes.
  - Do it as a reviewed script that reads the household and writes `preferences.colors` only where it's absent.
  - Never overwrite a color someone chose.
- Ship the pinning client in the same release.

Smaller note: there are 8 marker colors and up to 12 people, so a family of 9 or more repeats colors. Names always
print beside colors, so this is acceptable, but worth knowing.

## Recommended sequence

1. **Now, unchanged plan:** finish the Simulator and Postgres 17 runs.
2. **Decide 20261121–23:** apply them or retire them. Any change to `club_me` depends on this.
3. **Revise 20261127 before approval:** client ids, revisions and tombstones for offline agreements.
4. **Write the household-access migration** (call it 20261128) from production's actual `club_me`. Tests:
   - a partner opens entitled months;
   - a partner sees no billing data or fulfillment controls;
   - a removed partner loses access;
   - after the owner cancels, both adults can only read.
5. **Write the color pin script.** Dry-run it on a copy and report the before/after per household (names hidden) for
   your review.
6. **Apply to production in this order, with your approval at each step:**
   - 20261124 household
   - 20261125 calendar
   - 20261127 agreements (revised)
   - 20261128 household Club access
   - then the color pin, in the same deploy as the new website and app code.
7. **Product, in this order:**
   - the free weekly meeting screen in Family;
   - the Cleaning decision and roadmap update;
   - the premium boundary in copy;
   - the App Store purchase review;
   - then TestFlight.

Steps 3–5 are code-only on the branch; nothing reaches production before step 6, which needs your approval.
