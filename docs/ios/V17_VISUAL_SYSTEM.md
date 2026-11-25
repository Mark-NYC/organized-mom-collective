# V17: visual system exploration

**Status: experimental, for owner review. Do not merge over `/app`.**

- **What it is:** a visual redesign only. It's the same product, components, engines, data and workflows as V16.
- **Route:** `/preview/organized-family-v17`, unlinked and `noindex`. V16 stays at `/preview/organized-family-v16` for side-by-side comparison.
- **Same demo family, separate state:** both pages run on the same fictional Rivera household, but each keeps its own state in the browser.

**How it's built:** one codebase with a `look` flag (`V16App look="v17"`) and one scoped stylesheet (`src/styles/v17.css`). The only markup that differs between the looks:
- icon tiles on activities, shortcuts, empty states and the meeting invitation;
- a step progress bar in place of the "FAMILY MEETING · n of 4" eyebrow;
- bottom sheets for Rhythm and New event;
- a few explanatory lines hidden.

Every data attribute, state rule and workflow is shared. The same 84-check click-through passes on both versions.

## 1. Audit: what made V16 read as generic

| Pattern | Why it read as "AI-designed" | V17 |
| --- | --- | --- |
| Cream/ivory page with a serif display face | The default "premium editorial" shorthand | White, one soft neutral fill, and **Figtree**: a friendly humanist sans, hierarchy by weight |
| Tiny uppercase tracked eyebrows over every block | Decorative labeling; reads as a template | Sentence-case secondary text, or nothing; a step bar in the meeting |
| Uppercase, letter-spaced buttons | Fashion-catalog styling, not an app | Pill buttons in sentence case: one sage primary, neutral secondary |
| Pills/badges for every status | Badge noise | A colored word with a small dot (Suggested = butter, Agreed = sage, Waiting = blush) |
| Generic line icons for things | Interchangeable with any dashboard | Meaningful icons for each kind of thing (ball, bus, lunchbox, coat hanger…), on soft tiles tinted from the calendar palette. The hand-drawn soft-color illustrations stay with the kid-friendly printables for the fridge (owner, 2026-11-25) |
| Pastel-tinted rounded-square initials | Low contrast, weak identity | Solid discs in each person's **saved marker color**, with a white initial |
| Settings panels pushed inline into the page | Scrolling forms | Native bottom sheets with a grabber, a title and Done |
| Same weight everywhere | No hierarchy | Large title 32–36/760; section 22/720; row 16.5/560; meta 14 |

## 2. The system

**Color (audited from `src/theme.ts`, `global.css`, `family-colors.ts` and the printed calendar artwork):**
- **Interactive color, one only:** sage `#4F7A4A`. That's the wordmark green, deepened so white text clears 4.5:1. It carries primary buttons, selection, links, progress and the tab highlight. Its tint is `#E3EEDF`.
- **People:** the saved family marker colors (`MARKER_COLORS`), unchanged. They appear as avatars, as a person's done check (it fills with their color), and as their handwriting on the paper previews.
- **Things:** icon tiles in the calendar pastels: sky, butter, sage, blush, lilac. Each tint has a darker ink of the same hue.
- **Month:** the current month's calendar color, only on Club/monthly content (the Let's Talk card and the Resources month card).
- **Neutrals:**
  - Page and surfaces: `#FFFFFF`.
  - Fills: `#F3F5F4` for grouping, empty states and fields; `#E9ECEA` for secondary buttons and segmented tracks.
  - Text: `#1F2422`, secondary `#69716D`, hairline `#ECEEED`.

**Type:**
- One family, Figtree Variable (bundled via `@fontsource-variable/figtree`, so it renders the same on every device).
- No serif and no all-caps headings.
- **Wordmark:** "organized family." in sans, with "family." in sage. This is a brand change for the owner to decide.

**Shape and space:**
- Radius 14 on fields, 20–24 on cards and shortcuts, 30 on sheets; pill buttons.
- 22px side gutter. 36px between sections. Touch targets of at least 44px (buttons 46–52).

**Surfaces:**
- Few soft surfaces: the invitation card, the Let's Talk card, empty states and shortcuts.
- Rows sit on white with hairline separators; no nested cards.
- Shadow only on the primary button, the floating tab bar, sheets and paper previews.

**Navigation:**
- **Phone:** a floating translucent tab bar with the two destinations (Today, Family Meeting).
- **Desktop:** the same two tabs as a segmented control in the header, with content on a centered white canvas over the soft neutral.

**States and motion:**
- Selection and completion fill with a small spring (respecting reduced motion).
- Press feedback scales controls down slightly.
- Expanded rows fade in.
- Checks fill with the person's color.
- Cleaning keeps the companion's own rounded-square box and pen tick (owner decision), with a soft sage fill when done.

**Icons (`Art`, in `src/components/v16/shared.tsx`):**
- 16 line glyphs drawn on the same 24px grid, stroke and round caps as the app's interface icons (`ui.tsx`), so the set reads as one family.
- Each sits on a soft tile from the calendar palette, matched to the kind of thing: activities and school on sky and butter, family and home on sage, food and care on blush, conversation and music on lilac.
- The soft-color hand-drawn illustrations are **not** used in the app. They belong to the printables.
- Cleaning lists stay text-only with the companion's own checkboxes.

## 3. Preserved

- Every screen, its order and its content: Today, Plans (Week/Month/Agenda, Add event, connected calendars, private/shared), Cleaning (Daily Reset, all zones, the rhythm options, the weekly move), the four meeting parts, the Week Four check-in, We have a plan, Resources and Account.
- Inline editing in Everyone's Part (still inline, never a sheet).
- Keep vs We agree, durable agreements, and preparation that never auto-highlights.
- The engines: the Club month content, the development decisions (MAWL invisible), recurrence and member colors.
- Both printed calendar previews.
- The demo controls, kept visibly outside the product.

## 4. Evidence

- Screenshots: `docs/ios/screenshots/v17/`. `00-v16-vs-v17.jpg` compares six screens side by side.
- `node scripts/e2e/v16-preview.mjs <url> <dir>`: 84/84 on V17 and 84/84 on V16.

## 5. Open questions for the owner

1. **Wordmark in sans** (shown) vs keeping the serif logo only as the logo.
2. **Sage as the single interactive color** vs a warmer accent from the calendar (for example, rose `#B88A8C`). Sage reads calmer and is already the wordmark color.
3. **Icons next to activities.** They're matched by keyword in the preview; production would need an explicit icon per activity type, or a family-chosen icon.
4. **Dark mode** isn't explored yet.
