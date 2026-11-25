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

## 2. The system (refinement 2: confident, not washed out)

Owner feedback on the first pass: it was "washed out", read like "a softly styled website", and its icons were too
delicate. Refinement 2 keeps the same structure and raises contrast, color conviction and tactility.

**Color: the calendar palette at full strength where it means something**
- **Interactive color, one only:** a deeper wordmark sage, `#3E7A43` (white text 5.3:1). It carries primary buttons, the main call-to-action card (solid), selection, progress, links and the active tab.
- **The calendar's colors, strengthened:** January frost `#3A7895`, May leaf `#4B8746`, February blush `#BF5D69`, June apricot `#C98B0C`, April lilac `#7357AD`. They appear as solid icon squares in the grouped shortcuts and as strong status words.
- **People:** the saved marker colors as solid discs, and as each person's done check.
- **Month:** the month's own calendar color, at full strength, on the Club conversation card.
- **Text:**
  - near-black `#121614`;
  - secondary `#56605A` (6.3:1 on white);
  - control edges `#8D9792`, so empty checks and toggles are clearly visible.
- **Surfaces:** white plus one neutral gray (`#F1F3F2` and `#E5E9E7`). Solid color only where it should stand out.

**Icons: one bold family**
- Filled silhouettes and heavy rounded strokes on a 24px grid, SF Symbols in spirit (`Art` / `GLYPH` in `src/components/v16/shared.tsx`): house, people, person, ball, bus, lunchbox, chat, car, hanger, trash, music, backpack, calendar, sparkle, book, heart, paw, plate and check.
- Near-black and bare in rows and cards, with no pastel containers.
- White on a solid calendar-color square only in the grouped shortcuts (iOS settings style).
- The same family runs through the tab bar, the header and the account button.
- The soft-color hand-drawn illustrations are **not** in the interface. They're kept for editorial content, monthly kits, printables, onboarding and celebrations (owner direction).
- **Exception kept on purpose:** the Cleaning zone icons are the companion's existing zone artwork (V16 contract §2). Swapping them is an owner decision.

**Type and spacing:**
- Figtree.
- Large title 32–38/800, sections 23/780, row titles 16/600, meta 14.4/500.
- 28px between sections; rows 56px.

**Controls:**
- 54px pill primary buttons, with an inner highlight and a soft colored shadow.
- Neutral secondary buttons, with near-black text.
- Fields have a visible edge and a green focus ring.
- iOS segmented control.
- Press feedback scales controls down slightly.
- Checks and the highlight toggle fill with a small spring.

**Navigation:**
- A compact floating tab bar with bold icons. The active tab is green icon and label on a gray capsule; inactive tabs are near-black.
- Desktop: the same tabs in the header, with content on a white canvas over gray.

**Shortcuts:** a grouped list (icon square, title, detail line, chevron) instead of three equal pale tiles.

**Status:** strong colored words with a dot, never badges.

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
