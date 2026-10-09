# Blog editorial style

How a resource article should read and look. The short version of the standard; details live in the docs it links to. **HC-01 (`src/content/articles/weekly-cleaning-schedule-for-busy-moms.mdx`) is the reference article.**

Goal: Organized Mom Collective reads like a warm, practical home and family publication: real-life photography, generous whitespace, editorial headings, and advice a busy parent can use tonight. Not a cleaning blog, not documentation, not a sales page.

Related: [BRAND_VOICE.md](BRAND_VOICE.md) · [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md) (structure and components) · [SEO_STRATEGY.md](SEO_STRATEGY.md) · [INTERNAL_LINKING.md](INTERNAL_LINKING.md) · [PINTEREST_STRATEGY.md](PINTEREST_STRATEGY.md).

## Writing rules

- **Start with a real problem.** Open in the moment it bites (Wednesday night, 5 pm, the pickup line), in two to four short sentences.
- **Deliver the useful answer quickly.** The core answer is in the first screen or two on a phone, in bold.
- **Write like a knowledgeable friend.** Warm, direct, calm. "You", never an invented "I". No lecturing, no gushing.
- **Prefer concrete examples.** "Fifteen minutes after dinner" beats "a little time each day". Name the room, the task, the time.
- **Use short paragraphs.** One idea each; one to three sentences on a phone. Use transitions that answer the reader's next question.
- **Keep useful details.** Checklists, times, and the "what if" cases are the point. Cut repetition, not substance.
- **Don't pad.** No generic advice ("consistency is key"), no filler intros, no word-count targets.
- **Write for busy parents, not only search engines.** Keywords appear where they read naturally.
- **Show the bigger benefit.** Where it's true, say how the routine lightens the mental load: fewer decisions, less to remember, work others can pick up.
- **Terminology:** the product is the *wall calendar* plus its *companion website* (or "the cleaning companion"). Never call it an app, and never promise features that don't exist. Verified features: [ARTICLE_FORMAT.md → Product notes](ARTICLE_FORMAT.md#product-notes).
- **Never** invent statistics, studies, testimonials, expertise or personal stories.

## Design rules

- **2–4 relevant photographs** per standard-length article when suitable imagery exists: usually a hero, one or two in the body, and the product photo in the callout. Every image must show something the text is talking about.
- **Instructional diagrams and printable examples** where they add real value (the cleaning week, checklists). Prefer data-driven components over screenshots of text.
- **No long walls of text.** Break them with a heading, a checklist, a photo or a pull quote, not with decoration.
- **Not everything in a box.** Most of the article is plain text on white. Use at most: one Shift (pull quote), one Tip, one product callout, one Next Small Win. Checklists are cards because they're objects to use.
- **Consistent images:** 3:2 landscape for heroes and cards, 5:4 or 3:2 in the body, one corner radius (6px), captions in small soft text.
- **One primary product callout** (`<ProductCTA>`), near the end, where the article naturally leads to it.
- **Relevant internal links** in the body, per [INTERNAL_LINKING.md](INTERNAL_LINKING.md).

### The template does this for you

`src/pages/resources/[slug].astro` gives every article the same editorial frame:

- **Header:** category eyebrow (breadcrumbs), Georgia H1, the `summary` as a deck, byline, date, reading time; centered from tablet up so the article opens like a magazine page.
- **Hero photo** (optional `hero` in frontmatter) at ~960px wide, then a collapsed "In this article" list.
- **Body:** a ~720px reading column (`.article-body`), 17–18px Montserrat in warm charcoal (#3d3834), with wider `.breakout` elements (~960px: the cleaning-week diagram, checklist grids, the product callout).
- **Type scale:** H1 36→58px, H2 28→38px and H3 20→23px, all Georgia bold; H2s get extra space above (64→96px) and sit close to their first paragraph, so sections read as groups.
- **End of article:** Read next (as a feature card) and related cards.

Articles without a hero or components still render cleanly: text-only header, text-only cards on the hub.

Typography: Georgia (the brand's existing serif, used on the printed calendar's month names) for article titles and all headings; Montserrat for body, labels and UI. Warm charcoal `--color-prose` (#3d3834) for article text. The companion website keeps its own Montserrat / #545454 styling.

### Components for the editorial rhythm

All are available in any article without imports (full reference: [ARTICLE_FORMAT.md](ARTICLE_FORMAT.md#visual-elements)).

| Use | Component |
| --- | --- |
| Photo with caption | `<Figure image="name" alt="…" caption="…" size="content \| wide" />` |
| Practical aside, lightly tinted | `<Tip title="…">…</Tip>` |
| Checklist card / side-by-side cards | `<Checklist kicker title time icon items />` (a printed planner sheet: kicker such as the day, serif title), `<ChecklistGrid>…</ChecklistGrid>` |
| The product callout | `<ProductCTA title="…" image="name" alt="…">copy</ProductCTA>` (button: "See the Wall Calendar" → `/calendar`) |
| Pull-quote insight | `<Shift title="…">…</Shift>` |
| Routine / fallback sections | `<RealLifeVersion>`, `<WhenLifeHappens>` |
| Week sizes | `<Versions items />` |
| Cleaning week graphic + print | `<CleaningWeek print />` |
| Closing action | `<NextSmallWin>` |

Plain Markdown is styled too: blockquotes become pull quotes, tables scroll sideways on phones, `---` becomes a short accent rule.

No newsletter block exists, because there's no signup system. Don't add one until there is.

## Photography

### Direction

- Natural daylight; soft, muted, seasonal color (the month colors in `src/theme.ts` are a good guide).
- Real family homes: kitchens, dining tables, living rooms, entryways, laundry spaces. Lived-in, slightly imperfect.
- Candid moments: hands at work, a child helping, a counter mid-reset. Paper calendars, pens, handwritten lists, ordinary household objects.
- **Avoid:** sterile stock, luxury show homes, obvious AI-generated people, staged smiles, excessive beige, decorative images that don't help the article.
- **Product photos are real or absent.** Use the real calendar photos (`design/etsy-listing/`) or real screenshots of the companion website. Never generate or alter product imagery.

### Adding a photo

1. Keep the original untouched (product originals live in `design/etsy-listing/`; put new originals in `design/photography/`).
2. Make responsive files: `python3 scripts/article-image.py SOURCE NAME [--crop l,t,r,b]`. Crop only to frame the photo or remove a text overlay.
3. Register it in `src/data/images.ts` (widths and size are printed by the script).
4. Use it via `hero` in frontmatter, `<Figure>` or `<ProductCTA>`. Write alt text that says what the photo shows.

### Photos we have (all from the real Etsy listing set)

| Name | Shows | Used in |
| --- | --- | --- |
| `hc-01-hero` | A hand writing in the calendar on a kitchen counter | HC-01 hero, hub feature |
| `hc-01-zone-tags` | Close-up of the printed cleaning zone tags | HC-01, zone checklist |
| `hc-01-wall-calendar` | The calendar hanging on a wall in daylight | HC-01 product callout, hub calendar band |

All three are product listing photos. The library needs lifestyle photography that isn't a product shot. (A baking photo from the listing set was used in HC-01's daily reset section and removed: it didn't show cleaning.)

### Shot list (in priority order)

1. **An evening kitchen reset:** counter being wiped, dishwasher open, a dish towel, hands only, warm evening light, an ordinary lived-in kitchen. *Needed now: HC-01 "Why a short daily reset works" has no photo since the baking shot was removed. Add it with `<Figure>` after the Daily Reset checklist. Also for HC-02.*
2. **The calendar on a real family wall:** next to the fridge or in an entry, with school bags, a lunchbox, keys. Lived-in, not staged. *For "Put the routine where everyone can see it", the hub calendar band and FP-02 / FP-03.*
3. **A real screenshot of the companion website's Today checklist** on a phone, beside the calendar. *The listing image with a phone shows an outdated menu (“Tidy”), so it isn't used.*
4. **An entryway being tidied:** shoes paired, coats hung, a bag on a hook. *HC-01 Wednesday zone, HC-03.*
5. **A child helping:** small hands carrying pillows or putting shoes away. *HC-01 adaptations, IF-03 chores.*
6. **The living room five-minute pickup:** throw folded, toys going into a basket. *HC-03, HC-05.*
7. **A Sunday planning moment:** calendar, pens and a coffee on a dining table. *FP-01, FP-04 weekly reset.*
8. **Meal plan and grocery list being written,** fridge door open nearby. *FP-05, FP-06.*
9. **A laundry basket on a made bed.** *HC-01 "What's not on the list" Tip.*
10. **One photo per pillar** for hub cards and pillar pages: a planning table (FP), a calm, lived-in kitchen (HC), a family dinner table or hands holding mugs (IF).

Spec: landscape 3:2 as the default (portrait 4:5 for secondary photos), at least 1,600px wide, natural light, people shown from behind or as hands where possible, model releases for anyone identifiable.

## SEO rules

- Preserve the article's search intent ([SEO_STRATEGY.md](SEO_STRATEGY.md)).
- One clear H1 (the template renders it from `title`); a logical heading hierarchy (H2 sections, H3 within).
- Descriptive `seoTitle`, `description` and `summary`.
- Helpful alt text on every image; decorative images use `alt=""`.
- Natural internal links; no keyword stuffing.
- Never change a published URL (the file name).

## Article quality checklist

Before publishing, every article should answer yes to:

- [ ] Does the opening connect to a real family problem?
- [ ] Can the reader find the practical answer quickly?
- [ ] Is the article visually appealing on a phone and on desktop?
- [ ] Does every image add something?
- [ ] Is the advice achievable in a real week?
- [ ] Does it sound human: a knowledgeable friend, not a manual?
- [ ] Is there a natural next step (Next Small Win, Read next, one product callout)?

Then run the full workflow in [ARTICLE_WORKFLOW.md](ARTICLE_WORKFLOW.md), including `npm run verify`.
