# Pinterest strategy

Every article has three strategic Pinterest concepts (search-driven, curiosity-driven, and save-worthy). The default production batch is six finished creative variations, normally two per concept. Existing three-pin plans remain valid; the six-variation batch is a separate production layer until the tracker and validator are updated. This document is the standard; the per-article plan uses [templates/pinterest-plan.md](templates/pinterest-plan.md) and is saved as `docs/editorial/pinterest/{ARTICLE_ID}.md`.

Creative direction: [PINTEREST_CREATIVE_DIRECTION.md](PINTEREST_CREATIVE_DIRECTION.md) governs visual concepts and art direction. Production: [PINTEREST_PRODUCTION.md](PINTEREST_PRODUCTION.md) records the verified workflow and six-variation deliverables. [PINTEREST_QA_CHECKLIST.md](PINTEREST_QA_CHECKLIST.md) defines the release gate.

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

## Three strategic concepts, six production variations

Each article has three distinct *concepts*, each with a different job. Produce six finished variations by default (two search, two curiosity, two save-worthy), subject to source-photo suitability and the article's real content. Build six independent visual ideas before selecting layouts, not six near-identical text swaps. One approved master photo may be reused where it genuinely helps, but different article-grounded scenes, illustrations and typographic reference designs are encouraged when authorized. Keep authentic product artwork locked. For checklists, use the visual treatment that best communicates the actual steps. Never invent checklist steps to fill the design.

**Compatibility:** The existing per-article plan template and `npm run check:site` currently expect exactly three planned concepts. Do not duplicate sections or pretend that six pins are supported by the validator. Keep those three sections as the conceptual plan; track six production variants in a batch manifest or in an optional additional section, pending a separate template/validator update.

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

### Concept rules for every variation

- **Based on the finished article**, not the brief or outline. Write the concepts after the article is implemented and verified, and quote its actual headings, checklist items and rules.
- **One promise per pin.** Each promise is delivered in the article, findable without scrolling far.
- **Product and tool intent:** Advice-led article pins can sell the idea first. Tool and generator pins should clearly identify what the actual tool does and how it helps. Product-focused pins may lead with a verified, accurate product or tool and its real benefit. Never imply unavailable functionality or present generated artwork as the real product.
- **Brand voice applies.** No hype words, guilt, invented claims, or fake testimonials (see [BRAND_VOICE.md](BRAND_VOICE.md#never)).

## Visual identity

Pins use the same identity as the site, the companion website and the printed calendar. They should feel warm, helpful, approachable and premium: like a page from a well-made planner, not a generic marketing template or an obviously AI-generated image.

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
- Vary the accent and background across an article's six pins (e.g. cream + sage accent, white + clay accent, blush + frost-blue accent), so they read as a family but not as copies.
- No saturated brand-unrelated colors, gradients, neon, or heavy drop shadows. Prefer flat, subtle panels instead of gradient overlays; if a transparency treatment is required, it must remain restrained and legible.

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

Across an article's six variations, vary the visual concept, focal point, composition and reading rhythm. A mere color or headline swap is not a distinct creative idea. Across the library, rotate layouts so a board doesn't look like one pin repeated.

Optional layout references only (not required templates): photo-led editorial headline, authentic product in a believable setting, step-by-step reference card, illustrated explanation, or a useful typographic checklist. Select layouts to fit the specific idea. Do not map search/curiosity/save categories to prescribed layouts. Review concepts before batch production.

## Image generation and production

**Preferred workflow:** Develop six distinct article-grounded creative concepts, gain concept approval, create original supporting photography or illustration as authorized, and then composite all final typography and any authentic product artwork with exact deterministic layers. Keep the user-supplied product image unmodified. Generated background scenes can be edited to repair a placeholder, but product art must never be provided to an image model for recreation. See [PINTEREST_PRODUCTION.md](PINTEREST_PRODUCTION.md) for verified methods and their limitations.

- **Creative quality first:** Avoid forcing the same photo and layout across every variant. Supporting scenes may vary by concept; the result should feel like premium, lived-in lifestyle editorial, not six template substitutions.
- **No AI-rendered final product artwork or typography.** Place real screenshots or original printables through compositing. Check physical contact, proportions, shadows, magnets, and hand overlap.
- **Generated faces:** Avoid visible generated faces, including reflections. Frame naturally rather than creating headless-looking crops. Inspect hands, objects and actions for plausibility.
- **Style:** Warm authentic materials, natural daylight, recognizable household life, restrained accents, no fabricated testimonials or misleading product capability.
- **Technical delivery:** Follow [PINTEREST_QA_CHECKLIST.md](PINTEREST_QA_CHECKLIST.md) and reject serious flaws even when dimensions and source pixels verify.

### Product imagery

- The calendar may appear **only** via the real photos in `design/etsy-listing/` (or `public/images/reorder/`), unmodified apart from cropping and resizing. Don't edit the calendar's artwork, its dates or its handwriting.
- The cleaning companion website may appear only as a real screenshot of the current website, showing what it actually does (a zone checklist, the Daily Reset). Don't mock up screens or features it doesn't have.
- If a pin's message doesn't need the product, leave the product out. For a free tool/generator, identify that it is a generator, not only a static printable, when tool customization is the click reason.

## Pin copy

For free tools, distinguish the generator or interactive experience from a static printable. Confirm every claimed customization feature in the live tool. Approval of a visually appealing pin is not approval of inaccurate offer copy.

| Field | Rule |
| --- | --- |
| Pin title | Up to 100 characters (Pinterest's limit; check the current limit when publishing). Search-driven: starts with the primary keyword. Others: the hook or the mini-guide name, with a keyword where natural. |
| Description | Up to 500 characters. First sentence restates the promise in plain words with the primary or a secondary keyword; then one sentence on what the article adds (the fallback, the full routine). No hashtag lists, no keyword stuffing, no fake urgency. |
| Alt text | Describes what the image shows and what the text says, for someone who can't see it: "Pin with the heading 'Weekly Cleaning Schedule for Busy Moms' above a cream panel listing Monday Living Room, Tuesday Bedrooms…". Up to 500 characters. |
| Link | The final canonical article URL, `https://www.organizedmomcollective.com/resources/<slug>`, no tracking parameters unless analytics are set up and documented. |

## Boards

**Source of truth for actual account boards:** [PINTEREST_BOARDS.md](PINTEREST_BOARDS.md). These names were established from the owner's October 19, 2026 Pinterest account screenshot and prior board naming. Consult the registry every batch, and do not use the historical proposed names below in metadata.

| Existing Pinterest board | Primary use |
| --- | --- |
| Meal Planning for Families | Meals, groceries, family food planning |
| Chores & Shared Responsibilities | Chore charts, teaching kids household jobs, shared responsibilities |
| Family Organization Ideas | Calendars, command centers, routine generators, entryway systems |
| Cleaning Schedules for Busy Moms | Weekly/daily cleaning, zones and checklists |
| Mom Life & Mental Load | Sharing household thinking and ownership |
| Weekly Reset Routines | Weekly resets, Sunday planning and preparation |

**All Pins** appears on the profile as a Pinterest aggregate collection; it is not an editorial board to assign in import metadata.

Each pin needs an exact existing board name. Do not create new names in CSVs without the owner's approval. Screenshot card titles can be truncated: check current account spelling when publishing. A pin may additionally be saved to a second relevant board, subject to Pinterest policies.

## Publishing sequence

A standard sequence for each article (adjust per plan):

1. **Day 0** (article live and verified): search-driven pin, to the pillar board.
2. **About a week later:** save-worthy pin, to the checklist or task board.
3. **About two weeks later:** curiosity-driven pin, to the pillar board.
4. Seasonal articles (back-to-school, January, spring cleaning): schedule the first pin ahead of the season rather than at publication.

Spacing pins out keeps boards varied; don't publish all six on the same day. The listed three dates are the initial concept-level schedule; stagger the additional variants after these dates, monitor results, and avoid near-duplicate uploads. Don't re-upload identical images; make a new variation if a pin needs refreshing.

### Seasonal free tools

The free tools on `/resources#free-tools` aren't articles and have no tracker row, but the seasonal ones only earn traffic if their pins go up before the season. Each still needs a plan (three concepts, with six variations as the default production batch, saved as `docs/editorial/pinterest/TOOL-{slug}.md`) before its first-pin date.

| Tool | First pin by | Plan |
| --- | --- | --- |
| New Year Declutter Sprint (`/new-year-declutter`) | Early December, for January searches | Not started (owner to revisit) |

## Assets and status

The **production metadata CSV** described in the playbook is an internal deliverable, not necessarily Pinterest's import format. When bulk publishing is requested, separately verify the platform's current import schema, public hosted image URLs, boards, destination URLs and schedule requirements before generating a Pinterest-ready CSV.

- **Filenames:** `{ARTICLE_ID}-{pin-type}-v{N}-1000x1500.png`, with pin type `search`, `curiosity` or `save` and N = 01/02 within that type. Example: `HC-01-save-v02-1000x1500.png`. Legacy filenames remain accepted for existing three-pin assets.
- **Storage:** final exports in `design/pinterest/{ARTICLE_ID}/` (source files may live in the design tool). Pins aren't served by the site; don't add them to `public/`.
- **Production status per pin:** `planned` (concept written) → `generated` (image and overlay produced) → `reviewed` (checked against the article, this document and brand voice) → `published` (live on Pinterest, with date).
- The existing plan file holds three concept statuses; [CONTENT_TRACKER.md](CONTENT_TRACKER.md) mirrors them. `npm run check:site` checks three concept entries, not six exported variants. Record six-file delivery in the production manifest described in [PINTEREST_PRODUCTION.md](PINTEREST_PRODUCTION.md). Update the validator and plan template explicitly before changing this contract.

## Review checklist (per pin, before `reviewed`)

Use the comprehensive [PINTEREST_QA_CHECKLIST.md](PINTEREST_QA_CHECKLIST.md) for required visual and mechanical sign-off. These are supplementary quick checks.

- [ ] The promise is delivered by the final article, early and clearly.
- [ ] Text overlay matches the plan exactly and has no typos.
- [ ] Headline readable at ≈ 250 px wide; contrast ≥ 4.5:1; nothing in the 80 px margins or bottom 160 px.
- [ ] Brand badge or line present once, unaltered.
- [ ] No generated product art, fabricated UI, visible generated faces, text artifacts, or misleading imagery. Product placement and physical attachments have passed realism review.
- [ ] Distinct headline angle and clearly differentiated treatment from the other variants; no near-duplicate upload.
- [ ] Title, description and alt text follow the rules above; no invented numbers.


## Ongoing Pinterest opportunity research

Use [PINTEREST_RESEARCH_LOOP.md](PINTEREST_RESEARCH_LOOP.md) with the 500-pin master tracker. Research proven search phrases, precise mom/family situations, and a bounded creative experiment (proposed daily 6/3/1). Check competitor pins for useful patterns without copying artwork or inventing performance metrics. Document verified search evidence, differentiated imagery, and a trustworthy landing-page conversion action before commissioning new assets. Existing three strategic concepts and six-variation article planning remain compatible; the 6/3/1 ratio is for batches of ten master-plan pins, **not** a replacement for the per-article plan.
