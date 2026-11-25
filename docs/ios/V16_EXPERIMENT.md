# V16 experiment: review notes

**Status: experimental. Do not merge over `/app` until the owner approves.** No migration, no production data, no flag,
billing, RLS or Club-entitlement change.

- **Route:** `/preview/organized-family-v16` (unlinked, `noindex`, no analytics, not in the sitemap, not in the iPhone
  bundle's `shell-routes.json`, no service worker). `/app` is untouched.
- **Data:** the fictional Rivera household already used by the demos and e2e suites (Ana, Luis; Sofia 10, Mateo 7,
  Elena 4). State lives only in this browser (`localStorage` key `omc:v16-preview:v1`). It never reads or writes the
  real account, calendar, agreements or cleaning progress.
- **Preview controls:** the striped, collapsible bar at the top (scenario, Club/free, one/two adults, soccer
  moved/cancelled, offline, reset). Labeled "not in the app"; not product UI.

## Files

| File | What |
| --- | --- |
| `src/pages/preview/organized-family-v16.astro` | The page |
| `src/components/v16/` | `V16App` (shell, routing, demo bar, Resources, Account), `Today`, `Meeting` (4 parts, check-in, summary), `Parts` (row + in-place editor), `Plans`, `Cleaning`, `WallCalendar`, `shared` |
| `src/lib/v16/model.ts` | Every rule as pure functions (state honesty, invalidation, prep follows event, privacy, cleaning moves) |
| `src/lib/v16/demo.ts` | The fictional household and its calendar |
| `src/styles/v16.css` | Layout and rhythm only, on existing `--of-*` tokens |
| `tests/v16-model.test.ts` | 23 unit tests |
| `scripts/e2e/v16-preview.mjs` | 76-check click-through + screenshots → `docs/ios/screenshots/v16/` |

## Reused (real code, not copies)

- **Design system:** `family-app-brand.css` tokens, `.of-btn`, `.of-seg`, `.of-avatar`, `Avatar`, `Icon`, `Chevron` (`src/components/app/ui.tsx`); Georgia titles, Montserrat UI; wordmark as in `Nav.astro`; month color via `monthTints` exactly as `AppLayout` sets it.
- **Member colors:** `memberColors()` over saved `preferences.colors`. Never recolored by month.
- **Club content:** `buildFamilyMeeting()`. Let's Talk shows this month's real theme and questions; Let's Practice shows the month's practice activity; the month's age-fit suggestion appears in Everyone's Part as a proposal.
- **Development engine:** `applyDecision` / `availableDecisions` (records.ts), `coachLine` (language.ts). Stages are stored but never shown.
- **Calendar:** `occurrences`, `weekStart`, `timeLabel`, `repeatLabel` (recurrence.ts); the `external` read-only/visibility model from feeds.ts.
- **Priorities limits:** `SHOWN` (3) and `MAX_PER_WEEK` (5) from `src/lib/app/priorities.ts`.
- **Cleaning:** everything from `src/data/cleaning.ts`: Daily Reset (5), Mon–Thu zones with full task lists, Fri–Sun zones, this month's home project, zone icon artwork.

## Real vs. mocked

| Area | In this preview |
| --- | --- |
| Rules (agree/keep/skip, invalidation, prep dates, privacy filter, priority caps, engine decisions) | **Real logic**, tested |
| Club month content | **Real** (current month) |
| Agreements, event responsibilities, priorities, development records | **Mocked store**: in-memory/localStorage stand-in with the same contracts. Production would use `src/lib/agreements`, `calendar/event-tasks`, `app/priorities`, `family-development/client` |
| Google / iCal | **Mocked sample feeds.** No OAuth. Private/Shared toggles are simulated; the real flow is in `/app/family-calendar` |
| Event moved/cancelled | **Simulated** from the demo bar |
| Two-adult sync, offline, conflicts | **Simulated** "waiting to share" state only; no second device, no real conflict |
| Cleaning checks | **Separate demo keys** shaped like the real ones, so the preview can't overwrite a reviewer's real progress |
| Wall calendars | **HTML schematics** of the two printed layouts (zones as printed), not the print files |

## Scenario trace (all pass: 76/76 browser checks, 23 unit tests)

1. **First meeting, start to finish:** Our Focus → Let's Talk → Everyone's Part → Let's Practice → "We have a plan" → Today.
2. **Thursday soccer → Wednesday "Pack soccer bag"**, labeled Suggested on Today and in Plans, with "Why this?".
3. **In-place edit** of owner, task, finish line and day, on the same step. Done editing ≠ agreement.
4. **Explicit agreement:** Keep → "Kept for discussion"; only *We agree* agrees. Editing an agreement → "Changed · agree again".
5. **On Today:** the agreement sits under Soccer practice in Sofia's purple, on Wednesday, with one checkbox.
6. **One cleaning state:** Mateo's agreed part on Today checks the same Entry/Bathroom task the Cleaning screen shows (and vice versa). Daily Reset count matches.
7. **Wed → Sat move:** the same session (same checks) moves for this week; next week is back on Wednesday; moving back keeps the checks.
8. **Week four:** three earlier agreements stay in force, no re-approval; last meeting's focus carries over, labeled.
9. **Friday field trip** (read-only school calendar) → Thursday "Pack lunch" proposal with its own Keep/Change/Skip/We agree.
10. **Readiness:** "Could Mateo try 'Put shoes and bags away' without help?" Let's try / Keep helping go through the engine. Sofia, who owns hers, isn't asked. "Nothing to practice this time" is always there.
11. **Club conversation and practice:** real November content; a free household gets the full four-part meeting with no Club content and no upsell.
12. **Paper:** optional Weekly/Monthly previews in owner colors. Cleaning isn't copied onto the weekly page (zones are pre-printed). Together / later / another planner.

Also covered: privacy (Luis's private calendar never shown; Ana's marked private and excluded from the meeting; making a feed private hides its prep with a reason), moved/cancelled soccer, Skip leaves the event, offline pending, Come back later resumes, browser Back, one-adult household, 375/430 px with no horizontal scroll, desktop header tabs.

## Deliberate calls (owner to confirm)

1. **Fictional family, not the mockup's names.** The mockup used Mark/Meg/Philip/Andrew. The contract requires a fictional household, so this uses the Riveras. That also proves nothing is hardcoded to "Andrew".
2. **The existing look wins over mockup pixels:** Georgia titles, uppercase `.of-btn`, rounded-square avatars. The mockup shows sans titles, pill buttons and round avatars.
3. **Before the first meeting, Today says "Coming up"** under What matters. The mockup implies soccer was already a priority; the contract forbids automatic highlighting.
4. **Agreeing to an event's preparation puts that event on Today**, so the field-trip lunch shows under its activity. The family's explicit decision triggers it, not curation.
5. **Our Focus lists one-off events first.** A repeating activity joins them only when it has preparation this week (soccer); the rest go under "Our usual week".
6. **Resources is the third shortcut** next to Plans and Cleaning (the contract adds it; the mockup shows two).
7. Older `TWO_TAB_REDESIGN.md` puts the development check-in in Everyone's Part. V16 puts it in Let's Practice, per the contract.

## Gaps before connecting to production

- Wire the mocked stores to the real ones (agreements + `agreedSignature` semantics, event-tasks for trackable prep, priorities, development `decide` RPC). **Keep → We agree as two states needs a field the agreement store doesn't have yet.** That's a migration decision for the owner.
- Real Google/iCal: feed toggles → existing visibility RPCs; moved/cancelled from real refreshes.
- Meeting progress is per-device today (`meeting-progress.ts`); V16's resume is the same.
- Two-device sync and conflict UI weren't exercised (needs the e2e backend).
- The iOS shell wasn't built or run (no simulator here). Safe areas and the keyboard are handled in CSS but not tested on a device.
- Teen-autonomy household and five-priority-week screenshots aren't captured. Both are covered by logic and unit tests.
- Wall previews are schematics; replacing them with the real print components would make them exact.

## Recommendation

**Ready for owner design review; not ready to connect to production data.** The interaction model and every rule
hold up in the click-through. Before wiring:

1. Decide whether "kept for discussion" needs persisting, which would need a migration.
2. Replace the mocked stores one at a time behind a flag, re-running `scripts/e2e/v16-preview.mjs` against the e2e backend.
