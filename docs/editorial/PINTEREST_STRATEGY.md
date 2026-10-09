# Pinterest strategy

Every article ships with a Pinterest plan: three distinct pins that bring the right reader from Pinterest to the article. This document is the standard; the per-article plan uses [templates/pinterest-plan.md](templates/pinterest-plan.md) and is saved as `docs/editorial/pinterest/{ARTICLE_ID}.md`.

Related: [BRAND_VOICE.md](BRAND_VOICE.md) (applies to pin copy too) · [ARTICLE_WORKFLOW.md](ARTICLE_WORKFLOW.md) (when this happens) · [CONTENT_TRACKER.md](CONTENT_TRACKER.md) (plan and pin status) · [SEO_STRATEGY.md](SEO_STRATEGY.md) (Google research, which is separate).

## Why Pinterest, and how it differs from Google

Pinterest is a visual search and saving tool. People search it to plan: routines, checklists, systems, ideas. That fits the Real-Life Reset format well, but the platform behaves differently from Google:

| | Google | Pinterest |
| --- | --- | --- |
| What people want | An answer now | An idea to save and use later, or an answer in a glance |
| What gets clicked | The title and description in results | The image first; the pin title second |
| Phrasing | Questions and problems ("how to catch up on housework") | Often shorter, noun-led, idea-shaped ("cleaning schedule printable", "weekly reset routine") |
| Success | A visit that answers the question | A save, then a visit that delivers what the pin promised |

**Pinterest keyword research is done separately from Google research.** Never assume a phrase that works on Google has the same demand, or the same meaning, on Pinterest. Research both and record each in its own place (the brief for Google, the Pinterest plan for Pinterest).

## Pinterest keyword research

For each article, before writing the pin concepts:

1. **Pinterest search autocomplete.** Type the article's core topic into Pinterest search and record the suggested completions.
2. **Guided search terms.** Record the refinement terms Pinterest shows under the search bar for that query.
3. **Top pins for the query.** Note the formats that dominate (checklists, schedules, infographics, photos, step lists), the promises they make, and what's missing or overpromised.
4. **Pinterest Trends** (trends.pinterest.com), if available in the account's region: record whether the term shows a seasonal pattern (e.g. back-to-school, January resets). Record only what the tool shows; don't extrapolate.
5. **Board names** used by people saving similar pins, as a clue to how savers categorize the idea.

Record in the plan:

- **Primary Pinterest keyword**: the phrase the search-driven pin targets.
- **Secondary search terms**: 3–6 variants found above, used naturally in titles, descriptions and alt text.
- **Evidence**: what you observed (e.g. "appears in autocomplete for 'cleaning schedule'"), with the date checked.

**Never invent search volume, engagement rates, trend percentages, or "this pin went viral" claims.** If a tool doesn't show a number, the plan doesn't contain one. "Observed in autocomplete on 2026-10-09" is evidence; "10K monthly searches" is not, unless a tool showed it and the plan names the tool.

## The three pins

Every article gets exactly three pins, each with a different job. They must be visibly different (layout, color, and image), not three crops of one design.

### 1. Search-driven pin
**Job:** match a Pinterest search and clearly promise the answer.

- The text overlay leads with the primary Pinterest keyword, in plain words: "Weekly Cleaning Schedule for Busy Moms".
- A short supporting line says what's inside: "15 minutes a day + one zone".
- Pin title starts with the keyword.
- Best for: being found in search months after posting.

### 2. Curiosity-driven pin
**Job:** stop the scroll with a truthful hook the article genuinely pays off.

- The hook names a real insight from the article, usually The Shift: "Why your cleaning schedule falls apart by Wednesday".
- The article must answer the hook clearly and early (see curiosity loops in [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md#curiosity-loops)).
- **Truthful only.** No "the secret", "you won't believe", "doctors hate", shock claims, or promises the article doesn't make. If the article's answer would disappoint someone who clicked the hook, rewrite the hook.

### 3. Save-worthy pin
**Job:** be useful on its own, so people save it to come back to.

- A real mini-guide from the article: the checklist, the routine, the week at a glance, the framework (full / short / zero nights).
- Content is copied from the final article, not paraphrased into something new. If the article changes, the pin's content is checked again.
- It must still link to the article and say there's more there ("The full routine + what to do when you miss a day").
- Best for: saves and repeat value.

### Concept rules for all three

- **Based on the finished article**, not the brief or outline. Write the concepts after the article is implemented and verified, and quote its actual headings, checklist items and rules.
- **One promise per pin.** Each promise is delivered in the article, findable without scrolling far.
- **No product-first pins.** Pins sell the idea; the article handles the product mention. A pin may show the real calendar or app only where the article's content is genuinely about it (see "Product imagery").
- **Brand voice applies.** No hype words, guilt, invented claims, or fake testimonials (see [BRAND_VOICE.md](BRAND_VOICE.md#never)).

## Visual identity

Pins use the same identity as the site, the app and the printed calendar. They should feel warm, helpful, approachable and premium: like a page from a well-made planner, not a generic marketing template or an obviously AI-generated image.

### Format

- **Vertical 2:3, 1000 × 1500 px.** Export as PNG (graphics, text-heavy) or high-quality JPG (photographic), sRGB.
- One asset per pin; no carousels or video in the standard plan.

### Color

The print palette from `src/styles/global.css` and the month colors from `src/theme.ts`:

| Role | Color | Hex |
| --- | --- | --- |
| Background | Paper white | `#FFFFFF` |
| Warm backgrounds | Cream / sage wash / blush wash | `#FBF7F1` / `#F1F4EC` / `#F9F0EF` |
| Text and rules | Charcoal ink | `#545454` (secondary: `#727272`, rules `#C8C8C8`) |
| Accent | One month color per pin | e.g. January `#CDDDE1`, May `#D4DFC4`, June `#F1D8A8`, October `#D8B79F` (all 12 in `src/theme.ts`) |

- One accent color per pin, used for a band, a highlight bar or a small block, never for body text.
- Vary the accent and background across an article's three pins (e.g. cream + sage accent, white + clay accent, blush + frost-blue accent), so they read as a family but not as copies.
- No saturated brand-unrelated colors, gradients, neon, or heavy drop shadows.

### Typography

| Level | Font | Use | Size on a 1000 × 1500 canvas |
| --- | --- | --- | --- |
| Eyebrow label | Montserrat SemiBold, spaced capitals (letter-spacing ≈ 0.2em) | Topic or feature name: "THE REAL-LIFE RESET", "CLEANING ROUTINE" | 30–36 px |
| Headline | Montserrat Bold | The promise or hook; 3–8 words | 80–110 px, line height ≈ 1.1 |
| Accent phrase (optional) | Georgia Pro Black Italic (fallback Georgia Bold Italic) | One or two words in the headline, as on the Etsy listing images | Same size as the headline |
| Supporting line | Montserrat Medium | What's inside; one line, two at most | 40–48 px |
| Checklist / steps (save-worthy) | Montserrat Medium, with empty square boxes like the printed calendar | 4–7 items | 38–44 px |
| Brand line | Montserrat SemiBold, spaced capitals | "ORGANIZED MOM COLLECTIVE" | 24–28 px |

- At most two typefaces per pin (Montserrat plus the optional Georgia accent).
- Sentence case or title case for headlines; spaced capitals only for labels and the brand line, as on the calendar.
- Georgia Pro is licensed; use it only where the designer's tool has a valid license, otherwise Georgia.

### Readability on mobile

Most pins are seen small, in a two-column phone feed.

- **The headline must be readable at about a quarter of full size** (≈ 250 px wide). Check by shrinking the export before approving it.
- Headline ≤ 8 words; whole pin ≤ ~40 words, except save-worthy checklists (≤ ~60 words).
- Text sits on flat or very quiet areas: a solid panel, a paper texture, or a blurred part of a photo. Never over busy detail.
- **Contrast:** at least 4.5:1 for all text, aiming for 7:1 on headlines. Charcoal `#545454` on white, cream, or any month color passes; white text only on a solid charcoal panel. Don't put month-color text on white.
- No text smaller than 24 px on the 1000 × 1500 canvas.

### Layout, margins and brand placement

- **Safe margin: 80 px on every side.** Nothing important within 80 px of an edge.
- **Keep the bottom 160 px free of key text**: Pinterest overlays UI (save, menu) near the bottom and corners on some surfaces. The brand line can sit just above that area.
- **Brand:** the Organized Mom Collective badge (`public/brand/omc-badge.png`) at 90–120 px, or the spaced-caps brand line, placed once, top or bottom, within the safe margin. Never stretched, recolored or redrawn. The site URL (`organizedmomcollective.com`) may appear in the brand line.
- Use a clear top-to-bottom hierarchy: eyebrow → headline → supporting line or checklist → brand.

### Visual variety

Across an article's three pins, vary at least two of: layout (text-top / text-panel-center / full checklist), background (photo / paper / color block), accent color, and image subject. Across the library, rotate layouts so a board doesn't look like one pin repeated.

Starting layouts (adapt freely):

| Layout | Best for | Structure |
| --- | --- | --- |
| A. Photo + headline panel | Search-driven | Top 55%: calm real-life photo. Bottom: cream panel with eyebrow, headline, supporting line, brand. |
| B. Big type on color | Curiosity-driven | Solid wash background, oversized two-line headline with one Georgia italic accent word, a thin month-color rule, brand at bottom. |
| C. Planner page | Save-worthy | Paper-white page with ruled lines, eyebrow + title, 4–7 checklist items with empty boxes, a time stamp ("15 MIN") in a thin box like the app's, brand at bottom. |

## Image generation and production

AI image generation is allowed for **backgrounds and scenes only**: a kitchen counter in soft morning light, a tidy entryway, paper textures, a cup of coffee beside a notebook. The plan's prompt for each pin is complete (dimensions, composition, colors, lighting, typography, constraints), but:

- **Text is set in a design tool, not by the image model.** Generate the image with an empty area where text will go, then add the exact overlay text in Figma or Canva with the brand fonts. Image models misspell and distort text; the overlay must match the plan word for word.
- **Never generate the calendar, the app, a phone screen showing the app, or any packaging.** No fake product images, no imitation of the calendar's layout as if it were the real thing.
- **No generated people's faces as the subject.** Hands, a back view, or no people at all. Nothing that looks like a testimonial or a "real customer".
- **Style constraints for every prompt:** natural soft daylight, muted warm palette matching the brand colors, uncluttered, real-looking homes (lived-in, not staged showrooms), no glossy CGI look, no oversaturation, no surreal details, no text, letters, logos or watermarks in the generated image.
- Review generated images at full size for artifacts (warped objects, extra fingers, impossible shadows) before using them. Discard anything that looks generated.

### Product imagery

- The calendar may appear **only** via the real photos in `design/etsy-listing/` (or `public/images/reorder/`), unmodified apart from cropping and resizing. Don't edit the calendar's artwork, its dates or its handwriting.
- The app may appear only as a real screenshot of the current app, showing what it actually does (a zone checklist, the Daily Reset). Don't mock up screens or features it doesn't have.
- If a pin's message doesn't need the product, leave the product out.

## Pin copy

| Field | Rule |
| --- | --- |
| Pin title | Up to 100 characters (Pinterest's limit; check the current limit when publishing). Search-driven: starts with the primary keyword. Others: the hook or the mini-guide name, with a keyword where natural. |
| Description | Up to 500 characters. First sentence restates the promise in plain words with the primary or a secondary keyword; then one sentence on what the article adds (the fallback, the full routine). No hashtag lists, no keyword stuffing, no fake urgency. |
| Alt text | Describes what the image shows and what the text says, for someone who can't see it: "Pin with the heading 'Weekly Cleaning Schedule for Busy Moms' above a cream panel listing Monday Living Room, Tuesday Bedrooms…". Up to 500 characters. |
| Link | The final canonical article URL, `https://organizedmomcollective.com/resources/<slug>`, no tracking parameters unless analytics are set up and documented. |

## Boards

Start with one board per pillar plus a few task boards. Board names are searchable phrases, not clever names. Add boards only when there are enough pins to fill them.

| Board | Pillar | For |
| --- | --- | --- |
| Family Planning & Routines | FP | Calendar, command center, weekly reset |
| Meal Planning for Busy Families | FP | Meal planning, grocery lists, dinner rotation |
| Simple Home Cleaning Routines | HC | All cleaning articles |
| Cleaning Schedules & Checklists | HC | Save-worthy cleaning pins |
| Intentional Family Life | IF | Priorities, gratitude, prayer, self-care, shared work |
| Chores & Shared Responsibilities | IF | Mental load, chores for kids |

Each plan names one recommended board per pin; a pin can also be saved to a second relevant board.

## Publishing sequence

A standard sequence for each article (adjust per plan):

1. **Day 0** (article live and verified): search-driven pin, to the pillar board.
2. **About a week later:** save-worthy pin, to the checklist or task board.
3. **About two weeks later:** curiosity-driven pin, to the pillar board.
4. Seasonal articles (back-to-school, January, spring cleaning): schedule the first pin ahead of the season rather than at publication.

Spacing pins out keeps boards varied; don't publish all three on the same day. Don't re-upload identical images; make a new variation if a pin needs refreshing.

## Assets and status

- **Filenames:** `{ARTICLE_ID}-{pin-type}-1000x1500.{png|jpg}`, pin type `search`, `curiosity` or `save`. Example: `HC-01-save-1000x1500.png`.
- **Storage:** final exports in `design/pinterest/{ARTICLE_ID}/` (source files may live in the design tool). Pins aren't served by the site; don't add them to `public/`.
- **Production status per pin:** `planned` (concept written) → `generated` (image and overlay produced) → `reviewed` (checked against the article, this document and brand voice) → `published` (live on Pinterest, with date).
- The plan file holds each pin's status; [CONTENT_TRACKER.md](CONTENT_TRACKER.md) mirrors it. `npm run check:site` checks that every published article has a complete plan with three pins and that the tracker matches.

## Review checklist (per pin, before `reviewed`)

- [ ] The promise is delivered by the final article, early and clearly.
- [ ] Text overlay matches the plan exactly and has no typos.
- [ ] Headline readable at ≈ 250 px wide; contrast ≥ 4.5:1; nothing in the 80 px margins or bottom 160 px.
- [ ] Brand badge or line present once, unaltered.
- [ ] No generated product, app screen, faces, text artifacts, or misleading imagery.
- [ ] Visibly different from the article's other two pins.
- [ ] Title, description and alt text follow the rules above; no invented numbers.
